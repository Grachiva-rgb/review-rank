export interface SharedRateLimitResult {
  allowed: boolean;
  unavailable?: boolean;
}

const RPC_TIMEOUT_MS = 1_500;
const MAX_LIMIT = 2_147_483_647;
const MAX_WINDOW_MS = 2_147_483_647;

function configuration(): { url: string; serviceKey: string } | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceKey) return null;
  try {
    const url = new URL(rawUrl);
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
    const localFixture = localHosts.has(url.hostname);
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && localFixture)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      rawUrl.includes('?') ||
      rawUrl.includes('#') ||
      url.pathname !== '/'
    ) return null;
    return { url: url.toString().replace(/\/+$/, ''), serviceKey };
  } catch {
    return null;
  }
}

function validBounds(limit: number, windowMs: number): boolean {
  return Number.isSafeInteger(limit) && limit > 0 && limit <= MAX_LIMIT &&
    Number.isSafeInteger(windowMs) && windowMs > 0 && windowMs <= MAX_WINDOW_MS;
}

async function hmacKey(key: string, secret: string, windowMs: number): Promise<string | null> {
  if (!key || key.length > 1_024) return null;
  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    // Bind the bucket duration to the identity, but not its limit: policy
    // changes should retain the existing count for the same key/window.
    const digest = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(`${windowMs}\0${key}`)
    );
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export async function sharedRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<SharedRateLimitResult> {
  if (!validBounds(limit, windowMs)) return { allowed: false, unavailable: true };
  const config = configuration();
  if (!config) return { allowed: false, unavailable: true };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<SharedRateLimitResult>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ allowed: false, unavailable: true });
      }, RPC_TIMEOUT_MS);
    });
    const rpc = (async (): Promise<SharedRateLimitResult> => {
      try {
        const keyHash = await hmacKey(key, config.serviceKey, windowMs);
        if (!keyHash) return { allowed: false, unavailable: true };
        const response = await fetch(`${config.url}/rest/v1/rpc/reviewrank_rate_limit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.serviceKey,
            Authorization: `Bearer ${config.serviceKey}`,
          },
          body: JSON.stringify({ p_key_hash: keyHash, p_limit: limit, p_window_ms: windowMs }),
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        });
        if (!response.ok) return { allowed: false, unavailable: true };
        const result: unknown = await response.json();
        return typeof result === 'boolean'
          ? { allowed: result }
          : { allowed: false, unavailable: true };
      } catch {
        return { allowed: false, unavailable: true };
      }
    })();
    return await Promise.race([rpc, timeout]);
  } catch {
    return { allowed: false, unavailable: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sharedGooglePlacesDailyLimit(): Promise<SharedRateLimitResult> {
  const rawLimit = process.env.GOOGLE_PLACES_DAILY_REQUEST_LIMIT;
  if (!rawLimit || !/^[1-9]\d*$/.test(rawLimit)) {
    return { allowed: false, unavailable: true };
  }
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit > MAX_LIMIT) {
    return { allowed: false, unavailable: true };
  }
  return sharedRateLimit('google-places:daily-global-cap', limit, 86_400_000);
}
