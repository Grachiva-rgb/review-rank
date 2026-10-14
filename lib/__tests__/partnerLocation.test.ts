import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePartnerServiceCenter, validServiceCity } from '../partnerLocation';

const result = {
  types: ['locality', 'political'], geometry: { location: { lat: 41.24, lng: -81.44 } },
  address_components: [
    { long_name: 'Hudson', short_name: 'Hudson', types: ['locality'] },
    { long_name: 'Ohio', short_name: 'OH', types: ['administrative_area_level_1'] },
    { long_name: 'United States', short_name: 'US', types: ['country'] },
  ],
};
const respond = (results: unknown[], status = 'OK') =>
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ status, results }) } as Response);
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  respond([result]);
});
afterEach(() => vi.unstubAllGlobals());

describe('verified city-centered partner onboarding', () => {
  it('stores a corroborated city center using one 24-hour-cached geocode call', async () => {
    expect(await resolvePartnerServiceCenter('Hudson', 'OH', 'mock-key')).toEqual({ lat: 41.24, lng: -81.44 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ next: { revalidate: 86400 } });
  });
  it('rejects invalid city/state before paying for geocoding', async () => {
    expect(validServiceCity('', 'OH')).toBe(false);
    expect(validServiceCity('Hudson', 'ZZ')).toBe(false);
    expect(await resolvePartnerServiceCenter('Hudson', 'ZZ', 'mock-key')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects partial matches, street-level results, or invalid coordinates', async () => {
    for (const bad of [
      { ...result, partial_match: true }, { ...result, types: ['street_address'] },
      { ...result, geometry: { location: { lat: NaN, lng: -81 } } },
    ]) {
      respond([bad]);
      expect(await resolvePartnerServiceCenter('Hudson', 'OH', 'mock-key')).toBeNull();
    }
  });
  it.each(['country', 'administrative_area_level_1', 'locality'])('checks corroborating %s', async kind => {
    respond([{ ...result, address_components: result.address_components.map(c =>
      c.types.includes(kind) ? { ...c, short_name: 'Wrong', long_name: 'Wrong' } : c) }]);
    expect(await resolvePartnerServiceCenter('Hudson', 'OH', 'mock-key')).toBeNull();
  });
  it('distinguishes true no-results from provider/configuration failures', async () => {
    respond([], 'ZERO_RESULTS');
    expect(await resolvePartnerServiceCenter('Hudson', 'OH', 'mock-key')).toBeNull();
    respond([], 'REQUEST_DENIED');
    await expect(resolvePartnerServiceCenter('Hudson', 'OH', 'mock-key')).rejects.toThrow('unavailable');
    await expect(resolvePartnerServiceCenter('Hudson', 'OH', '')).rejects.toThrow('not configured');
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(resolvePartnerServiceCenter('Hudson', 'OH', 'mock-key')).rejects.toThrow('unavailable');
  });
});
