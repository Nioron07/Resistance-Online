import { WebSocket } from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { roomManager } from "../../../../managers/RoomManager.js";
import { GameRoom } from '../../../../managers/GameRoom.js';
import { TestGameRoom } from '../../../../managers/TestGameRoom.js';

/**
 * @type
 * 
 * Type alias for the request object for `POST /test-game/ws/_join_code`
 */
type Post = {
    Params: {
        join_code: string;
    };
    Querystring: {
        username: string;
    };
};

// ------------------- ------------------- Methods ------------------- ------------------- \\
const GET = async (socket: WebSocket, req: FastifyRequest<Post>) => {
    // ------------------- ------------------- Validation ------------------- ------------------- \\
    /**
     * @note I believe Fastify has builtin validation, but I don't want to bother right now. We will look into it later.
     * - Joseph Habisohn 2/18/2025 (copied from routes/testgame/_join_code/index.ts)
     * 
     * @note I will look into making this validation a function or abstracting it somehow later if needed
     */
    
    // Join Code must exist - May not be needed, but too bad
    if (!req.params.join_code) {
        socket.send('Error (400): The join_code parameter is required');
        socket.close(400);
        return;
    }

    // Username must exist
    if (!req.query.username && req.query.username !== '') {
        socket.send('Error (400): The username query parametter is required');
        socket.close(400);
        return;
    }

    const join_code = parseInt(req.params.join_code, 10);

    // Validate the Join code
    const room = roomManager.validateCode<TestGameRoom>(join_code);

    if (!(room instanceof GameRoom)) {
        socket.send(room.msg);
        socket.close(room.code);
        return;
    }
    
    // ------------------- ------------------- Business Logic ------------------- ------------------- \\
    socket.send(`Join Code Received: ${req.params.join_code}`);

    // Add the player to the Game
    const added: boolean = room.addPlayer(req.query.username, socket);

    if (!added) {
        socket.send('Error (503): This game is already full');
        socket.close(503);
        return;
    }

    // ------------------- Listners ------------------- \\
    socket.on('message', (message: string) => {
        if (room.getState().getCurrentPlayer() === undefined) {
            socket.send('The game is over.');
        } else if (req.query.username !== room.getState().getCurrentPlayer()) {
            socket.send('It is not your turn. Please wait for it to be your turn.');
            return;
        }

        try {
            const data: {
                input: string;
                action?: ['left' | 'right', 'left' | 'right'] | 'transfer' | 'divide';
            } = JSON.parse(message.toString());
    
            room.delta(data.input, data.action);
        } catch (err) {
            console.error(err);
            socket.send((err as Error).message);
        }
        
    })

    socket.on('close', () => {
        room.removePlayer(req.query.username);
    });
};

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: object) {
  fastify.get('', {
        websocket: true,
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    username: { 
                        type: 'string',
                        description: 'The username of the caller'
                    },
                },
                required: ['username'] // Mark 'foo' as required
            }
        }
    }, GET);
}

export default routes;