import {FastifyInstance, FastifyReply, FastifyRequest, RouteHandler}  from "fastify";
import {queryAll} from "../../../../../utils/db.js";

type Get = {
    Params: {
        userid: number;
    };
};

type SuspicionTuple = [number, number];

export interface MetricsRow {
    game_id: number;
    round_id: number;
    leader_userid: string | null;
    mission_participent_userids: string[] | null;
    count_spies_nominated: number | null;
    vote_status: boolean | null;
    mission_status: boolean | null;
    suspicions: Record<string, Record<string, number>> | null;
    players: Record<string, string | null>;
    resistance_win: boolean | null;
    round_index_in_game: number;
}

/**
 * Returns per-round data needed for:
 *   - RoS  (Rate of Sherlock) - suspicion records submitted *by* this player
 *   - RoCD (Rate of "CD") - rounds where this player was leader, excluding round 0
 *   - RoI  (Rate of Illusion) - suspicion records targeting this player + spy count
 *   - RoIF (Rate of Infiltration) - mission_participent_userids & vote_status
 *   - Game counts - total games, wins, losses, games as spy/resistance
 *
 */
const metricsQuery = `
    SELECT
        vr.game_id,
        vr.id AS round_id,
        vr.leader_userid,
        vr.mission_participent_userids,
        vr.count_spies_nominated,
        vr.vote_status,
        vr.mission_status,
        vr.suspicions,
        g.players,
        g.resistance_win,
        ROW_NUMBER() OVER (
        PARTITION BY vr.game_id
        ORDER BY vr.id ASC
    )-1 AS round_index_in_game
    FROM voting_rounds vr
             JOIN games g ON g.id = vr.game_id
    WHERE
        g.players ? $1::text
    ORDER BY vr.game_id, vr.id;`;



const SPY_ROLES = new Set(['spy', 'assassin', 'false-commander', 'deep-cover', 'blind-spy']);

/**
 * Returns the number of spies in a game given the players JSONB object.
 * The players column is a jsonb map of {[userid]: role | null}.
 */
function countSpiesInGame(players: Record<string, string | null>): number {
    return Object.values(players).filter((role) => role !== null && SPY_ROLES.has(role)).length;
}


interface ComplexMetrics {
    counts: {
        /** Total number of finished games this player has played. */
        games: number;
        /** Total number of finished games this player has won. */
        wins: number;
        /** Total number of finished games this player has lost. */
        losses: number;
        /** Number of finished games this player played as Resistance. */
        gamesAsResistance: number;
        /** Number of finished games this player played as Spy. */
        gamesAsSpy: number;
    };
    resistance: {
        /**
         * Lifetime Rate of Sherlock.
         * Measures how good this player is at sussing out a spy over their lifetime.
         * null when the player has never submitted a suspicion vote as Resistance.
         */
        RoS_L: number | null;

        /**
         * Lifetime Rate of "CD".
         * Fraction of spies this player put on their proposed teams while leading (excl. first round).
         * null when the player has never led a non-first round.
         */
        RoCD_L: number | null;
    };
    spy: {
        /**
         * Lifetime Rate of Illusion.
         * Measures how well this player flies under the radar as a spy.
         * null when the player has never played as a spy.
         */
        RoI_L: number | null;

        /**
         * Lifetime Rate of Infiltration.
         * Proportion of times this player was proposed to a team as a spy that they actually went on a mission.
         * null when this player has never been proposed to a team.
         */
        RoIF_L: number | null;
    };
}

