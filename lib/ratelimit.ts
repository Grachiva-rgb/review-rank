/**
 * In-process sliding window rate limiter.
 *
 * State is module-level and therefore resets on serverless cold starts and is
 * NOT shared across multiple instances. This is sufficient for MVP traffic to
 * block casual abuse, quota-draining bots, and accidental loops.
 *
 * Upgrade path: replace `rateLimit()` with an Upstash Redis-backed equivalent
 * (@upstash/ratelimit) for distributed, persistent limiting when you need it.
 */

const store = new Map<string, number[]>();
let lastCleanup = Date.now();

// Evict stale keys every 5 minutes to prevent unbounded memory growth.
function maybeCleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, ts] of store.entries()) {
    const valid = ts.filter((t) => now - t < windowMs);
    if (valid.length === 0) store.delete(key);
    else store.set(key, valid);
  }
}

/**
 * Check whether a request identified by `key` is within the allowed rate.
 * Returns `{ allowed: true }` if the request should proceed, `{ allowed: false }`
 * if the limit is exceeded.
 *
 * @param key      Unique identifier, typically `"route:ip"`.
 * @param limit    Maximum number of requests within the window.
 * @param windowMs Window size in milliseconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean } {
  const now = Date.now();
  maybeCleanup(windowMs);

  const existing = store.get(key) ?? [];
  const valid = existing.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    store.set(key, valid);
    return { allowed: false };
  }

  valid.push(now);
  store.set(key, valid);
  return { allowed: true };
}

/**
 * Extract the best-effort client IP from a Next.js / Vercel request.
 * Vercel sets `x-forwarded-for`; falls back to a static string so rate
 * limiting degrades gracefully rather than throwing.
 */
export function clientIp(request: Request): string {
  const forwarded = (request.headers as Headers).get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}
