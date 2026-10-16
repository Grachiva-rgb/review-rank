import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  isSupabaseConfiguredMock,
  sbSelectMock,
  sbUpsertMock,
  getCachedTAEnrichmentMock,
  rateLimitMock,
  enforceGooglePlacesDailyLimitMock,
  clientIpMock,
} = vi.hoisted(() => ({
  isSupabaseConfiguredMock: vi.fn(),
  sbSelectMock: vi.fn(),
  sbUpsertMock: vi.fn(),
  getCachedTAEnrichmentMock: vi.fn(),
  rateLimitMock: vi.fn(),
  enforceGooglePlacesDailyLimitMock: vi.fn(),
  clientIpMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock,
  sbSelect: sbSelectMock,
  sbUpsert: sbUpsertMock,
}));

vi.mock('../tripadvisor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tripadvisor')>()),
  getCachedTAEnrichment: getCachedTAEnrichmentMock,
}));

vi.mock('../ratelimit', () => ({
  rateLimit: rateLimitMock,
  rateLimitAsync: rateLimitMock,
  enforceGooglePlacesDailyLimit: enforceGooglePlacesDailyLimitMock,
  clientIp: clientIpMock,
}));

import * as placesModule from '../places';
import { getPlaceDetails, searchPlaces } from '../places';
import { generateMetadata as businessGenerateMetadata } from '../../app/business/[id]/page';
import { GET as getPlaceDetailsRoute } from '../../app/api/place-details/route';

const PLACE_ID = 'ChIJ/cache-test?&';
const ROUTE_PLACE_ID = 'ChIJrouteCacheTest0123456789';
const GOOGLE_RESPONSE = {
  id: PLACE_ID,
  displayName: { text: 'Cache Test Cafe' },
  formattedAddress: '12 Cache Lane, Example City',
  location: { latitude: 40.25, longitude: -73.75 },
  rating: 4.7,
  userRatingCount: 123,
  reviews: [],
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Provider Error',
    json: async () => body,
  };
}

