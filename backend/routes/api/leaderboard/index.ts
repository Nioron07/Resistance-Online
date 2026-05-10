import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { queryAll } from "../../../utils/db.js";
import {
    computeIndices,
    type WeightingStrategy,
    type PointsRow,
} from "../../../game/metrics/indices.js";

type Metric = 'pIndex' | 'rIndex' | 'sIndex' | 'lifetimePoints';

type Get = {
    Querystring: {
        metric?: Metric;
        limit?: number;
        weighting?: 'uniform' | 'expdecay';
        alpha?: number;
    };
};

interface IndexRow {
    user_id: string | number;
    side: 'resistance' | 'spy';
    points: number;
    end_timestamp: string;
    username: string | null;
    pfp: string | null;
}

interface LifetimePointsRow {
    user_id: string | number;
    total: number;
    games: number;
    username: string | null;
    pfp: string | null;
}

const INDEX_SQL = `
    SELECT pgm.user_id, pgm.side, pgm.points, g.end_timestamp,
           pp.username, pp.pfp
    FROM player_game_metrics pgm
    JOIN games g ON g.id = pgm.game_id
    JOIN player_profiles pp ON pp.id = pgm.user_id
    WHERE g.end_timestamp IS NOT NULL
      AND (g.outcome_type IS NULL OR g.outcome_type <> 'forfeit')
    ORDER BY pgm.user_id ASC, g.end_timestamp ASC, g.id ASC;
`;

const LIFETIME_SQL = `
    SELECT pgm.user_id,
           COALESCE(SUM(pgm.points), 0)::int AS total,
           COUNT(*)::int                     AS games,
           pp.username, pp.pfp
    FROM player_game_metrics pgm
    JOIN games g ON g.id = pgm.game_id
    JOIN player_profiles pp ON pp.id = pgm.user_id
    WHERE g.end_timestamp IS NOT NULL
      AND (g.outcome_type IS NULL OR g.outcome_type <> 'forfeit')
    GROUP BY pgm.user_id, pp.username, pp.pfp
    ORDER BY total DESC, games DESC, pgm.user_id ASC
    LIMIT $1;
`;

interface OutRow {
    rank: number;
    userid: number;
    username: string | null;
    pfp: string | null;
    value: number;
    games: number;
}

export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        const metric = (req.query.metric ?? 'pIndex') as Metric;
        if (!['pIndex', 'rIndex', 'sIndex', 'lifetimePoints'].includes(metric)) {
            rep.code(400).send({ error: `Unknown metric '${metric}'` });
            return;
        }

        const limit = clampLimit(req.query.limit);
        const strategy = req.query.weighting ?? 'expdecay';
        const alpha = typeof req.query.alpha === 'number' ? req.query.alpha : 0.95;
        const weighting: WeightingStrategy = strategy === 'uniform'
            ? { strategy: 'uniform' }
            : { strategy: 'expdecay', alpha };

        let rows: OutRow[];
        if (metric === 'lifetimePoints') {
            const dbRows = await queryAll<LifetimePointsRow>(LIFETIME_SQL, [limit]);
            rows = dbRows.map((r, i) => ({
                rank: i + 1,
                userid: Number(r.user_id),
                username: r.username,
                pfp: r.pfp,
                value: Number(r.total),
                games: Number(r.games),
            }));
        } else {
            const all = await queryAll<IndexRow>(INDEX_SQL);
            rows = computeIndexLeaderboard(all, metric, weighting, limit);
        }

        rep.code(200).send({
            metric,
            weighting: weighting.strategy === 'expdecay'
                ? { strategy: 'expdecay', alpha: weighting.alpha }
                : { strategy: 'uniform' },
            rows,
        });
    } catch (error) {
        console.error(error);
        rep.code(500).send({ error: 'Something went wrong while computing the leaderboard.' });
    }
};

function computeIndexLeaderboard(
    rows: IndexRow[],
    metric: 'pIndex' | 'rIndex' | 'sIndex',
    weighting: WeightingStrategy,
    limit: number,
): OutRow[] {
    interface Bucket { username: string | null; pfp: string | null; points: PointsRow[] }
    const byUser = new Map<number, Bucket>();
    for (const r of rows) {
        const id = Number(r.user_id);
        let b = byUser.get(id);
        if (!b) {
            b = { username: r.username, pfp: r.pfp, points: [] };
            byUser.set(id, b);
        }
        b.points.push({ side: r.side, points: Number(r.points) });
    }

    const scored: OutRow[] = [];
    for (const [userid, b] of byUser) {
        const indices = computeIndices(b.points, weighting);
        const v = metric === 'pIndex' ? indices.pIndex
                : metric === 'rIndex' ? indices.rIndex
                : indices.sIndex;
        if (v === null) continue;
        scored.push({
            rank: 0, // filled after sort
            userid,
            username: b.username,
            pfp: b.pfp,
            value: v,
            games: b.points.length,
        });
    }

    scored.sort((a, b) => b.value - a.value || b.games - a.games || a.userid - b.userid);
    const top = scored.slice(0, limit);
    for (let i = 0; i < top.length; i++) top[i]!.rank = i + 1;
    return top;
}

function clampLimit(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 50;
    if (n > 200) return 200;
    return Math.floor(n);
}

export const get_opts = {
    schema: {
        querystring: {
            type: 'object',
            properties: {
                metric: {
                    type: 'string',
                    enum: ['pIndex', 'rIndex', 'sIndex', 'lifetimePoints'],
                    default: 'pIndex',
                },
                limit: { type: 'number', default: 50, minimum: 1, maximum: 200 },
                weighting: { type: 'string', enum: ['uniform', 'expdecay'], default: 'expdecay' },
                alpha: { type: 'number', default: 0.95, minimum: 0, maximum: 1 },
            },
        },
    },
};

async function routes(fastify: FastifyInstance, _opts: object) {
    fastify.get('', get_opts, GET);
}

export default routes;
