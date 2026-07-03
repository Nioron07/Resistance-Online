import { GameRoom } from './GameRoom.js';

// Grace window after a game ends before its room is deleted, so players
// can briefly reconnect and see the end screen.
const POST_GAME_GRACE_MS = 5 * 60 * 1000;

class RoomManager {
    private rooms = new Map<number, GameRoom>;
    private cleanupTimers = new Map<number, ReturnType<typeof setTimeout>>();

    /**
     * Creates a new game with a unique 6-digit join code.
     *
     * @returns The GameRoom instance.
     */
    async createRoom<T extends GameRoom = GameRoom>(RoomFactory: (code: number, ...args: unknown[]) => Promise<T>): Promise<T | null> {
        let code: number | undefined = undefined;
        do {
            code = Math.floor(Math.random() * 1000000);
        } while (this.rooms.has(code));

        try {
            const room = await RoomFactory(code);
    
            this.rooms.set(code, room);
            return room;
        } catch(error) {
            console.error(error);
            return null;
        }
    }

    // ------------------ ------------------ Predicates ------------------ ------------------ \\
    hasRoom(code: number): boolean {
        return this.rooms.has(code);
    }

    /**
     * 
     * @param `number` code Join Code to be Validate
     * @returns `GameRoom | { code: number, msg: string }` Either the GameRoom or a object describing the error
     */
    validateCode<T extends GameRoom = GameRoom>(code: number): T | {
        code: number,
        msg: string
    } {
        // Got to actually be a number between 0 and 999999
        if (isNaN(code) || code < 0 || code > 999999) {
            return {
                code: 400,
                msg: 'Error (400): Invalid join code format'
            };
        }

        const room = roomManager.getRoom<T>(code);

        // Has to actually exist already
        if (!room) {
            return {
                code: 404,
                msg: 'Error (404): Game not found'
            };
        }

        return room;
    }
    // ------------------ ------------------ Getters/Setters ------------------ ------------------ \\
    getRoom<T extends GameRoom = GameRoom>(code: number): T | undefined {
        return this.rooms.get(code) as T;
    }

    removeRoom(code: number): boolean {
        const timer = this.cleanupTimers.get(code);
        if (timer) {
            clearTimeout(timer);
            this.cleanupTimers.delete(code);
        }
        return this.rooms.delete(code);
    }

    /**
     * Cancel a pending scheduled removal (e.g. a player reconnected to an
     * abandoned room). No-op if nothing is scheduled.
     */
    cancelRemoval(code: number): void {
        const timer = this.cleanupTimers.get(code);
        if (timer) {
            clearTimeout(timer);
            this.cleanupTimers.delete(code);
        }
    }

    /**
     * Schedule deletion of a room after the post-game grace window. Idempotent:
     * a second call with the same code is a no-op while the timer is pending.
     */
    scheduleRemoval(code: number, delayMs: number = POST_GAME_GRACE_MS): void {
        if (this.cleanupTimers.has(code)) return;
        if (!this.rooms.has(code)) return;

        const timer = setTimeout(() => {
            this.cleanupTimers.delete(code);
            this.rooms.delete(code);
        }, delayMs);
        // Don't keep the event loop alive just for cleanup.
        if (typeof timer === 'object' && timer && 'unref' in timer) {
            (timer as { unref?: () => void }).unref?.();
        }
        this.cleanupTimers.set(code, timer);
    }
}

export const roomManager = new RoomManager();