import type { FastifyInstance, FastifyRequest, FastifyReply, RouteHandler } from 'fastify';
import { TestGameRoom } from "../../managers/TestGameRoom.js";
import { roomManager } from "../../managers/RoomManager.js";

/**
 * @type
 * 
 * Type alias for the request object for `POST /test-game`
 */
type Post = {
    Querystring: {
        username: string;
    };
};

// ------------------- ------------------- Methods ------------------- ------------------- \\
/**
 * Create a new test game and reserve a unique six-digit join code.
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
const POST: RouteHandler<Post> = async (req: FastifyRequest<Post>, rep: FastifyReply) => {
    const room: TestGameRoom = (await roomManager.createRoom<TestGameRoom>(TestGameRoom.create))!;

    // Username must exist
    if (!req.query.username && req.query.username !== '') {
        return rep.status(400).send({error: 'The username query parametter is required'});
    }

    /** 
     * @note There is probably a programatic way of doing this based on teh file path, but its probably not worth the effort
     * - Joseph Habisohn 2/19/2026
     */
    const ws_url: string = `ws://${req.headers.host}/ws/test-games/${room.getJoinCode()}?username=${req.query.username}`;

    rep.status(201).send({
        join_code: room.getJoinCode(),
        ws_url: ws_url
    });
}

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: object) {
  // Test games are an unauthenticated dev/QA harness (free-text usernames,
  // unbounded room creation) — never ship them enabled. Opt in with
  // ENABLE_TEST_GAMES=true.
  if (process.env.ENABLE_TEST_GAMES !== 'true') return;

  fastify.post('', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    username: { 
                        type: 'string',
                        description: 'The username of the caller'
                    },
                },
                required: ['username']
            }
        }
    }, POST);
}

export default routes;