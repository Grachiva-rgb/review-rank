/**
 * In-process sliding window rate limiter.
 *
 * State is module-level, so it resets on serverless cold starts and is NOT
 * shared across instances: the real allowance is `limit × concurrent instances`.
 * That is enough to stop casual abuse, accidental client loops, and naive
 * scrapers.
 *
 * RATE_LIMIT_BACKEND=supabase opts into a database-backed shared fixed-window
 * limiter. The default remains the established local sliding-window behavior.
 */

import { sharedGoogleApiDailyLimit, sharedRateLimit } from './sharedRateLimit';
import type { GoogleApiRequestKind } from './sharedRateLimit';

export type { GoogleApiRequestKind } from './sharedRateLimit';

interface Entry {
  /** Request timestamps inside the window, oldest first. */
  ts: number[];
  /** The window this key was registered with — see maybeCleanup. */
  windowMs: number;
}

const store = new Map<string, Entry>();
let lastCleanup = Date.now();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function backendMode(): 'local' | 'supabase' | 'invalid' {
  const backend = process.env.RATE_LIMIT_BACKEND;
  if (backend === undefined || backend === '' || backend === 'local') return 'local';
  return backend === 'supabase' ? 'supabase' : 'invalid';
}

/**
 * Ceiling on distinct keys held in memory.
 *
 * A flood of distinct keys (many source IPs, or spoofed ones on infrastructure
 * that appends to x-forwarded-for) would otherwise grow the map unbounded
 * between cleanups.
 */
const MAX_KEYS = 20_000;

/**
 * Evict expired keys, filtering each entry against ITS OWN window.
 *
 * This previously filtered every key against the *calling* route's window. The
 * windows in use range from 60s to 1h, so a request to a 60s-window route
 * purged the timestamps belonging to the 1h-window routes and reset their
 * budgets: the 5-per-hour cap on the email endpoints degraded to roughly 5 per
 * cleanup interval, about a 12x weakening. Per-entry windows keep each route
 * independent.
 */
function cleanup(now: number): void {
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    const valid = entry.ts.filter((t) => now - t < entry.windowMs);
    if (valid.length === 0) store.delete(key);
    else entry.ts = valid;
  }
}

function maybeCleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  cleanup(now);
}

/**
 * Check whether a request identified by `key` is within the allowed rate.
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
  maybeCleanup(now);

  const entry = store.get(key);
  const valid = entry ? entry.ts.filter((t) => now - t < windowMs) : [];

  if (valid.length >= limit) {
    store.set(key, { ts: valid, windowMs });
    return { allowed: false };
  }

  if (!entry && store.size >= MAX_KEYS) {
    // Force a cleanup even if the interval has not elapsed — under a key flood
    // most entries are usually expired, so this normally makes room.
    cleanup(now);

    if (store.size >= MAX_KEYS) {
      // Still full: a flood is in progress. Deny rather than fail open.
      //
      // Trade-off, deliberate: failing open here would hand an attacker a
      // guaranteed bypass simply by filling the map, which defeats the point of
      // the limiter on the endpoints that cost money. The cost is that new
      // clients are refused while the map stays saturated. Flip this to
      // `allowed: true` if availability matters more than spend on your
      // endpoints, but do not do it on the paid ones.
      return { allowed: false };
    }
  }

  valid.push(now);
  store.set(key, { ts: valid, windowMs });
  return { allowed: true };
}

export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; unavailable?: boolean }> {
  const backend = backendMode();
  if (backend === 'invalid') return { allowed: false, unavailable: true };
  if (backend === 'local') {
    return rateLimit(key, limit, windowMs);
  }
  return sharedRateLimit(key, limit, windowMs);
}

/**
 * Aggregate call-count gate shared by Places and Geocoding API requests.
 */
export async function enforceGoogleApiDailyLimit(kind?: GoogleApiRequestKind): Promise<{
  allowed: boolean;
  unavailable?: boolean;
}> {
  if (
    kind !== undefined &&
    !['search', 'details', 'autocomplete', 'geocoding'].includes(kind)
  ) return { allowed: false, unavailable: true };
  const budgetMode = process.env.GOOGLE_API_BUDGET_MODE;
  if (
    budgetMode !== undefined &&
    budgetMode !== 'combined' &&
    budgetMode !== 'per_type'
  ) return { allowed: false, unavailable: true };
  const backend = backendMode();
  if (budgetMode === 'per_type' && backend !== 'supabase') {
    return { allowed: false, unavailable: true };
  }
  if (backend === 'invalid') return { allowed: false, unavailable: true };
  if (backend === 'local') return { allowed: true };
  return sharedGoogleApiDailyLimit(kind);
}

/** @deprecated Use enforceGoogleApiDailyLimit; retained for existing Places callers. */
export async function enforceGooglePlacesDailyLimit(): Promise<{
  allowed: boolean;
  unavailable?: boolean;
}> {
  return enforceGoogleApiDailyLimit();
}

/**
 * Best-effort client IP.
 *
 * Prefers `x-real-ip`, which Vercel sets from the verified peer address and
 * which a client cannot influence. `x-forwarded-for` is only a fallback for
 * local dev and non-Vercel hosting: its leftmost entry is client-supplied on
 * any infrastructure that appends rather than replaces the header, so a limiter
 * keyed on it can be reset at will. Do not rely on that path to bound spend.
 */
export function ipFromHeaders(headers: Headers): string {
  const real = headers.get('x-real-ip');
  if (real) return real.trim();

  const forwarded = headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

/** Convenience wrapper for route handlers, which have a whole Request. */
export function clientIp(request: Request): string {
  return ipFromHeaders(request.headers as Headers);
}
