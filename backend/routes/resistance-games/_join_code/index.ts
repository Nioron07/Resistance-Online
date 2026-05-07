import type { FastifyInstance, FastifyRequest, FastifyReply, RouteHandler } from 'fastify';
import {roomManager} from "../../../managers/RoomManager.js";

/**
 * @type
 *
 * Type alias for the request object for `POST /resistance-games/_join_code`
 */
type Post = {
    Params: {
        join_code: string;
    };
};

// ------------------- ------------------- Methods ------------------- ------------------- \\
/**
 * Joins a player to an existing resistance game using a 6-digit join code and returns the WebSocket URL to connect to for that game.
 *
 * Responds with the following JSON:
 * ```ts
 * {
 *      "ws_url": string     // the WebSocket URL clients should connect to join the game
 * }
 * ```
 *
 * @param req `FastifyRequest` - incoming request object
 * @param rep `FastifyReply` - reply object used to send the response
 * @returns `Promise<void>` - Resolves after sending the JSON response
 */
const POST: RouteHandler<Post> = async (req: FastifyRequest<Post>, rep: FastifyReply) => {
    // ------------------- ------------------- Validation ------------------- ------------------- \\
    if (!req.isAuthenticated()) {
        return rep.status(401).send({ error: 'You must be logged in to join a game' });
    }

    // Join Code must exist - May not be needed, but too bad
    if (!req.params.join_code) {
        return rep.status(400).send({ error: 'The join_code parameter is required' });
    }

    const join_code = parseInt(req.params.join_code, 10);

    // Got to actually be a number between 0 and 999999
    if (isNaN(join_code) || join_code < 0 || join_code > 999999) {
        return rep.status(400).send({ error: 'Invalid join code format' });
    }

    // Has to actually exist already
    if (!roomManager.hasRoom(join_code)) {
        return rep.status(404).send({ error: 'Game not found' });
    }

    // ------------------- ------------------- Business Logic ------------------- ------------------- \\
    /**
     * @note There is probably a programmatic way of doing this based on the file path, but its probably not worth the effort
     * - Joseph Habisohn 2/19/2026
     */
    const ws_url: string = `ws://${req.headers.host}/ws/resistance-games/${join_code}`;

    rep.status(200).send({
        ws_url: ws_url
    });
}

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
export const get_opts = {
    schema: {
        params: {
            type: 'object',
            properties: {
                join_code: {
                    type: 'number',
                    description: 'The join code of the room to join'
                }
            }
        }
    }
};
async function routes(fastify: FastifyInstance, _: object) {
    fastify.post('', get_opts, POST);
}

export default routes;