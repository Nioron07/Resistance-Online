import { WebSocket } from "@fastify/websocket";

class UserStore {
    // ------------------- ------------------- Member Variables ------------------- ------------------- \\
    /**
     * @property
     * @private
     * 
     * Map of userid's to their open socket.
     * 
     * Specifically holds users that are currently playing a game.
     * In our case  'playing a game' constitutes as has a websocket open and is connected to a game room.
     * Therefore, it is the GameRoom instance's responsiblity to add and remove a player from the store.
     * 
     * Every so often*, the UserStore instance will check if each websocket is open. If a socket is not open, the instance will automatically remove the user from the map.
     * - *See `UserStore.interval`;
     */
    private playing_users: Map<number, WebSocket>;

    /**
     * @property
     * @protected
     *
     * Interval in milliseconds for how often the instance of UserStore will check to remove stale users.
     */
    private interval: number;

    /**
     * The NodeJS Timeout for `setInterval()`
     * 
     * Specifically for the stale user cleanup.
     */
    private cleanup: NodeJS.Timeout

    // ------------------- ------------------- Member Functions ------------------- ------------------- \\
    /**
     * @constructor
     * @param { number } interval `number = 300000 (5 Minutes)` Interval in milliseconds for how often the instance of UserStore will check to remove stale users.
     */
    constructor(interval: number = 300000) {
        this.playing_users = new Map<number, WebSocket>();
        this.interval = interval;
        this.cleanup = setInterval(() => {
            for (const [userid, socket] of this.playing_users) {
                if (socket.CLOSED) {
                    this.playing_users.delete(userid);
                }
            }
        }, this.interval);
    }

    // ------------------- Getters/Setters ------------------- \\
    setUserAsPlaying(userid: number, socket: WebSocket): void {
        this.playing_users.set(userid, socket);
    }

    removeUserFromPlaying(userid: number): void {
        this.playing_users.delete(userid);
    }

    clearStore(): void {
        if (this.cleanup) clearInterval(this.cleanup);
        this.playing_users.clear();
    }

    // ------------------- Predicates ------------------- \\
    isUserPlaying(userid: number): boolean {
        return this.playing_users.has(userid);
    }
}

export const user_store = new UserStore();