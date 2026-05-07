import 'dotenv/config'
import fastify, { FastifyInstance } from 'fastify'
import { fastifySwagger } from '@fastify/swagger'
import { fastifySwaggerUi } from '@fastify/swagger-ui'
import websocket from "@fastify/websocket"
import autoload from "@fastify/autoload";
import session from "@fastify/session";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors"
import fastifyStatic from "@fastify/static"

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

import { closePool } from './utils/db.js'
import { passport } from './utils/passport.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const server: FastifyInstance = fastify({
  trustProxy: true,
})

// CORS!!!!!! YIPPEEE!!!!!!
server.register(cors, {
  // Optional: configure your options here
  origin: process.env.FRONTEND_BASE_URL!,
  credentials: true
});

// SwaggerSouls
server.register(fastifySwagger)
server.register(fastifySwaggerUi, {
  routePrefix: '/docs',
})

// Register the websocket plugin
server.register(websocket);

// Register file-based router
server.register(autoload, {
  dir: join(__dirname, 'routes'),
  routeParams: true,
  dirNameRoutePrefix: true
});

// ------------------- ------------------- Authentication Setup ------------------- ------------------- \\
/**
 * BFF uses cookies between the backend and frontend
 */
await server.register(cookie);

/**
 * Handles session cookies for suer authentication
 * 
 * We are using a Backend-for-Frontend (BFF) setup
 */
await server.register(session, {
  secret: process.env.SESSION_SECRET!,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'lax',
    path: "/",
    maxAge: 86400000,
  },
  saveUninitialized: true,
});

// Initialize the passport onto fastify and then allow it to be saved to the session
await server.register(passport.initialize());
await server.register(passport.secureSession());

// ------------------- ------------------- Static Files & SPA Fallback ------------------- ------------------- \\
const publicDir = join(__dirname, '..', 'public')
if (existsSync(publicDir)) {
  server.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    wildcard: false,
  })

  server.setNotFoundHandler((req, rep) => {
    if (req.method === 'GET' &&
      !req.url.startsWith('/api') &&
      !req.url.startsWith('/auth') &&
      !req.url.startsWith('/ws') &&
      !req.url.startsWith('/resistance-games') &&
      !req.url.startsWith('/test-games') &&
      !req.url.startsWith('/docs') &&
      !req.url.startsWith('/health') &&
      !req.url.startsWith('/ping')
    ) {
      return rep.sendFile('index.html')
    }
    rep.code(404).send({ error: 'Not Found' })
  })
}

// ------------------- ------------------- Server Setup ------------------- ------------------- \\
const port = parseInt(process.env.PORT || '8080')
server.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...')
  try {
    await server.close()
    await closePool()
    console.log('Server closed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)