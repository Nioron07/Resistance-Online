import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { queryAll, queryOne } from "../../../../utils/db.js";

/**
 * GET /api/games/search
 *
 * Filter-driven search across the games table. All filters are optional
 * and AND-combined; if no filters are supplied the endpoint returns the
 * most recent finished games. Pagination is offset-based so the UI can
 * surface a "load more" affordance if the result set is large.
 *
 * Same visibility envelope as the rest of the games API — any
 * authenticated user can search, since the data is shared.
 */

type Get = {
    Querystring: {
        q?: string;
        userid?: number;
        before?: string;
        after?: string;
        winner?: 'resistance' | 'spy';
        outcomeType?: string;
        minPlayers?: number;
        maxPlayers?: number;
        limit?: number;
        offset?: number;
    };
};

interface GameRow {
    id: string | number;
    resistance_win: boolean | null;
    outcome_type: string | null;
    mission_statuses: boolean[] | null;
    start_timestamp: string | null;
    end_timestamp: string;
    count_failed_votes: number | null;
    player_count: number;
}

/**
 * player_count is computed ONCE per row via a LATERAL join and reused by
 * the SELECT list and both min/max filters — previously three separate
 * correlated jsonb_object_keys() subqueries per row, per query.
 */
const ROW_SQL = `
    SELECT
        g.id, g.resistance_win, g.outcome_type, g.mission_statuses,
        g.start_timestamp, g.end_timestamp, g.count_failed_votes,
        pc.player_count
    FROM public.games g
    CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS player_count FROM jsonb_object_keys(g.players)
    ) pc
    WHERE g.end_timestamp IS NOT NULL
      AND ($1::text IS NULL OR EXISTS (
            SELECT 1 FROM public.player_profiles pp
            WHERE pp.username ILIKE $1
              AND g.players ? pp.id::text
          ))
      AND ($2::bigint IS NULL OR g.players ? $2::text)
      AND ($3::timestamptz IS NULL OR g.end_timestamp < $3)
      AND ($4::timestamptz IS NULL OR g.end_timestamp > $4)
      AND ($5::text IS NULL OR (
            ($5 = 'resistance' AND g.resistance_win = TRUE) OR
            ($5 = 'spy'        AND g.resistance_win = FALSE)
          ))
      AND ($6::text IS NULL OR g.outcome_type = $6)
      AND ($7::int IS NULL OR pc.player_count >= $7)
      AND ($8::int IS NULL OR pc.player_count <= $8)
    ORDER BY g.end_timestamp DESC, g.id DESC
    LIMIT $9 OFFSET $10;
`;

const COUNT_SQL = `
    SELECT COUNT(*)::int AS total
    FROM public.games g
    CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS player_count FROM jsonb_object_keys(g.players)
    ) pc
    WHERE g.end_timestamp IS NOT NULL
      AND ($1::text IS NULL OR EXISTS (
            SELECT 1 FROM public.player_profiles pp
            WHERE pp.username ILIKE $1
              AND g.players ? pp.id::text
          ))
      AND ($2::bigint IS NULL OR g.players ? $2::text)
      AND ($3::timestamptz IS NULL OR g.end_timestamp < $3)
      AND ($4::timestamptz IS NULL OR g.end_timestamp > $4)
      AND ($5::text IS NULL OR (
            ($5 = 'resistance' AND g.resistance_win = TRUE) OR
            ($5 = 'spy'        AND g.resistance_win = FALSE)
          ))
      AND ($6::text IS NULL OR g.outcome_type = $6)
      AND ($7::int IS NULL OR pc.player_count >= $7)
      AND ($8::int IS NULL OR pc.player_count <= $8);
`;

export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        // Wrap the substring with %…% server-side rather than asking the client.
        const q = req.query.q ? `%${req.query.q}%` : null;
        const userid = typeof req.query.userid === 'number' ? req.query.userid : null;
        const before = req.query.before ?? null;
        const after  = req.query.after  ?? null;
        const winner = req.query.winner ?? null;
        const outcomeType = req.query.outcomeType ?? null;
        const minPlayers = typeof req.query.minPlayers === 'number' ? req.query.minPlayers : null;
        const maxPlayers = typeof req.query.maxPlayers === 'number' ? req.query.maxPlayers : null;
        const limit = clampLimit(req.query.limit);
        const offset = clampOffset(req.query.offset);

        const baseParams = [q, userid, before, after, winner, outcomeType, minPlayers, maxPlayers];

        const [rows, totalRow] = await Promise.all([
            queryAll<GameRow>(ROW_SQL, [...baseParams, limit, offset]),
            queryOne<{ total: number }>(COUNT_SQL, baseParams),
        ]);

        const data = rows.map(r => ({
            gameid: Number(r.id),
            endTimestamp: r.end_timestamp,
            startTimestamp: r.start_timestamp,
            winner: r.resistance_win === null
                ? null
                : r.resistance_win === true ? 'resistance' : 'spies',
            outcomeType: r.outcome_type,
            playerCount: Number(r.player_count),
            missionStatuses: r.mission_statuses ?? [],
            countFailedVotes: r.count_failed_votes ?? 0,
        }));

        rep.code(200).send({
            rows: data,
            total: totalRow?.total ?? 0,
            limit,
            offset,
        });
    } catch (error) {
        console.error(error);
        rep.code(500).send({ error: 'Something went wrong while searching games.' });
    }
};

function clampLimit(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 50;
    if (n > 200) return 200;
    return Math.floor(n);
}

function clampOffset(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

export const get_opts = {
    schema: {
        querystring: {
            type: 'object',
            properties: {
                q:           { type: 'string', minLength: 1, maxLength: 64 },
                userid:      { type: 'integer', minimum: 1 },
                before:      { type: 'string', format: 'date-time' },
                after:       { type: 'string', format: 'date-time' },
                winner:      { type: 'string', enum: ['resistance', 'spy'] },
                outcomeType: { type: 'string', maxLength: 64 },
                minPlayers:  { type: 'integer', minimum: 5, maximum: 10 },
                maxPlayers:  { type: 'integer', minimum: 5, maximum: 10 },
                limit:       { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                offset:      { type: 'integer', minimum: 0, default: 0 },
            },
        },
    },
};

async function routes(fastify: FastifyInstance, _opts: object) {
    fastify.get('', get_opts, GET);
}

export default routes;
