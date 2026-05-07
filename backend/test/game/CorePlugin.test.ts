import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResistanceGameRoom } from '../../game/ResistanceGameRoom.js';
import { LobbyPlugin } from '../../game/plugins/LobbyPlugin.js';
import { ResistanceCore } from '../../game/plugins/ResistanceCore.js';
import { WebSocket } from '@fastify/websocket';
import { PlayerId, RoleName } from '../../game/types/GameTypes.js';

vi.mock("../../utils/db-queries/DataAccessClass", () => ({
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
                id: () => ({})
            }
        },
    },
}));

function createMockSocket(id: number) {
    return { id, send: vi.fn(), on: vi.fn() } as unknown as WebSocket;
}

function getMessages(ws: WebSocket) {
    return (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
}

function getLastMessage(ws: WebSocket) {
    return getMessages(ws).at(-1);
}

function getMessageOfType(ws: WebSocket, event: string) {
    return getMessages(ws).findLast((m: any) => m.event === event);
}

function createRoom() {
    const room = new ResistanceGameRoom(1234, 987654);
    room.use(new LobbyPlugin());
    room.use(new ResistanceCore());
    return room;
}

function addPlayers(room: ResistanceGameRoom, count: number): WebSocket[] {
    const sockets: WebSocket[] = [];
    for (let i = 1; i <= count; i++) {
        const ws = createMockSocket(i);
        room.addPlayer(i, ws);
        sockets.push(ws);
    }
    return sockets;
}

/**
 * Starts the game and assigns roles.
 *
 * sends seatOrder and leaderId since in person
 * leaderId passed to game:start is set to 1 so that after the
 * pre-rotation in roles:assigned (leaderId = seatOrder[indexOf(leaderId) - 1]),
 * then getNextLeader() increments forward and lands on seatOrder[0] = player 1.
 *
 * roles:assigned does: leaderId = seatOrder[(indexOf(leaderId) - 1 + len) % len]
 * Then nomination:start does: leaderId = getNextLeader() = seatOrder[(indexOf(leaderId) + 1) % len]
 * So: seatOrder[(-1 + 1 + len) % len] = seatOrder[0] = first player
 *
 * we pass leaderId = 1 to get player 1 as first leader.
 */
function startGame(room: ResistanceGameRoom, roles: RoleName[]) {
    const playerIds = [...room.state.players.keys()];
    const seatOrder = playerIds;

    room.bus.emit('game:start', {
        senderId: room.host!,
        leaderId: 1,
        seatOrder,
    });

    playerIds.forEach((id, i) => {
        room.bus.emit('role:submit', { senderId: id, role: roles[i]! });
    });
}

function castVotes(room: ResistanceGameRoom, votes: Record<number, boolean>) {
    for (const [id, vote] of Object.entries(votes)) {
        room.bus.emit('vote:cast', { senderId: Number(id), vote });
    }
}

function allApprove(room: ResistanceGameRoom) {
    for (const id of room.state.players.keys()) {
        room.bus.emit('vote:cast', { senderId: id, vote: true });
    }
}

function allReject(room: ResistanceGameRoom) {
    for (const id of room.state.players.keys()) {
        room.bus.emit('vote:cast', { senderId: id, vote: false });
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

function runMission(room: ResistanceGameRoom, team: PlayerId[], cards: boolean[], skipSus = false) {
    room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team });
    allApprove(room);
    playMissionCards(room, cards);
    if (!skipSus) allSubmitSus(room);
}

const ROLES_5_PLAYER: RoleName[] = ['resistance', 'resistance', 'resistance', 'spy', 'spy'];


describe('ResistanceCore', () => {
    let room: ResistanceGameRoom;
    let sockets: WebSocket[];

    beforeEach(() => {
        room = createRoom();
        sockets = addPlayers(room, 5);
    });


    describe('role:submit', () => {
        it('should not accept role submissions before role-reveal phase', () => {
            room.bus.emit('role:submit', { senderId: 1, role: 'resistance' });
            expect(room.state.players.get(1)!.role).toBeUndefined();
        });

        it('should record a submitted role', () => {
            room.bus.emit('game:start', {
                senderId: room.host!,
                leaderId: 5,
                seatOrder: [1, 2, 3, 4, 5],
            });
            room.bus.emit('role:submit', { senderId: 1, role: 'resistance' });
            expect(room.state.players.get(1)!.role).toBe('resistance');
        });

        it('should not transition until all players submit', () => {
            room.bus.emit('game:start', {
                senderId: room.host!,
                leaderId: 5,
                seatOrder: [1, 2, 3, 4, 5],
            });
            room.bus.emit('role:submit', { senderId: 1, role: 'resistance' });
            room.bus.emit('role:submit', { senderId: 2, role: 'resistance' });
            expect(room.state.phase).toBe('role-reveal');
        });

        it('should transition to nomination after all roles submitted', () => {
            startGame(room, ROLES_5_PLAYER);
            expect(room.state.phase).toBe('nomination');
        });

        it('should assign knownRoles to all players', () => {
            startGame(room, ROLES_5_PLAYER);
            for (const player of room.state.players.values()) {
                expect(player.knownRoles).toBeDefined();
            }
        });

        it('spies should know each other in knownRoles', () => {
            startGame(room, ROLES_5_PLAYER);
            const playerIds = [...room.state.players.keys()];
            const spy1 = playerIds[3]!; // index 3 = spy
            const spy2 = playerIds[4]!; // index 4 = spy
            expect(room.state.players.get(spy1)!.knownRoles![spy2]).toBe('spy');
            expect(room.state.players.get(spy2)!.knownRoles![spy1]).toBe('spy');
        });

        it('resistance players should have empty knownRoles', () => {
            startGame(room, ROLES_5_PLAYER);
            const playerIds = [...room.state.players.keys()];
            const resistance = playerIds[0]!;
            expect(Object.keys(room.state.players.get(resistance)!.knownRoles!).length).toBe(0);
        });

        it('should send role:assigned to each player individually', () => {
            startGame(room, ROLES_5_PLAYER);
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'role:assigned')).toBeDefined();
            }
        });

        it('role:assigned should include the correct role', () => {
            startGame(room, ROLES_5_PLAYER);
            const msg = getMessageOfType(sockets[0]!, 'role:assigned');
            expect(msg.data.role).toBe('resistance');
        });

        it('role:assigned should include knownRoles', () => {
            startGame(room, ROLES_5_PLAYER);
            const msg = getMessageOfType(sockets[0]!, 'role:assigned');
            expect(msg.data.knownRoles).toBeDefined();
        });

        it('should broadcast nomination:started to all players after roles assigned', () => {
            startGame(room, ROLES_5_PLAYER);
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'nomination:started')).toBeDefined();
            }
        });

        it('should set seatOrder on state', () => {
            startGame(room, ROLES_5_PLAYER);
            expect(room.state.seatOrder).toEqual([1, 2, 3, 4, 5]);
        });

        it('first leader should be player 1 (first in seatOrder)', () => {
            startGame(room, ROLES_5_PLAYER);
            expect(room.state.leaderId).toBe(1);
        });

        it('round and mission should be 0 at game start', () => {
            startGame(room, ROLES_5_PLAYER);
            expect(room.state.round).toBe(0);
            expect(room.state.mission).toBe(0);
        });
    });


    describe('buildKnownRoles', () => {
        it('commander should know spies', () => {
            const roles: RoleName[] = ['commander', 'resistance', 'resistance', 'spy', 'spy'];
            startGame(room, roles);
            const playerIds = [...room.state.players.keys()];
            const commander = playerIds[0]!;
            const spy1 = playerIds[3]!;
            const spy2 = playerIds[4]!;
            const known = room.state.players.get(commander)!.knownRoles!;
            expect(known[spy1]).toBe('spy');
            expect(known[spy2]).toBe('spy');
        });

        it('commander should not know deep-cover', () => {
            const roles: RoleName[] = ['commander', 'resistance', 'resistance', 'spy', 'deep-cover'];
            startGame(room, roles);
            const playerIds = [...room.state.players.keys()];
            const commander = playerIds[0]!;
            const deepCover = playerIds[4]!;
            expect(room.state.players.get(commander)!.knownRoles![deepCover]).toBeUndefined();
        });

        it('commander should know blind-spy', () => {
            const roles: RoleName[] = ['commander', 'resistance', 'resistance', 'spy', 'blind-spy'];
            startGame(room, roles);
            const playerIds = [...room.state.players.keys()];
            const commander = playerIds[0]!;
            const blindSpy = playerIds[4]!;
            expect(room.state.players.get(commander)!.knownRoles![blindSpy]).toBeDefined();
        });

        it('bodyguard should see commander and false-commander as commander-candidate', () => {
            const roles: RoleName[] = ['bodyguard', 'commander', 'resistance', 'spy', 'false-commander'];
            startGame(room, roles);
            const playerIds = [...room.state.players.keys()];
            const bodyguard = playerIds[0]!;
            const commander = playerIds[1]!;
            const falseCommander = playerIds[4]!;
            expect(room.state.players.get(bodyguard)!.knownRoles![falseCommander]).toBe('commander-candidate');
            expect(room.state.players.get(bodyguard)!.knownRoles![commander]).toBe('commander-candidate');
        });

        it('blind-spy should not know other spies and spies should not know blind-spy', () => {
            const roles: RoleName[] = ['resistance', 'resistance', 'resistance', 'spy', 'blind-spy'];
            startGame(room, roles);
            const playerIds = [...room.state.players.keys()];
            const spy = playerIds[3]!;
            const blindSpy = playerIds[4]!;
            expect(Object.keys(room.state.players.get(blindSpy)!.knownRoles!).length).toBe(0);
            expect(room.state.players.get(spy)!.knownRoles![blindSpy]).toBeUndefined();
        });

        it('spies should know deep-cover spy', () => {
            const roles: RoleName[] = ['resistance', 'resistance', 'resistance', 'spy', 'deep-cover'];
            startGame(room, roles);
            const playerIds = [...room.state.players.keys()];
            const spy = playerIds[3]!;
            const deepCover = playerIds[4]!;
            expect(room.state.players.get(spy)!.knownRoles![deepCover]).toBeDefined();
        });
    });


    describe('nomination:submit', () => {
        beforeEach(() => {
            startGame(room, ROLES_5_PLAYER);
        });

        it('should reject nomination from non-leader', () => {
            const nonLeader = [...room.state.players.keys()].find(id => id !== room.state.leaderId)!;
            room.bus.emit('nomination:submit', { senderId: nonLeader, team: [1, 2] });
            expect(room.state.phase).toBe('nomination');
            expect(room.state.nominatedTeam).toEqual([]);
        });

        it('should reject nomination with players not in game', () => {
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [999, 1000] });
            expect(room.state.phase).toBe('nomination');
        });

        it('should accept valid nomination and transition to voting', () => {
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            expect(room.state.phase).toBe('voting');
        });

        it('should set nominatedTeam', () => {
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            expect(room.state.nominatedTeam).toEqual([1, 2]);
        });

        it('should broadcast nomination:submitted to all players', () => {
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            for (const ws of sockets) {
                const msg = getMessageOfType(ws, 'nomination:submitted');
                expect(msg).toBeDefined();
                expect(msg.data.team).toEqual([1, 2]);
            }
        });

        it('should enforce missionSizes from rules', () => {
            // 3 players is wrong for mission 0
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2, 3] });
            expect(room.state.phase).toBe('nomination');
            // 2 players is correct
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            expect(room.state.phase).toBe('voting');
        });
    });


    describe('vote:cast', () => {
        beforeEach(() => {
            startGame(room, ROLES_5_PLAYER);
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
        });

        it('should not accept votes outside voting phase', () => {
            room.state.phase = 'nomination';
            room.bus.emit('vote:cast', { senderId: 1, vote: true });
            expect(1 in room.state.pendingVotes).toBe(false);
        });

        it('should not accept votes from unknown players', () => {
            room.bus.emit('vote:cast', { senderId: 999, vote: true });
            expect(999 in room.state.pendingVotes).toBe(false);
        });

        it('should record a true vote', () => {
            room.bus.emit('vote:cast', { senderId: 1, vote: true });
            expect(room.state.pendingVotes[1]).toBe(true);
        });

        it('should record a false vote correctly', () => {
            room.bus.emit('vote:cast', { senderId: 1, vote: false });
            expect(room.state.pendingVotes[1]).toBe(false);
            expect(1 in room.state.pendingVotes).toBe(true);
        });

        it('should not allow double voting', () => {
            room.bus.emit('vote:cast', { senderId: 1, vote: true });
            room.bus.emit('vote:cast', { senderId: 1, vote: false });
            expect(room.state.pendingVotes[1]).toBe(true);
        });

        it('should not resolve before all votes cast', () => {
            room.bus.emit('vote:cast', { senderId: 1, vote: true });
            room.bus.emit('vote:cast', { senderId: 2, vote: true });
            expect(room.state.phase).toBe('voting');
        });

        it('should broadcast vote:result after all votes cast', () => {
            allApprove(room);
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'vote:result')).toBeDefined();
            }
        });

        it('vote:result should include all 5 votes', () => {
            allApprove(room);
            const msg = getMessageOfType(sockets[0]!, 'vote:result');
            expect(Object.keys(msg.data.votes).length).toBe(5);
        });

        it('vote:result approved should be true when majority approves', () => {
            allApprove(room);
            expect(getMessageOfType(sockets[0]!, 'vote:result').data.approved).toBe(true);
        });

        it('vote:result approved should be false when majority rejects', () => {
            allReject(room);
            expect(getMessageOfType(sockets[0]!, 'vote:result').data.approved).toBe(false);
        });

        it('should approve with exactly majority (3 of 5)', () => {
            castVotes(room, { 1: true, 2: true, 3: true, 4: false, 5: false });
            expect(room.state.phase).toBe('mission');
        });

        it('should reject with less than majority (2 of 5)', () => {
            castVotes(room, { 1: true, 2: true, 3: false, 4: false, 5: false });
            expect(room.state.phase).not.toBe('mission');
        });

        it('should reject with 3/6 fails', () => {
            const room7 = createRoom();
            addPlayers(room7, 6);
            startGame(room7, ['resistance', 'resistance', 'resistance', 'resistance', 'spy', 'spy']);
            room7.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            expect(room7.state.phase).toBe('voting');
            castVotes(room7, { 1: true, 2: true, 3: false, 4: false, 5: false, 6: true });

            expect(room7.state.phase).toBe('nomination');
            expect(room7.state.round).toBe(1);
        });

        it('should transition to mission on approval', () => {
            allApprove(room);
            expect(room.state.phase).toBe('mission');
        });

        it('should clear pendingVotes after resolution', () => {
            allApprove(room);
            expect(Object.keys(room.state.pendingVotes).length).toBe(0);
        });

        it('should push to pendingNominations after vote resolves', () => {
            allApprove(room);
            expect(room.state.pendingNominations.length).toBe(1);
        });

        it('nomination record should have correct outcome', () => {
            allApprove(room);
            expect(room.state.pendingNominations[0]!.outcome).toBe(true);
        });

        it('nomination record should have correct proposedTeam', () => {
            allApprove(room);
            expect(room.state.pendingNominations[0]!.proposedTeam).toEqual([1, 2]);
        });

        it('nomination record should have correct round', () => {
            allApprove(room);
            expect(room.state.pendingNominations[0]!.round).toBe(0);
        });

        it('nomination record should have correct leader', () => {
            const leader = room.state.leaderId;
            allApprove(room);
            expect(room.state.pendingNominations[0]!.leader).toBe(leader);
        });

        it('nomination record should count numberOfSpies correctly with spy on team', () => {
            // player 4 is a spy
            room.state.nominatedTeam = [1, 4];
            allApprove(room);
            expect(room.state.pendingNominations[0]!.numberOfSpies).toBe(1);
        });

        it('nomination record should count numberOfSpies as 0 with no spies on team', () => {
            allApprove(room);
            expect(room.state.pendingNominations[0]!.numberOfSpies).toBe(0);
        });
    });


    describe('nomination rejection', () => {
        beforeEach(() => {
            startGame(room, ROLES_5_PLAYER);
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
        });

        it('should skip suspicion on first rejection of first mission (mission 0, round 0)', () => {
            allReject(room);
            expect(room.state.phase).toBe('nomination');
        });

        it('should enter suspicion phase on rejection after round 0', () => {
            allReject(room); // round 0, skip suspicion
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allReject(room); // round 1
            expect(room.state.phase).toBe('suspicion');
        });

        it('should broadcast suspicion:started on second rejection', () => {
            allReject(room);
            vi.clearAllMocks();
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allReject(room);
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'suspicion:started')).toBeDefined();
            }
        });

        it('should rotate leader after rejection', () => {
            const firstLeader = room.state.leaderId;
            allReject(room);
            expect(room.state.leaderId).not.toBe(firstLeader);
        });

        it('should set round to 1 after first rejection', () => {
            allReject(room);
            expect(room.state.round).toBe(1);
        });

        it('round should equal pendingNominations.length', () => {
            allReject(room);
            expect(room.state.round).toBe(room.state.pendingNominations.length);
        });

        it('should push rejected nomination to pendingNominations', () => {
            allReject(room);
            expect(room.state.pendingNominations.length).toBe(1);
            expect(room.state.pendingNominations[0]!.outcome).toBe(false);
        });

        it('should reset nominatedTeam after rejection', () => {
            allReject(room);
            expect(room.state.nominatedTeam).toEqual([]);
        });

        it('should broadcast nomination:started after rejection', () => {
            vi.clearAllMocks();
            allReject(room);
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'nomination:started')).toBeDefined();
            }
        });

        it('nomination:started after rejection should have updated round', () => {
            allReject(room);
            const msg = getMessageOfType(sockets[0]!, 'nomination:started');
            expect(msg.data.round).toBe(1);
        });

        it('nomination:started after rejection should have same mission', () => {
            allReject(room);
            const msg = getMessageOfType(sockets[0]!, 'nomination:started');
            expect(msg.data.mission).toBe(0);
        });

        it('should end game after 5 rejections and reason should be "nomination-limit"', () => {
            for (let i = 0; i < 5; i++) {
                if (i !== 0) {
                    expect(room.state.phase).toBe('nomination')
                    room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
                }
                allReject(room);
                expect(room.state.phase).not.toBe('voting');
                if (room.state.phase === 'suspicion') {
                    allSubmitSus(room);
                }
            }
            expect(room.state.phase).toBe('game-over');
            expect(room.state.winner).toBe('spies');
            expect(getMessageOfType(sockets[0]!, 'game:ended').data.reason).toBe('nomination-limit');
        });
    });


    describe('sus:submit', () => {
        beforeEach(() => {
            startGame(room, ROLES_5_PLAYER);
            // Round 0 rejection skips suspicion
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allReject(room);
            // Round 1 rejection enters suspicion
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allReject(room);
            expect(room.state.phase).toBe('suspicion');
        });

        it('should not accept sus outside suspicion phase', () => {
            room.state.phase = 'nomination';
            room.bus.emit('sus:submit', { senderId: 1, sus: { 2: 5 } });
            expect(1 in room.state.pendingSuspicions).toBe(false);
        });

        it('should not accept sus from unknown players', () => {
            room.bus.emit('sus:submit', { senderId: 999, sus: {} });
            expect(999 in room.state.pendingSuspicions).toBe(false);
        });

        it('should record a suspicion submission', () => {
            room.bus.emit('sus:submit', { senderId: 1, sus: { 2: 5, 3: 3 } });
            expect(room.state.pendingSuspicions[1]).toEqual({ 2: 5, 3: 3 });
        });

        it('should not allow double sus submission', () => {
            room.bus.emit('sus:submit', { senderId: 1, sus: { 2: 5 } });
            room.bus.emit('sus:submit', { senderId: 1, sus: { 2: 1 } });
            expect(room.state.pendingSuspicions[1]).toEqual({ 2: 5 });
        });

        it('should not advance until all players submit', () => {
            room.bus.emit('sus:submit', { senderId: 1, sus: {} });
            room.bus.emit('sus:submit', { senderId: 2, sus: {} });
            expect(room.state.phase).toBe('suspicion');
        });

        it('should advance to nomination after all sus submitted', () => {
            allSubmitSus(room);
            expect(room.state.phase).toBe('nomination');
        });

        it('should clear pendingSuspicions after completion', () => {
            allSubmitSus(room);
            expect(Object.keys(room.state.pendingSuspicions).length).toBe(0);
        });

        it('should attach suspicions to last pending nomination (cameFromMission = false)', () => {
            allSubmitSus(room, { 4: 8, 5: 6 });
            const lastNom = room.state.pendingNominations[room.state.pendingNominations.length - 1]!;
            expect(lastNom.suspicions).toBeDefined();
        });

        it('first nomination (round 0) should have undefined suspicions', () => {
            expect(room.state.pendingNominations[0]!.suspicions).toBeUndefined();
        });

        it('should not clear pendingNominations after rejection suspicion', () => {
            allSubmitSus(room);
            expect(room.state.pendingNominations.length).toBeGreaterThan(0);
        });

        it('should broadcast nomination:started after suspicion complete', () => {
            vi.clearAllMocks();
            allSubmitSus(room);
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'nomination:started')).toBeDefined();
            }
        });
    });


    describe('mission:play-card', () => {
        beforeEach(() => {
            startGame(room, ROLES_5_PLAYER);
            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allApprove(room);
            expect(room.state.phase).toBe('mission');
        });

        it('should broadcast mission:started on approval', () => {
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'mission:started')).toBeDefined();
            }
        });

        it('mission:started should have correct team', () => {
            expect(getMessageOfType(sockets[0]!, 'mission:started').data.team).toEqual([1, 2]);
        });

        it('mission:started should have correct mission number', () => {
            expect(getMessageOfType(sockets[0]!, 'mission:started').data.mission).toBe(0);
        });

        it('mission:started should have correct leaderId', () => {
            expect(getMessageOfType(sockets[0]!, 'mission:started').data.leaderId).toBeDefined();
        });

        it('should not accept cards from non-team members', () => {
            const nonMember = [...room.state.players.keys()].find(id => !room.state.nominatedTeam.includes(id))!;
            room.bus.emit('mission:play-card', { senderId: nonMember, card: true });
            expect(nonMember in room.state.pendingMissionCards).toBe(false);
        });

        it('should not allow double card submission', () => {
            room.bus.emit('mission:play-card', { senderId: 1, card: true });
            room.bus.emit('mission:play-card', { senderId: 1, card: false });
            expect(room.state.pendingMissionCards[1]).toBe(true);
        });

        it('should not resolve before all team members play', () => {
            room.bus.emit('mission:play-card', { senderId: 1, card: true });
            expect(room.state.missions.length).toBe(0);
        });

        it('should succeed when all cards are true', () => {
            playMissionCards(room, [true, true]);
            expect(room.state.missions[0]!.success).toBe(true);
        });

        it('should have failCount 0 on successful mission', () => {
            playMissionCards(room, [true, true]);
            expect(room.state.missions[0]!.failCount).toBe(0);
        });

        it('should fail when a fail card is played', () => {
            playMissionCards(room, [true, false]);
            expect(room.state.missions[0]!.success).toBe(false);
        });

        it('should have correct failCount on failed mission', () => {
            playMissionCards(room, [true, false]);
            expect(room.state.missions[0]!.failCount).toBe(1);
        });

        it('should store mission number correctly', () => {
            playMissionCards(room, [true, true]);
            expect(room.state.missions[0]!.mission).toBe(0);
        });

        it('should store correct number of cards', () => {
            playMissionCards(room, [true, true]);
            expect(room.state.missions[0]!.cards.length).toBe(2);
        });

        it('should store nominations in mission result', () => {
            playMissionCards(room, [true, true]);
            expect(room.state.missions[0]!.nominations.length).toBe(1);
        });

        it('should broadcast mission:result', () => {
            playMissionCards(room, [true, true]);
            for (const ws of sockets) {
                expect(getMessageOfType(ws, 'mission:result')).toBeDefined();
            }
        });

        it('mission:result should include correct result', () => {
            playMissionCards(room, [true, false]);
            expect(getMessageOfType(sockets[0]!, 'mission:result').data.result).toBe(false);
        });

        it('mission:result should include correct failCount', () => {
            playMissionCards(room, [true, false]);
            expect(getMessageOfType(sockets[0]!, 'mission:result').data.failCount).toBe(1);
        });

        it('should clear pendingMissionCards after mission', () => {
            playMissionCards(room, [true, true]);
            allSubmitSus(room)
            expect(Object.keys(room.state.pendingMissionCards).length).toBe(0);
        });

        it('should clear pendingNominations after mission', () => {
            playMissionCards(room, [true, true]);
            allSubmitSus(room);
            expect(room.state.pendingNominations.length).toBe(0);
        });

        it('should enter suspicion phase after mission with no winner', () => {
            playMissionCards(room, [true, true]);
            expect(room.state.phase).toBe('suspicion');
        });

        it('should increment mission after post-mission suspicion', () => {
            playMissionCards(room, [true, true]);
            allSubmitSus(room);
            expect(room.state.mission).toBe(1);
        });

        it('should go to nomination after post-mission suspicion', () => {
            playMissionCards(room, [true, true]);
            allSubmitSus(room);
            expect(room.state.phase).toBe('nomination');
        });

        it('should reset round to 0 at start of new mission', () => {
            playMissionCards(room, [true, true]);
            allSubmitSus(room);
            expect(room.state.round).toBe(0);
        });

        it('should attach suspicions to last nomination of completed mission (cameFromMission = true)', () => {
            playMissionCards(room, [true, true]);
            // pendingNominations is empty here so cameFromMission = true
            allSubmitSus(room, { 4: 7 });
            expect(room.state.pendingNominations.length).toBe(0);
            expect(room.state.missions[0]!.nominations[0]!.suspicions).toBeDefined();
        });

        it('should rotate leader after mission suspicion', () => {
            const leaderBefore = room.state.leaderId;
            playMissionCards(room, [true, true]);
            allSubmitSus(room);
            expect(room.state.leaderId).not.toBe(leaderBefore);
        });
    });


    describe('4th mission double fail rule', () => {
        it('should succeed with 1 fail on mission 3 with 7 players', () => {
            const room7 = createRoom();
            addPlayers(room7, 7);
            startGame(room7, ['resistance', 'resistance', 'resistance', 'resistance', 'spy', 'spy', 'spy']);
            room7.state.mission = 3;
            room7.state.phase = 'mission';
            room7.state.nominatedTeam = [1, 2, 3, 4];

            room7.bus.emit('mission:play-card', { senderId: 1, card: true });
            room7.bus.emit('mission:play-card', { senderId: 2, card: true });
            room7.bus.emit('mission:play-card', { senderId: 3, card: true });
            room7.bus.emit('mission:play-card', { senderId: 4, card: false });

            expect(room7.state.missions[0]!.success).toBe(true);
        });

        it('should fail with 2 fails on mission 3 with 7 players', () => {
            const room7 = createRoom();
            addPlayers(room7, 7);
            startGame(room7, ['resistance', 'resistance', 'resistance', 'resistance', 'spy', 'spy', 'spy']);
            room7.state.mission = 3;
            room7.state.phase = 'mission';
            room7.state.nominatedTeam = [1, 2, 3, 4];

            room7.bus.emit('mission:play-card', { senderId: 1, card: true });
            room7.bus.emit('mission:play-card', { senderId: 2, card: true });
            room7.bus.emit('mission:play-card', { senderId: 3, card: false });
            room7.bus.emit('mission:play-card', { senderId: 4, card: false });

            expect(room7.state.missions[0]!.success).toBe(false);
        });

        it('should apply normal 1-fail rule on mission 3 with 5 players', () => {
            room.state.mission = 3;
            room.state.phase = 'mission';
            room.state.nominatedTeam = [1, 2, 3];

            room.bus.emit('mission:play-card', { senderId: 1, card: true });
            room.bus.emit('mission:play-card', { senderId: 2, card: true });
            room.bus.emit('mission:play-card', { senderId: 3, card: false });

            expect(room.state.missions[0]!.success).toBe(false);
        });
    });


    describe('win conditions', () => {
        beforeEach(() => {
            startGame(room, ROLES_5_PLAYER);
        });

        it('resistance should win after 3 successful missions', () => {
            runMission(room, [1, 2], [true, true]);
            runMission(room, [1, 2, 3], [true, true, true]);
            runMission(room, [1, 2], [true, true], true);
            expect(room.state.phase).toBe('game-over');
            expect(room.state.winner).toBe('resistance');
        });

        it('spies should win after 3 failed missions', () => {
            runMission(room, [1, 4], [true, false]);
            runMission(room, [1, 2, 4], [true, true, false]);
            runMission(room, [1, 4], [true, false], true);
            expect(room.state.phase).toBe('game-over');
            expect(room.state.winner).toBe('spies');
        });

        it('should broadcast game:ended with resistance winner and reason', () => {
            runMission(room, [1, 2], [true, true]);
            runMission(room, [1, 2, 3], [true, true, true]);
            runMission(room, [1, 2], [true, true], true);
            const msg = getMessageOfType(sockets[0]!, 'game:ended');
            expect(msg.data.winner).toBe('resistance');
            expect(msg.data.reason).toBe('mission-victory');
        });

        it('should broadcast game:ended with spies winner', () => {
            runMission(room, [1, 4], [true, false]);
            runMission(room, [1, 2, 4], [true, true, false]);
            runMission(room, [1, 4], [true, false], true);
            expect(getMessageOfType(sockets[0]!, 'game:ended').data.winner).toBe('spies');
        });

        it('resistanceWins should be 3 after resistance wins', () => {
            runMission(room, [1, 2], [true, true]);
            runMission(room, [1, 2, 3], [true, true, true]);
            runMission(room, [1, 2], [true, true], true);
            expect(room.state.resistanceWins).toBe(3);
            expect(room.state.spyWins).toBe(0);
        });

        it('spyWins should be 3 after spies win', () => {
            runMission(room, [1, 4], [true, false]);
            runMission(room, [1, 2, 4], [true, true, false]);
            runMission(room, [1, 4], [true, false], true);
            expect(room.state.spyWins).toBe(3);
            expect(room.state.resistanceWins).toBe(0);
        });

        it('winner should be null mid-game', () => {
            runMission(room, [1, 2], [true, true]);
            runMission(room, [1, 4, 3], [true, false, true]);
            expect(room.state.winner).toBeNull();
        });

        it('should correctly track mixed wins', () => {
            runMission(room, [1, 2], [true, true]);
            runMission(room, [1, 3, 4], [true, false, true]);
            runMission(room, [1, 3], [true, true]);
            expect(room.state.resistanceWins).toBe(2);
            expect(room.state.spyWins).toBe(1);
        });

        it('should store correct number of mission records', () => {
            runMission(room, [1, 2], [true, true]);
            runMission(room, [1, 2, 3], [true, true, true]);
            runMission(room, [1, 2], [true, true], true);
            expect(room.state.missions.length).toBe(3);
        });
    });


    describe('leader rotation', () => {
        beforeEach(() => {
            startGame(room, ROLES_5_PLAYER);
        });

        it('should rotate through all 5 players as leader', () => {
            const leaders: PlayerId[] = [];
            for (let i = 0; i < 5; i++) {
                leaders.push(room.state.leaderId);
                room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
                allReject(room);
                if (room.state.phase === 'suspicion') allSubmitSus(room);
            }
            expect(new Set(leaders).size).toBe(5);
        });

        it('should wrap leader rotation back to start', () => {
            runMission(room, [1, 2], [true, true]);
            expect(room.state.mission).toBe(1);
            expect(room.state.phase).toBe('nomination');

            runMission(room, [1, 2, 4], [true, true, false]); // spy win
            expect(room.state.mission).toBe(2);

            runMission(room, [1, 2], [true, true]);
            expect(room.state.mission).toBe(3);

            for (let i = 0; i < 2; i++) {
                room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2, 4] });
                allReject(room);
                if (room.state.phase === 'suspicion') allSubmitSus(room);
            }

            expect(room.state.leaderId).toBe(1);
        });

        it('leader should rotate after mission via suspicion', () => {
            const firstLeader = room.state.leaderId;
            runMission(room, [1, 2], [true, true]);
            allSubmitSus(room);
            expect(room.state.leaderId).not.toBe(firstLeader);
        });

        it('leader should follow seatOrder', () => {
            const firstLeader = room.state.leaderId;
            const seatOrder = room.state.seatOrder;
            const firstIndex = seatOrder.indexOf(firstLeader);
            const expectedNext = seatOrder[(firstIndex + 1) % seatOrder.length]!;

            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allReject(room);
            expect(room.state.leaderId).toBe(expectedNext);
        });
    });


    describe('full game flow', () => {
        it('resistance victory: 3 missions won', () => {
            startGame(room, ROLES_5_PLAYER);

            runMission(room, [1, 2], [true, true]);
            expect(room.state.mission).toBe(1);
            expect(room.state.phase).toBe('nomination');

            runMission(room, [1, 2, 4], [true, true, false]); // spy win
            expect(room.state.mission).toBe(2);

            runMission(room, [1, 2], [true, true]);
            expect(room.state.mission).toBe(3);

            runMission(room, [1, 2, 3], [true, true, true], true); // game over
            expect(room.state.phase).toBe('game-over');
            expect(room.state.winner).toBe('resistance');
            expect(room.state.missions.length).toBe(4);
        });

        it('spy victory: 3 missions failed', () => {
            startGame(room, ROLES_5_PLAYER);

            runMission(room, [1, 4], [true, false]);
            runMission(room, [1, 2, 4], [true, true, false]);
            runMission(room, [1, 4], [true, false], true);

            expect(room.state.phase).toBe('game-over');
            expect(room.state.winner).toBe('spies');
            expect(room.state.missions.length).toBe(3);
        });

        it('should correctly store all data in a mission record', () => {
            startGame(room, ROLES_5_PLAYER);

            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allApprove(room);
            playMissionCards(room, [true, true]);
            allSubmitSus(room);

            const m = room.state.missions[0]!;
            expect(m.mission).toBe(0);
            expect(m.success).toBe(true);
            expect(m.failCount).toBe(0);
            expect(m.cards.length).toBe(2);
            expect(m.nominations.length).toBe(1);
            expect(m.nominations[0]!.outcome).toBe(true);
            expect(m.nominations[0]!.proposedTeam).toEqual([1, 2]);
            expect(m.nominations[0]!.round).toBe(0);
        });

        it('should record multiple nomination attempts in a mission', () => {
            startGame(room, ROLES_5_PLAYER);

            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allReject(room);

            room.bus.emit('nomination:submit', { senderId: room.state.leaderId, team: [1, 2] });
            allApprove(room);
            playMissionCards(room, [true, true]);

            expect(room.state.missions[0]!.nominations.length).toBe(2);
            expect(room.state.missions[0]!.nominations[0]!.outcome).toBe(false);
            expect(room.state.missions[0]!.nominations[1]!.outcome).toBe(true);
        });
    });
});