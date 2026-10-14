import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedLeadBusiness } from '../leadLocation';

const db = vi.hoisted(() => ({ configured: true, select: vi.fn() }));
vi.mock('../supabase', () => ({
  isSupabaseConfigured: () => db.configured,
  sbSelect: db.select,
  sbUpsert: vi.fn(),
  sbInsertIgnore: vi.fn(),
}));
const id = 'ChIJleadtest000000000000';
const raw = { id, displayName: { text: 'Trusted Plumbing' }, formattedAddress: 'Hudson, OH',
  location: { latitude: 41.24, longitude: -81.44 } };
const row = (results: unknown, days = 0) => ({
  results, created_at: new Date(Date.now() - days * 86400_000).toISOString(),
});
const card = { place_id: id, name: 'Trusted Plumbing', formatted_address: 'Hudson, OH',
  geometry: { location: { lat: 41.24, lng: -81.44 } } };

beforeEach(() => {
  db.configured = true;
  db.select.mockReset().mockResolvedValue([]);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external requests allowed'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('server-owned cache-only lead location', () => {
  it('uses fresh raw detail identity/name/coordinates without a provider call', async () => {
    db.select.mockResolvedValueOnce([row(raw)]);
    expect(await getCachedLeadBusiness(id)).toEqual({
      placeId: id, name: 'Trusted Plumbing', address: 'Hudson, OH', location: card.geometry.location,
    });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('falls back to an exact-ID cached search card, supporting card-only quotes', async () => {
    db.select.mockResolvedValueOnce([]).mockResolvedValueOnce([row([card])]);
    expect((await getCachedLeadBusiness(id))?.location).toEqual(card.geometry.location);
    expect(db.select.mock.calls[1][1]).toContain('results=cs.');
    expect(decodeURIComponent(db.select.mock.calls[1][1])).toContain(JSON.stringify([{ place_id: id }]));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the existing 14-day detail window rather than extending retention', async () => {
    db.select.mockResolvedValueOnce([row(raw, 13)]);
    expect(await getCachedLeadBusiness(id)).not.toBeNull();
    db.select.mockReset().mockResolvedValue([]);
    db.select.mockResolvedValueOnce([row(raw, 15)]);
    expect(await getCachedLeadBusiness(id)).toBeNull();
  });
  it('does not use expired city/search rows', async () => {
    db.select.mockResolvedValueOnce([]).mockResolvedValueOnce([row([card], 7)]);
    expect(await getCachedLeadBusiness(id)).toBeNull();
  });
  it('refuses a poisoned detail identity or unrelated search entry', async () => {
    db.select.mockResolvedValueOnce([row({ ...raw, id: 'another-business' })])
      .mockResolvedValueOnce([row([{ ...card, place_id: 'another-business' }])]);
    expect(await getCachedLeadBusiness(id)).toBeNull();
  });
  it.each([
    { latitude: null, longitude: -81 },
    { latitude: NaN, longitude: -81 },
    { latitude: 91, longitude: -81 },
    { latitude: 41, longitude: -181 },
    { latitude: '41', longitude: '-81' },
    { latitude: 0, longitude: 0 },
  ])('rejects unusable cached detail coordinates %j', async location => {
    db.select.mockResolvedValueOnce([row({ ...raw, location })]);
    expect(await getCachedLeadBusiness(id)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects the historical search (0,0) missing-location sentinel', async () => {
    db.select.mockResolvedValueOnce([]).mockResolvedValueOnce([
      row([{ ...card, geometry: { location: { lat: 0, lng: 0 } } }]),
    ]);
    expect(await getCachedLeadBusiness(id)).toBeNull();
  });
  it('rejects malformed or far-future cache timestamps', async () => {
    db.select.mockResolvedValueOnce([{ results: raw, created_at: 'invalid' }]);
    expect(await getCachedLeadBusiness(id)).toBeNull();
    db.select.mockReset().mockResolvedValue([]);
    db.select.mockResolvedValueOnce([{ results: raw, created_at: new Date(Date.now() + 86400_000).toISOString() }]);
    expect(await getCachedLeadBusiness(id)).toBeNull();
  });
  it('fails closed on database failure and never purchases a fallback lookup', async () => {
    db.select.mockRejectedValue(new Error('database unavailable'));
    expect(await getCachedLeadBusiness(id)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('bounds a hanging cache lookup', async () => {
    vi.useFakeTimers();
    db.select.mockImplementation(() => new Promise(() => {}));
    const lookup = getCachedLeadBusiness(id);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await lookup).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('short-circuits missing configuration or invalid IDs', async () => {
    expect(await getCachedLeadBusiness('../unsafe')).toBeNull();
    db.configured = false;
    expect(await getCachedLeadBusiness(id)).toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });
});
