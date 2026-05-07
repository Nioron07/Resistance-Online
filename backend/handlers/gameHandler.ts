import {GameRoom} from "../managers/GameRoom.js";
import { WebSocket } from "@fastify/websocket";

export function handleGameMessage(room: GameRoom, msg: any, ws: WebSocket) {
    switch(msg.type) {
        case ("test"):
            // change something in the state
            room.broadcastState() // broadcast changed data
    }
}