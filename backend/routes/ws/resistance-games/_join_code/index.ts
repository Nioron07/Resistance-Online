import { WebSocket } from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { roomManager } from "../../../../managers/RoomManager.js";
import { GameRoom } from "../../../../managers/GameRoom.js";
import { ResistanceGameRoom } from "../../../../game/ResistanceGameRoom.js";
import { ClientEvents } from "../../../../game/types/Events.js";
import { clearInterval } from "node:timers";

/**
 * @type
 *
 * Type alias for the request object for `POST /test-game/ws/_join_code`
 */
type Post = {
  Params: {
    join_code: string;
  };
};

const heartbeatInterval = 500000;

// ------------------- ------------------- Methods ------------------- ------------------- \\
const GET = async (socket: WebSocket, req: FastifyRequest<Post>) => {
  // ------------------- ------------------- Validation ------------------- ------------------- \\
  if (!req.isAuthenticated()) {
    socket.send("Error (401): You must be logged in to join a game");
    socket.close(401);
    return;
  }

  // Join Code must exist - May not be needed, but too bad
  if (!req.params.join_code) {
    socket.send("Error (400): The join_code parameter is required");
    socket.close(400);
    return;
  }

  const join_code = parseInt(req.params.join_code, 10);

  // Validate the Join code
  const room = roomManager.validateCode<ResistanceGameRoom>(join_code);

  if (!(room instanceof GameRoom)) {
    socket.send(room.msg);
    socket.close(room.code);
    return;
  }

  // by this point we know that user is valid because of auth prevalidation
  const userid = req.user!.userid;

  // Add the player to the Game
  const added: boolean = room.addPlayer(userid, socket);

  if (!added) {
    socket.send("Error (503): This game is already full or in progress");
    socket.close(503);
    return;
  }

  let isAlive = true;

  // Application-level heartbeat. We intentionally avoid socket.ping() / 'pong'
  // (WS control frames) because Cloud Run's L7 proxy can drop them, which
  // caused the heartbeat to falsely time the connection out at ~60-90s.
  // Data frames (JSON messages) are forwarded reliably.
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      console.warn(`[WS] Player ${userid} timed out`);
      clearInterval(heartbeat);
      socket.terminate();
      return;
    }
    isAlive = false;
    try {
      socket.send(JSON.stringify({ event: "ping", data: {} }));
    } catch (err) {
      console.warn("[WS] failed to send ping", err);
    }
  }, heartbeatInterval);

  // ------------------- Listners ------------------- \\
  socket.on("message", (message: string) => {
    isAlive = true;
    try {
      const { event, data } = JSON.parse(message.toString()) as {
        event: string;
        data: unknown;
      };

      // App-level keepalive reply from the client.
      if (event === "pong") {
        isAlive = true;
        return;
      }

      /**
       * @note `as ClientEvents[typeof event]` is a bit of a hack and expects the correct structure of the data from the frontend
       * We can look into validation with zod or something later
       */
      room.bus.emit(
        event as keyof ClientEvents,
        {
          ...(data as object),
          senderId: userid,
        } as ClientEvents[keyof ClientEvents],
      );
    } catch (err) {
      console.error(err);
      room.send(socket, "socket:error", { message: (err as Error).message });
    }
  });

  socket.on("error", (err) => {
    console.error(`[WS] Socket error for player ${userid}:`, err);
  });

  socket.on("close", () => {
    clearInterval(heartbeat);
    room.removePlayer(userid, socket);
  });
};

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: object) {
  fastify.get(
    "",
    {
      websocket: true,
    },
    GET,
  );
}

export default routes;
