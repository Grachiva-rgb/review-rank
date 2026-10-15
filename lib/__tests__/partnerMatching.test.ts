import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateDistanceMiles } from '../locationIntent';

const { sbSelectMock, isSupabaseConfiguredMock } = vi.hoisted(() => ({
  sbSelectMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  sbSelect: sbSelectMock,
  isSupabaseConfigured: isSupabaseConfiguredMock,
}));

import {
  findMatchingPartners,
  isCoordinates,
  matchesServiceArea,
} from '../partnerMatching';
import type { Coordinates, PartnerRow } from '../partnerMatching';

const origin: Coordinates = { lat: 0, lng: 0 };

function partner(overrides: Partial<PartnerRow> = {}): PartnerRow {
  return {
    id: 'partner-1',
    business_name: 'Local Plumbing',
    contact_email: 'hello@example.com',
    category: 'plumbing',
    status: 'active',
    latitude: 0,
    longitude: 0,
    service_radius_miles: 25,
    ...overrides,
  };
}

function queryParams(query: string): URLSearchParams {
  return new URLSearchParams(query.replace(/^\?/, ''));
}

beforeEach(() => {
  sbSelectMock.mockReset().mockResolvedValue([]);
  isSupabaseConfiguredMock.mockReset().mockReturnValue(true);
});

describe('isCoordinates', () => {
  it.each([
    ['missing value', undefined],
    ['null', null],
    ['missing latitude', { lng: 0 }],
    ['missing longitude', { lat: 0 }],
    ['string latitude', { lat: '0', lng: 0 }],
    ['string longitude', { lat: 0, lng: '0' }],
    ['NaN latitude', { lat: Number.NaN, lng: 0 }],
    ['infinite longitude', { lat: 0, lng: Number.POSITIVE_INFINITY }],
    ['latitude below range', { lat: -90.0001, lng: 0 }],
    ['latitude above range', { lat: 90.0001, lng: 0 }],
    ['longitude below range', { lat: 0, lng: -180.0001 }],
    ['longitude above range', { lat: 0, lng: 180.0001 }],
  ])('rejects %s', (_label, value) => {
    expect(isCoordinates(value)).toBe(false);
  });

  it('accepts valid zero coordinates and geographic endpoints', () => {
    expect(isCoordinates({ lat: 0, lng: 0 })).toBe(true);
    expect(isCoordinates({ lat: -90, lng: -180 })).toBe(true);
    expect(isCoordinates({ lat: 90, lng: 180 })).toBe(true);
  });
});

describe('matchesServiceArea', () => {
  it('accepts a partner inside its service radius and excludes one outside it', () => {
    const nearby: Coordinates = { lat: 0, lng: 0.1 };
    expect(matchesServiceArea(partner({ service_radius_miles: 10 }), nearby)).toBe(true);
    expect(matchesServiceArea(partner({ service_radius_miles: 1 }), nearby)).toBe(false);
  });

  it('includes a location exactly on the service-radius boundary', () => {
    const boundaryLongitude = (10 / 3958.8) * (180 / Math.PI);
    const boundaryLocation: Coordinates = { lat: 0, lng: boundaryLongitude };
    const exactDistance = calculateDistanceMiles(0, 0, 0, boundaryLongitude);

    expect(exactDistance).toBeCloseTo(10, 10);
    expect(
      matchesServiceArea(partner({ service_radius_miles: exactDistance }), boundaryLocation)
    ).toBe(true);
  });

  it.each([0, -1, 0.99, 200.01, 201, Number.NaN, Number.POSITIVE_INFINITY])(
    'fails closed for an invalid radius (%s)',
    (radius) => {
      expect(
        matchesServiceArea(
          partner({ service_radius_miles: radius }),
          origin
        )
      ).toBe(false);
    }
  );

  it('fails closed for missing, non-finite, or out-of-range partner coordinates', () => {
    expect(matchesServiceArea(partner({ latitude: null }), origin)).toBe(false);
    expect(matchesServiceArea(partner({ longitude: null }), origin)).toBe(false);
    expect(matchesServiceArea(partner({ latitude: Number.NaN }), origin)).toBe(false);
    expect(matchesServiceArea(partner({ longitude: Number.POSITIVE_INFINITY }), origin)).toBe(false);
    expect(matchesServiceArea(partner({ latitude: 91 }), origin)).toBe(false);
    expect(matchesServiceArea(partner({ longitude: -181 }), origin)).toBe(false);
  });
});

describe('findMatchingPartners', () => {
  it('does not query the database when the location is invalid', async () => {
    const result = await findMatchingPartners('plumbing', { lat: Number.NaN, lng: 0 });

    expect(result).toEqual([]);
    expect(sbSelectMock).not.toHaveBeenCalled();
  });

  it('does not query the database for an unknown category', async () => {
    const result = await findMatchingPartners('unlisted trade', origin);

    expect(result).toEqual([]);
    expect(sbSelectMock).not.toHaveBeenCalled();
  });

  it('normalizes category aliases before querying with active and canonical-category filters', async () => {
    await findMatchingPartners('  Pest Control  ', origin);

    expect(sbSelectMock).toHaveBeenCalledTimes(1);
    const [table, query] = sbSelectMock.mock.calls[0] as [string, string];
    const params = queryParams(query);
    expect(table).toBe('partners');
    expect(params.get('status')).toBe('eq.active');
    expect(params.get('category')).toBe('eq.pest-control');
  });

  it('filters inactive, cross-category, and out-of-area rows even if returned by the database', async () => {
    const activeMatch = partner({ id: 'active-match', service_radius_miles: 10 });
    const inactiveMatch = partner({ id: 'inactive-match', status: 'inactive' });
    const otherCategory = partner({ id: 'other-category', category: 'electrical' });
    const outsideArea = partner({
      id: 'outside-area',
      latitude: 0,
      longitude: 1,
      service_radius_miles: 10,
    });
    sbSelectMock.mockResolvedValue([
      activeMatch,
      inactiveMatch,
      otherCategory,
      outsideArea,
    ]);

    const result = await findMatchingPartners('plumbing', origin);

    expect(result).toEqual([activeMatch]);
  });

  it('returns no matches and does not query when Supabase is not configured', async () => {
    isSupabaseConfiguredMock.mockReturnValue(false);

    await expect(findMatchingPartners('plumbing', origin)).resolves.toEqual([]);
    expect(sbSelectMock).not.toHaveBeenCalled();
  });
});
