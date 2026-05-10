import { FastifyInstance, FastifyReply, FastifyRequest, RouteHandler } from "fastify";
import { DAC } from "../../../../utils/db-queries/DataAccessClass.js";

type Post = {
    Body: { username: string };
};

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

const POST: RouteHandler<Post> = async (req: FastifyRequest<Post>, rep: FastifyReply) => {
    if (req.isUnauthenticated()) {
        rep.code(401).send({ error: 'You must login to call this endpoint.' });
        return;
    }

    const username = (req.body?.username ?? '').trim();
    if (!USERNAME_RE.test(username)) {
        rep.code(400).send({
            error: 'Username must be 3-20 characters, letters / digits / underscore only.',
        });
        return;
    }

    try {
        const userid = (req.user as { userid: number }).userid;
        const result = await DAC.users.id(userid).setUsername(username);
        if (result === null) {
            rep.code(503).send({ error: 'Database is disabled.' });
            return;
        }
        if (result[0] === 'taken') {
            rep.code(409).send({ error: 'That username is already taken.' });
            return;
        }
        rep.code(200).send(result[1]);
    } catch (err) {
        console.error(err);
        rep.code(500).send({ error: 'Something went wrong while updating your username.' });
    }
};

const post_opts = {
    schema: {
        body: {
            type: 'object',
            properties: {
                username: {
                    type: 'string',
                    minLength: 3,
                    maxLength: 20,
                    description: 'New username (3-20 chars, letters/digits/underscore).',
                },
            },
            required: ['username'],
        },
    },
};

async function routes(fastify: FastifyInstance, _opts: object) {
    fastify.post('', post_opts, POST);
}

export default routes;

export { POST, post_opts };
