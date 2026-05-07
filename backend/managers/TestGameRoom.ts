import { WebSocket } from '@fastify/websocket';
import { GameRoom } from './GameRoom.js';
import { TestGameState } from '../handlers/testGameState.js';

/**
 * Implements a basic version of Choptsicks
 */
export class TestGameRoom extends GameRoom {
    protected players: Map<string, WebSocket>;
    protected state: TestGameState;

    static async create(joinCode: number) {
        return new TestGameRoom(joinCode);
    }

    constructor(joinCode: number) {
        super(joinCode);
        this.players = new Map<string, WebSocket>();
        this.state = new TestGameState();
    }

    // ------------------ ------------------ Getters/Setters ------------------ ------------------ \\
    getPlayers(): Map<string, WebSocket> {
        return this.players;
    }

    getState(): TestGameState {
        return this.state;
    }

    // ------------------ ------------------ Basic Player/Socket Managment ------------------ ------------------ \\
    addPlayer(username: string, socket: WebSocket): boolean {
        if (this.players.size == 2) {
            return false;
        }

        this.players.set(username, socket);

        this.state.addPlayer(username)

        return true;
    }

    removePlayer(username: string): boolean {
        if (this.players.has(username)) {
            return false;
        }

        this.players.delete(username);
        this.state.removePlayer(username);
        return true;
    }

    // ------------------ ------------------ Messaging ------------------ ------------------ \\
    broadcast(data: any): void {
        let json = JSON.stringify(data);
        
        for (const conn of this.players.values()) {
            conn.send(json);
        }
    }
    
    broadcastState(): void {
        this.broadcast({
            type: "game_state",
            state: this.state
        });
    }

    // ------------------ ------------------ Gaming ------------------ ------------------ \\
    /**
     * Wraps the GameState's Transition Function
     */
    delta(input: any, action?: ['left' | 'right', 'left' | 'right'] | 'transfer' | 'divide'): void {
        const winner: string | undefined = this.state.delta(input, action);
        if (winner === undefined) {
            this.broadcast({
                current_player: this.state.getCurrentPlayer(),
                ...this.state.getGameData()
            });
        } else {
            this.broadcast({
                winner: winner
            });
        }
        
    }

}