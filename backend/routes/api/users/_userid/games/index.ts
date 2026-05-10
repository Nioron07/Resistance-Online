import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { queryAll, queryOne } from "../../../../../utils/db.js";
import { SPY_ROLES } from "../metrics/index.js";

type Get = {
    Params: { userid: number };
    Querystring: {
        limit?: number;
        offset?: number;
    };
};

interface GameLogRow {
    game_id: string | number;
    side: 'resistance' | 'spy';
    role: string;
    points: number;
    end_timestamp: string;
    outcome_type: string | null;
    mission_statuses: boolean[] | null;
    resistance_win: boolean | null;
    players: Record<string, string | null>;
}

const GAMES_SQL = `
    SELECT
        pgm.game_id,
        pgm.side,
        pgm.points,
        g.end_timestamp,
        g.outcome_type,
        g.mission_statuses,
        g.resistance_win,
        g.players
    FROM player_game_metrics pgm
    JOIN games g ON g.id = pgm.game_id
    WHERE pgm.user_id = $1
      AND g.end_timestamp IS NOT NULL
    ORDER BY g.end_timestamp DESC, g.id DESC
    LIMIT $2 OFFSET $3;
`;

const TOTAL_SQL = `
    SELECT COUNT(*)::int AS total
    FROM player_game_metrics pgm
    JOIN games g ON g.id = pgm.game_id
    WHERE pgm.user_id = $1
      AND g.end_timestamp IS NOT NULL;
`;

export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        const userid = req.params.userid;
        const limit = clampLimit(req.query.limit);
        const offset = clampOffset(req.query.offset);

        const [rows, totalRow] = await Promise.all([
            queryAll<GameLogRow>(GAMES_SQL, [userid, limit, offset]),
            queryOne<{ total: number }>(TOTAL_SQL, [userid]),
        ]);

        const data = rows.map(r => {
            const role = r.players[String(userid)] ?? '';
            const userIsSpy = SPY_ROLES.has(role);
            const won = r.resistance_win === null
                ? null
                : userIsSpy ? !r.resistance_win : r.resistance_win;
            return {
                gameid: Number(r.game_id),
                endTimestamp: r.end_timestamp,
                side: r.side,
                role,
                points: Number(r.points),
                won,
                outcomeType: r.outcome_type,
                missionStatuses: r.mission_statuses ?? [],
            };
        });

        rep.code(200).send({
            rows: data,
            total: totalRow?.total ?? 0,
            limit,
            offset,
        });
    } catch (error) {
        console.error(error);
        rep.code(500).send({ error: 'Something went wrong while loading the game log.' });
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
        params: {
            type: 'object',
            properties: {
                userid: { type: 'number' },
            },
            required: ['userid'],
        },
        querystring: {
            type: 'object',
            properties: {
                limit:  { type: 'number', default: 50, minimum: 1 },
                offset: { type: 'number', default: 0,  minimum: 0 },
            },
        },
    },
};

async function routes(fastify: FastifyInstance, _opts: object) {
    fastify.get('', get_opts, GET);
}

export default routes;
