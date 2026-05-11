import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { queryAll } from "../../../../../utils/db.js";
import {
    computeIndices,
    type WeightingStrategy,
} from "../../../../../game/metrics/indices.js";
import { computeRoS_G, computeRoI_G } from "../../../../../game/metrics/perGameComplex.js";
import { SPY_ROLES, type MetricsRow } from "../../../users/_userid/metrics/index.js";

type Get = {
    Params: { gameid: number };
    Querystring: {
        weighting?: 'uniform' | 'expdecay';
        alpha?: number;
    };
};

interface GameRowResult {
    user_id: string | number;
    side: 'resistance' | 'spy';
    points: number;
    breakdown: Record<string, number>;
    catalog_version: string;
    username: string | null;
    pfp: string | null;
    players: Record<string, string | null>;
    resistance_win: boolean | null;
    outcome_type: string | null;
    end_timestamp: string | null;
    mission_statuses: boolean[] | null;
    count_failed_votes: number | null;
}

interface HistoryRow {
    user_id: string | number;
    side: 'resistance' | 'spy';
    points: number;
    end_timestamp: string;
    game_id: string | number;
}

const GAME_ROW_SQL = `
    SELECT
        pgm.user_id,
        pgm.side,
        pgm.points,
        pgm.breakdown,
        pgm.catalog_version,
        pp.username,
        pp.pfp,
        g.players,
        g.resistance_win,
        g.outcome_type,
        g.end_timestamp,
        g.mission_statuses,
        g.count_failed_votes
    FROM player_game_metrics pgm
    JOIN player_profiles pp ON pp.id = pgm.user_id
    JOIN games g ON g.id = pgm.game_id
    WHERE pgm.game_id = $1
    ORDER BY pgm.user_id ASC;
`;

const HISTORY_SQL = `
    SELECT pgm.user_id, pgm.side, pgm.points, g.end_timestamp, g.id AS game_id
    FROM player_game_metrics pgm
    JOIN games g ON g.id = pgm.game_id
    WHERE pgm.user_id = ANY($1::bigint[])
      AND g.end_timestamp IS NOT NULL
    ORDER BY pgm.user_id ASC, g.end_timestamp ASC, g.id ASC;
`;

const ROUNDS_SQL = `
    SELECT
        vr.game_id,
        vr.id AS round_id,
        vr.leader_userid,
        vr.mission_participent_userids,
        vr.count_spies_nominated,
        vr.vote_status,
        vr.mission_status,
        vr.suspicions,
        vr.mission_cards,
        vr.vote_poll,
        g.players,
        g.resistance_win,
        ROW_NUMBER() OVER (PARTITION BY vr.game_id ORDER BY vr.id ASC) - 1 AS round_index_in_game
    FROM voting_rounds vr
    JOIN games g ON g.id = vr.game_id
    WHERE vr.game_id = $1
    ORDER BY vr.id ASC;
`;

interface IndexTriple {
    rIndex: number | null;
    sIndex: number | null;
    pIndex: number | null;
}

/**
 * "Simple" per-game stats derived from the per-round table. These are
 * counts, not ratios — they're cheap to compute and make the EndState
 * useful even when the complex metric is null.
 */
interface PerPlayerStats {
    /** Times this player was named on a nomination (proposed for a mission). */
    timesNominated:       number;
    /** Times this player actually went on a mission (nomination approved). */
    missionsParticipated: number;
    /** Times this player led a nomination. */
    timesLed:             number;
    /** Approve / reject vote counts on nominations. */
    timesApproved:        number;
    timesRejected:        number;
    /** Mission cards this player played (post-mission_cards migration). */
    successCardsPlayed:   number;
    failCardsPlayed:      number;
}

interface PerPlayer {
    userid: number;
    username: string | null;
    pfp: string | null;
    role: string;
    side: 'resistance' | 'spy';
    points: number;
    breakdown: Record<string, number>;
    catalogVersion: string;
    /** Per-game complex metric: RoS_G if resistance, RoI_G if spy. Null if not applicable. */
    complexMetric: { key: 'RoS_G' | 'RoI_G'; value: number | null };
    stats: PerPlayerStats;
    indexBefore: IndexTriple;
    indexAfter:  IndexTriple;
    indexDelta:  IndexTriple;
}

function computePerPlayerStats(userid: string, rounds: MetricsRow[]): PerPlayerStats {
    let timesNominated = 0;
    let missionsParticipated = 0;
    let timesLed = 0;
    let timesApproved = 0;
    let timesRejected = 0;
    let successCardsPlayed = 0;
    let failCardsPlayed = 0;

    for (const r of rounds) {
        // Leadership
        if (r.leader_userid !== null && String(r.leader_userid) === userid) {
            timesLed++;
        }
        // Team participation
        const team = (r.mission_participent_userids ?? []).map(String);
        if (team.includes(userid)) {
            timesNominated++;
            if (r.vote_status === true) missionsParticipated++;
        }
        // Vote ballot — only counted when the row actually has poll data.
        const vote = r.vote_poll?.[userid];
        if (vote === true)  timesApproved++;
        else if (vote === false) timesRejected++;
        // Mission cards (only present on approved-then-played rounds).
        const card = r.mission_cards?.[userid];
        if (card === 'success') successCardsPlayed++;
        else if (card === 'fail') failCardsPlayed++;
    }

    return {
        timesNominated,
        missionsParticipated,
        timesLed,
        timesApproved,
        timesRejected,
        successCardsPlayed,
        failCardsPlayed,
    };
}

