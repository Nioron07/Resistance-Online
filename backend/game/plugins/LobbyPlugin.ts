import {GamePlugin} from "./GamePlugin.js";
import {getRulesFor} from "../types/GameTypes.js";
import { DAC } from "../../utils/db-queries/DataAccessClass.js";
import { roomManager } from "../../managers/RoomManager.js";

const MIN_PLAYERS = 5;

export class LobbyPlugin extends GamePlugin {
    protected register() {
        /**
         * @note We can add functions to the below line such as broadcast, but we need to change them to
         * arrow functions in ResistanceGameRoom for that to work since "this" is used in them.
         * - Eric Brewster 03/23/26
         */
        const {bus, state, meta_data} = this.room;

        bus.on("player:join", 999, async (e) => {
            if (state.phase !== 'lobby') return;

            state.players.set(e.playerId, {
                playerId: e.playerId,
                connected: true,
                plotCardsInHand: [],
                role: undefined,
                knownRoles: undefined
            });

            // Append to the canonical seat order; the host can reorder later
            // via `lobby:reorder`.
            if (!state.seatOrder.includes(e.playerId)) {
                state.seatOrder.push(e.playerId);
            }

            if (this.room.host === null) this.room.host = e.playerId;

            this.room.broadcast("player:joined", {playerId: e.playerId, players: [...state.seatOrder]});
            this.room.broadcast("lobby:reordered", {seatOrder: [...state.seatOrder], hostId: this.room.host});

            await DAC.resistance.games.id(meta_data.gameid).playerId(e.playerId).add();
        })

        bus.on("player:reconnect", 999, e => {
            this.room.state.players.get(e.playerId)!.connected = true;

            this.room.broadcast('player:reconnected', {playerId: e.playerId});
        })

        bus.on("player:leave", 999, async (e) => {
            if (state.phase !== 'lobby') return;
            if (!state.players.get(e.playerId)) return;

            state.players.delete(e.playerId);
            state.seatOrder = state.seatOrder.filter(id => id !== e.playerId);

            if (this.room.host === e.playerId) {
                this.room.host = state.seatOrder[0] ?? state.players.keys().next().value ?? null;
            }

            this.room.broadcast("player:left", {playerId: e.playerId});
            this.room.broadcast("lobby:reordered", {seatOrder: [...state.seatOrder], hostId: this.room.host});

            await DAC.resistance.games.id(meta_data.gameid).playerId(e.playerId).remove();

            // If the lobby is empty after this leave, the room is dead. Drop
            // it from the manager immediately so codes don't accumulate.
            if (state.players.size === 0) {
                roomManager.removeRoom(this.room.getJoinCode());
            }
        });

        bus.on("player:disconnect", 100, async (e) => {
            const player = this.room.state.players.get(e.playerId);
            if (player) {
                player.connected = false;
            }

            this.room.broadcast('player:disconnected', {playerId: e.playerId});
        });

        /**
         * Host-only seat reorder during the lobby phase. The new `seatOrder`
         * must be a permutation of the current player set — same size, no
         * duplicates, no unknown ids. Anything else is silently ignored
         * (validation already happened at the WS boundary, this is defense
         * in depth).
         */
        bus.on("lobby:reorder", 100, e => {
            if (state.phase !== 'lobby') return;
            if (e.senderId !== this.room.host) return;

            const current = state.players;
            if (e.seatOrder.length !== current.size) return;
            const seen = new Set<number>();
            for (const id of e.seatOrder) {
                if (!current.has(id)) return;
                if (seen.has(id)) return;
                seen.add(id);
            }

            state.seatOrder = [...e.seatOrder];
            this.room.broadcast("lobby:reordered", {seatOrder: [...state.seatOrder], hostId: this.room.host});
        });

        bus.on("game:configure", 999, async (e) => {
            if (state.phase !== 'lobby') return;
            if (e.senderId !== this.room.host) return;

            if (e.modulesEnabled !== undefined) state.config.modulesEnabled = e.modulesEnabled;
            if (e.optionalRoles !== undefined) state.config.optionalRoles = e.optionalRoles;

            this.room.broadcast("game:configured", {
                modulesEnabled: [...state.config.modulesEnabled],
                optionalRoles: [...state.config.optionalRoles],
            });

            await DAC.resistance.games.id(meta_data.gameid).updateSettings({
                modulesEnabled: state.config.modulesEnabled,
                optionalRoles: state.config.optionalRoles
            });
        });

        bus.on("game:start", 999, async(e) => {
            if (state.phase !== 'lobby') return;
            if (e.senderId !== this.room.host) return;
            if (state.players.size < MIN_PLAYERS) return;

            const allConnected = [...state.players.values()].every(p => p.connected);
            if (!allConnected) {
                const disconnected = [...state.players.values()].filter(p => !p.connected).map(p => p.playerId);
                this.room.send(this.room.players.get(this.room.host!)!, "socket:error", {message: `Cannot start: players disconnected: ${disconnected.join(', ')}`});
                return;
            }

            // The client-sent seatOrder must be a permutation of the actual
            // player set and the leader must be one of them — otherwise a
            // buggy/malicious host could inject foreign ids or drop players
            // and corrupt leader rotation.
            if (e.seatOrder.length !== state.players.size
                || e.seatOrder.some(id => !state.players.has(id))
                || !e.seatOrder.includes(e.leaderId)) {
                this.room.send(this.room.players.get(this.room.host!)!, "socket:error", {message: 'Invalid seat order or leader for game start.'});
                return;
            }

            state.config.playerCount = this.room.players.size;
            state.rules = getRulesFor(state.config.playerCount);
            state.leaderId = e.leaderId;
            state.seatOrder = e.seatOrder;
            state.phase = 'role-reveal';

            /**
             * @note I am deciding to handle game start different than the other ones with respect to the db.
             *    I need the game start query to complete before the users are told that the game has started for the sake of data integrity.
             *    This is because I donn't want user action to happen for the actual gamerow is fully set up.
             * - Joseph Habisohn 4/26/2026
             */
            await DAC.resistance.games.id(meta_data.gameid).start();

            this.room.broadcast("game:started", {});
        });
    }
}