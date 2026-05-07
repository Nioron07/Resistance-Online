import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { passport } from "../../../../../utils/passport.js";

// ------------------- ------------------- Types ------------------- ------------------- \\
// None

async function routes(fastify: FastifyInstance, _: Object) {
    fastify.get(
    "",
    {
        // @ts-ignore | @note: Big ass type error on preValidation; not sure why tsx is yelling at me now. Will properly fix this later.
        preValidation: passport.authenticate("steam", {
            authInfo: false,
            successRedirect: `${process.env.FRONTEND_BASE_URL!}/`,
            failureRedirect: `${process.env.FRONTEND_BASE_URL!}/?login=failed`,
        }),
    },
        async (_: FastifyRequest, rep: FastifyReply) => {
            rep.send();
        }
    );
}

export default routes;