/**
 * Tiny in-memory TTL cache for request-level memoization of expensive
 * read-only computations (leaderboard, per-game metrics, …).
 *
 * Not shared across instances — that's fine: it only exists to absorb
 * bursts of identical requests, and a stale window of a few seconds is
 * acceptable for the endpoints that use it.
 */
export class TtlCache<V> {
    private entries = new Map<string, { value: V, expiresAt: number }>();

    constructor(
        private readonly ttlMs: number,
        private readonly maxEntries: number = 500,
    ) {}

    get(key: string): V | undefined {
        const hit = this.entries.get(key);
        if (!hit) return undefined;
        if (hit.expiresAt < Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return hit.value;
    }

    set(key: string, value: V): void {
        // Simple size cap: evict the oldest insertion when full. Good
        // enough for a burst cache; no LRU bookkeeping needed.
        if (this.entries.size >= this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest !== undefined) this.entries.delete(oldest);
        }
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }

    /** Drop every entry (used by tests and after bulk recomputes). */
    clear(): void {
        this.entries.clear();
    }

    /** Memoize an async producer under `key`. */
    async getOrCompute(key: string, produce: () => Promise<V>): Promise<V> {
        const hit = this.get(key);
        if (hit !== undefined) return hit;
        const value = await produce();
        this.set(key, value);
        return value;
    }
}
