import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { GET, get_opts } from '../../../../routes/api/games/search/index.js';
import * as db from '../../../../utils/db.js';

vi.mock('../../../../utils/db.js', () => ({
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    transaction: vi.fn(),
    getClient: vi.fn(),
    closePool: vi.fn(),
    getPool: vi.fn(),
    query: vi.fn(),
    healthCheck: vi.fn(),
}));

function row (overrides: Partial<Record<string, unknown>> = {}): unknown {
    return {
        id: 42,
        resistance_win: true,
        outcome_type: 'mission-victory',
        mission_statuses: [true, true, true],
        start_timestamp: '2026-05-01T10:00:00Z',
        end_timestamp: '2026-05-01T10:30:00Z',
        count_failed_votes: 1,
        player_count: 5,
        ...overrides,
    };
}

describe('GET /api/games/search', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();
        server.get('/api/games/search', get_opts, GET);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns all games with no filters and forwards nulls as filter args', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([row(), row({ id: 41 })] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 2 } as never);

        const res = await server.inject({ method: 'GET', url: '/api/games/search' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.rows).toHaveLength(2);
        expect(body.total).toBe(2);
        expect(body.limit).toBe(50);
        expect(body.offset).toBe(0);

        // ROW_SQL bind order: q, userid, before, after, winner, outcomeType,
        // minPlayers, maxPlayers, limit, offset. All filters null when none supplied.
        const [, args] = vi.mocked(db.queryAll).mock.calls[0]!;
        expect(args).toEqual([null, null, null, null, null, null, null, null, 50, 0]);
    });

    it('forwards winner + minPlayers filters in the bind position', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([row({ resistance_win: false })] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 1 } as never);

        const res = await server.inject({
            method: 'GET',
            url: '/api/games/search?winner=spy&minPlayers=6&maxPlayers=8',
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.rows[0].winner).toBe('spies');

        const [, args] = vi.mocked(db.queryAll).mock.calls[0]!;
        // q, userid, before, after, winner, outcomeType, minPlayers, maxPlayers, limit, offset
        expect(args).toEqual([null, null, null, null, 'spy', null, 6, 8, 50, 0]);
    });

    it('wraps q in % wildcards server-side', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 0 } as never);

        await server.inject({ method: 'GET', url: '/api/games/search?q=nio' });

        const [, args] = vi.mocked(db.queryAll).mock.calls[0]!;
        expect(args![0]).toBe('%nio%');
    });

    it('honors before / after timestamps', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 0 } as never);

        await server.inject({
            method: 'GET',
            url: '/api/games/search?before=2026-05-09T00:00:00Z&after=2026-05-01T00:00:00Z',
        });

        const [, args] = vi.mocked(db.queryAll).mock.calls[0]!;
        expect(args![2]).toBe('2026-05-09T00:00:00Z'); // before
        expect(args![3]).toBe('2026-05-01T00:00:00Z'); // after
    });

    it('returns winner: spies when resistance_win = false', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            row({ resistance_win: false, mission_statuses: [false, false, false] }),
        ] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 1 } as never);

        const res = await server.inject({ method: 'GET', url: '/api/games/search' });
        const body = res.json();
        expect(body.rows[0].winner).toBe('spies');
        expect(body.rows[0].missionStatuses).toEqual([false, false, false]);
    });

    it('400s on an out-of-range winner value', async () => {
        const res = await server.inject({ method: 'GET', url: '/api/games/search?winner=nobody' });
        expect(res.statusCode).toBe(400);
    });
});
