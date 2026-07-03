import {FastifyInstance, FastifyReply, FastifyRequest, RouteHandler}  from "fastify";
import {queryAll} from "../../../../../utils/db.js";
import {computeRoS_G, computeRoI_G} from "../../../../../game/metrics/perGameComplex.js";
import {TtlCache} from "../../../../../utils/ttlCache.js";

type Get = {
    Params: {
        userid: number;
    };
};

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
    /**
     * Per-player card vote on the mission that this nomination ran. `null`
     * when the vote was rejected (no mission was played) or for legacy rows
     * recorded before the column existed.
     * Read by the points/index pipeline; the lifetime metrics endpoint
     * ignores this field.
     */
    mission_cards?: Record<string, 'success' | 'fail'> | null;
    /**
     * Per-player approve/reject vote for this nomination. The lifetime
     * metrics endpoint doesn't read this; the points pipeline does.
     */
    vote_poll?: Record<string, boolean> | null;
}

/**
 * Returns per-round data needed for:
 *   - RoS  (Rate of Sherlock) - suspicion records submitted *by* this player
 *   - RoP (Rate of Purity) - rounds where this player was leader, excluding round 0.
 *     Fraction of proposed teammates who turned out to be RESISTANCE (i.e. clean),
 *     averaged over all non-first rounds the player led. Higher is better:
 *     1.0 means you never put a spy on a team you led; 0.0 means every teammate
 *     was a spy.
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



export const SPY_ROLES: ReadonlySet<string> = new Set(['spy', 'assassin', 'false-commander', 'deep-cover', 'blind-spy']);

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
    lifetimePoints: {
        /** Sum of player_game_metrics.points for resistance games. */
        resistance: number;
        /** Sum of player_game_metrics.points for spy games. */
        spy: number;
        /** Combined sum of resistance + spy. */
        total: number;
    };
    resistance: {
        /**
         * Lifetime Rate of Sherlock.
         * Measures how good this player is at sussing out a spy over their lifetime.
         * null when the player has never submitted a suspicion vote as Resistance.
         */
        RoS_L: number | null;

        /**
         * Lifetime Rate of Purity.
         * Fraction of spies this player put on their proposed teams while leading (excl. first round).
         * null when the player has never led a non-first round.
         */
        RoP_L: number | null;
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

export function computeMetrics(
    userid: string,
    rounds: MetricsRow[],
    lifetimePoints: { resistance: number; spy: number } = { resistance: 0, spy: 0 },
): ComplexMetrics {
    let totalGames = 0;
    let totalWins = 0;
    let totalGamesAsSpy = 0;
    let totalGamesAsResistance = 0;

    let RoS_G_sum = 0;
    let RoS_game_count = 0;

    let RoP_numerator = 0;
    let RoP_denominator = 0;


    const roiByGame = new Map<number, number>();

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
        const resistance_win: boolean | null = gameRounds[0]!.resistance_win;

        if (resistance_win !== null) {
            const userWon = userIsSpy ? !resistance_win : resistance_win;
            totalGames++;
            if (userWon) totalWins++;
            if (userIsSpy) totalGamesAsSpy++;
            else totalGamesAsResistance++;
        }

        // RoS — lifetime is the average of the per-game RoS. Delegates to
        // the single canonical implementation in perGameComplex.ts (clamped
        // gamma, empty slots skipped, spyCount-normalized divisor) so this
        // endpoint and the per-game endpoint can never disagree.
        if (!userIsSpy) {
            const RoS_G = computeRoS_G(userid, gameRounds);
            if (RoS_G !== null) {
                RoS_G_sum += RoS_G;
                RoS_game_count++;
            }
        }

        // RoP
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

                // Purity = fraction of teammates who were CLEAN
                // (resistance). Higher is better — 1.0 means you never
                // proposed a spy; 0.0 means every teammate was a spy.
                RoP_numerator += (t - s) / t;
                RoP_denominator++;
            }
        }

        // RoI — same unification as RoS: one canonical per-game function.
        // Games with no usable suspicion records return null and are
        // excluded from the lifetime average.
        if (userIsSpy) {
            const RoI_G = computeRoI_G(userid, gameRounds);
            if (RoI_G !== null) roiByGame.set(game_id, RoI_G);
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

    // RoI_L — average of per-game RoI over games where it's defined.
    let RoI_L: number | null = null;
    if (roiByGame.size > 0) {
        let RoI_G_sum = 0;
        for (const RoI_G of roiByGame.values()) RoI_G_sum += RoI_G;
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
        lifetimePoints: {
            resistance: lifetimePoints.resistance,
            spy: lifetimePoints.spy,
            total: lifetimePoints.resistance + lifetimePoints.spy,
        },
        resistance: {
            RoS_L: RoS_game_count > 0 ? RoS_G_sum / RoS_game_count : null,
            RoP_L: RoP_denominator > 0 ? RoP_numerator / RoP_denominator : null,
        },
        spy: {
            RoI_L,
            RoIF_L: RoIF_proposals > 0 ? RoIF_missions / RoIF_proposals : null,
        },
    };
}


const lifetimePointsQuery = `
    SELECT side, COALESCE(SUM(points), 0)::int AS total
    FROM player_game_metrics
    WHERE user_id = $1
    GROUP BY side;
`;

// Lifetime metrics walk a user's entire round history per request; a short
// TTL absorbs bursts (profile page fires several of these at once).
const userMetricsCache = new TtlCache<ComplexMetrics>(30_000);

export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        const userid = req.params.userid;

        const metrics = await userMetricsCache.getOrCompute(String(userid), async () => {
            const [rounds, points] = await Promise.all([
                queryAll<MetricsRow>(metricsQuery, [userid.toString()]),
                queryAll<{ side: 'resistance' | 'spy'; total: number }>(lifetimePointsQuery, [userid]),
            ]);

            const lifetimePoints = { resistance: 0, spy: 0 };
            for (const row of points) {
                if (row.side === 'resistance') lifetimePoints.resistance = Number(row.total);
                else if (row.side === 'spy')   lifetimePoints.spy        = Number(row.total);
            }

            return computeMetrics(userid.toString(), rounds, lifetimePoints);
        });

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
                    lifetimePoints: {
                        type: 'object',
                        properties: {
                            resistance: {type: 'number', description: 'Sum of game points earned as Resistance'},
                            spy:        {type: 'number', description: 'Sum of game points earned as Spy'},
                            total:      {type: 'number', description: 'Combined lifetime points'},
                        }
                    },
                    resistance: {
                        type: 'object',
                        properties: {
                            RoS_L:  {type: ['number', 'null'], description: 'Lifetime Rate of Sherlock. null if never voted as Resistance'},
                            RoP_L: {type: ['number', 'null'], description: 'Lifetime Rate of Purity. null if never led a non-first round'},
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

async function routes(fastify: FastifyInstance, _: object) {
    fastify.get('', get_opts, GET);
}

export default routes;