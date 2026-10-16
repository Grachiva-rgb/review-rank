import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enforceGoogleApiDailyLimit,
  enforceGooglePlacesDailyLimit,
  rateLimit,
  rateLimitAsync,
} from '../ratelimit';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('rateLimitAsync', () => {
  it('preserves the synchronous local sliding-window limiter by default', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', '');
    const key = `local-fallback:${Date.now()}`;
    expect(await rateLimitAsync(key, 1, 60_000)).toEqual({ allowed: true });
    expect(await rateLimitAsync(key, 1, 60_000)).toEqual({ allowed: false });
    expect(rateLimit(key, 1, 60_000)).toEqual({ allowed: false });
  });

  it('fails closed for unknown nonempty backend names without consuming the local counter', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabse');
    const key = `unknown-backend:${Date.now()}`;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await rateLimitAsync(key, 1, 60_000)).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('RATE_LIMIT_BACKEND', 'local');
    expect(rateLimit(key, 1, 60_000)).toEqual({ allowed: true });
  });

  it('uses HMAC-only keys and calls the fixed-window RPC in shared mode', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test/');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn(async () => new Response('true', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await rateLimitAsync('places:192.0.2.1', 30, 60_000)).toEqual({ allowed: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://db.example.test/rest/v1/rpc/reviewrank_rate_limit');
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({ p_limit: 30, p_window_ms: 60_000 });
    expect(payload.p_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(payload)).not.toContain('192.0.2.1');
    expect(JSON.stringify(payload)).not.toContain('test-only-secret');
    expect(init.headers).toMatchObject({
      apikey: 'test-only-secret',
      Authorization: 'Bearer test-only-secret',
    });
    expect(init.redirect).toBe('error');
  });

  it.each([
    'http://db.example.test',
    'https://user:pass@db.example.test',
    'https://db.example.test?x=1',
    'https://db.example.test?',
    'https://db.example.test#fragment',
    'https://db.example.test/#',
    'https://db.example.test/rest/v1',
  ])('rejects unsafe Supabase RPC URL %s before sending credentials', async (url) => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await rateLimitAsync('route:key', 1, 1000)).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows explicit localhost fixture URLs and rejects redirects', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321/');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.redirect).toBe('error');
      return new Response('true', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await rateLimitAsync('route:key', 1, 1000)).toEqual({ allowed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the same shared identity across module instances and limit changes, but isolates windows', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const payloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      payloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response('true', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    for (const [limit, windowMs] of [[30, 60_000], [10, 60_000], [30, 30_000]]) {
      vi.resetModules();
      const freshModule = await import('../sharedRateLimit');
      await freshModule.sharedRateLimit('search:192.0.2.9', limit, windowMs);
    }

    expect(payloads[0].p_key_hash).toBe(payloads[1].p_key_hash);
    expect(payloads[0].p_key_hash).not.toBe(payloads[2].p_key_hash);
  });

  it('fails closed for missing configuration, HTTP errors, and malformed RPC data', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(await rateLimitAsync('route:key', 1, 1000)).toEqual({
      allowed: false,
      unavailable: true,
    });

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"allowed":true}', { status: 200 }))
      .mockResolvedValueOnce(new Response('false', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await rateLimitAsync('route:key', 1, 1000)).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(await rateLimitAsync('route:key', 1, 1000)).toEqual({
      allowed: false,
      unavailable: true,
    });
  });

  it('fails closed on timeout without logging', async () => {
    vi.useFakeTimers();
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      markStarted();
      init.signal!.addEventListener('abort', () => reject(new Error('Synthetic request aborted')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = rateLimitAsync('sensitive-key', 1, 1000);
    // Wait for native WebCrypto before advancing mocked time. Otherwise crypto
    // may finish after test teardown and touch the following test's fetch mock.
    await started;
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(consoleError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal!.aborted).toBe(true);
  });

  it('never starts an RPC when the deadline expires during identity hashing', async () => {
    vi.useFakeTimers();
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
    let finishHash!: (value: ArrayBuffer) => void;
    vi.spyOn(crypto.subtle, 'sign').mockImplementation(() => new Promise<ArrayBuffer>((resolve) => {
      finishHash = resolve;
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = rateLimitAsync('slow-identity', 1, 1000);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toEqual({ allowed: false, unavailable: true });
    finishHash(new ArrayBuffer(32));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('global Google Places daily cap', () => {
  it('is disabled locally and fails closed without a positive cap in shared mode', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'local');
    expect(await enforceGooglePlacesDailyLimit()).toEqual({ allowed: true });
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_PLACES_DAILY_REQUEST_LIMIT', '0');
    expect(await enforceGooglePlacesDailyLimit()).toEqual({
      allowed: false,
      unavailable: true,
    });
  });

  it('applies configured cap as a shared 24-hour fixed window', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_PLACES_DAILY_REQUEST_LIMIT', '25');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn(async () => new Response('false', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await enforceGooglePlacesDailyLimit()).toEqual({ allowed: false });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_limit: 25,
      p_window_ms: 86_400_000,
    });
  });

  it('prefers the canonical combined cap and preserves the legacy shared bucket identity', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'combined');
    vi.stubEnv('GOOGLE_API_DAILY_REQUEST_LIMIT', '50');
    vi.stubEnv('GOOGLE_PLACES_DAILY_REQUEST_LIMIT', '25');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const payloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      payloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response('true', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await enforceGoogleApiDailyLimit()).toEqual({ allowed: true });
    vi.stubEnv('GOOGLE_API_DAILY_REQUEST_LIMIT', undefined as unknown as string);
    expect(await enforceGooglePlacesDailyLimit()).toEqual({ allowed: true });
    expect(payloads[0]).toMatchObject({ p_limit: 50, p_window_ms: 86_400_000 });
    expect(payloads[1]).toMatchObject({ p_limit: 25, p_window_ms: 86_400_000 });
    expect(payloads[0].p_key_hash).toBe(payloads[1].p_key_hash);
  });

  it.each(['', '0', 'not-a-number'])(
    'fails closed for explicitly malformed canonical cap %j instead of falling back',
    async (canonical) => {
      vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
      vi.stubEnv('GOOGLE_API_DAILY_REQUEST_LIMIT', canonical);
      vi.stubEnv('GOOGLE_PLACES_DAILY_REQUEST_LIMIT', '50');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      expect(await enforceGoogleApiDailyLimit()).toEqual({
        allowed: false,
        unavailable: true,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('uses the same shared bucket when Places and geocoding consume the allowance', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_API_DAILY_REQUEST_LIMIT', '1');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const payloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      payloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(payloads.length === 1 ? 'true' : 'false', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await enforceGoogleApiDailyLimit()).toEqual({ allowed: true });
    const { geocodeZip } = await import('../locationIntent');
    expect(await geocodeZip('12345', 'synthetic-google-key')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payloads[0]).toMatchObject({ p_limit: 1, p_window_ms: 86_400_000 });
    expect(payloads[1].p_key_hash).toBe(payloads[0].p_key_hash);
  });

  it('routes every recognized request kind to its own configured 24-hour bucket', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'per_type');
    vi.stubEnv('GOOGLE_PLACES_SEARCH_DAILY_LIMIT', '7');
    vi.stubEnv('GOOGLE_PLACES_DETAILS_DAILY_LIMIT', '11');
    vi.stubEnv('GOOGLE_PLACES_AUTOCOMPLETE_DAILY_LIMIT', '13');
    vi.stubEnv('GOOGLE_GEOCODING_DAILY_LIMIT', '17');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const payloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      payloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response('true', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    for (const kind of ['search', 'details', 'autocomplete', 'geocoding'] as const) {
      expect(await enforceGoogleApiDailyLimit(kind)).toEqual({ allowed: true });
    }

    expect(payloads.map((payload) => payload.p_limit)).toEqual([7, 11, 13, 17]);
    expect(payloads.every((payload) => payload.p_window_ms === 86_400_000)).toBe(true);
    expect(new Set(payloads.map((payload) => payload.p_key_hash)).size).toBe(4);
  });

  it.each([
    ['search', 'GOOGLE_PLACES_SEARCH_DAILY_LIMIT'],
    ['details', 'GOOGLE_PLACES_DETAILS_DAILY_LIMIT'],
    ['autocomplete', 'GOOGLE_PLACES_AUTOCOMPLETE_DAILY_LIMIT'],
    ['geocoding', 'GOOGLE_GEOCODING_DAILY_LIMIT'],
  ] as const)('fails closed for missing or malformed %s caps before RPC', async (kind, envName) => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'per_type');
    vi.stubEnv(envName, '1.5');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await enforceGoogleApiDailyLimit(kind)).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv(envName, undefined as unknown as string);
    expect(await enforceGoogleApiDailyLimit(kind)).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed for unknown budget modes and request kinds', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'per-kind-ish');
    vi.stubEnv('GOOGLE_PLACES_SEARCH_DAILY_LIMIT', '7');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await enforceGoogleApiDailyLimit('search')).toEqual({
      allowed: false,
      unavailable: true,
    });
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'per_type');
    expect(await enforceGoogleApiDailyLimit()).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(await enforceGoogleApiDailyLimit('search-ish' as never)).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows autocomplete independently when the search bucket is exhausted', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'per_type');
    vi.stubEnv('GOOGLE_PLACES_SEARCH_DAILY_LIMIT', '1');
    vi.stubEnv('GOOGLE_PLACES_DETAILS_DAILY_LIMIT', '2');
    vi.stubEnv('GOOGLE_PLACES_AUTOCOMPLETE_DAILY_LIMIT', '3');
    vi.stubEnv('GOOGLE_GEOCODING_DAILY_LIMIT', '4');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const payloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      payloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(payloads.length === 1 ? 'false' : 'true', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await enforceGoogleApiDailyLimit('search')).toEqual({ allowed: false });
    expect(await enforceGoogleApiDailyLimit('autocomplete')).toEqual({ allowed: true });
    expect(payloads[0].p_limit).toBe(1);
    expect(payloads[1].p_limit).toBe(3);
    expect(payloads[0].p_key_hash).not.toBe(payloads[1].p_key_hash);
  });

  it('retains the local backend opt-out when combined budgeting is selected', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'local');
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'combined');
    expect(await enforceGoogleApiDailyLimit('geocoding')).toEqual({ allowed: true });
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['local', 'local'],
    ['invalid', 'supabse'],
  ])('fails closed with zero RPC/provider requests for explicit per_type and %s backend', async (_name, backend) => {
    vi.stubEnv('RATE_LIMIT_BACKEND', backend);
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'per_type');
    vi.stubEnv('GOOGLE_GEOCODING_DAILY_LIMIT', '9');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { geocodeZip } = await import('../locationIntent');

    expect(await enforceGoogleApiDailyLimit('geocoding')).toEqual({
      allowed: false,
      unavailable: true,
    });
    expect(await geocodeZip('12345', 'synthetic-google-key')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts explicit per_type requests through the shared RPC with Supabase enabled', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
    vi.stubEnv('GOOGLE_API_BUDGET_MODE', 'per_type');
    vi.stubEnv('GOOGLE_GEOCODING_DAILY_LIMIT', '9');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-secret');
    const fetchMock = vi.fn(async () => new Response('true', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await enforceGoogleApiDailyLimit('geocoding')).toEqual({ allowed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_limit: 9,
      p_window_ms: 86_400_000,
    });
  });
});
