import type { SessionStore } from '@fastify/session'
import type { Session } from 'fastify'
import { query } from './db.js'

/**
 * Minimal Postgres-backed session store for @fastify/session.
 *
 * The default MemoryStore is per-instance (breaks auth across Cloud Run
 * instances) and never evicts (unbounded growth). This store keeps sessions
 * in a `sessions` table on the existing pool instead.
 *
 * The table is created lazily on first use so no external migration is
 * needed. Expired rows are ignored on read and swept periodically.
 */
export class PgSessionStore implements SessionStore {
    private ready: Promise<void> | null = null
    private sweepTimer: NodeJS.Timeout | null = null

    private ensureTable(): Promise<void> {
        if (!this.ready) {
            this.ready = query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    sid        TEXT PRIMARY KEY,
                    sess       JSONB NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL
                );
            `).then(() => {
                // Sweep expired sessions hourly. unref() so the timer never
                // keeps the process alive on shutdown.
                this.sweepTimer = setInterval(() => {
                    query(`DELETE FROM sessions WHERE expires_at < NOW();`)
                        .catch(err => console.error('[sessions] sweep failed', err))
                }, 60 * 60 * 1000)
                this.sweepTimer.unref()
            })
        }
        return this.ready
    }

    private expiryOf(session: Session): Date {
        const expires = session.cookie?.expires
        if (expires) return new Date(expires)
        return new Date(Date.now() + 86_400_000)
    }

    // NOTE: every method uses the two-argument `.then(onFulfilled, onRejected)`
    // form rather than `.then(...).catch(...)`. A trailing `.catch` would also
    // catch errors thrown *inside* the callback (fastify-session invokes its
    // save callback synchronously while processing onSend hooks, which can
    // throw) and call the callback a second time — a double invocation
    // corrupts fastify's hook chain and surfaces as "cb is not a function".
    // The onRejected handler here only ever sees a real DB rejection.

    set(sessionId: string, session: Session, callback: (err?: Error) => void): void {
        this.ensureTable()
            .then(() => query(
                `INSERT INTO sessions (sid, sess, expires_at)
                      VALUES ($1, $2, $3)
                 ON CONFLICT (sid) DO UPDATE SET sess = $2, expires_at = $3;`,
                [sessionId, JSON.stringify(session), this.expiryOf(session)],
            ))
            .then(
                () => callback(),
                (err: unknown) => callback(err as Error),
            )
    }

    get(sessionId: string, callback: (err: Error | null, session: Session | null) => void): void {
        this.ensureTable()
            .then(() => query<{ sess: Session }>(
                `SELECT sess FROM sessions WHERE sid = $1 AND expires_at >= NOW();`,
                [sessionId],
            ))
            .then(
                result => callback(null, result.rows[0]?.sess ?? null),
                (err: unknown) => callback(err as Error, null),
            )
    }

    destroy(sessionId: string, callback: (err?: Error) => void): void {
        this.ensureTable()
            .then(() => query(`DELETE FROM sessions WHERE sid = $1;`, [sessionId]))
            .then(
                () => callback(),
                (err: unknown) => callback(err as Error),
            )
    }
}
