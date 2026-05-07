import {ResistanceGameRoom} from "../ResistanceGameRoom.js";

export abstract class GamePlugin {
    protected room!: ResistanceGameRoom

    init(room: ResistanceGameRoom) {
        this.room = room
        this.register()
    }

    protected abstract register(): void
}