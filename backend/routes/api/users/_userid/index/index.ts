import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { queryAll } from "../../../../../utils/db.js";
import {
    computeIndices,
    computeIndexHistory,
    type WeightingStrategy,
} from "../../../../../game/metrics/indices.js";

type Get = {
    Params: { userid: number };
    Querystring: {
        weighting?: 'uniform' | 'expdecay';
        alpha?: number;
    };
};

interface PointsQueryRow {
    game_id: string | number;
    side: 'resistance' | 'spy';
    points: number;
    end_timestamp: string;
    catalog_version: string;
    computed_at: string;
}

const pointsQuery = `
    SELECT pgm.game_id, pgm.side, pgm.points, pgm.catalog_version, pgm.computed_at, g.end_timestamp
    FROM player_game_metrics pgm
    JOIN games g ON g.id = pgm.game_id
    WHERE pgm.user_id = $1
      AND g.end_timestamp IS NOT NULL
    ORDER BY g.end_timestamp ASC, g.id ASC;
`;

export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        const userid = req.params.userid;

        const strategy = req.query.weighting ?? 'expdecay';
        const alpha = typeof req.query.alpha === 'number' ? req.query.alpha : 0.95;

        const weighting: WeightingStrategy = strategy === 'uniform'
            ? { strategy: 'uniform' }
            : { strategy: 'expdecay', alpha };

        const rows = await queryAll<PointsQueryRow>(pointsQuery, [userid]);

        const result = computeIndices(rows, weighting);

        // Per-game index trajectory for the profile rating chart.
        const history = computeIndexHistory(
            rows.map(r => ({
                gameid: Number(r.game_id),
                endTimestamp: r.end_timestamp,
                side: r.side,
                points: Number(r.points),
            })),
            weighting,
        );

        // Most-common catalog version among the rows used (helps consumers
        // know which catalog the indices reflect).
        let catalogVersion: string | null = null;
        let asOf: string | null = null;
        if (rows.length > 0) {
            const counts = new Map<string, number>();
            for (const r of rows) {
                counts.set(r.catalog_version, (counts.get(r.catalog_version) ?? 0) + 1);
                if (asOf === null || r.computed_at > asOf) asOf = r.computed_at;
            }
            let best = '';
            let bestN = -1;
            for (const [v, n] of counts) {
                if (n > bestN) { best = v; bestN = n; }
            }
            catalogVersion = best;
        }

        rep.code(200).send({
            rIndex: result.rIndex,
            sIndex: result.sIndex,
            pIndex: result.pIndex,
            history,
            details: {
                resistanceGames: result.resistanceGames,
                spyGames: result.spyGames,
                weighting: weighting.strategy === 'expdecay'
                    ? { strategy: 'expdecay', alpha: clampAlphaForResponse(weighting.alpha) }
                    : { strategy: 'uniform' },
                catalogVersion,
                asOf,
            },
        });
    } catch (error) {
        console.error(error);
        rep.code(500).send({ error: 'Something went wrong while computing indices.' });
    }
};

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
                userid: { type: 'number', description: 'The userid to compute indices for.' },
            },
            required: ['userid'],
        },
        querystring: {
            type: 'object',
            properties: {
                weighting: {
                    type: 'string',
                    enum: ['uniform', 'expdecay'],
                    default: 'expdecay',
                },
                alpha: {
                    type: 'number',
                    description: 'Recency-decay base for expdecay (0..1). Default 0.95.',
                    default: 0.95,
                    minimum: 0,
                    maximum: 1,
                },
            },
        },
    },
};

async function routes(fastify: FastifyInstance, _opts: object) {
    fastify.get('', get_opts, GET);
}

export default routes;
