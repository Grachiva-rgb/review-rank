import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/partner/checkout/route';

const m = vi.hoisted(() => ({
  insert: vi.fn(), geocode: vi.fn(), checkout: vi.fn(), configured: true, stripeConfigured: true,
}));
vi.mock('../supabase', () => ({ isSupabaseConfigured: () => m.configured, sbInsert: m.insert }));
vi.mock('../partnerLocation', async () => {
  const actual = await vi.importActual<typeof import('../partnerLocation')>('../partnerLocation');
  return { ...actual, resolvePartnerServiceCenter: m.geocode };
});
vi.mock('../ratelimit', () => ({
  rateLimit: () => ({ allowed: true }),
  rateLimitAsync: async () => ({ allowed: true }),
  enforceGooglePlacesDailyLimit: async () => ({ allowed: true }),
  clientIp: () => 'test',
}));
vi.mock('../stripe', () => ({
  PARTNER_MONTHLY_CENTS: 9900,
  isStripeConfigured: () => m.stripeConfigured,
  getStripe: () => ({ checkout: { sessions: { create: m.checkout } } }),
}));
const payload = { business_name: 'Test Partner', contact_email: 'partner@example.test',
  category: 'plumbing', city: 'Hudson', state: 'OH', service_radius_miles: 25 };
const request = (body: unknown) => new NextRequest('https://app.invalid/api/partner/checkout',
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.invalid');
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'mock-only');
  m.configured = true;
  m.stripeConfigured = true;
  m.geocode.mockReset().mockResolvedValue({ lat: 41.24, lng: -81.44 });
  m.insert.mockReset().mockResolvedValue([{ id: 'partner-test' }]);
  m.checkout.mockReset().mockResolvedValue({ url: 'https://stripe.invalid/test' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('save a verified service area before charging a partner', () => {
  it('persists a server-resolved center, ignoring forged client coordinates', async () => {
    const res = await POST(request({ ...payload, latitude: 0, longitude: 0 }));
    expect(res.status).toBe(200);
    expect(m.geocode).toHaveBeenCalledWith('Hudson', 'OH', 'mock-only');
    expect(m.insert).toHaveBeenCalledWith('partners', expect.objectContaining({
      latitude: 41.24, longitude: -81.44, service_radius_miles: 25,
      service_area_location_source: 'city_center', status: 'pending',
    }), { returning: true });
    expect(m.checkout).toHaveBeenCalledTimes(1);
    expect(m.insert.mock.invocationCallOrder[0]).toBeLessThan(m.checkout.mock.invocationCallOrder[0]);
  });
  it.each([
    { city: '' }, { state: 'ZZ' }, { service_radius_miles: 0 },
    { service_radius_miles: 201 }, { service_radius_miles: 2.5 },
    { service_radius_miles: 'invalid' },
  ])('rejects invalid areas/radii without geocoding or checkout %j', async changes => {
    expect((await POST(request({ ...payload, ...changes }))).status).toBe(400);
    expect(m.geocode).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it('does not create checkout when geocoding finds no corroborated city', async () => {
    m.geocode.mockResolvedValue(null);
    expect((await POST(request(payload))).status).toBe(422);
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it('does not fall back nationwide after a provider failure', async () => {
    m.geocode.mockRejectedValue(new Error('unavailable'));
    expect((await POST(request(payload))).status).toBe(503);
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it.each([null, []])('does not charge if persistence returns no partner: %j', async rows => {
    m.insert.mockResolvedValue(rows);
    expect((await POST(request(payload))).status).toBe(503);
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it('does not charge after a database write error', async () => {
    m.insert.mockRejectedValue(new Error('unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(request(payload))).status).toBe(503);
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it('checks configuration before spending on a geocode request', async () => {
    m.configured = false;
    expect((await POST(request(payload))).status).toBe(503);
    m.configured = true;
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect((await POST(request(payload))).status).toBe(503);
    expect(m.geocode).not.toHaveBeenCalled();
    expect(m.checkout).not.toHaveBeenCalled();
  });
});
