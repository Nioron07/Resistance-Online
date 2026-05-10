import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { GET, get_opts } from '../../../../routes/api/users/_userid/index/index.js';
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

interface Row {
    side: 'resistance' | 'spy';
    points: number;
    end_timestamp: string;
    catalog_version: string;
    computed_at: string;
}

function row(o: Partial<Row> & { side: 'resistance' | 'spy', points: number }): Row {
    return {
        side: o.side,
        points: o.points,
        end_timestamp: o.end_timestamp ?? new Date(2026, 0, 1).toISOString(),
        catalog_version: o.catalog_version ?? '1',
        computed_at: o.computed_at ?? new Date(2026, 0, 1).toISOString(),
    };
}

describe('GET /api/users/:userid/index', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();
        server.get('/api/users/:userid/index', get_opts, GET);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns nulls for a user with no completed games', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([]);

        const res = await server.inject({ method: 'GET', url: '/api/users/1/index?weighting=uniform' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.rIndex).toBe(null);
        expect(body.sIndex).toBe(null);
        expect(body.pIndex).toBe(null);
        expect(body.details.resistanceGames).toBe(0);
        expect(body.details.spyGames).toBe(0);
        expect(body.details.weighting).toEqual({ strategy: 'uniform' });
    });

    it('uniform weighting returns the arithmetic means', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            row({ side: 'resistance', points: 4 }),
            row({ side: 'resistance', points: 8 }),
            row({ side: 'spy',        points: 12 }),
        ]);

        const res = await server.inject({ method: 'GET', url: '/api/users/1/index?weighting=uniform' });
        const body = res.json();
        expect(body.rIndex).toBe(6);
        expect(body.sIndex).toBe(12);
        expect(body.pIndex).toBe(9);
        expect(body.details.resistanceGames).toBe(2);
        expect(body.details.spyGames).toBe(1);
    });

    it('one-sided player gets pIndex == that side', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            row({ side: 'resistance', points: 5 }),
            row({ side: 'resistance', points: 7 }),
        ]);
        const res = await server.inject({ method: 'GET', url: '/api/users/1/index?weighting=uniform' });
        const body = res.json();
        expect(body.rIndex).toBe(6);
        expect(body.sIndex).toBe(null);
        expect(body.pIndex).toBe(6);
    });

    it('expdecay alpha=1 collapses to uniform', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            row({ side: 'resistance', points: 2 }),
            row({ side: 'resistance', points: 4 }),
            row({ side: 'resistance', points: 6 }),
        ]);
        const res = await server.inject({ method: 'GET', url: '/api/users/1/index?weighting=expdecay&alpha=1' });
        const body = res.json();
        expect(body.rIndex).toBe(4);
    });

    it('expdecay alpha=0 isolates the most recent', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            row({ side: 'resistance', points: 2 }),
            row({ side: 'resistance', points: 4 }),
            row({ side: 'resistance', points: 6 }),
        ]);
        const res = await server.inject({ method: 'GET', url: '/api/users/1/index?weighting=expdecay&alpha=0' });
        const body = res.json();
        expect(body.rIndex).toBe(6);
    });

    it('details surface most-common catalog_version and max computed_at', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            row({ side: 'resistance', points: 1, catalog_version: '1', computed_at: '2026-01-01T00:00:00Z' }),
            row({ side: 'resistance', points: 1, catalog_version: '1', computed_at: '2026-01-02T00:00:00Z' }),
            row({ side: 'spy',        points: 1, catalog_version: '2', computed_at: '2026-01-03T00:00:00Z' }),
        ]);
        const res = await server.inject({ method: 'GET', url: '/api/users/1/index?weighting=uniform' });
        const body = res.json();
        expect(body.details.catalogVersion).toBe('1');     // most common
        expect(body.details.asOf).toBe('2026-01-03T00:00:00Z');
    });

    it('500s on a DB failure', async () => {
        vi.mocked(db.queryAll).mockRejectedValueOnce(new Error('boom'));
        const res = await server.inject({ method: 'GET', url: '/api/users/1/index?weighting=uniform' });
        expect(res.statusCode).toBe(500);
    });
});
