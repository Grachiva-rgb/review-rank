import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  rateLimitAsyncMock,
  enforceGoogleApiDailyLimitMock,
  clientIpMock,
  isSupabaseConfiguredMock,
  sbSelectMock,
  sbUpsertMock,
} = vi.hoisted(() => ({
  rateLimitAsyncMock: vi.fn(),
  enforceGoogleApiDailyLimitMock: vi.fn(),
  clientIpMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
  sbSelectMock: vi.fn(),
  sbUpsertMock: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  rateLimitAsync: rateLimitAsyncMock,
  enforceGoogleApiDailyLimit: enforceGoogleApiDailyLimitMock,
  clientIp: clientIpMock,
}));

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock,
  sbSelect: sbSelectMock,
  sbUpsert: sbUpsertMock,
}));

import { GET } from '../../app/api/location-autocomplete/route';

function request(query: string) {
  return new NextRequest(`https://app.example.test/api/location-autocomplete?q=${encodeURIComponent(query)}`);
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'synthetic-google-key');
  rateLimitAsyncMock.mockReset().mockResolvedValue({ allowed: true });
  enforceGoogleApiDailyLimitMock.mockReset().mockResolvedValue({ allowed: true });
  clientIpMock.mockReset().mockReturnValue('synthetic-client');
  isSupabaseConfiguredMock.mockReset().mockReturnValue(false);
  sbSelectMock.mockReset().mockResolvedValue([]);
  sbUpsertMock.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    suggestions: [{
      placePrediction: {
        placeId: 'synthetic-place-id',
        text: { text: 'Hudson, OH, USA' },
        types: ['locality'],
      },
    }],
  }), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('location autocomplete request budget', () => {
  it('uses the autocomplete request kind and preserves provider request/cache behavior', async () => {
    const response = await GET(request('Hudson'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ label: 'Hudson, OH', placeId: 'synthetic-place-id' }]);
    expect(enforceGoogleApiDailyLimitMock).toHaveBeenCalledWith('autocomplete');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, RequestInit & {
      next: { revalidate: number };
    }];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(JSON.parse(String(init.body))).toMatchObject({
      input: 'hudson',
      languageCode: 'en',
      includedRegionCodes: ['us'],
      includedPrimaryTypes: ['(regions)'],
    });
    expect(init.next).toEqual({ revalidate: 86400 });
  });

  it('denies an uncached autocomplete request before contacting Google', async () => {
    enforceGoogleApiDailyLimitMock.mockResolvedValue({ allowed: false });

    const response = await GET(request('Hudson'));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual([]);
    expect(enforceGoogleApiDailyLimitMock).toHaveBeenCalledWith('autocomplete');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps persistent cache hits exempt from budget checks and provider fetches', async () => {
    isSupabaseConfiguredMock.mockReturnValue(true);
    sbSelectMock.mockResolvedValueOnce([{ results: [{ label: 'Cached Hudson', placeId: 'cached-id' }] }]);

    const response = await GET(request('Hudson'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ label: 'Cached Hudson', placeId: 'cached-id' }]);
    expect(enforceGoogleApiDailyLimitMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
