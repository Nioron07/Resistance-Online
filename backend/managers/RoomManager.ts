import { ResistanceGameRoom } from '../game/ResistanceGameRoom.js';
import { GameRoom } from './GameRoom.js';

class RoomManager {
    private rooms = new Map<number, GameRoom>;

    /**
     * Creates a new game with a unique 6-digit join code.
     *
     * @returns The GameRoom instance.
     */
    async createRoom<T extends GameRoom = GameRoom>(RoomFactory: (code: number, ...args: any[]) => Promise<T>): Promise<T | null> {
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
        return this.rooms.delete(code);
    }
}

export const roomManager = new RoomManager();