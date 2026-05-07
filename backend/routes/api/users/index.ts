import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { ProfileVerbosity } from "../../../types/user_types.js";
import { QueryResultRow } from "pg";
import { DAC } from "../../../utils/db-queries/DataAccessClass.js";

// ------------------- ------------------- Types ------------------- ------------------- \\
type Get = {
    Querystring: {
        verbosity: ProfileVerbosity;
        userids: number[] | string[];
    };
};

// ------------------- ------------------- Methods ------------------- ------------------- \\
export const GET: RouteHandler<Get> = async (req: FastifyRequest<Get>, rep: FastifyReply) => {
    try {
        let userids: number[] | string[] | undefined = undefined;

        // Check for comma delimted array
        if (req.query.userids.length == 1 && typeof(req.query.userids[0]) === 'string' && req.query.userids[0]?.includes(',')) {
            userids = req.query.userids[0].split(',') as string[];
        } else {
            userids = req.query.userids;
        }

        /**
         * @note If this check is ommited, the worst that can happen is that the db call errors, which is caught.
         * Therefore this O(n) search may not be needed; however, what is written here does work.
         * - Joseph Habisohn
         */
        for (const [i, e] of userids.entries()) {
            if (typeof(e) === 'string' && !e.match(/^\d+$/)) {
                rep.code(400).send(`Query parameter 'userids' must contain only numbers. Offending value is "${e?.toString()}" at index ${i}.`);
                return;            
            }
            
            if (typeof(e) === 'string') {
                userids[i] = parseInt(e);
            } else {
                userids[i] = e;
            }
        }
        
        // By this point, userids is guaranteed to be strictly number[]
        let users: QueryResultRow | null = null;
        if (userids.length === 0) {
            users = await DAC.users.get(req.query.verbosity);

        } else {
            users = await DAC.users.ids(userids as number[]).get(req.query.verbosity);

        }

        if (users === null) {
            rep.code(404).send(`The are no users of the userids ${req.query.userids.toString()}`);
            return;
        }

        rep.code(200).send(users);

    } catch (error) {
        console.error(error);
        rep.code(500).send({
            error: 'Something went wrong while processing this request.'
        });
    }

}

// ------------------- ------------------- Inject the Methods into the Route ------------------- ------------------- \\
export const get_opts = {
    schema: {
        querystring: {
            type: 'object',
            properties: {
                verbosity: {
                    type: 'number',
                    enum: [0, 1, 2],
                    description: 'The verbosity level of the returned user profile.\n- 0: Minimal information for use in game rooms\n- 1: Medium information like those seen on a profile page\n- 2: The full sql row for that user.',
                    default: 0
                },
                userids: {
                    type: 'array',
                    items: {
                        anyOf: [
                            { type: 'integer' },
                            { type: 'string' },
                        ]
                    },
                    description: 'An array of userids to fetch. When none are supplied, all users will be returned at the selected verbosity level. IDs that are not found will silently fail.',
                    default: []
                }
            }
        }
    }
};
async function routes(fastify: FastifyInstance, _: Object) {
  fastify.get('', get_opts, GET);
}

export default routes;