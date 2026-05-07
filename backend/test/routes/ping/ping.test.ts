import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fastify, { type FastifyInstance } from 'fastify'
import { GET } from '../../../routes/ping/index.js'

describe('GET /ping', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = fastify()

    // Register the route handler directly instead of using fastify-router
    server.get('/ping', GET)

    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('should return pong', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/ping'
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('pong\n')
  })

  it('should have text/plain content type', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/ping'
    })

    expect(response.headers['content-type']).toContain('text/plain')
  })
})