export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        const gameid = req.params.gameid;
        const strategy = req.query.weighting ?? 'expdecay';
        const alpha = typeof req.query.alpha === 'number' ? req.query.alpha : 0.95;
        const weighting: WeightingStrategy = strategy === 'uniform'
            ? { strategy: 'uniform' }
            : { strategy: 'expdecay', alpha };

        const gameRows = await queryAll<GameRowResult>(GAME_ROW_SQL, [gameid]);
        if (gameRows.length === 0) {
            rep.code(404).send({ error: `No metrics found for game ${gameid}` });
            return;
        }

        // Game-level summary comes from any row (all share the join to `games`).
        const head = gameRows[0]!;
        const endTimestamp = head.end_timestamp;

        const userids = gameRows.map(r => Number(r.user_id));

        const [historyRows, roundsRows] = await Promise.all([
            queryAll<HistoryRow>(HISTORY_SQL, [userids]),
            queryAll<MetricsRow>(ROUNDS_SQL, [gameid]),
        ]);

        // Bucket history by user_id for fast lookup.
        const historyByUser = new Map<number, HistoryRow[]>();
        for (const h of historyRows) {
            const id = Number(h.user_id);
            const list = historyByUser.get(id) ?? [];
            list.push(h);
            historyByUser.set(id, list);
        }

        const players: PerPlayer[] = [];
        let resistanceTotal = 0;
        let spyTotal = 0;

        for (const row of gameRows) {
            const userid = Number(row.user_id);
            const role = head.players[String(userid)] ?? '';
            const side = SPY_ROLES.has(role) ? 'spy' : 'resistance';
            if (side === 'resistance') resistanceTotal += row.points;
            else                       spyTotal       += row.points;

            const history = historyByUser.get(userid) ?? [];
            const before = computeIndices(
                history.filter(h => endTimestamp === null ? false : h.end_timestamp < endTimestamp).map(toPointsRow),
                weighting,
            );
            const after = computeIndices(
                history.filter(h => endTimestamp === null ? true : h.end_timestamp <= endTimestamp).map(toPointsRow),
                weighting,
            );

            const complexMetric = side === 'resistance'
                ? { key: 'RoS_G' as const, value: computeRoS_G(String(userid), roundsRows) }
                : { key: 'RoI_G' as const, value: computeRoI_G(String(userid), roundsRows) };

            players.push({
                userid,
                username: row.username,
                pfp: row.pfp,
                role,
                side,
                points: row.points,
                breakdown: row.breakdown,
                catalogVersion: row.catalog_version,
                complexMetric,
                stats: computePerPlayerStats(String(userid), roundsRows),
                indexBefore: pickTriple(before),
                indexAfter:  pickTriple(after),
                indexDelta:  triplDelta(pickTriple(before), pickTriple(after)),
            });
        }

        rep.code(200).send({
            gameid: Number(gameid),
            endTimestamp,
            outcome: {
                winner: head.resistance_win === null
                    ? null
                    : head.resistance_win === true ? 'resistance' : 'spies',
                outcomeType: head.outcome_type,
                missionStatuses: head.mission_statuses ?? [],
                countFailedVotes: head.count_failed_votes ?? 0,
            },
            teams: {
                resistance: {
                    totalPoints: resistanceTotal,
                    players: players.filter(p => p.side === 'resistance'),
                },
                spy: {
                    totalPoints: spyTotal,
                    players: players.filter(p => p.side === 'spy'),
                },
            },
            details: {
                weighting: weighting.strategy === 'expdecay'
                    ? { strategy: 'expdecay', alpha: clampAlphaForResponse(weighting.alpha) }
                    : { strategy: 'uniform' },
                catalogVersion: head.catalog_version,
            },
        });
    } catch (error) {
        console.error(error);
        rep.code(500).send({ error: 'Something went wrong while computing game metrics.' });
    }
};

function toPointsRow(h: HistoryRow): { side: 'resistance' | 'spy'; points: number } {
    return { side: h.side, points: Number(h.points) };
}

function pickTriple(r: { rIndex: number | null, sIndex: number | null, pIndex: number | null }): IndexTriple {
    return { rIndex: r.rIndex, sIndex: r.sIndex, pIndex: r.pIndex };
}

function triplDelta(before: IndexTriple, after: IndexTriple): IndexTriple {
    return {
        rIndex: subOrNull(after.rIndex, before.rIndex),
        sIndex: subOrNull(after.sIndex, before.sIndex),
        pIndex: subOrNull(after.pIndex, before.pIndex),
    };
}

function subOrNull(a: number | null, b: number | null): number | null {
    if (a === null && b === null) return null;
    return (a ?? 0) - (b ?? 0);
}

function clampAlphaForResponse(alpha: number): number {
    if (!Number.isFinite(alpha)) return 1;
    if (alpha < 0) return 0;
    if (alpha > 1) return 1;
    return alpha;
}

export const get_opts = {
    schema: {
        params: {
            type: 'object',
            properties: {
                gameid: { type: 'number', description: 'The game id.' },
            },
            required: ['gameid'],
        },
        querystring: {
            type: 'object',
            properties: {
                weighting: {
                    type: 'string',
                    enum: ['uniform', 'expdecay'],
                    default: 'expdecay',
                },
                alpha: { type: 'number', default: 0.95, minimum: 0, maximum: 1 },
            },
        },
    },
};

async function routes(fastify: FastifyInstance, _opts: object) {
    fastify.get('', get_opts, GET);
}

export default routes;
