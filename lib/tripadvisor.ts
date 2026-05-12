/**
 * Tripadvisor integration utilities.
 *
 * Design constraints:
 *  - TRIPADVISOR_API_KEY is server-side only — never NEXT_PUBLIC_
 *  - Live TA API calls happen ONLY in the background ingestion job
 *  - This module handles: normalization, category detection, API client, cache reads
 *  - All consumer page paths read from the Supabase cache (tripadvisor_businesses table)
 *  - Failures are always silent — TA enrichment is additive, never blocking
 */

import type {
  TripadvisorBusinessData,
  ReviewSource,
} from './types';
import { sbSelect, sbInsert, sbUpdate, isSupabaseConfigured } from './supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const TA_API_BASE = 'https://api.content.tripadvisor.com/api/v1';

/** Categories that receive Tripadvisor enrichment and blended scoring. */
export const HOSPITALITY_CATEGORIES = new Set([
  'restaurants',
  'hotels',
  'attractions',
  'resorts',
  'tourism',
  'food',       // maps to 'restaurants' in SEO taxonomy
  'hospitality',
]);

/** TA category type values returned by the Location Search API. */
export const TA_CATEGORY_MAP: Record<string, string> = {
  restaurants: 'restaurants',
  hotels:      'hotels',
  attractions: 'attractions',
  resorts:     'hotels',
  food:        'restaurants',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isHospitalityCategory(category: string): boolean {
  return HOSPITALITY_CATEGORIES.has(category.toLowerCase());
}

/**
 * Build ReviewSource[] for multi-source scoring.
 * Hospitality categories: Google 60% + TA 40%.
 * All other categories: Google 100%.
 */
export function buildReviewSources(
  googleRating: number,
  googleCount: number,
  ta?: TripadvisorBusinessData | null,
  category?: string
): ReviewSource[] {
  const isHospitality = category ? isHospitalityCategory(category) : false;

  const sources: ReviewSource[] = [
    {
      source: 'google',
      rating: googleRating,
      reviewCount: googleCount,
      confidenceWeight: isHospitality && ta ? 0.60 : 1.0,
      lastFetched: new Date().toISOString(),
    },
  ];

  if (ta && isHospitality) {
    sources.push({
      source: 'tripadvisor',
      rating: ta.rating,
      reviewCount: ta.reviewCount,
      confidenceWeight: 0.40,
      lastFetched: ta.lastFetched,
    });
  }

  return sources;
}

// ─── Normalization ────────────────────────────────────────────────────────────

/** Normalize a raw Tripadvisor API location detail response. */
export function normalizeTAResponse(raw: Record<string, unknown>): TripadvisorBusinessData {
  const subratingsRaw = raw.subratings as Record<string, { value: string }> | undefined;
  const subratings: TripadvisorBusinessData['subratings'] = {};
  if (subratingsRaw) {
    if (subratingsRaw.food)          subratings.food          = parseFloat(subratingsRaw.food.value);
    if (subratingsRaw.service)       subratings.service       = parseFloat(subratingsRaw.service.value);
    if (subratingsRaw.value)         subratings.value         = parseFloat(subratingsRaw.value.value);
    if (subratingsRaw.atmosphere)    subratings.ambiance      = parseFloat(subratingsRaw.atmosphere.value);
    if (subratingsRaw.cleanliness)   subratings.cleanliness   = parseFloat(subratingsRaw.cleanliness.value);
    if (subratingsRaw.rooms)         subratings.rooms         = parseFloat(subratingsRaw.rooms.value);
    if (subratingsRaw.location)      subratings.location      = parseFloat(subratingsRaw.location.value);
    if (subratingsRaw.sleep_quality) subratings.sleepQuality  = parseFloat(subratingsRaw.sleep_quality.value);
  }

  const subcats = raw.subcategory as Array<{ name: string }> | undefined;
  const awards  = raw.awards       as Array<{ display_name: string }> | undefined;

  return {
    taLocationId:    String(raw.location_id),
    rating:          parseFloat(String(raw.rating || '0')),
    reviewCount:     parseInt(String(raw.num_reviews || '0'), 10),
    category:        subcats?.[0]?.name ?? String(raw.category ?? ''),
    travelerRanking: (raw.ranking_data as { ranking_string?: string })?.ranking_string,
    priceLevel:      raw.price_level as string | undefined,
    awards:          awards?.map((a) => a.display_name) ?? [],
    subratings,
    lastFetched:     new Date().toISOString(),
  };
}

// ─── Supabase cache reads ─────────────────────────────────────────────────────

interface TABusinessRow {
  ta_location_id: string;
  google_place_id: string;
  rating: number;
  review_count: number;
  category: string;
  traveler_ranking: string | null;
  price_level: string | null;
  awards: string[];
  subratings: Record<string, number>;
  fetched_at: string;
}

interface IDMappingRow {
  ta_location_id: string | null;
  match_confidence: number | null;
}

/**
 * Fetch cached TA data for a Google place ID.
 * Returns null if not found, Supabase is not configured, or any error occurs.
 * This is always non-blocking — callers should use Promise.allSettled or try/catch.
 */
export async function getCachedTAData(
  googlePlaceId: string
): Promise<TripadvisorBusinessData | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const mappings = await sbSelect<IDMappingRow>(
      'business_id_mapping',
      `google_place_id=eq.${encodeURIComponent(googlePlaceId)}&select=ta_location_id,match_confidence`
    );
    const mapping = mappings[0];
    if (!mapping?.ta_location_id) return null;

    const rows = await sbSelect<TABusinessRow>(
      'tripadvisor_businesses',
      `ta_location_id=eq.${encodeURIComponent(mapping.ta_location_id)}&select=*`
    );
    const row = rows[0];
    if (!row) return null;

    return {
      taLocationId:    row.ta_location_id,
      rating:          row.rating,
      reviewCount:     row.review_count,
      category:        row.category,
      travelerRanking: row.traveler_ranking ?? undefined,
      priceLevel:      row.price_level ?? undefined,
      awards:          row.awards ?? [],
      subratings:      row.subratings ?? {},
      lastFetched:     row.fetched_at,
    };
  } catch {
    return null;
  }
}

