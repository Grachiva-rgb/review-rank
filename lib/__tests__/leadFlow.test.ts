import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/lead-request/route';
import { GET } from '../../app/api/partner-coverage/route';
import { deliverLeadToPartners } from '../leadDelivery';

const m = vi.hoisted(() => ({
  select: vi.fn(), insert: vi.fn(), cached: vi.fn(), send: vi.fn(), configured: true,
}));
vi.mock('../supabase', () => ({
  isSupabaseConfigured: () => m.configured, sbSelect: m.select, sbInsert: m.insert,
}));
vi.mock('../leadLocation', () => ({
  LEAD_PLACE_ID_RE: /^[A-Za-z0-9_-]{10,100}$/, getCachedLeadBusiness: m.cached,
}));
vi.mock('../ratelimit', () => ({ rateLimit: () => ({ allowed: true }), clientIp: () => 'test' }));
vi.mock('resend', () => ({ Resend: class { emails = { send: m.send }; } }));

const placeId = 'ChIJleadtest000000000000';
const business = { placeId, name: 'Verified Plumbing', address: 'Hudson, OH', location: { lat: 41, lng: -81 } };
const base = { id: 'inside', business_name: 'Inside Partner', contact_email: 'inside@example.test',
  category: 'plumbing', status: 'active', latitude: 41, longitude: -81, service_radius_miles: 25 };
const payload = { contact_name: 'Test Customer', contact_phone: '555-555-0123', description: 'Test request',
  business_place_id: placeId, category: 'plumbing', share_with_local_partners: true };
const request = (body: unknown) => new NextRequest('https://app.invalid/api/lead-request',
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-only');
  vi.stubEnv('RESEND_API_KEY', 'mock-only');
  m.configured = true;
  m.cached.mockReset().mockResolvedValue(business);
  m.select.mockReset().mockResolvedValue([
    base,
    { ...base, id: 'outside', latitude: 34, longitude: -118, contact_email: 'outside@example.test' },
    { ...base, id: 'missing', latitude: null, longitude: null },
    { ...base, id: 'inactive', status: 'canceled' },
    { ...base, id: 'other', category: 'roofing' },
  ]);
  m.insert.mockReset().mockResolvedValue(null);
  m.send.mockReset().mockResolvedValue({ data: { id: 'mock-email' }, error: null });
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    if (String(url) !== 'https://database.invalid/rest/v1/leads') throw new Error('Paid provider call forbidden');
    return { ok: true, json: async () => [{ id: 'lead-test' }] };
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('quote submission + coverage + email matching', () => {
  it('ignores forged browser location/name and shares only with a verified local match', async () => {
    const res = await POST(request({ ...payload, business_name: 'Forged Name', business_lat: 34, business_lng: -118 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, delivered: true });
    expect(m.cached).toHaveBeenCalledWith(placeId);
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send.mock.calls[0][0].to).toBe('inside@example.test');
    const record = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(record).toMatchObject({ business_name: business.name, service_area_latitude: 41,
      service_area_longitude: -81, service_area_source: 'cached_business_area' });
    expect(record.partner_sharing_consented_at).toEqual(expect.any(String));
    expect(m.insert).toHaveBeenCalledWith('lead_deliveries', expect.objectContaining({ partner_id: 'inside' }));
    expect(fetch).toHaveBeenCalledTimes(1); // Database insert only; zero Google requests.
  });
  it('uses the same matching rules for coverage, ignoring caller coordinates', async () => {
    const res = await GET(new NextRequest(
      `https://app.invalid/api/partner-coverage?category=plumbing&business_place_id=${placeId}&lat=34&lng=-118`));
    expect(await res.json()).toEqual({ hasPartner: true });
    expect(m.cached).toHaveBeenCalledWith(placeId);
    expect(fetch).not.toHaveBeenCalled();
    m.select.mockResolvedValue([{ ...base, latitude: null, longitude: null }]);
    const none = await GET(new NextRequest(
      `https://app.invalid/api/partner-coverage?category=plumbing&business_place_id=${placeId}`));
    expect(await none.json()).toEqual({ hasPartner: false });
  });
  it('rejects unverified areas without saving or sharing PII', async () => {
    m.cached.mockResolvedValue(null);
    expect((await POST(request(payload))).status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
    const coverage = await GET(new NextRequest(
      `https://app.invalid/api/partner-coverage?category=plumbing&business_place_id=${placeId}`));
    expect(await coverage.json()).toEqual({ hasPartner: false });
    expect(coverage.headers.get('cache-control')).toBe('no-store');
  });
  it.each([false, undefined, 'true'])('requires explicit boolean sharing consent: %s', async consent => {
    expect((await POST(request({ ...payload, share_with_local_partners: consent }))).status).toBe(400);
    expect(m.cached).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it.each([
    { business_place_id: '../bad' }, { category: 'unknown' }, { contact_phone: 'invalid' },
  ])('rejects invalid routing/contact fields before storage %j', async changes => {
    expect((await POST(request({ ...payload, ...changes }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it('does not claim success when quote storage is unconfigured', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await POST(request(payload))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it('does not share a lead that failed persistence', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(request(payload))).status).toBe(500);
    expect(m.send).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('reports stored-but-not-delivered honestly when no eligible partner remains', async () => {
    m.select.mockResolvedValue([]);
    const res = await POST(request(payload));
    expect(await res.json()).toEqual({ success: true, delivered: false });
    expect(m.send).not.toHaveBeenCalled();
  });
  it('direct delivery with unknown coordinates cannot query/broadcast', async () => {
    expect(await deliverLeadToPartners({ category: 'plumbing', businessName: business.name,
      contactName: 'Test', contactPhone: '555-555-0123', description: 'Test' })).toBe(0);
    expect(m.select).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
});
