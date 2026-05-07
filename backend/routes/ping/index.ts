import type { FastifyInstance } from 'fastify'

// ------------------- ------------------- Define the Methods ------------------- ------------------- \\
export const GET = async () => {
  return 'pong\n'
}

// ------------------- ------------------- Inject the Above Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: Object) {
  fastify.get('', GET);
}

export default routes;