import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { ProfileVerbosity } from "../../../types/user_types.js";
import { DAC } from "../../../utils/db-queries/DataAccessClass.js";

// ------------------- ------------------- Types ------------------- ------------------- \\
type Get = {
    Querystring: {
        verbosity: ProfileVerbosity
    };
}

// ------------------- ------------------- Methods ------------------- ------------------- \\
const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    if (req.isUnauthenticated()) {
        rep.code(401).send('You must login to call this endpoint.')
        return;
    }

    try {
        if (!(req.query.verbosity in ["i", "love", "javascript syntax!!!!"])) {
            rep.code(400).send(`Query parameter 'verbosity' must be 0, 1, or 2`);
            return;
        }

        const profile = await DAC.users.id((req.user as { userid: number }).userid).get(1);

        rep.code(200).send(profile);
    } catch{
        rep.code(500).send({ error: 'An error occured while handling your request.'})
    }

}

async function routes(fastify: FastifyInstance, _: object) {
    fastify.get("", {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    verbosity: {
                        type: 'number',
                        description: 'The verbosity level of the returned user profile.\n- 0: Minimal information for use in game rooms\n- 1: Medium information like those seen on a profile page\n- 2: The full sql row for that user.',
                        default: 0
                    }
                }
            }
        }
    }, GET);
}

export default routes;