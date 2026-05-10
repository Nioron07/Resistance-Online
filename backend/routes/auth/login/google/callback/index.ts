import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { passport } from "../../../../../utils/passport.js";

async function routes (fastify: FastifyInstance, _opts: object) {
    fastify.get(
    "",
    {
        // @ts-expect-error | @note: Same Fastify-passport preValidation type quirk as the Steam callback.
        preValidation: passport.authenticate("google", {
            authInfo: false,
            successRedirect: `${process.env.FRONTEND_BASE_URL!}/`,
            failureRedirect: `${process.env.FRONTEND_BASE_URL!}/?login=failed`,
        }),
    },
        async (_req: FastifyRequest, rep: FastifyReply) => {
            rep.send();
        }
    );
}

export default routes;
