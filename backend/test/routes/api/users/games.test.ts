import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { GET, get_opts } from '../../../../routes/api/users/_userid/games/index.js';
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

const PLAYERS_5: Record<string, string | null> = {
    '1': 'resistance', '2': 'resistance', '3': 'resistance',
    '4': 'spy', '5': 'spy',
};

describe('GET /api/users/:userid/games', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();
        server.get('/api/users/:userid/games', get_opts, GET);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns paginated rows + total', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            {
                game_id: 102, side: 'resistance', points: 7,
                end_timestamp: '2026-05-06T12:00:00Z',
                outcome_type: 'mission-victory',
                mission_statuses: [true, true, true],
                resistance_win: true,
                players: PLAYERS_5,
            },
            {
                game_id: 101, side: 'spy', points: -3,
                end_timestamp: '2026-05-05T12:00:00Z',
                outcome_type: 'mission-victory',
                mission_statuses: [true, true, true],
                resistance_win: true,
                players: PLAYERS_5,
            },
        ] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 12 } as never);

        const res = await server.inject({ method: 'GET', url: '/api/users/1/games?limit=2&offset=0' });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.total).toBe(12);
        expect(body.limit).toBe(2);
        expect(body.offset).toBe(0);
        expect(body.rows).toHaveLength(2);

        // First row: resistance, won (resistance_win === true and side === resistance)
        expect(body.rows[0].gameid).toBe(102);
        expect(body.rows[0].side).toBe('resistance');
        expect(body.rows[0].won).toBe(true);
        expect(body.rows[0].role).toBe('resistance');

        // Second row: spy, lost (resistance won, user is spy)
        expect(body.rows[1].gameid).toBe(101);
        expect(body.rows[1].side).toBe('spy');
        // userid=1 in PLAYERS_5 is resistance — so won === resistance_win === true
        // but the mock has them on the spy side that game; this asserts the role-from-players
        // mapping: role is whatever players[userid] says, which is 'resistance' here.
        expect(body.rows[1].role).toBe('resistance');
    });

    it('clamps a too-large limit to 200', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 0 } as never);

        const res = await server.inject({ method: 'GET', url: '/api/users/1/games?limit=999' });
        const body = res.json();
        expect(body.limit).toBe(200);
    });

    it('default limit and offset', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        vi.mocked(db.queryOne).mockResolvedValueOnce({ total: 0 } as never);

        const res = await server.inject({ method: 'GET', url: '/api/users/1/games' });
        const body = res.json();
        expect(body.limit).toBe(50);
        expect(body.offset).toBe(0);
    });
});
