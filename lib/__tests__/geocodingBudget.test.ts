import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  geocodeCityState,
  geocodeLocationString,
  geocodeZip,
} from '../locationIntent';
import { resolvePartnerServiceCenter } from '../partnerLocation';
import * as rateLimit from '../ratelimit';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const googleResponse = {
  status: 'OK',
  results: [{
    formatted_address: 'Hudson, OH 44236, USA',
    geometry: { location: { lat: 41.24, lng: -81.44 } },
    types: ['locality', 'political'],
    address_components: [
      { long_name: 'Hudson', short_name: 'Hudson', types: ['locality'] },
      { long_name: 'Ohio', short_name: 'OH', types: ['administrative_area_level_1'] },
      { long_name: 'United States', short_name: 'US', types: ['country'] },
    ],
  }],
};

describe('Google geocoding daily budget', () => {
  it.each([
    ['geocodeCityState', () => geocodeCityState('Hudson', 'OH', 'synthetic-google-key')],
    ['geocodeLocationString', () => geocodeLocationString('Hudson, OH', 'synthetic-google-key')],
    ['geocodeZip', () => geocodeZip('44236', 'synthetic-google-key')],
  ])('%s denies before any outbound fetch when the shared budget is exhausted', async (_name, geocode) => {
    vi.spyOn(rateLimit, 'enforceGoogleApiDailyLimit').mockResolvedValue({ allowed: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await geocode()).toBeNull();
    expect(rateLimit.enforceGoogleApiDailyLimit).toHaveBeenCalledWith('geocoding');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies partner service-center geocoding before fetch with its existing error contract', async () => {
    vi.spyOn(rateLimit, 'enforceGoogleApiDailyLimit').mockResolvedValue({ allowed: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolvePartnerServiceCenter('Hudson', 'OH', 'synthetic-google-key'))
      .rejects.toThrow('Service-area geocoding is unavailable');
    expect(rateLimit.enforceGoogleApiDailyLimit).toHaveBeenCalledWith('geocoding');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['city/state', () => geocodeCityState('Hudson', 'OH', 'synthetic-google-key')],
    ['freeform location', () => geocodeLocationString('Hudson, OH', 'synthetic-google-key')],
    ['ZIP', () => geocodeZip('44236', 'synthetic-google-key')],
  ])('retains %s request parameters and 24-hour cache when allowed', async (_name, geocode) => {
    vi.spyOn(rateLimit, 'enforceGoogleApiDailyLimit').mockResolvedValue({ allowed: true });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(googleResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await geocode()).toEqual({
      lat: 41.24,
      lng: -81.44,
      display: 'Hudson, OH 44236, USA',
    });
    expect(rateLimit.enforceGoogleApiDailyLimit).toHaveBeenCalledWith('geocoding');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { next: { revalidate: number } }];
    expect(url).toContain('https://maps.googleapis.com/maps/api/geocode/json?');
    expect(url).toContain('key=synthetic-google-key');
    expect(init).toMatchObject({ next: { revalidate: 86400 } });
  });

  it('retains partner service-center parameters, timeout, and 24-hour cache when allowed', async () => {
    vi.spyOn(rateLimit, 'enforceGoogleApiDailyLimit').mockResolvedValue({ allowed: true });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(googleResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await resolvePartnerServiceCenter('Hudson', 'OH', 'synthetic-google-key'))
      .toEqual({ lat: 41.24, lng: -81.44 });
    expect(rateLimit.enforceGoogleApiDailyLimit).toHaveBeenCalledWith('geocoding');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { next: { revalidate: number } }];
    expect(url).toContain('address=Hudson%2C%20OH');
    expect(url).toContain('components=country%3AUS%7Cadministrative_area%3AOH');
    expect(url).toContain('key=synthetic-google-key');
    expect(init).toMatchObject({ next: { revalidate: 86400 }, signal: expect.any(AbortSignal) });
  });
});
