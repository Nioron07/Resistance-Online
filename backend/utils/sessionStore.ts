import type { SessionStore } from '@fastify/session'
import type { Session } from 'fastify'
import { query } from './db.js'

// Read-through cache window. A single SPA page load fires several API calls
// at once, all carrying the same session cookie; without a cache each is a
// separate `SELECT sess`, and that burst can drain the DB pool on a slow
// Cloud SQL instance. Short enough that cross-instance staleness is a
// non-issue for auth.
const CACHE_TTL_MS = 5_000
const CACHE_MAX_ENTRIES = 10_000

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

    // Serves repeat reads of the same sid; `inflight` coalesces concurrent
    // reads of one sid into a single DB round-trip.
    private cache = new Map<string, { session: Session | null; expiresAt: number }>()
    private inflight = new Map<string, Promise<Session | null>>()

    private ensureTable(): Promise<void> {
        if (!this.ready) {
            this.ready = query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    sid        TEXT PRIMARY KEY,
                    sess       JSONB NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL
                );
            `).then(() => {
                // Sweep expired DB rows + cache entries hourly. unref() so the
                // timer never keeps the process alive on shutdown.
                this.sweepTimer = setInterval(() => {
                    query(`DELETE FROM sessions WHERE expires_at < NOW();`)
                        .catch(err => console.error('[sessions] sweep failed', err))
                    this.evictExpiredCache()
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

    private cacheSet(sid: string, session: Session | null): void {
        if (this.cache.size >= CACHE_MAX_ENTRIES) this.cache.clear()
        this.cache.set(sid, { session, expiresAt: Date.now() + CACHE_TTL_MS })
    }

    private evictExpiredCache(): void {
        const now = Date.now()
        for (const [sid, entry] of this.cache) {
            if (entry.expiresAt <= now) this.cache.delete(sid)
        }
    }

    // NOTE: every method invokes its callback via `.then(onFulfilled,
    // onRejected)` — never a trailing `.catch`. A trailing `.catch` would
    // also fire on errors thrown *inside* the callback (fastify-session runs
    // its save callback synchronously while walking onSend hooks, which can
    // throw) and call the callback a second time; that double invocation
    // corrupts fastify's hook chain and surfaces as "cb is not a function".

    set(sessionId: string, session: Session, callback: (err?: Error) => void): void {
        const serialized = JSON.stringify(session)
        this.ensureTable()
            .then(() => query(
                `INSERT INTO sessions (sid, sess, expires_at)
                      VALUES ($1, $2, $3)
                 ON CONFLICT (sid) DO UPDATE SET sess = $2, expires_at = $3;`,
                [sessionId, serialized, this.expiryOf(session)],
            ))
            .then(
                () => {
                    // Cache a detached copy of what we just wrote so a login
                    // is immediately visible to the next read without a
                    // round-trip.
                    this.cacheSet(sessionId, JSON.parse(serialized) as Session)
                    callback()
                },
                (err: unknown) => callback(err as Error),
            )
    }

    get(sessionId: string, callback: (err: Error | null, session: Session | null) => void): void {
        const cached = this.cache.get(sessionId)
        if (cached && cached.expiresAt > Date.now()) {
            callback(null, cached.session)
            return
        }

        // Coalesce concurrent reads of the same sid into one query.
        let inflight = this.inflight.get(sessionId)
        if (!inflight) {
            inflight = (async () => {
                try {
                    await this.ensureTable()
                    const result = await query<{ sess: Session }>(
                        `SELECT sess FROM sessions WHERE sid = $1 AND expires_at >= NOW();`,
                        [sessionId],
                    )
                    const sess = result.rows[0]?.sess ?? null
                    // Don't clobber a fresher entry a concurrent `set` (e.g.
                    // a login) may have just written.
                    const existing = this.cache.get(sessionId)
                    if (!existing || existing.expiresAt <= Date.now()) {
                        this.cacheSet(sessionId, sess)
                    }
                    return sess
                } finally {
                    this.inflight.delete(sessionId)
                }
            })()
            this.inflight.set(sessionId, inflight)
        }

        inflight.then(
            session => callback(null, session),
            (err: unknown) => callback(err as Error, null),
        )
    }

    destroy(sessionId: string, callback: (err?: Error) => void): void {
        this.cache.delete(sessionId)
        this.ensureTable()
            .then(() => query(`DELETE FROM sessions WHERE sid = $1;`, [sessionId]))
            .then(
                () => callback(),
                (err: unknown) => callback(err as Error),
            )
    }
}
