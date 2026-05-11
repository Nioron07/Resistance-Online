import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { GET, get_opts } from '../../../../routes/api/games/_gameid/replay/index.js';
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

function header (overrides: Partial<Record<string, unknown>> = {}): unknown {
    return {
        id: 42,
        players: PLAYERS_5,
        resistance_win: true,
        outcome_type: 'mission-victory',
        mission_statuses: [true, false, true],
        start_timestamp: '2026-05-01T10:00:00Z',
        end_timestamp: '2026-05-01T10:30:00Z',
        ...overrides,
    };
}

function round (overrides: Partial<Record<string, unknown>> = {}): unknown {
    return {
        round_id: 1,
        leader_userid: 1,
        mission_participent_userids: [1, 4],
        count_spies_nominated: 1,
        vote_poll: { '1': true, '2': true, '3': false, '4': true, '5': false },
        vote_status: true,
        mission_status: true,
        mission_cards: { '1': 'success', '4': 'success' },
        suspicions: null,
        ...overrides,
    };
}

describe('GET /api/games/:gameid/replay', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();
        server.get('/api/games/:gameid/replay', get_opts, GET);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('404s when no game exists for the id', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(null as never);
        const res = await server.inject({ method: 'GET', url: '/api/games/9999/replay' });
        expect(res.statusCode).toBe(404);
    });

    it('returns header + players (with side derivation) + empty rounds', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(header() as never);
        // rounds query → empty
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never);
        // profiles query
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            { id: 1, username: 'Alice',   pfp: 'a.png' },
            { id: 2, username: 'Bob',     pfp: null    },
            { id: 3, username: 'Carol',   pfp: null    },
            { id: 4, username: 'Dan',     pfp: null    },
            { id: 5, username: 'Eve',     pfp: null    },
        ] as never);

        const res = await server.inject({ method: 'GET', url: '/api/games/42/replay' });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.gameid).toBe(42);
        expect(body.outcome.winner).toBe('resistance');
        expect(body.outcome.outcomeType).toBe('mission-victory');
        // Padded to length 5 even when source array was shorter.
        expect(body.outcome.missionStatuses).toHaveLength(5);
        expect(body.outcome.missionStatuses).toEqual([true, false, true, null, null]);

        expect(body.players).toHaveLength(5);
        const sides = Object.fromEntries(body.players.map((p: { userid: number, side: string }) => [p.userid, p.side]));
        expect(sides).toEqual({ 1: 'resistance', 2: 'resistance', 3: 'resistance', 4: 'spy', 5: 'spy' });

        expect(body.rounds).toEqual([]);
    });

    it('derives missionIndex and nominationAttempt across rejected and approved rounds', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(header() as never);
        // Two missions worth of rounds:
        //   Mission 1, attempt 1 — rejected (mission_status null)
        //   Mission 1, attempt 2 — approved (mission_status true)
        //   Mission 2, attempt 1 — approved (mission_status false)
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            round({ round_id: 10, vote_status: false, mission_status: null, mission_cards: null }),
            round({ round_id: 11, vote_status: true,  mission_status: true,  mission_cards: { '1': 'success', '4': 'success' } }),
            round({ round_id: 12, vote_status: true,  mission_status: false, mission_cards: { '1': 'success', '4': 'fail'    } }),
        ] as never);
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never); // profiles

        const res = await server.inject({ method: 'GET', url: '/api/games/42/replay' });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.rounds).toHaveLength(3);
        expect(body.rounds[0].missionIndex).toBe(1);
        expect(body.rounds[0].nominationAttempt).toBe(1);
        expect(body.rounds[1].missionIndex).toBe(1);
        expect(body.rounds[1].nominationAttempt).toBe(2);
        // After mission 1 resolves, mission counter increments and attempt resets.
        expect(body.rounds[2].missionIndex).toBe(2);
        expect(body.rounds[2].nominationAttempt).toBe(1);
    });

    it('passes through suspicions and mission_cards verbatim', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(header() as never);
        vi.mocked(db.queryAll).mockResolvedValueOnce([
            round({
                round_id: 99,
                suspicions: { '1': { '4': 4, '5': 2 }, '2': { '4': 3 } },
                mission_cards: { '1': 'success', '4': 'fail' },
            }),
        ] as never);
        vi.mocked(db.queryAll).mockResolvedValueOnce([] as never); // profiles

        const res = await server.inject({ method: 'GET', url: '/api/games/42/replay' });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.rounds[0].suspicions).toEqual({ '1': { '4': 4, '5': 2 }, '2': { '4': 3 } });
        expect(body.rounds[0].missionCards).toEqual({ '1': 'success', '4': 'fail' });
    });
});
