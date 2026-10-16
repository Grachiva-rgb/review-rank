import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBackfillArgs, runBackfill } from '../../scripts/backfill-partner-locations';

const m = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), geocode: vi.fn(), configured: true }));
vi.mock('../supabase', () => ({
  isSupabaseConfigured: () => m.configured, sbSelect: m.select, sbUpdate: m.update,
}));
vi.mock('../partnerLocation', async () => {
  const actual = await vi.importActual<typeof import('../partnerLocation')>('../partnerLocation');
  return { ...actual, resolvePartnerServiceCenter: m.geocode };
});
const originalReads = m.select.mock.calls.length;
const row = { id: 'partner-test', city: 'Hudson', state: 'OH', service_radius_miles: 25 };

beforeEach(() => {
  m.configured = true;
  m.select.mockReset().mockResolvedValue([row]);
  m.update.mockReset().mockResolvedValue(null);
  m.geocode.mockReset().mockResolvedValue({ lat: 41.24, lng: -81.44 });
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'mock-only');
  vi.stubEnv('RATE_LIMIT_BACKEND', 'supabase');
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('manual bounded partner-location backfill', () => {
  it('has no import-time database or paid-provider side effects', () => expect(originalReads).toBe(0));
  it('defaults to a 10-record dry run with zero writes/geocoding', async () => {
    expect(parseBackfillArgs([])).toEqual({ apply: false, limit: 10 });
    await runBackfill([]);
    expect(m.select.mock.calls[0][1]).toContain('limit=10');
    expect(m.update).not.toHaveBeenCalled();
    expect(m.geocode).not.toHaveBeenCalled();
  });
  it.each([['--limit', '0'], ['--limit', '26'], ['--limit', '1.5'], ['--limit'], ['--unknown']])(
    'rejects unsafe or ambiguous arguments %j', (...args) => {
      expect(() => parseBackfillArgs(args)).toThrow();
    });
  it('requires explicit apply and shares city lookups within a bounded batch', async () => {
    m.select.mockResolvedValue([row, { ...row, id: 'partner-two' }]);
    await runBackfill(['--apply', '--limit', '2']);
    expect(m.geocode).toHaveBeenCalledTimes(1);
    expect(m.update).toHaveBeenCalledTimes(2);
    expect(m.update.mock.calls[0][2]).toMatchObject({
      latitude: 41.24, longitude: -81.44, service_area_location_source: 'city_center',
    });
  });
  it('enforces the selected-record budget even if a DB response exceeds its limit', async () => {
    m.select.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ ...row, id: String(i) })));
    await runBackfill(['--apply', '--limit', '2']);
    expect(m.update).toHaveBeenCalledTimes(2);
  });
  it('leaves invalid/manual-review locations and no-matches excluded', async () => {
    m.select.mockResolvedValue([{ ...row, state: 'ZZ' }, { ...row, id: 'no-match' }]);
    m.geocode.mockResolvedValue(null);
    await runBackfill(['--apply']);
    expect(m.geocode).toHaveBeenCalledTimes(1);
    expect(m.update).not.toHaveBeenCalled();
  });
  it('reuses provider failures within a batch without repeated paid retries', async () => {
    m.select.mockResolvedValue([row, { ...row, id: 'partner-two' }]);
    m.geocode.mockRejectedValue(new Error('mock API failure with sensitive diagnostics'));
    await runBackfill(['--apply']);
    expect(m.geocode).toHaveBeenCalledTimes(1);
    expect(m.update).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain('sensitive diagnostics');
  });
  it('requires server configuration and an API key only for apply mode', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    await runBackfill([]);
    await expect(runBackfill(['--apply'])).rejects.toThrow('configuration');
    m.configured = false;
    await expect(runBackfill([])).rejects.toThrow('Supabase');
  });
  it.each([undefined, '', 'local', 'invalid'])(
    'refuses apply without the shared backend (%s) before any reads or writes',
    async (backend) => {
      vi.stubEnv('RATE_LIMIT_BACKEND', backend as unknown as string);
      await expect(runBackfill(['--apply'])).rejects.toThrow('Shared Google budget');
      expect(m.select).not.toHaveBeenCalled();
      expect(m.geocode).not.toHaveBeenCalled();
      expect(m.update).not.toHaveBeenCalled();
    }
  );
  it('still permits a zero-provider dry run without shared-budget activation', async () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', undefined as unknown as string);
    await runBackfill([]);
    expect(m.select).toHaveBeenCalledOnce();
    expect(m.geocode).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
});
