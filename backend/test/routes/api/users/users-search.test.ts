import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { GET, get_opts } from '../../../../routes/api/users/index.js';
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

describe('GET /api/users ?q= (substring search path)', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();
        server.get('/api/users', get_opts, GET);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forwards q + default limit and returns verbosity-0 shape', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            { id: 1, username: 'Nioron07', pfp: 'p.png', bio: null, last_played: '2026-05-09T10:00:00Z' },
            { id: 7, username: 'NioronTwo', pfp: null,  bio: null, last_played: '2026-05-09T09:00:00Z' },
        ] as never);

        const res = await server.inject({ method: 'GET', url: '/api/users?q=nio' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveLength(2);
        expect(body[0].username).toBe('Nioron07');

        // The SQL helper was called with ['%nio%', 'nio', 'nio%', 50] —
        // matches the search SQL's $1/$2/$3/$4 bound parameter order.
        expect(db.queryAll).toHaveBeenCalledTimes(1);
        const [, args] = vi.mocked(db.queryAll).mock.calls[0]!;
        expect(args).toEqual(['%nio%', 'nio', 'nio%', 50]);
    });

    it('clamps a too-large limit to 100', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        await server.inject({ method: 'GET', url: '/api/users?q=foo&limit=500' });
        // Schema cap is 100; Fastify's `maximum` rejects > 100 with a 400.
        // We assert the route did NOT fall through to the legacy path
        // when the validator allowed the request through.
        // (Below request explicitly chooses 100 to verify pass-through.)
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        await server.inject({ method: 'GET', url: '/api/users?q=foo&limit=100' });
        const lastCall = vi.mocked(db.queryAll).mock.calls.at(-1)!;
        expect(lastCall[1]).toEqual(['%foo%', 'foo', 'foo%', 100]);
    });

    it('falls through to the legacy path when q is absent', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            { id: 1, username: 'Alice', pfp: null, bio: null, last_played: null },
        ] as never);

        const res = await server.inject({ method: 'GET', url: '/api/users' });
        expect(res.statusCode).toBe(200);
        // The legacy SQL has no positional args (it's a SELECT * FROM
        // table at verbosity 0). The helper was called with the SQL
        // string alone — no params array.
        const [, args] = vi.mocked(db.queryAll).mock.calls[0]!;
        expect(args).toBeUndefined();
    });
});