export function computeMetrics(userid: string, rounds: MetricsRow[]): ComplexMetrics {
    let totalGames = 0;
    let totalWins = 0;
    let totalGamesAsSpy = 0;
    let totalGamesAsResistance = 0;

    let RoS_G_sum = 0;
    let RoS_game_count = 0;

    let RoCD_numerator = 0;
    let RoCD_denominator = 0;


    const roiByGame = new Map<number, {spyCount: number; totalR: number; userWeightedSum: number}>();

    let RoIF_missions = 0;
    let RoIF_proposals = 0;

    const byGame = new Map<number, MetricsRow[]>();
    for (const row of rounds) {
        if (!byGame.has(row.game_id)) byGame.set(row.game_id, []);
        byGame.get(row.game_id)!.push(row);
    }

    for (const [game_id, gameRounds] of byGame) {
        const players: Record<string, string | null> = gameRounds[0]!.players ?? {};
        const userRole: string | null = players[userid] ?? null;
        const userIsSpy = userRole !== null && SPY_ROLES.has(userRole);
        const spyCount = countSpiesInGame(players);
        const resistance_win: boolean | null = gameRounds[0]!.resistance_win;

        if (resistance_win !== null) {
            const userWon = userIsSpy ? !resistance_win : resistance_win;
            totalGames++;
            if (userWon) totalWins++;
            if (userIsSpy) totalGamesAsSpy++;
            else totalGamesAsResistance++;
        }

        // ROS
        if (!userIsSpy) {
            const V: SuspicionTuple[] = [];
            let roundsWhereUserVoted = 0;

            for (const row of gameRounds) {
                const suspicions: Record<string, Record<string, number>> | null = row.suspicions;
                if (!suspicions) continue;
                const myVotes = suspicions[userid];
                if (!myVotes) continue;

                roundsWhereUserVoted++;

                for (const [targetId, gamma] of Object.entries(myVotes)) {
                    const targetRole = players[targetId] ?? null;
                    const targetIsSpy = targetRole !== null && SPY_ROLES.has(targetRole);
                    const c = targetIsSpy ? 1 : -1;
                    V.push([c, gamma as number]);
                }
            }

            if (V.length > 0) {
                const sum = V.reduce((acc, [c, gamma]) => acc + c * gamma, 0);
                const RoS_G = sum / (5 * spyCount * roundsWhereUserVoted);
                RoS_G_sum += RoS_G;
                RoS_game_count++;
            }
        }

        // RoCD
        if (!userIsSpy) {
            for (const row of gameRounds) {
                if (String(row.leader_userid) !== userid) continue;
                if (Number(row.round_index_in_game) === 0) continue;

                const team: string[] = row.mission_participent_userids ?? [];
                const t = team.length;
                if (t === 0) continue;

                const s = team.filter((id) => {
                    const role = players[id] ?? null;
                    return role !== null && SPY_ROLES.has(role);
                }).length;

                RoCD_numerator += s / t;
                RoCD_denominator++;
            }
        }

        // RoI
        if (userIsSpy) {
            let totalR = 0;
            let userWeightedSum = 0;

            for (const row of gameRounds) {
                const suspicions: Record<string, Record<string, number>> | null = row.suspicions;
                if (!suspicions) continue;

                for (const [, votes] of Object.entries(suspicions)) {
                    for (const [targetId, gamma] of Object.entries(votes)) {
                        totalR++;
                        if (targetId === userid) {
                            userWeightedSum += gamma as number;
                        }
                    }
                }
            }

            roiByGame.set(game_id, { spyCount, totalR, userWeightedSum });
        }

        // RoIF
        if (userIsSpy) {
            for (const row of gameRounds) {
                const team: string[] = row.mission_participent_userids ?? [];
                const wasProposed = team.map(String).includes(userid);
                if (!wasProposed) continue;

                RoIF_proposals++;

                if (row.vote_status === true) {
                    RoIF_missions++;
                }
            }
        }
    }

    // RoI_L
    let RoI_L: number | null = null;
    if (roiByGame.size > 0) {
        let RoI_G_sum = 0;
        for (const { spyCount, totalR, userWeightedSum } of roiByGame.values()) {
            const RoI_G = totalR > 0 ? 1 - (spyCount / (5 * totalR)) * userWeightedSum : 1;
            RoI_G_sum += RoI_G;
        }
        RoI_L = RoI_G_sum / roiByGame.size;
    }

    return {
        counts: {
            games: totalGames,
            wins: totalWins,
            losses: totalGames - totalWins,
            gamesAsResistance: totalGamesAsResistance,
            gamesAsSpy: totalGamesAsSpy,
        },
        resistance: {
            RoS_L: RoS_game_count > 0 ? RoS_G_sum / RoS_game_count : null,
            RoCD_L: RoCD_denominator > 0 ? RoCD_numerator / RoCD_denominator : null,
        },
        spy: {
            RoI_L,
            RoIF_L: RoIF_proposals > 0 ? RoIF_missions / RoIF_proposals : null,
        },
    };
}


export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        const userid = req.params.userid;

        const rounds = await queryAll<MetricsRow>(metricsQuery, [userid.toString()]);

        const metrics = computeMetrics(userid.toString(), rounds);

        rep.code(200).send(metrics);
    } catch (error) {
        console.error(error);
        rep.code(500).send({
            error: 'Something went wrong while computing metrics.'
        });
    }
};


export const get_opts = {
    schema: {
        params: {
            type: 'object',
            properties: {
                userid: {
                    type: 'number',
                    description: 'The userid of the player to compute complex metrics for.'
                }
            },
            required: ['userid']
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    counts: {
                        type: 'object',
                        properties: {
                            games:             {type: 'number', description: 'Total finished games played'},
                            wins:              {type: 'number', description: 'Total finished games won'},
                            losses:            {type: 'number', description: 'Total finished games lost'},
                            gamesAsResistance: {type: 'number', description: 'Finished games played as Resistance'},
                            gamesAsSpy:        {type: 'number', description: 'Finished games played as Spy'},
                        }
                    },
                    resistance: {
                        type: 'object',
                        properties: {
                            RoS_L:  {type: ['number', 'null'], description: 'Lifetime Rate of Sherlock. null if never voted as Resistance'},
                            RoCD_L: {type: ['number', 'null'], description: 'Lifetime Rate of CD. null if never led a non-first round'},
                        }
                    },
                    spy: {
                        type: 'object',
                        properties: {
                            RoI_L:  {type: ['number', 'null'], description: 'Lifetime Rate of Illusion. null if never played as Spy'},
                            RoIF_L: {type: ['number', 'null'], description: 'Lifetime Rate of Infiltration. null if never proposed to a team as Spy'},
                        }
                    }
                }
            }
        }
    }
};

async function routes(fastify: FastifyInstance, _: Object) {
    fastify.get('', get_opts, GET);
}

export default routes;