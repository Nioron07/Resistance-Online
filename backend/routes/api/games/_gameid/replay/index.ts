import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { queryAll, queryOne } from "../../../../../utils/db.js";
import { SPY_ROLES, type MetricsRow } from "../../../users/_userid/metrics/index.js";
import { computeEvalSeries } from "../../../../../game/metrics/evalSeries.js";

/**
 * GET /api/games/:gameid/replay
 *
 * Returns the full action timeline for a finished (or in-progress) game,
 * shaped for client-side stepper rendering. All round-by-round evidence
 * is already persisted in `voting_rounds`; this endpoint reshapes it
 * into one chronological array with mission/attempt indices derived
 * server-side, plus the player roster with roles revealed.
 *
 * The visibility envelope matches /api/games/:gameid/metrics — any
 * authenticated user can view any game's replay (same as EndState).
 */

type Get = {
    Params: { gameid: number };
};

interface GameHeaderRow {
    id: string | number;
    players: Record<string, string | null>;
    resistance_win: boolean | null;
    outcome_type: string | null;
    mission_statuses: boolean[] | null;
    start_timestamp: string | null;
    end_timestamp: string | null;
}

interface RoundRow {
    round_id: string | number;
    leader_userid: string | number | null;
    mission_participent_userids: Array<string | number> | null;
    count_spies_nominated: number | null;
    vote_poll: Record<string, boolean> | null;
    vote_status: boolean | null;
    mission_status: boolean | null;
    mission_cards: Record<string, 'success' | 'fail'> | null;
    suspicions: Record<string, Record<string, number>> | null;
}

interface ProfileRow {
    id: string | number;
    username: string | null;
    pfp: string | null;
}

const GAME_HEADER_SQL = `
    SELECT id, players, resistance_win, outcome_type, mission_statuses,
           start_timestamp, end_timestamp
    FROM games
    WHERE id = $1;
`;

const ROUNDS_SQL = `
    SELECT vr.id AS round_id,
           vr.leader_userid,
           vr.mission_participent_userids,
           vr.count_spies_nominated,
           vr.vote_poll,
           vr.vote_status,
           vr.mission_status,
           vr.mission_cards,
           vr.suspicions
    FROM voting_rounds vr
    WHERE vr.game_id = $1
    ORDER BY vr.id ASC;
`;

const PROFILES_SQL = `
    SELECT id, username, pfp
    FROM player_profiles
    WHERE id = ANY($1::bigint[]);
`;

interface ReplayPlayer {
    userid: number;
    username: string | null;
    pfp: string | null;
    role: string;
    side: 'resistance' | 'spy';
}

interface ReplayRound {
    roundId: number;
    /** 1..5 — which mission this nomination belongs to. */
    missionIndex: number;
    /** 1..N — attempt index within the current mission. Resets to 1 when a mission resolves. */
    nominationAttempt: number;
    leaderUserid: number | null;
    team: number[];
    countSpiesNominated: number | null;
    votePoll: Record<string, boolean> | null;
    voteStatus: boolean | null;
    /** Populated only on the approved attempt that actually ran a mission. */
    missionStatus: boolean | null;
    missionCards: Record<string, 'success' | 'fail'> | null;
    /** Suspicions submitted at the end of this round (after the mission). */
    suspicions: Record<string, Record<string, number>> | null;
}

export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        const gameid = req.params.gameid;

        const header = await queryOne<GameHeaderRow>(GAME_HEADER_SQL, [gameid]);
        if (!header) {
            rep.code(404).send({ error: `No game found for id ${gameid}` });
            return;
        }

        const [roundRows, profiles] = await Promise.all([
            queryAll<RoundRow>(ROUNDS_SQL, [gameid]),
            queryAll<ProfileRow>(PROFILES_SQL, [Object.keys(header.players).map(Number)]),
        ]);

        // Index profiles by userid for O(1) lookup while walking rounds.
        const profileByUserid = new Map<number, ProfileRow>();
        for (const p of profiles) profileByUserid.set(Number(p.id), p);

        const players: ReplayPlayer[] = [];
        for (const [useridStr, role] of Object.entries(header.players)) {
            const userid = Number(useridStr);
            const profile = profileByUserid.get(userid);
            const roleStr = role ?? '';
            players.push({
                userid,
                username: profile?.username ?? null,
                pfp: profile?.pfp ?? null,
                role: roleStr,
                side: SPY_ROLES.has(roleStr) ? 'spy' : 'resistance',
            });
        }
        // Stable order by userid keeps the identity step deterministic.
        players.sort((a, b) => a.userid - b.userid);

        // Derive missionIndex/nominationAttempt by walking ordered rounds.
        // A mission resolves when mission_status is non-null on a row —
        // after that, the next row starts the next mission at attempt 1.
        const rounds: ReplayRound[] = [];
        let mission = 1;
        let attempt = 1;
        for (const r of roundRows) {
            const team = (r.mission_participent_userids ?? []).map(Number);
            rounds.push({
                roundId: Number(r.round_id),
                missionIndex: mission,
                nominationAttempt: attempt,
                leaderUserid: r.leader_userid === null ? null : Number(r.leader_userid),
                team,
                countSpiesNominated: r.count_spies_nominated,
                votePoll: r.vote_poll,
                voteStatus: r.vote_status,
                missionStatus: r.mission_status,
                missionCards: r.mission_cards,
                suspicions: r.suspicions,
            });
            if (r.mission_status !== null) {
                mission++;
                attempt = 1;
            } else {
                attempt++;
            }
        }

        // Eval-bar series: reshape the round rows into the MetricsRow form
        // the point engine expects (per-round data + game-level players/win)
        // and compute the cumulative team point differential.
        const metricsRows: MetricsRow[] = roundRows.map((r, i) => ({
            game_id: Number(header.id),
            round_id: Number(r.round_id),
            leader_userid: r.leader_userid === null ? null : String(r.leader_userid),
            mission_participent_userids: (r.mission_participent_userids ?? []).map(String),
            count_spies_nominated: r.count_spies_nominated,
            vote_status: r.vote_status,
            mission_status: r.mission_status,
            suspicions: r.suspicions,
            players: header.players,
            resistance_win: header.resistance_win,
            round_index_in_game: i,
            mission_cards: r.mission_cards,
            vote_poll: r.vote_poll,
        }));
        const evalSeries = computeEvalSeries(metricsRows);

        // Pad mission_statuses to length 5 so the frontend's MissionTracker
        // always has the expected shape, regardless of how many missions
        // actually ran.
        const statuses: Array<boolean | null> = [];
        const src = header.mission_statuses ?? [];
        for (let i = 0; i < 5; i++) statuses.push(src[i] ?? null);

        rep.code(200).send({
            gameid: Number(header.id),
            startTimestamp: header.start_timestamp,
            endTimestamp: header.end_timestamp,
            outcome: {
                winner: header.resistance_win === null
                    ? null
                    : header.resistance_win === true ? 'resistance' : 'spies',
                outcomeType: header.outcome_type,
                missionStatuses: statuses,
            },
            players,
            rounds,
            evalSeries,
        });
    } catch (error) {
        console.error(error);
        rep.code(500).send({ error: 'Something went wrong while loading the game replay.' });
    }
};

export const get_opts = {
    schema: {
        params: {
            type: 'object',
            properties: {
                gameid: { type: 'number', description: 'The game id.' },
            },
            required: ['gameid'],
        },
    },
};

async function routes(fastify: FastifyInstance, _opts: object) {
    fastify.get('', get_opts, GET);
}

export default routes;
