import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { healthCheck } from '../../utils/db.js'

// ------------------- ------------------- Define the Methods ------------------- ------------------- \\
export const GET = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const dbHealthy = await healthCheck()

    if (dbHealthy) {
      return reply.send({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    } else {
      return reply.status(503).send({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    return reply.status(503).send({
      status: 'unhealthy',
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
}

// ------------------- ------------------- Inject the Above Methods into the Route ------------------- ------------------- \\
async function routes(fastify: FastifyInstance, _: object) {
  fastify.get('', GET);
}

export default routes;
