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
    abstract addPlayer(...args: unknown[]): void;

    abstract removePlayer(...args: unknown[]): void;

    // ------------------ ------------------ Messaging ------------------ ------------------ \\
    abstract broadcast(data: unknown, ...args: unknown[]): void;

    abstract broadcastState(...args: unknown[]): void;
}