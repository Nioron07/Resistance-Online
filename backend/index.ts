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
import { PgSessionStore } from './utils/sessionStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isProduction = process.env.NODE_ENV === 'production'

// Fail fast on a missing/default session secret rather than shipping
// forgeable sessions.
const sessionSecret = process.env.SESSION_SECRET
if (isProduction && (!sessionSecret || sessionSecret === 'change_me_in_production')) {
  console.error('SESSION_SECRET must be set to a real secret in production.')
  process.exit(1)
}

const server: FastifyInstance = fastify({
  trustProxy: true,
})

/**
 * Global auth gate for the REST data API. Registered before any routes so
 * it applies to everything under /api/**. Auth endpoints (/auth/**) and the
 * SPA/static assets are unaffected; websocket upgrade routes do their own
 * isAuthenticated() check in the upgrade handler.
 */
server.addHook('preHandler', async (req, rep) => {
  if (!req.url.startsWith('/api')) return
  if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated()) {
    return rep.code(401).send({ error: 'Unauthorized' })
  }
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
  secret: sessionSecret ?? 'dev_only_secret_change_me_change_me',
  // Postgres-backed store: sessions survive restarts and are shared across
  // Cloud Run instances (the default MemoryStore is per-instance and never
  // evicts). saveUninitialized:false stops every anonymous visitor from
  // allocating a session row.
  store: new PgSessionStore(),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: "/",
    maxAge: 86400000,
  },
  saveUninitialized: false,
  // Don't re-save an unchanged session on every request. Without this the
  // store writes to Postgres on EVERY request (to slide the cookie expiry),
  // which — on a slow Cloud SQL instance — drains the connection pool and
  // makes the save in the onSend hook fire late, colliding with the
  // already-sent response. With rolling off, writes happen only on login
  // (session created/modified) and logout (destroy).
  rolling: false,
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

// ------------------- ------------------- Crash Guards ------------------- ------------------- \\
// A single request-scoped error must never take down the whole instance —
// doing so drops every live WebSocket game on it. In particular, a late
// session-store callback can surface as an uncaught ERR_HTTP_HEADERS_SENT
// from deep inside fastify's onSend path, which we can't try/catch locally.
// Log and keep serving instead of letting the process die.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] keeping process alive:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] keeping process alive:', reason)
})

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