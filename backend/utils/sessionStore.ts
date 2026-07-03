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

    set(sessionId: string, session: Session, callback: (err?: Error) => void): void {
        this.ensureTable()
            .then(() => query(
                `INSERT INTO sessions (sid, sess, expires_at)
                      VALUES ($1, $2, $3)
                 ON CONFLICT (sid) DO UPDATE SET sess = $2, expires_at = $3;`,
                [sessionId, JSON.stringify(session), this.expiryOf(session)],
            ))
            .then(() => callback())
            .catch(err => callback(err as Error))
    }

    get(sessionId: string, callback: (err: Error | null, session: Session | null) => void): void {
        this.ensureTable()
            .then(() => query<{ sess: Session }>(
                `SELECT sess FROM sessions WHERE sid = $1 AND expires_at >= NOW();`,
                [sessionId],
            ))
            .then(result => callback(null, result.rows[0]?.sess ?? null))
            .catch(err => callback(err as Error, null))
    }

    destroy(sessionId: string, callback: (err?: Error) => void): void {
        this.ensureTable()
            .then(() => query(`DELETE FROM sessions WHERE sid = $1;`, [sessionId]))
            .then(() => callback())
            .catch(err => callback(err as Error))
    }
}
