import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { passport } from "../../../../utils/passport.js";

// ------------------- ------------------- Types ------------------- ------------------- \\
// NONE

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: Object) {
    fastify.get(
      "",
      // @ts-ignore | @note: Big ass type error on preValidation; not sure why tsx is yelling at me now. Will properly fix this later.
      { preValidation: passport.authenticate("steam", { authInfo: false }) },
      async (_: FastifyRequest, rep: FastifyReply) => {
        // This handler typically never runs because authenticate() redirects.
        // But Fastify requires a handler, so keep it empty/safe.
        rep.send();
      }
    );
}

export default routes;