/**
 * Save a "no match" sentinel row so we don't repeatedly query Tripadvisor
 * for businesses that aren't listed there.
 */
async function saveNegativeMapping(googlePlaceId: string): Promise<void> {
  try {
    await sbInsert('business_id_mapping', {
      google_place_id:  googlePlaceId,
      ta_location_id:   null,
      match_confidence: 0,
      matched_at:       new Date().toISOString(),
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Lazy TA enrichment: checks the Supabase cache first; if no entry exists,
 * calls the Tripadvisor API live to search for and fetch the business,
 * then caches the result for future requests.
 *
 * On no match or any error, saves a negative sentinel so subsequent requests
 * skip the live lookup. Returns null on any failure — always non-blocking.
 *
 * @param googlePlaceId - Google place ID used as the cache key
 * @param name          - Business display name (used for TA search)
 * @param address       - Formatted address (improves TA match accuracy)
 * @param category      - Detected business category (e.g. "hospitality")
 */
export async function getOrFetchTAData(
  googlePlaceId: string,
  name: string,
  address: string,
  category: string
): Promise<TripadvisorBusinessData | null> {
  if (!isSupabaseConfigured()) return null;
  if (!isHospitalityCategory(category)) return null;

  try {
    // 1. Check cache — includes negative sentinel rows
    const mappings = await sbSelect<IDMappingRow>(
      'business_id_mapping',
      `google_place_id=eq.${encodeURIComponent(googlePlaceId)}&select=ta_location_id,match_confidence`
    ).catch(() => [] as IDMappingRow[]);

    if (mappings.length > 0) {
      // Row exists (positive or negative sentinel)
      const taId = mappings[0].ta_location_id;
      if (!taId) return null; // negative cache — no TA listing for this business

      // Positive cache — fetch full TA record
      const rows = await sbSelect<TABusinessRow>(
        'tripadvisor_businesses',
        `ta_location_id=eq.${encodeURIComponent(taId)}&select=*`
      ).catch(() => [] as TABusinessRow[]);

      const row = rows[0];
      if (row) {
        return {
          taLocationId:    row.ta_location_id,
          rating:          row.rating,
          reviewCount:     row.review_count,
          category:        row.category,
          travelerRanking: row.traveler_ranking ?? undefined,
          priceLevel:      row.price_level ?? undefined,
          awards:          row.awards ?? [],
          subratings:      row.subratings ?? {},
          lastFetched:     row.fetched_at,
        };
      }
    }

    // 2. Cache miss — call TA API live with a 5-second timeout
    const taApiKey = process.env.TRIPADVISOR_API_KEY;
    if (!taApiKey) return null;

    const taCategory = TA_CATEGORY_MAP[category.toLowerCase()] ?? 'hotels';

    const liveEnrich = async (): Promise<TripadvisorBusinessData | null> => {
      const taId = await searchTALocation(name, address, taCategory);
      if (!taId) {
        await saveNegativeMapping(googlePlaceId);
        return null;
      }
      const taData = await fetchTALocationDetails(taId);
      if (!taData) {
        await saveNegativeMapping(googlePlaceId);
        return null;
      }
      // Cache result
      await saveTAMapping(googlePlaceId, taId, 80);
      await saveTABusinessData(googlePlaceId, taData);
      return taData;
    };

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    return await Promise.race([liveEnrich(), timeout]);
  } catch {
    return null;
  }
}

// ─── Tripadvisor API client (ingestion jobs only) ─────────────────────────────

function taApiKey(): string {
  const key = process.env.TRIPADVISOR_API_KEY;
  if (!key) throw new Error('TRIPADVISOR_API_KEY not configured');
  return key;
}

/**
 * Search Tripadvisor for a matching location by name + address.
 * Returns the TA location_id or null if no confident match.
 */
export async function searchTALocation(
  name: string,
  address: string,
  category: string
): Promise<string | null> {
  const key = taApiKey();
  const taCategory = TA_CATEGORY_MAP[category.toLowerCase()] ?? 'restaurants';
  const query = encodeURIComponent(`${name} ${address}`);

  const url = `${TA_API_BASE}/location/search?searchQuery=${query}&category=${taCategory}&language=en&key=${key}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;

  const json = await res.json() as { data?: Array<{ location_id: string; name: string; address_obj?: { address_string?: string } }> };
  const results = json.data ?? [];
  if (results.length === 0) return null;

  // Simple fuzzy match: first result whose name includes the query name (case-insensitive)
  const nameLower = name.toLowerCase();
  const match = results.find((r) =>
    r.name.toLowerCase().includes(nameLower) ||
    nameLower.includes(r.name.toLowerCase())
  ) ?? results[0];

  return match?.location_id ?? null;
}

/**
 * Fetch full location details from Tripadvisor by location_id.
 */
export async function fetchTALocationDetails(
  taLocationId: string
): Promise<TripadvisorBusinessData | null> {
  const key = taApiKey();
  const url = `${TA_API_BASE}/location/${taLocationId}/details?language=en&currency=USD&key=${key}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const json = await res.json() as Record<string, unknown>;
  return normalizeTAResponse(json);
}

/**
 * Save a business ID mapping (Google place ID → TA location ID) to Supabase.
 */
export async function saveTAMapping(
  googlePlaceId: string,
  taLocationId: string,
  confidence: number
): Promise<void> {
  await sbInsert('business_id_mapping', {
    google_place_id:   googlePlaceId,
    ta_location_id:    taLocationId,
    match_confidence:  confidence,
    matched_at:        new Date().toISOString(),
  });
}

/**
 * Upsert Tripadvisor business data into the Supabase cache.
 */
export async function saveTABusinessData(
  googlePlaceId: string,
  ta: TripadvisorBusinessData
): Promise<void> {
  const exists = await sbSelect<{ ta_location_id: string }>(
    'tripadvisor_businesses',
    `ta_location_id=eq.${encodeURIComponent(ta.taLocationId)}&select=ta_location_id`
  ).catch(() => []);

  const payload = {
    ta_location_id:    ta.taLocationId,
    google_place_id:   googlePlaceId,
    rating:            ta.rating,
    review_count:      ta.reviewCount,
    category:          ta.category,
    traveler_ranking:  ta.travelerRanking ?? null,
    price_level:       ta.priceLevel ?? null,
    awards:            ta.awards ?? [],
    subratings:        ta.subratings ?? {},
    fetched_at:        ta.lastFetched ?? new Date().toISOString(),
  };

  if (exists.length > 0) {
    await sbUpdate(
      'tripadvisor_businesses',
      `ta_location_id=eq.${encodeURIComponent(ta.taLocationId)}`,
      payload
    );
  } else {
    await sbInsert('tripadvisor_businesses', payload);
  }
}
