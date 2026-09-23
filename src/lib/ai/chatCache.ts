/**
 * Simple in-memory LRU-ish cache for chat context builder results.
 *
 * Why: building the chat context (per-habit day-of-week rates, mood buckets,
 * gap analysis, pattern detection) is moderately expensive — multiple Prisma
 * queries + numeric work. The same user asking back-to-back questions about
 * the same habit should not re-pay that cost. We cache by
 * (userId, question-hash) for 5 minutes by default.
 *
 * This is intentionally NOT Redis / external — the chat traffic pattern is
 * bursty and per-user, so a small in-process Map is enough. Cache entries
 * are also invalidated explicitly via `clearCache(userId)` whenever the user
 * creates a check-in (handled in the check-in route hooks if we wire that up
 * later — for now we rely on TTL expiry).
 *
 * The Map is bounded to MAX_ENTRIES to prevent unbounded growth under high
 * request volume. When full, the oldest entries are evicted first (Map
 * preserves insertion order, so we iterate from the front to find expired
 * entries to drop, or fall back to deleting the first key).
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 256;

const cache = new Map<string, CacheEntry>();

/**
 * Returns the cached value if present and not expired, else null.
 * Side effect: if the entry is expired, it is removed.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Stores `data` in the cache under `key`, with an optional TTL (default 5min).
 * Evicts oldest entries when the cache is at capacity.
 */
export function setCached(key: string, data: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
  // Bound the cache size — drop expired entries first, then oldest
  if (cache.size >= MAX_ENTRIES) {
    evictOldest();
  }
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate all cache entries for a given user. Call this whenever the
 * user's data changes (check-in create/update/delete, mood entry, etc.) so
 * the next chat question rebuilds context from fresh data.
 */
export function clearCache(userId: string): void {
  const prefix = `u:${userId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Test-only hook: clears everything. Not exported via the public surface
 * above because nothing in production code needs to nuke the whole cache.
 */
export function clearAllForTesting(): void {
  cache.clear();
}

/**
 * Drops the single oldest non-expired entry. Called only when the cache is
 * at capacity. We first sweep for expired entries (which doesn't really
 * shrink the Map, since they're already dead but still occupying slots),
 * then if still at capacity we delete the first key by iteration order.
 */
function evictOldest(): void {
  // First sweep expired entries
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now >= v.expiresAt) {
      cache.delete(k);
      // We made room — stop here.
      if (cache.size < MAX_ENTRIES) return;
    }
  }
  // Still at capacity — drop the first key (oldest insertion)
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) {
    cache.delete(firstKey);
  }
}
