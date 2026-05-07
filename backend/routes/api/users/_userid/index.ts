import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { ProfileVerbosity } from "../../../../types/user_types.js";
import { DAC } from "../../../../utils/db-queries/DataAccessClass.js";

// ------------------- ------------------- Types ------------------- ------------------- \\
type Get = {
    Params: {
        userid: number;
    };
    Querystring: {
        verbosity: ProfileVerbosity
    };
};

// ------------------- ------------------- Methods ------------------- ------------------- \\
export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        // console.log(`${req.params.userid} | ${typeof req.params.userid}`);
        // console.log(`${req.query.verbosity} | ${typeof req.query.verbosity}`);
        if (!(req.query.verbosity in ["i", "love", "javascript syntax!!!!"])) {
            rep.code(400).send(`Query parameter 'verbosity' must be 0, 1, or 2`);
            return;
        }
        const user = await DAC.users.id(req.params.userid).get(req.query.verbosity);

        if (user === null) {
            rep.code(404).send(`The is no user with the userid ${req.params.userid}`);
            return;
        }

        rep.code(200).send(user);

    } catch (error) {
        rep.code(500).send({
            error: 'Something went wrong while processing this request.'
        });
    }

}

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
export const get_opts = {
    schema: {
        params: {
            type: 'object',
            properties: {
                userid: {
                    type: 'number',
                    description: 'The userid of the user in our db.'
                }
            }
        },
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
};
async function routes(fastify: FastifyInstance, _: Object) {
  fastify.get('', get_opts, GET);
}

export default routes;