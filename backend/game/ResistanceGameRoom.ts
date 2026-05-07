import {GameRoom} from "../managers/GameRoom.js";
import {MessageBus} from "./bus/MessageBus.js";
import {ClientEvents, InternalEvents, ServerEvents} from "./types/Events.js";
import {GamePlugin} from "./plugins/GamePlugin.js";
import {WebSocket} from "@fastify/websocket";
import {ResistanceState} from "./ResistanceState.js";
import {PlayerId} from "./types/GameTypes.js";
import { DAC } from "../utils/db-queries/DataAccessClass.js";

export class ResistanceGameRoom extends GameRoom{
    maxSize: number = 10;
    players: Map<PlayerId, WebSocket>;
    bus = new MessageBus<ClientEvents & InternalEvents & ServerEvents>();
    plugins: GamePlugin[] = [];
    host: PlayerId | null = null;

    state: ResistanceState;

    meta_data: {
        gameid: number
    };
  
    private reconnectTimers = new Map<PlayerId, ReturnType<typeof setTimeout> | null>();
    private readonly reconnectGrace = 8000;
                                                           
    /**
     * @async
     * 
     * @static
     * 
     * Factory method to safely create the game room
     * 
     * This is needed because there is important meta data that the system needs to wait for from the db before the room can actually be created.
     * 
     * In other words, calls this instead of the constructor.
     * 
     * @param join_code 
     * @returns 
     * @throws
     */
    static async create(join_code: number): Promise<ResistanceGameRoom> {
        // Create Game Row in the DB
        const gameid = await DAC.resistance.games.create();

        // Create the Game Room using the game id
        /**
         * @note I could go around and hunt for all of the types to fix the typing on `gameid`, but it won't matter.
         *      This is because `gameid` is only ever null iff the DAC is disabled (proof by trust be bro).
         *      That means, because I am one of the greatest, most masculine coders on planet earth (iykyk), it won't matter.
         * - Joseph Habisohn 4/21/2026 
         */
        return new ResistanceGameRoom(join_code, gameid!); 
    }

    /**
     * @constructor
     * 
     * To only be used internally.
     * 
     * `@gameid` is a primary key in the database so we can't create this object until the game row has been created.
     * 
     * Therefore, use `ResistanceGameRoom.create()` instead of teh constructor directly.
     * 
     * @param joinCode 
     * @param gameid 
     */
    constructor(joinCode: number, gameid: number) {
        super(joinCode);
        this.players = new Map<PlayerId, WebSocket>();
        this.state = new ResistanceState();
        this.meta_data = {
            gameid: gameid
        };
    }

    /**
     * Adds a player to the room. Should only be called when a new WebSocket connection is established
     *
     * @param playerId The player by ID to add
     * @param ws The player WebSocket
     */
    addPlayer(playerId: PlayerId, ws: WebSocket): boolean {
        if (this.reconnectTimers.has(playerId)) {
            const timer = this.reconnectTimers.get(playerId);
            if (timer) {
                clearTimeout(timer);
            }
            this.reconnectTimers.delete(playerId);

            const oldSocket = this.players.get(playerId);
            if (oldSocket && oldSocket !== ws) {
                oldSocket.close(3000, 'Replaced by new connection');
            }

            this.players.set(playerId, ws);
            this.send(ws, "state:update", {state: this.state.serializeFor(playerId)}); // resync state
            this.bus.emit('player:reconnect', { playerId });
            return true;
        }

        if (this.players.has(playerId)) {
            const oldSocket = this.players.get(playerId);
            if (oldSocket && oldSocket !== ws) {
                oldSocket.close(3000, 'Replaced by new connection');
            }
            this.players.set(playerId, ws);
            return true;
        }

        // after lobby dont allow joins
        if (this.state.phase !== 'lobby' && !this.state.players.has(playerId)) return false;

        if (this.players.size >= this.maxSize) return false;

        this.players.set(playerId, ws);

        this.bus.emit("player:join", {playerId});

        return true;
    }

    /**
     * Removes a player from the room
     *
     * @param playerId The player by ID to remove
     * @param socket The disconnecting socket. Handles a duplicate join scenario
     */
    removePlayer(playerId: PlayerId, socket?: WebSocket): boolean {
        if (!this.players.has(playerId)) return false;
        if (socket && this.players.get(playerId) !== socket) return false;

        if (this.reconnectTimers.has(playerId)) {
            clearTimeout(this.reconnectTimers.get(playerId)!);
        }

        this.players.delete(playerId);

        if (this.state.phase === 'lobby') {
            const timer = setTimeout(() => {
                this.reconnectTimers.delete(playerId);
                this.bus.emit('player:leave', { playerId });
            }, this.reconnectGrace);

            this.reconnectTimers.set(playerId, timer);
        } else {
            this.reconnectTimers.set(playerId, null);
        }

        this.bus.emit('player:disconnect', { playerId });
        return true;
    }

    /**
     * Adds a logic plugin to the game
     *
     * @param plugin The plugin to add
     */
    use(plugin: GamePlugin) {
        plugin.init(this);
        this.plugins.push(plugin);
    }

    /**
     * Sends the event to a specific user.
     *
     * @param ws The user WebSocket
     * @param event The ServerEvent
     * @param data Corresponding data for the event
     */
    send<K extends keyof ServerEvents>(ws: WebSocket, event: K, data: ServerEvents[K]) {
        try {
            ws.send(JSON.stringify({event, data}));
        } catch (err) {
            console.warn(`[WS] send failed for event ${String(event)}`, err);
        }
    }

    /**
     * Broadcasts the selected ServerEvent to every client.
     * A failing socket is logged and skipped; it must not abort the loop.
     *
     * @param event The ServerEvent
     * @param data Corresponding data for the event
     */
    broadcast<K extends keyof ServerEvents>(event: K, data: ServerEvents[K]) {
        const msg = JSON.stringify({event, data});

        for (const [playerId, ws] of this.players.entries()) {
            try {
                ws.send(msg);
            } catch (err) {
                console.warn(`[WS] broadcast send failed for player ${playerId}`, err);
            }
        }
    }

    /**
     * Broadcasts the full state per the visibility rules for each player
     */
    broadcastState() {
        for (const [playerId, ws] of this.players.entries()) {
            try {
                ws.send(JSON.stringify({event: "state:update", data: {state: this.state.serializeFor(playerId)}}));
            } catch (err) {
                console.warn(`[WS] state:update send failed for player ${playerId}`, err);
            }
        }
    }
}