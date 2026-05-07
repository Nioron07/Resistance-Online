import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { roomManager } from '../../managers/RoomManager.js';
import { GameRoom } from '../../managers/GameRoom.js';

class FakeRoom extends GameRoom {
    addPlayer() {}
    removePlayer() {}
    broadcast() {}
    broadcastState() {}
}

async function registerFakeRoom(): Promise<{ code: number }> {
    let assigned = -1;
    const room = await roomManager.createRoom(async (code: number) => {
        assigned = code;
        return new FakeRoom(code);
    });
    expect(room).not.toBeNull();
    return { code: assigned };
}

describe('RoomManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('createRoom', () => {
        it('issues a 6-digit code in [0, 999999]', async () => {
            const { code } = await registerFakeRoom();
            expect(code).toBeGreaterThanOrEqual(0);
            expect(code).toBeLessThan(1000000);
            roomManager.removeRoom(code);
        });
    });

    describe('removeRoom', () => {
        it('drops the room from the manager', async () => {
            const { code } = await registerFakeRoom();
            expect(roomManager.hasRoom(code)).toBe(true);

            expect(roomManager.removeRoom(code)).toBe(true);
            expect(roomManager.hasRoom(code)).toBe(false);
        });
    });

    describe('scheduleRemoval', () => {
        it('removes the room after the grace window elapses', async () => {
            const { code } = await registerFakeRoom();

            roomManager.scheduleRemoval(code, 1000);
            expect(roomManager.hasRoom(code)).toBe(true);

            vi.advanceTimersByTime(999);
            expect(roomManager.hasRoom(code)).toBe(true);

            vi.advanceTimersByTime(1);
            expect(roomManager.hasRoom(code)).toBe(false);
        });

        it('is idempotent — a second schedule does not extend or duplicate', async () => {
            const { code } = await registerFakeRoom();

            roomManager.scheduleRemoval(code, 1000);
            // Second call while the first is pending should be ignored.
            roomManager.scheduleRemoval(code, 5000);

            vi.advanceTimersByTime(1000);
            expect(roomManager.hasRoom(code)).toBe(false);
        });

        it('does nothing for an unknown code', () => {
            // Should neither throw nor schedule anything.
            roomManager.scheduleRemoval(424242, 1000);
            vi.advanceTimersByTime(2000);
            expect(roomManager.hasRoom(424242)).toBe(false);
        });

        it('removeRoom cancels a pending removal timer', async () => {
            const { code } = await registerFakeRoom();
            roomManager.scheduleRemoval(code, 5000);

            // Manual remove now.
            roomManager.removeRoom(code);
            expect(roomManager.hasRoom(code)).toBe(false);

            // Reuse the same code, then advance past the original timer —
            // the cancelled timer must not fire and clobber the new room.
            const fresh = new FakeRoom(code);
            (roomManager as unknown as { rooms: Map<number, GameRoom> }).rooms.set(code, fresh);
            vi.advanceTimersByTime(10000);
            expect(roomManager.hasRoom(code)).toBe(true);

            roomManager.removeRoom(code);
        });
    });
});