function cachedRows(results: Record<string, unknown>) {
  return [{ results }];
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-placeholder');
  rateLimitMock.mockReset().mockReturnValue({ allowed: true });
  enforceGooglePlacesDailyLimitMock.mockReset().mockResolvedValue({ allowed: true });
  clientIpMock.mockReset().mockReturnValue('synthetic-test-client');
  isSupabaseConfiguredMock.mockReset().mockReturnValue(true);
  sbSelectMock.mockReset().mockResolvedValue([]);
  sbUpsertMock.mockReset().mockResolvedValue(undefined);
  getCachedTAEnrichmentMock.mockReset().mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(GOOGLE_RESPONSE)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('getPlaceDetails cache-only behavior', () => {
  it('preserves business-specific SEO metadata and serves its detail from fresh cache without budget/provider calls', async () => {
    sbSelectMock.mockResolvedValueOnce(cachedRows(GOOGLE_RESPONSE));
    const getDetailsSpy = vi.spyOn(placesModule, 'getPlaceDetails');

    const metadata = await businessGenerateMetadata({
      params: Promise.resolve({ id: ROUTE_PLACE_ID }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe('Cache Test Cafe — ReviewRank Score & Trust Analysis');
    expect(metadata.description).toContain('123 reviews');
    expect(getDetailsSpy).toHaveBeenCalledWith(ROUTE_PLACE_ID);
    expect(fetch).not.toHaveBeenCalled();
    expect(enforceGooglePlacesDailyLimitMock).not.toHaveBeenCalled();
    getDetailsSpy.mockRestore();
  });

  it.each([
    ['unset', undefined],
    ['blank', ''],
  ])('serves and normalizes a fresh cached detail, including location, with a %s API key', async (_kind, key) => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', key);
    sbSelectMock.mockResolvedValueOnce(cachedRows(GOOGLE_RESPONSE));

    const detail = await getPlaceDetails(PLACE_ID);

    expect(detail).toMatchObject({
      place_id: PLACE_ID,
      name: 'Cache Test Cafe',
      formatted_address: '12 Cache Lane, Example City',
      geometry: { location: { lat: 40.25, lng: -73.75 } },
      rating: 4.7,
      user_ratings_total: 123,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(enforceGooglePlacesDailyLimitMock).not.toHaveBeenCalled();
    expect(sbSelectMock).toHaveBeenCalledTimes(1);
    expect(sbSelectMock).toHaveBeenCalledWith(
      'search_cache',
      expect.stringContaining(`cache_key=eq.${encodeURIComponent(`place_details:${PLACE_ID}`)}`)
    );
  });

  it('uses a fresh cache hit with a configured key and never calls Google', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'synthetic-google-key-placeholder');
    sbSelectMock.mockResolvedValueOnce(cachedRows(GOOGLE_RESPONSE));

    const detail = await getPlaceDetails(PLACE_ID);

    expect(detail.name).toBe('Cache Test Cafe');
    expect(fetch).not.toHaveBeenCalled();
    expect(enforceGooglePlacesDailyLimitMock).not.toHaveBeenCalled();
    expect(sbUpsertMock).not.toHaveBeenCalled();
  });

  it('serves cached search results without calling the shared Places budget RPC', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'synthetic-google-key-placeholder');
    const cachedResult = [{ place_id: 'cached-place', name: 'Cached Business' }];
    sbSelectMock.mockResolvedValueOnce([{ results: cachedResult }]);

    await expect(searchPlaces('cached query')).resolves.toEqual(cachedResult);
    expect(enforceGooglePlacesDailyLimitMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serves the minimal existing staging fixture without a provider key', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', undefined);
    sbSelectMock.mockResolvedValueOnce(cachedRows({
      id: 'RR_QA_LOCAL_001',
      displayName: { text: 'STAGING TEST ONLY - Hudson area' },
      location: { latitude: 41.24, longitude: -81.44 },
    }));

    const detail = await getPlaceDetails('RR_QA_LOCAL_001');

    expect(detail).toMatchObject({
      place_id: 'RR_QA_LOCAL_001',
      name: 'STAGING TEST ONLY - Hudson area',
      geometry: { location: { lat: 41.24, lng: -81.44 } },
    });
    expect(Number.isFinite(detail.review_rank_score)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', []],
    ['stale (excluded by the freshness filter)', []],
  ])('fails closed on a %s cache entry when the API key is absent', async (_kind, rows) => {
    sbSelectMock.mockResolvedValueOnce(rows);

    await expect(getPlaceDetails(PLACE_ID)).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);

    expect(sbSelectMock).toHaveBeenCalledWith(
      'search_cache',
      expect.stringMatching(/created_at=gte\..*&select=results&limit=1/)
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(sbUpsertMock).not.toHaveBeenCalled();
  });

  it('fails closed without a key when Supabase is unavailable', async () => {
    isSupabaseConfiguredMock.mockReturnValue(false);

    await expect(getPlaceDetails(PLACE_ID)).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);

    expect(sbSelectMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed without a key when the Supabase cache read errors', async () => {
    sbSelectMock.mockRejectedValueOnce(new Error('Synthetic cache read failure'));

    await expect(getPlaceDetails(PLACE_ID)).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);

    expect(sbSelectMock).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed without a key when the Supabase cache read times out', async () => {
    vi.useFakeTimers();
    sbSelectMock.mockImplementationOnce(() => new Promise(() => {}));

    try {
      const detailPromise = getPlaceDetails(PLACE_ID);
      const rejection = expect(detailPromise).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
      await vi.advanceTimersByTimeAsync(1000);
      await rejection;
      expect(sbSelectMock).toHaveBeenCalledTimes(1);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetches a configured-key cache miss with an escaped ID and field mask, then schedules a cache write', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'synthetic-google-key-placeholder');
    const fetchMock = vi.fn(
      async (
        _url: string | URL,
        _options: { headers: Record<string, string>; next: { revalidate: number } }
      ) => jsonResponse(GOOGLE_RESPONSE)
    );
    vi.stubGlobal('fetch', fetchMock);

    const detail = await getPlaceDetails(PLACE_ID);

    expect(detail.name).toBe('Cache Test Cafe');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`
    );
    expect(options.headers['X-Goog-FieldMask']).toContain('id,displayName');
    expect(options.headers['X-Goog-FieldMask']).toContain('reviews');
    expect(options.next).toEqual({ revalidate: 3600 });
    expect(enforceGooglePlacesDailyLimitMock).toHaveBeenCalledTimes(1);
    expect(sbUpsertMock).toHaveBeenCalledWith(
      'search_cache',
      expect.objectContaining({
        cache_key: `place_details:${PLACE_ID}`,
        results: GOOGLE_RESPONSE,
      })
    );
  });

  it('surfaces a provider error without attempting any live external request', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'synthetic-google-key-placeholder');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { message: 'Synthetic provider rejection' } }, 403))
    );

    await expect(getPlaceDetails(PLACE_ID)).rejects.toThrow('Synthetic provider rejection');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not call Google when the shared daily cap denies a cache miss', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'synthetic-google-key-placeholder');
    enforceGooglePlacesDailyLimitMock.mockResolvedValueOnce({ allowed: false });

    await expect(getPlaceDetails(PLACE_ID)).rejects.toThrow(/daily request limit/);
    expect(enforceGooglePlacesDailyLimitMock).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(sbUpsertMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/place-details cache-only behavior', () => {
  it('returns a normalized cached business without a key or a Google request', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', undefined);
    const routePayload = { ...GOOGLE_RESPONSE, id: ROUTE_PLACE_ID };
    sbSelectMock.mockResolvedValueOnce(cachedRows(routePayload));
    const request = new NextRequest(
      `https://app.invalid/api/place-details?id=${encodeURIComponent(ROUTE_PLACE_ID)}`
    );

    const response = await getPlaceDetailsRoute(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      business: {
        place_id: ROUTE_PLACE_ID,
        name: 'Cache Test Cafe',
        address: '12 Cache Lane, Example City',
      },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without leaking internal errors on a cache miss without a key', async () => {
    const internalErrorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = new NextRequest(
      `https://app.invalid/api/place-details?id=${encodeURIComponent(ROUTE_PLACE_ID)}`
    );

    const response = await getPlaceDetailsRoute(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Unable to complete request. Please try again.' });
    expect(JSON.stringify(body)).not.toContain('GOOGLE_PLACES_API_KEY');
    expect(fetch).not.toHaveBeenCalled();
    internalErrorLog.mockRestore();
  });
});
