import { isSupabaseConfigured, sbSelect } from './supabase';
import { PLACE_DETAILS_CACHE_TTL_MS, SEO_SEARCH_CACHE_TTL_MS } from './places';
import { isCoordinates, type Coordinates } from './partnerMatching';

export const LEAD_PLACE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

export interface CachedLeadBusiness {
  placeId: string;
  name: string;
  address: string;
  location: Coordinates;
}

type CacheRow = { results: unknown; created_at: string };

function fresh(row: CacheRow, ttl: number): boolean {
  const time = Date.parse(row.created_at);
  return Number.isFinite(time) && time >= Date.now() - ttl && time <= Date.now() + 60_000;
}

function fromCache(value: unknown, placeId: string, raw: boolean): CachedLeadBusiness | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if ((raw ? p.id : p.place_id) !== placeId) return null;
  const display = p.displayName as { text?: unknown } | undefined;
  const name = raw ? display?.text : p.name;
  const geometry = p.geometry as { location?: unknown } | undefined;
  const position = p.location as { latitude?: unknown; longitude?: unknown } | undefined;
  const location = raw ? { lat: position?.latitude, lng: position?.longitude } : geometry?.location;
  if (typeof name !== 'string' || !name.trim() || !isCoordinates(location)) return null;
  // Older search mappers used (0,0) when Google omitted location. It is not a
  // usable US service-area anchor, even though (0,0) is globally valid.
  if (location.lat === 0 && location.lng === 0) return null;
  const address = raw ? p.formattedAddress : p.formatted_address;
  return { placeId, name: name.trim(), address: typeof address === 'string' ? address : '', location };
}

/**
 * Resolve only from server-owned, fresh cache records. NEVER call
 * getPlaceDetails/geocoding on a miss: lead traffic cannot purchase Google calls.
 * The business is an area anchor, not a claim about the customer's job address.
 */
export async function getCachedLeadBusiness(placeId: string): Promise<CachedLeadBusiness | null> {
  if (!LEAD_PLACE_ID_RE.test(placeId) || !isSupabaseConfigured()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lookup = async () => {
    const details = await sbSelect<CacheRow>(
      'search_cache',
      `cache_key=eq.${encodeURIComponent(`place_details:${placeId}`)}`
        + `&created_at=gte.${encodeURIComponent(new Date(Date.now() - PLACE_DETAILS_CACHE_TTL_MS).toISOString())}`
        + '&select=results,created_at&limit=1'
    );
    for (const row of details) {
      const business = fresh(row, PLACE_DETAILS_CACHE_TTL_MS) ? fromCache(row.results, placeId, true) : null;
      if (business) return business;
    }
    // Quote buttons also exist on search cards, before a detail page is opened.
    // JSONB containment bounds the lookup to rows containing this exact ID.
    const searches = await sbSelect<CacheRow>(
      'search_cache',
      `cache_key=like.search:*&results=cs.${encodeURIComponent(JSON.stringify([{ place_id: placeId }]))}`
        + `&created_at=gte.${encodeURIComponent(new Date(Date.now() - SEO_SEARCH_CACHE_TTL_MS).toISOString())}`
        + '&select=results,created_at&order=created_at.desc&limit=5'
    );
    for (const row of searches) {
      if (!fresh(row, SEO_SEARCH_CACHE_TTL_MS) || !Array.isArray(row.results)) continue;
      for (const p of row.results) {
        const business = fromCache(p, placeId, false);
        if (business) return business;
      }
    }
    return null;
  };
  try {
    return await Promise.race([
      lookup(),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1500); }),
    ]);
  } catch {
    return null; // DB unavailable, malformed data, or cache miss: never broadcast.
  } finally {
    if (timer) clearTimeout(timer);
  }
}
