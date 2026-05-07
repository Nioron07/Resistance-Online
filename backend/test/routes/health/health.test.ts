import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fastify, { type FastifyInstance } from 'fastify'
import { GET } from '../../../routes/health/index.js'

// Mock the database utilities module before any imports
vi.mock('../../../utils/db', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  query: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  transaction: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  getPool: vi.fn()
}))

describe('Health Route', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = fastify()

    // Register the route handler directly instead of using fastify-router
    server.get('/health', GET)

    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('should return 200 and healthy status when database is connected', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('database')
    expect(body).toHaveProperty('timestamp')
    expect(body.status).toBe('healthy')
    expect(body.database).toBe('connected')
  })

  it('should include a valid ISO timestamp', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    const body = JSON.parse(response.body)
    const timestamp = new Date(body.timestamp)
    expect(timestamp.toString()).not.toBe('Invalid Date')
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('should return JSON content type', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.headers['content-type']).toMatch(/application\/json/)
  })
})
