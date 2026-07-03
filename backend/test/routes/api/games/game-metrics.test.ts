import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { GET, get_opts, gameMetricsCache } from '../../../../routes/api/games/_gameid/metrics/index.js';
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

function gameRow(userid: number, side: 'resistance' | 'spy', points: number, breakdown: Record<string, number> = {}): unknown {
    return {
        user_id: userid,
        side,
        points,
        breakdown,
        catalog_version: '2',
        username: `Player${userid}`,
        pfp: `pfp${userid}`,
        players: PLAYERS_5,
        resistance_win: true,
        outcome_type: 'mission-victory',
        end_timestamp: '2026-05-06T12:00:00Z',
        mission_statuses: [true, true, true],
        count_failed_votes: 1,
    };
}

function historyRow(userid: number, side: 'resistance' | 'spy', points: number, end: string, gameId: number): unknown {
    return {
        user_id: userid,
        side,
        points,
        end_timestamp: end,
        game_id: gameId,
    };
}

describe('GET /api/games/:gameid/metrics', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();
        server.get('/api/games/:gameid/metrics', get_opts, GET);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Tests reuse gameids with different mocked DB payloads — a cached
        // response from an earlier case would mask the new mock.
        gameMetricsCache.clear();
    });

    it('404s when no metrics exist for the game', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([]);
        const res = await server.inject({ method: 'GET', url: '/api/games/9999/metrics' });
        expect(res.statusCode).toBe(404);
    });

    it('returns team totals, players, and game outcome', async () => {
        // Game-row results query
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            gameRow(1, 'resistance', 5),
            gameRow(2, 'resistance', 7),
            gameRow(3, 'resistance', 4),
            gameRow(4, 'spy', -3),
            gameRow(5, 'spy', -8),
        ] as never);
        // History (none — fresh players for simplicity here)
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        // Voting rounds (no suspicion data — RoS_G/RoI_G null)
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);

        const res = await server.inject({ method: 'GET', url: '/api/games/42/metrics?weighting=uniform' });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.gameid).toBe(42);
        expect(body.outcome.winner).toBe('resistance');
        expect(body.outcome.outcomeType).toBe('mission-victory');
        expect(body.outcome.missionStatuses).toEqual([true, true, true]);

        expect(body.teams.resistance.totalPoints).toBe(5 + 7 + 4);
        expect(body.teams.spy.totalPoints).toBe(-3 + -8);

        expect(body.teams.resistance.players).toHaveLength(3);
        expect(body.teams.spy.players).toHaveLength(2);

        // Each player has the expected shape
        const p1 = body.teams.resistance.players.find((p: { userid: number }) => p.userid === 1);
        expect(p1.role).toBe('resistance');
        expect(p1.side).toBe('resistance');
        expect(p1.username).toBe('Player1');
        expect(p1.complexMetric.key).toBe('RoS_G');
        expect(p1.complexMetric.value).toBe(null);  // no suspicion rounds
        expect(p1.indexBefore).toEqual({ rIndex: null, sIndex: null, pIndex: null });
        expect(p1.indexAfter).toEqual({ rIndex: null, sIndex: null, pIndex: null });

        const p4 = body.teams.spy.players.find((p: { userid: number }) => p.userid === 4);
        expect(p4.complexMetric.key).toBe('RoI_G');
    });

    it('computes index delta from the player history (this game vs prior games)', async () => {
        // Player 1 has played one prior game, this game is their second.
        const thisGameEnd = '2026-05-06T12:00:00Z';
        const priorGameEnd = '2026-05-01T12:00:00Z';

        vi.mocked(db.queryAll).mockResolvedValueOnce([
            gameRow(1, 'resistance', 10),  // points in this game
        ] as never);
        // History contains the prior game (4 pts) and the current game (10 pts)
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            historyRow(1, 'resistance', 4,  priorGameEnd, 41),
            historyRow(1, 'resistance', 10, thisGameEnd,  42),
        ] as never);
        // No suspicion data
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);

        const res = await server.inject({ method: 'GET', url: '/api/games/42/metrics?weighting=uniform' });
        const p1 = res.json().teams.resistance.players[0];

        // Before this game: only the prior game → uniform mean = 4
        expect(p1.indexBefore.rIndex).toBe(4);
        // After this game: mean of [4, 10] = 7
        expect(p1.indexAfter.rIndex).toBe(7);
        // Delta should be +3
        expect(p1.indexDelta.rIndex).toBe(3);
        // pIndex matches rIndex when sIndex is null (one-sided player)
        expect(p1.indexBefore.pIndex).toBe(4);
        expect(p1.indexAfter.pIndex).toBe(7);
        expect(p1.indexDelta.pIndex).toBe(3);
    });

    it('a fresh player (this is their first game) shows null indexBefore', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            gameRow(1, 'resistance', 12),
        ] as never);
        // History contains only the current game.
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            historyRow(1, 'resistance', 12, '2026-05-06T12:00:00Z', 42),
        ] as never);
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);

        const res = await server.inject({ method: 'GET', url: '/api/games/42/metrics?weighting=uniform' });
        const p1 = res.json().teams.resistance.players[0];
        expect(p1.indexBefore.rIndex).toBe(null);
        expect(p1.indexAfter.rIndex).toBe(12);
        expect(p1.indexDelta.rIndex).toBe(12);
    });
});
