import { Pool } from 'pg'
import type { PoolClient, QueryResult, QueryResultRow } from 'pg'

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // GCP Cloud SQL specific settings
  ...(process.env.DB_INSTANCE_CONNECTION_NAME && {
    host: `/cloudsql/${process.env.DB_INSTANCE_CONNECTION_NAME}`,
  }),
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
}

// Create a connection pool
let pool: Pool | null = null

// ------------------- ------------------- Pool/Client Setup ------------------- ------------------- \\

/**
 * Get or create the database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(dbConfig)

    // An idle client erroring (network blip, server-side timeout) is
    // recoverable — the pool discards the client and dials a new one on the
    // next checkout. Crashing here would kill every active game room.
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })

    // Log pool events in development
    if (process.env.NODE_ENV !== 'production') {
      pool.on('connect', () => {
        console.log('New client connected to database')
      })

      pool.on('remove', () => {
        console.log('Client removed from pool')
      })
    }
  }

  return pool
}

/**
 * Get a client from the pool for transactions
 * @returns Pool client
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool()
  return await pool.connect()
}

/**
 * Close the database pool
 * Call this when shutting down the application
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('Database pool closed')
  }
}

// ------------------- ------------------- Query Abstractions ------------------- ------------------- \\

/**
 * Execute a SQL query
 * @param text - SQL query string
 * @param params - Query parameters (optional)
 * @returns Query result
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool()
  const start = Date.now()

  try {
    const result = await pool.query<T>(text, params)
    const duration = Date.now() - start

    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production' && duration > 1000) {
      console.warn('Slow query detected:', {
        text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      })
    }

    return result
  } catch (error) {
    console.error('Database query error:', {
      text,
      params,
      error: error instanceof Error ? error.message : error,
    });
    throw error
  }
}

// Helper function to execute a query and return the first row
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params)
  return result.rows[0] || null
}

// Helper function to execute a query and return all rows
export async function queryAll<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params)
  return result.rows
}

/**
 * Execute multiple queries in a transaction
 * 
 * @WARNING
 * 
 * You CANNOT use ANY of the abstracted query functions. Failure to heed this warning WILL cause issues. See the [node-pg docs](node-postgres.com/features/transactions) for more info.
 * 
 * @param callback - Function that receives a client and executes queries
 * @returns Result from the callback
 */
export async function transaction<T extends QueryResult = QueryResult>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Check if the database connection is healthy
 * @returns True if connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health')
    return result.rows[0]?.health === 1
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}