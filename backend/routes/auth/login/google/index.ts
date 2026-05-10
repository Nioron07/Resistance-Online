import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { passport } from "../../../../utils/passport.js";

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
async function routes (fastify: FastifyInstance, _opts: object) {
    fastify.get(
      "",
      // @ts-expect-error | @note: Same Fastify-passport preValidation type quirk as steam.ts; safe to ignore.
      { preValidation: passport.authenticate("google", { authInfo: false, scope: ['profile'] }) },
      async (_req: FastifyRequest, rep: FastifyReply) => {
        // This handler typically never runs because authenticate() redirects.
        // But Fastify requires a handler, so keep it empty/safe.
        rep.send();
      }
    );
}

export default routes;
