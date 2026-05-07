import { WebSocket } from "@fastify/websocket";

export abstract class GameRoom {
    protected joinCode: number;

    constructor(joinCode: number) {
        this.joinCode = joinCode;
    }

    // ------------------ ------------------ Getters/Setters ------------------ ------------------ \\
    getJoinCode(): number {
        return this.joinCode;
    }

    // ------------------ ------------------ Basic Player/Socket Managment ------------------ ------------------ \\
    abstract addPlayer(...args: any[]): void;
    
    abstract removePlayer(...args: any[]): void;
    
    // ------------------ ------------------ Messaging ------------------ ------------------ \\
    abstract broadcast(data: any, ...args: any[]): void;

    abstract broadcastState(...args: any[]): void;
}