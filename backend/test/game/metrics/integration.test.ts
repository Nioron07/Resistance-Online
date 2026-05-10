import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResistanceGameRoom } from '../../../game/ResistanceGameRoom.js';
import { LobbyPlugin } from '../../../game/plugins/LobbyPlugin.js';
import { ResistanceCore } from '../../../game/plugins/ResistanceCore.js';
import type { WebSocket } from '@fastify/websocket';
import type { PlayerId, RoleName } from '../../../game/types/GameTypes.js';
import { metricsRowsFromState } from '../../../game/metrics/stateToRows.js';
import { computeGamePoints } from '../../../game/metrics/points.js';

vi.mock('../../../utils/db-queries/DataAccessClass', () => ({
    DAC: {
        resistance: {
            games: {
                create: vi.fn().mockResolvedValue(1),
                id: () => ({
                    playerId: () => ({
                        add: vi.fn().mockResolvedValue('added'),
                        remove: vi.fn().mockResolvedValue('removed'),
                        update: vi.fn().mockResolvedValue('updated'),
                    }),
                    updateSettings: vi.fn().mockResolvedValue('updated'),
                    start: vi.fn().mockResolvedValue('started'),
                    end: vi.fn().mockResolvedValue('ended'),
                }),
            },
            rounds: {
                create: vi.fn().mockResolvedValue(1),
                id: () => ({}),
            },
        },
    },
}));

function createMockSocket(id: number) {
    return { id, send: vi.fn(), on: vi.fn() } as unknown as WebSocket;
}

function createRoom() {
    const room = new ResistanceGameRoom(1234, 987654);
    room.use(new LobbyPlugin());
    room.use(new ResistanceCore());
    return room;
}

function addPlayers(room: ResistanceGameRoom, count: number): void {
    for (let i = 1; i <= count; i++) {
        room.addPlayer(i, createMockSocket(i));
    }
}

const ROLES_5_PLAYER: RoleName[] = ['resistance', 'resistance', 'resistance', 'spy', 'spy'];

function startGame(room: ResistanceGameRoom, roles: RoleName[]) {
    const playerIds = [...room.state.players.keys()];
    room.bus.emit('game:start', {
        senderId: room.host!,
        leaderId: 1,
        seatOrder: playerIds,
    });
    playerIds.forEach((id, i) => {
        room.bus.emit('role:submit', { senderId: id, role: roles[i]! });
    });
}

function allApprove(room: ResistanceGameRoom) {
    for (const id of room.state.players.keys()) {
        room.bus.emit('vote:cast', { senderId: id, vote: true });
    }
}

function allSubmitSus(room: ResistanceGameRoom, sus: Record<PlayerId, number> = {}) {
    for (const id of room.state.players.keys()) {
        room.bus.emit('sus:submit', { senderId: id, sus });
    }
}

function playMissionCards(room: ResistanceGameRoom, cards: boolean[]) {
    room.state.nominatedTeam.forEach((id, i) => {
        room.bus.emit('mission:play-card', { senderId: id, card: cards[i]! });
    });
}

describe('metrics pipeline (state → rows → points) end-to-end', () => {
    let room: ResistanceGameRoom;

    beforeEach(() => {
        vi.clearAllMocks();
        room = createRoom();
        addPlayers(room, 5);
    });

    it('produces one row per finalized nomination on a clean resistance sweep', () => {
        startGame(room, ROLES_5_PLAYER);

        // Resistance wins 3 missions in a row, all clean teams (members 1,2,3).
        for (let i = 0; i < 3; i++) {
            const teamSize = room.state.rules!.missionSizes[room.state.mission];
            const team: PlayerId[] = [1, 2, 3].slice(0, teamSize);
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team });
            allApprove(room);
            playMissionCards(room, team.map(() => true));
            // Sussers (resistance only, post the spy-suspicion-drop fix).
            allSubmitSus(room, {});
        }

        expect(room.state.phase).toBe('game-over');
        expect(room.state.endWinner).toBe('resistance');

        const rows = metricsRowsFromState(room.state, 987654);
        // Three completed missions, one approved nomination each → 3 rows.
        expect(rows.length).toBeGreaterThanOrEqual(3);
        expect(rows.every(r => r.players['1'] === 'resistance')).toBe(true);
        expect(rows.every(r => r.players['4'] === 'spy')).toBe(true);
        // mission_cards should be set on each approved nomination.
        const approvedRows = rows.filter(r => r.vote_status === true && r.mission_status !== null);
        expect(approvedRows.length).toBe(3);
        expect(approvedRows.every(r => r.mission_cards !== null)).toBe(true);
    });

    it('computeGamePoints awards a positive resistance index after a win, and penalizes a losing spy', () => {
        startGame(room, ROLES_5_PLAYER);

        for (let i = 0; i < 3; i++) {
            const teamSize = room.state.rules!.missionSizes[room.state.mission];
            const team: PlayerId[] = [1, 2, 3].slice(0, teamSize);
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team });
            allApprove(room);
            playMissionCards(room, team.map(() => true));
            allSubmitSus(room, {});
        }

        const rows = metricsRowsFromState(room.state, 987654);

        // Player 1 was on every mission, voted approve, won.
        const p1 = computeGamePoints('1', rows)!;
        expect(p1.side).toBe('resistance');
        expect(p1.points).toBeGreaterThan(0);
        expect(p1.breakdown['game_won']).toBeDefined();

        // Player 4 (spy) was never on a mission, voted approve, lost.
        const p4 = computeGamePoints('4', rows)!;
        expect(p4.side).toBe('spy');
        expect(p4.breakdown['game_won']).toBeUndefined();
    });

    it('breakdown sums to points for every participant', () => {
        startGame(room, ROLES_5_PLAYER);

        for (let i = 0; i < 3; i++) {
            const teamSize = room.state.rules!.missionSizes[room.state.mission];
            const team: PlayerId[] = [1, 2, 3].slice(0, teamSize);
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team });
            allApprove(room);
            playMissionCards(room, team.map(() => true));
            allSubmitSus(room, {});
        }

        const rows = metricsRowsFromState(room.state, 987654);
        for (const id of room.state.players.keys()) {
            const r = computeGamePoints(String(id), rows)!;
            const sum = Object.values(r.breakdown).reduce((a, b) => a + b, 0);
            expect(r.points).toBe(sum);
        }
    });
});
