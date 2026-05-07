import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";

// ------------------- ------------------- Types ------------------- ------------------- \\
// NONE

// ------------------- ------------------- Methods ------------------- ------------------- \\
const POST: RouteHandler = async (req: FastifyRequest, rep: FastifyReply) => {
    if (req.isUnauthenticated()) {
      rep.code(401).send('You must login to call this endpoint.')
      return;
  }

  // Remove the user from the session
  await req.logOut();

  // Destroy the session
  await req.session.destroy();

  // Clear the session cookie.
  rep.clearCookie("sessionId", { path: "/" });

  return rep.send({ ok: true });
}

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: object) {
  fastify.post('', POST);
}

export default routes;