import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { GET, get_opts } from '../../../../routes/api/leaderboard/index.js';
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

describe('GET /api/leaderboard', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();
        server.get('/api/leaderboard', get_opts, GET);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('400s on an unknown metric', async () => {
        const res = await server.inject({ method: 'GET', url: '/api/leaderboard?metric=elo' });
        expect(res.statusCode).toBe(400);
    });

    it('lifetimePoints: returns rows ordered by total descending', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            { user_id: 1, total: 100, games: 10, username: 'one',   pfp: null },
            { user_id: 2, total: 50,  games:  5, username: 'two',   pfp: null },
            { user_id: 3, total: 20,  games:  2, username: 'three', pfp: null },
        ] as never);

        const res = await server.inject({ method: 'GET', url: '/api/leaderboard?metric=lifetimePoints&limit=10' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.metric).toBe('lifetimePoints');
        expect(body.rows).toHaveLength(3);
        expect(body.rows[0]).toEqual({ rank: 1, userid: 1, username: 'one',   pfp: null, value: 100, games: 10 });
        expect(body.rows[2]).toEqual({ rank: 3, userid: 3, username: 'three', pfp: null, value: 20,  games: 2  });
    });

    it('pIndex with uniform weighting: ranks by computed P-Index', async () => {
        // Two users; user 1 averages 6 across two resistance games; user 2 averages 4.
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            { user_id: 1, side: 'resistance', points: 4, end_timestamp: '2026-01-01', username: 'one', pfp: null },
            { user_id: 1, side: 'resistance', points: 8, end_timestamp: '2026-01-02', username: 'one', pfp: null },
            { user_id: 2, side: 'resistance', points: 3, end_timestamp: '2026-01-01', username: 'two', pfp: null },
            { user_id: 2, side: 'resistance', points: 5, end_timestamp: '2026-01-02', username: 'two', pfp: null },
        ] as never);

        const res = await server.inject({ method: 'GET', url: '/api/leaderboard?metric=pIndex&weighting=uniform' });
        const body = res.json();
        expect(body.rows).toHaveLength(2);
        expect(body.rows[0].userid).toBe(1);
        expect(body.rows[0].value).toBe(6);
        expect(body.rows[1].userid).toBe(2);
        expect(body.rows[1].value).toBe(4);
    });

    it('respects limit', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            { user_id: 1, side: 'resistance', points: 10, end_timestamp: '2026-01-01', username: 'a', pfp: null },
            { user_id: 2, side: 'resistance', points:  9, end_timestamp: '2026-01-01', username: 'b', pfp: null },
            { user_id: 3, side: 'resistance', points:  8, end_timestamp: '2026-01-01', username: 'c', pfp: null },
        ] as never);

        const res = await server.inject({ method: 'GET', url: '/api/leaderboard?metric=pIndex&weighting=uniform&limit=2' });
        const body = res.json();
        expect(body.rows).toHaveLength(2);
        expect(body.rows[0].userid).toBe(1);
        expect(body.rows[1].userid).toBe(2);
    });

    it('skips users whose target index is null (e.g., no games on that side)', async () => {
        // user 2 has no spy games → sIndex would be null → excluded from sIndex board.
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            { user_id: 1, side: 'spy',        points:  5, end_timestamp: '2026-01-01', username: 'a', pfp: null },
            { user_id: 2, side: 'resistance', points: 10, end_timestamp: '2026-01-01', username: 'b', pfp: null },
        ] as never);

        const res = await server.inject({ method: 'GET', url: '/api/leaderboard?metric=sIndex&weighting=uniform' });
        const body = res.json();
        expect(body.rows.map((r: { userid: number }) => r.userid)).toEqual([1]);
    });
});
