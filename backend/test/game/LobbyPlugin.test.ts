import {ResistanceState} from "../../game/ResistanceState.js";
import {ResistanceGameRoom} from "../../game/ResistanceGameRoom.js";
import {LobbyPlugin} from "../../game/plugins/LobbyPlugin.js";
import {WebSocket} from "@fastify/websocket";
import {vi} from "vitest";

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
    return {
        id,
        send: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
    } as unknown as WebSocket;
}

function getMessages(ws: WebSocket) {
    return (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
}

function getLastMessage(ws: WebSocket) {
    return getMessages(ws).at(-1);
}

async function createRoom() {
    const room = await ResistanceGameRoom.create(1234);
    room.use(new LobbyPlugin());
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

describe('LobbyPlugin', () => {
    let room: ResistanceGameRoom;

    beforeEach(async () => {
        room = await createRoom();
    });

    describe('player:join', () => {
        it('should add a player to state', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);

            expect(room.state.players.get(1)).toBeDefined();
            expect(room.state.players.get(1)!.connected).toBe(true);
            expect(room.state.players.get(1)!.plotCardsInHand).toEqual([]);
        });

        it('should receive a message on initial join', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);

            expect(ws.send).toHaveBeenCalled();
        });

        it('should set the first player as host', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);

            expect(room.host).toBe(1);
        });

        it('should not change host when a second player joins', () => {
            addPlayers(room, 2);

            expect(room.host).toBe(1);
        });

        it('should broadcast player:joined with the new player id', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);

            const msg = getLastMessage(ws);
            expect(msg.event).toBe('player:joined');
            expect(msg.data.playerId).toBe(1);
        });

        it('should broadcast updated player list on join', () => {
            const ws1 = createMockSocket(1);
            room.addPlayer(1, ws1);
            const ws2 = createMockSocket(2);
            room.addPlayer(2, ws2);

            const msg = getLastMessage(ws1);
            expect(msg.event).toBe('player:joined');
            expect(msg.data.players).toContain(1);
            expect(msg.data.players).toContain(2);
        });

        it('should not add player when not in lobby phase', () => {
            addPlayers(room, 1);
            room.state.phase = 'nomination';

            const ws = createMockSocket(99);
            const added = room.addPlayer(99, ws);

            expect(added).toBe(false);
            expect(room.state.players.get(99)).toBeUndefined();
            expect(room.players.has(99)).toBe(false);
        });

        it('should allow reconnect for existing player when not in lobby phase', () => {
            vi.useFakeTimers();
            const ws = addPlayers(room, 1);
            room.state.phase = 'nomination';

            room.removePlayer(1, ws[0]);
            const added = room.addPlayer(1, createMockSocket(1));

            expect(added).toBe(true);
            expect(room.players.has(1)).toBe(true);
            expect(room.state.players.get(1)!.connected).toBe(true);
            vi.useRealTimers();
        });

        it('should not add a player when the room is at max capacity', () => {
            addPlayers(room, 10);

            const ws11 = createMockSocket(11);
            const result = room.addPlayer(11, ws11);

            expect(result).toBe(false);
            expect(room.state.players.get(11)).toBeUndefined();
            expect(room.state.players.size).toBe(10);
        });
    });
    describe('player:leave', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should do nothing if player does not exist', () => {
            expect(room.removePlayer(999, createMockSocket(999))).toBe(false);
        });

        it('should remove the socket immediately on disconnect', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            expect(room.players.has(1)).toBe(false);
        });

        it('should NOT remove player from state during grace period', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            expect(room.state.players.get(1)).toBeDefined();
            expect(room.state.players.get(1)?.connected).toBe(false);
        });

        it('should remove player from state after grace period expires in lobby', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            vi.advanceTimersByTime(8000);

            expect(room.state.players.get(1)).toBeUndefined();
        });

        it('should NOT remove player from state after grace period expires during a game', () => {
            const ws = addPlayers(room, 1);
            room.state.phase = 'nomination';
            room.removePlayer(1, ws[0]);

            vi.advanceTimersByTime(8000);

            expect(room.state.players.get(1)).toBeDefined();
            expect(room.state.players.get(1)?.connected).toBe(false);
        });

        it('should transfer host to next player when host leaves and grace expires in lobby', () => {
            const ws = addPlayers(room, 2);
            room.removePlayer(1, ws[0]);

            vi.advanceTimersByTime(8000);

            expect(room.host).toBe(2);
        });

        it('should NOT transfer host during a game when grace expires', () => {
            const ws = addPlayers(room, 2);
            room.state.phase = 'nomination';
            room.removePlayer(1, ws[0]);

            vi.advanceTimersByTime(8000);

            expect(room.host).toBe(1); // host unchanged
        });

        it('should set host to null when last player leaves and grace expires in lobby', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            vi.advanceTimersByTime(8000);

            expect(room.host).toBeNull();
        });

        it('should broadcast player:left after grace period expires in lobby', () => {
            const ws1 = createMockSocket(1);
            room.addPlayer(1, ws1);
            const ws2 = createMockSocket(2);
            room.addPlayer(2, ws2);

            room.removePlayer(1, ws1);
            vi.clearAllMocks();
            vi.advanceTimersByTime(8000);

            const msg = getLastMessage(ws2);
            expect(msg.event).toBe('player:left');
            expect(msg.data.playerId).toBe(1);
        });

        it('should NOT broadcast player:left after grace period expires during a game', () => {
            const ws1 = createMockSocket(1);
            room.addPlayer(1, ws1);
            const ws2 = createMockSocket(2);
            room.addPlayer(2, ws2);

            room.state.phase = 'nomination';
            room.removePlayer(1, ws1);
            vi.clearAllMocks();
            vi.advanceTimersByTime(8000);

            expect(ws2.send).not.toHaveBeenCalled();
        });

        it('should ignore a disconnect from an old socket if the player has already rejoined', () => {
            const wsOld = createMockSocket(1);
            room.addPlayer(1, wsOld);

            const wsNew = createMockSocket(1);
            room.addPlayer(1, wsNew);

            const removed = room.removePlayer(1, wsOld);

            expect(removed).toBe(false);
            expect(room.state.players.get(1)).toBeDefined();
            expect(room.players.get(1)).toBe(wsNew);
        });
    });

    describe('reconnect', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should allow reconnect during grace period in lobby', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            vi.advanceTimersByTime(4000);

            const wsNew = createMockSocket(1);
            const result = room.addPlayer(1, wsNew);

            expect(result).toBe(true);
            expect(room.players.get(1)).toBe(wsNew);
        });

        it('should allow reconnect after grace period expires during a game', () => {
            const ws = addPlayers(room, 1);
            room.state.phase = 'nomination';
            room.removePlayer(1, ws[0]);

            expect(room.state.players.get(1)?.connected).toBe(false);

            vi.advanceTimersByTime(8001); // past grace but timer is null so stays in reconnectTimers

            const wsNew = createMockSocket(1);
            const result = room.addPlayer(1, wsNew);

            expect(result).toBe(true);
            expect(room.players.get(1)).toBe(wsNew);
            expect(room.state.players.get(1)).toBeDefined();
            expect(room.state.players.get(1)?.connected).toBe(true);
        });

        it('should not allow reconnect after grace period expires in lobby', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            vi.advanceTimersByTime(8001);

            // after grace in lobby, player:leave fired and state was cleaned up
            expect(room.state.players.get(1)).toBeUndefined();

            // treated as a fresh join
            const wsNew = createMockSocket(1);
            const result = room.addPlayer(1, wsNew);
            expect(result).toBe(true); // fresh join, lobby still open
            expect(room.state.players.size).toBe(1); // added fresh
        });

        it('should cancel the grace timer on reconnect', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            const wsNew = createMockSocket(1);
            room.addPlayer(1, wsNew);

            vi.advanceTimersByTime(8000);

            expect(room.state.players.get(1)).toBeDefined();
            expect(room.players.has(1)).toBe(true);
        });

        it('should send state:update to reconnecting player', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            const wsNew = createMockSocket(1);
            vi.clearAllMocks();
            room.addPlayer(1, wsNew);

            const msgs = getMessages(wsNew);
            expect(msgs.some((m: any) => m.event === 'state:update')).toBe(true);
        });

        it('should broadcast player:reconnected on successful reconnect', () => {
            const ws1 = createMockSocket(1);
            room.addPlayer(1, ws1);
            const ws2 = createMockSocket(2);
            room.addPlayer(2, ws2);

            room.removePlayer(1, ws1);
            vi.clearAllMocks();

            const ws1New = createMockSocket(1);
            room.addPlayer(1, ws1New);

            const msg = getLastMessage(ws2);
            expect(msg.event).toBe('player:reconnected');
            expect(msg.data.playerId).toBe(1);
        });

        it('should close the old socket when reconnecting with a new one', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            room.players.set(1, ws); // simulate stale ref still in map

            const wsNew = createMockSocket(1);
            room.addPlayer(1, wsNew);

            expect(ws.close).toHaveBeenCalledWith(3000, 'Replaced by new connection');
        });

        it('should handle rapid disconnect and reconnect without corrupting state', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);
            room.addPlayer(1, createMockSocket(1));

            vi.advanceTimersByTime(8000);

            expect(room.state.players.get(1)).toBeDefined();
            expect(room.host).toBe(1);
            expect(room.state.players.get(1)?.connected).toBe(true);
        });

        it('should emit player:disconnect immediately on removePlayer', () => {
            const disconnectHandler = vi.fn();
            room.bus.on('player:disconnect', 10, disconnectHandler);

            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            expect(disconnectHandler).toHaveBeenCalledWith({ playerId: 1 });
            expect(room.state.players.get(1)?.connected).toBe(false);
        });

        it('should not emit player:leave until grace period expires in lobby', () => {
            const leaveHandler = vi.fn();
            room.bus.on('player:leave', 10, leaveHandler);

            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);

            expect(leaveHandler).not.toHaveBeenCalled();

            vi.advanceTimersByTime(8000);

            expect(leaveHandler).toHaveBeenCalledWith({ playerId: 1 });
        });

        it('should never emit player:leave during a game regardless of time elapsed', () => {
            const leaveHandler = vi.fn();
            room.bus.on('player:leave', 10, leaveHandler);

            const ws = addPlayers(room, 1);
            room.state.phase = 'nomination';
            room.removePlayer(1, ws[0]);

            vi.advanceTimersByTime(60000); // way past any grace period

            expect(leaveHandler).not.toHaveBeenCalled();
            expect(room.state.players.get(1)?.connected).toBe(false);
        });
    });

    describe('both join and leave or rejoin logic', () => {
        it('should maintain host status when the host rejoins', () => {
            addPlayers(room, 2);
            expect(room.host).toBe(1);

            const ws1New = createMockSocket(1);
            room.addPlayer(1, ws1New);

            expect(room.host).toBe(1);
        });

        it('should replace the old socket and NOT double-add the player on rejoin', () => {
            const ws1 = createMockSocket(1);
            room.addPlayer(1, ws1);

            vi.clearAllMocks();

            const ws2 = createMockSocket(1);
            room.addPlayer(1, ws2);

            expect(room.state.players.size).toBe(1);
            expect(room.players.get(1)).toBe(ws2);

            room.broadcastState();
            expect(ws1.send).not.toHaveBeenCalled();
            expect(ws2.send).toHaveBeenCalled();
        });

        it('should ignore a disconnect from an old socket if the player has already rejoined', () => {
            const wsOld = createMockSocket(1);
            room.addPlayer(1, wsOld);

            const wsNew = createMockSocket(1);
            room.addPlayer(1, wsNew);

            const removed = room.removePlayer(1, wsOld);

            expect(removed).toBe(false);
            expect(room.state.players.get(1)).toBeDefined();
            expect(room.players.get(1)).toBe(wsNew);
        });

        it('should handle rapid-fire join and leave without corrupting state', () => {
            const ws = createMockSocket(1);
            room.addPlayer(1, ws);
            room.removePlayer(1, ws);
            room.addPlayer(1, createMockSocket(1));

            expect(room.state.players.get(1)).toBeDefined();
            expect(room.host).toBe(1);
        });
    });

    describe('game:configure', () => {
        it('should update modulesEnabled when sent by host', () => {
            addPlayers(room, 1);

            room.bus.emit('game:configure', {
                senderId: 1,
                modulesEnabled: ['assassin'],
                optionalRoles: []
            });

            expect(room.state.config.modulesEnabled).toContain('assassin');
        });

        it('should update optionalRoles when sent by host', () => {
            addPlayers(room, 1);

            room.bus.emit('game:configure', {
                senderId: 1,
                modulesEnabled: ['assassin'],
                optionalRoles: ['bodyguard']
            });

            expect(room.state.config.optionalRoles).toContain('bodyguard');
        });

        it('should ignore configure from non-host', () => {
            addPlayers(room, 2);

            room.bus.emit('game:configure', {
                senderId: 2,
                modulesEnabled: ['assassin'],
                optionalRoles: []
            });

            expect(room.state.config.modulesEnabled).not.toContain('assassin');
        });

        it('should ignore configure when not in lobby phase', () => {
            addPlayers(room, 1);
            room.state.phase = 'nomination';

            room.bus.emit('game:configure', {
                senderId: 1,
                modulesEnabled: ['assassin'],
                optionalRoles: []
            });

            expect(room.state.config.modulesEnabled).not.toContain('assassin');
        });
    });

    describe('game:start', () => {
        it('should not start with fewer than 5 players', () => {
            const ws = addPlayers(room, 4);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            expect(room.state.config.playerCount).not.toBe(4);

            const messages = getMessages(ws[0]!);
            const startedEvent = messages.find((m: any) => m.event === 'game:started');
            expect(startedEvent).toBeUndefined();
        });

        it('should not start if sender is not host', () => {
            addPlayers(room, 5);

            room.bus.emit('game:start', { senderId: 5, leaderId: 1, seatOrder: [...room.state.players.keys()]});

            expect(room.state.config.playerCount).not.toBe(5);
        });

        it('should not start when not in lobby phase', () => {
            addPlayers(room, 5);

            room.state.phase = 'nomination';
            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            expect(room.state.rules).toBeNull();
        });

        it('should broadcast game:started on valid start', async () => {
            const sockets = addPlayers(room, 5);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            await Promise.resolve();

            const msg = getLastMessage(sockets[0]!);
            expect(msg.event).toBe('game:started');
        });

        it('should set playerCount from connected players', () => {
            addPlayers(room, 5);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            expect(room.state.config.playerCount).toBe(5);
        });

        it('should set rules after start', () => {
            addPlayers(room, 5);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            expect(room.state.rules).not.toBeNull();
        });

        it('should set correct spy count in rules for 5 players', () => {
            addPlayers(room, 5);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            expect(room.state.rules!.spyCount).toBe(2);
        });

        it('should set correct spy count in rules for 7 players', () => {
            addPlayers(room, 7);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            expect(room.state.rules!.spyCount).toBe(3);
        });

        it('should broadcast game:started to all players', async () => {
            const sockets = addPlayers(room, 5);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            await Promise.resolve();

            for (const ws of sockets) {
                expect(getLastMessage(ws).event).toBe('game:started');
            }
        });

        it('should transition to role-reveal phase', () => {
            addPlayers(room, 5);

            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            expect(room.state.phase).toBe('role-reveal');
        });
    });

    describe('serializeForMetrics', () => {
        it('should serialize players map to a plain object with numeric keys', () => {
            addPlayers(room, 3);

            const parsed = JSON.parse(room.state.serializeForMetrics());

            expect(parsed.players).toBeDefined();
            expect(typeof parsed.players).toBe('object');
            expect(Array.isArray(parsed.players)).toBe(false);

            expect(parsed.players['1']).toBeDefined();
            expect(parsed.players['2']).toBeDefined();
            expect(parsed.players['3']).toBeDefined();
        });

        it('should preserve player state values when serialized', () => {
            addPlayers(room, 2);

            const parsed = JSON.parse(room.state.serializeForMetrics());

            expect(parsed.players['1'].playerId).toBe(1);
            expect(parsed.players['1'].connected).toBe(true);
            expect(parsed.players['1'].plotCardsInHand).toEqual([]);
        });

        it('should round-trip correctly through fromJSON', () => {
            addPlayers(room, 3);

            const serialized = room.state.serializeForMetrics();
            const restored = ResistanceState.fromJSON(serialized);

            expect(restored.players.size).toBe(3);
            expect(restored.players.get(1)).toBeDefined();
            expect(restored.players.get(1)!.playerId).toBe(1);
            expect(restored.players.get(2)).toBeDefined();
            expect(restored.players.get(3)).toBeDefined();
        });

        it('should serialize other state fields correctly', () => {
            addPlayers(room, 5);
            room.bus.emit('game:start', { senderId: 1, leaderId: 1, seatOrder: [...room.state.players.keys()] });

            const parsed = JSON.parse(room.state.serializeForMetrics());

            expect(parsed.phase).toBe('role-reveal');
            expect(parsed.config.playerCount).toBe(5);
            expect(parsed.rules).not.toBeNull();
            expect(parsed.rules.spyCount).toBe(2);
        });
    });

        // it('should assign every player exactly one role', () => {
        //     addPlayers(room, 5);
        //
        //     const assignments = getAssignments(room);
        //
        //     expect(Object.keys(assignments).length).toBe(5);
        // });

        // it('should assign correct number of spies for 5 players', () => {
        //     addPlayers(room, 5);
        //
        //     const assignments = getAssignments(room);
        //
        //     const spyRoles = ['spy', 'assassin', 'false-commander', 'deep-cover', 'blind-spy'];
        //     const count = Object.values(assignments).filter(r => spyRoles.includes(r as string)).length;
        //     expect(count).toBe(2);
        // });
        //
        // it('should assign correct number of spies for 7 players', () => {
        //     addPlayers(room, 7);
        //
        //     const assignments = getAssignments(room);
        //
        //     const spyRoles = ['spy', 'assassin', 'false-commander', 'deep-cover', 'blind-spy'];
        //     const count = Object.values(assignments).filter(r => spyRoles.includes(r as string)).length;
        //     expect(count).toBe(3);
        // });
        //
        // it('should assign commander and assassin when assassin module enabled', () => {
        //     addPlayers(room, 5);
        //
        //     room.bus.emit('game:configure', { senderId: 'player-0', modulesEnabled: ['assassin'], optionalRoles: [] });
        //
        //     const assignments = getAssignments(room);
        //     const roles = Object.values(assignments);
        //
        //     expect(roles).toContain('commander');
        //     expect(roles).toContain('assassin');
        // });
        //
        // it('should include optional roles when configured', () => {
        //     addPlayers(room, 5);
        //
        //     room.bus.emit('game:configure', { senderId: 'player-0', modulesEnabled: ['assassin'], optionalRoles: ['bodyguard'] });
        //
        //     const assignments = getAssignments(room);
        //
        //     expect(Object.values(assignments)).toContain('bodyguard');
        // });
        //
        // it('should emit roles:assigned as a logged event', () => {
        //     addPlayers(room, 5);
        //
        //     room.bus.emit('game:start', { senderId: 'player-0' });
        //
        //     const log = (room.bus as any).log as { event: string }[];
        //
        //     expect(log.some(entry => entry.event === 'roles:assigned')).toBe(true);
        // });
});
