import type { FastifyInstance, FastifyRequest, FastifyReply, RouteHandler } from 'fastify';
import { roomManager } from "../../managers/RoomManager.js";
import {ResistanceGameRoom} from "../../game/ResistanceGameRoom.js";
import { LobbyPlugin } from '../../game/plugins/LobbyPlugin.js';
import {ResistanceCore} from "../../game/plugins/ResistanceCore.js";

// ------------------- ------------------- Methods ------------------- ------------------- \\
/**
 * Create a new resistance game and reserve a unique six-digit join code.
 *
 * Responds with the following JSON:
 * ```ts
 * {
 *  "join_code": number, // the numeric 6-digit code clients use to join the game
 *  "ws_url": string     // the WebSocket URL clients should connect to join the game
 * }
 * ```
 *
 * @param req `FastifyRequest` - incoming request object
 * @param rep `FastifyReply` - reply object used to send the response
 * @returns `Promise<void>` - Resolves after sending the JSON response
 */
const POST: RouteHandler = async (req: FastifyRequest, rep: FastifyReply) => {
    if (!req.isAuthenticated()) {
        return rep.status(401).send({ error: 'You must be logged in to create a game' });
    }

    const room: ResistanceGameRoom | null = await roomManager.createRoom<ResistanceGameRoom>(ResistanceGameRoom.create);
    
    if (room === null) {
        rep.status(500).send({ error: 'Game room creation failed' });
        return;
    }

    room.use(new LobbyPlugin());
    room.use(new ResistanceCore());

    /**
     * @note There is probably a programmatic way of doing this based on the file path, but its probably not worth the effort
     * - Joseph Habisohn 2/19/2026
     */
    const ws_url: string = `ws://${req.headers.host}/ws/resistance-games/${room.getJoinCode()}`;

    rep.status(201).send({
        join_code: room.getJoinCode(),
        ws_url: ws_url
    });
}

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: object) {
    fastify.post('', {}, POST);
}

export default routes;