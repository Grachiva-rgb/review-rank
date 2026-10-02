import { Place, PlaceDetail, NormalizedBusiness } from './types';
import { calculateSmartScore, MIN_DISPLAY_RATING, detectCategory } from './ranking';
import { calculateReviewRankScore, BusinessReview, computeTrendSignal, getTrendLabel } from './reviewRankScoring';
import { getCachedTAEnrichment } from './tripadvisor';
import { computeMultiSourceScore } from './multiSourceScoring';
import { isSupabaseConfigured, sbUpsert, sbSelect } from './supabase';

type RawPlacesReview = {
  text?: { text?: string };
  rating?: number;
  publishTime?: string;
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
};

/**
 * Normalize the Places API's review shape into BusinessReview — the input
 * shape our scoring engine expects. Places API v1 returns up to 5 reviews
 * per business, selected and sorted BY RELEVANCE by Google (the New API has
 * no chronological sort option) — a sample, NOT the most recent reviews.
 * That sample feeds the sentiment and consistency sub-scores.
 */
function toBusinessReviews(raw: RawPlacesReview[] | undefined): BusinessReview[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((r, i) => ({
    id: String(i),
    rating: r.rating ?? 0,
    text: r.text?.text ?? '',
    createdAt: r.publishTime ?? new Date().toISOString(),
    platform: 'google' as const,
  }));
}

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

// Maps the new API's string enum to a 0–4 integer for display
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function normalizeBusiness(
  place: Place | PlaceDetail
): NormalizedBusiness {
  return {
    place_id: place.place_id,
    name: place.name,
    rating: place.rating,
    review_count: place.user_ratings_total,
    address: place.formatted_address,
    maps_url:
      place.url ||
      `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(place.place_id)}`,
    smart_score: place.smart_score,
    review_rank_score: place.review_rank_score,
    rank_label: place.rank_label,
    score_explanations: place.score_explanations,
  };
}

interface SearchOptions {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  /** Oldest acceptable cached result. Defaults to SEARCH_CACHE_TTL_MS. */
  cacheTtlMs?: number;
}

// ─── Search result cache (Supabase) ──────────────────────────────────────────

/**
 * Default freshness window, used for interactive user searches.
 *
 * Ratings and review counts move slowly, so a repeated query inside a day is
 * the same ranking — but at 30 minutes the same popular query ("plumbers in
 * cleveland") was re-bought dozens of times a day at the Text Search
 * Enterprise rate ($35/1k). A day-old result is indistinguishable to the user.
 */
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Freshness window for the pre-generated /[category]/[city] pages.
 *
 * Those pages are ISR'd once every 7 days, which is the freshness guarantee we
 * actually make for them — so anything shorter than that only causes the same
 * 260 Text Search calls to be re-bought on every deploy, since a build always
 * missed the shorter window. Sitting just under the revalidate period means a
 * redeploy is free while the weekly refresh still hits Google exactly once.
 */
export const SEO_SEARCH_CACHE_TTL_MS = 6.5 * 24 * 60 * 60 * 1000; // ~6.5 days

/**
 * Build a stable cache key from the search query and optional location bias.
 * Lat/lng are rounded to 3 decimal places (~110 m precision) so nearby
 * searches with fractionally different coords hit the same cache entry.
 */
function buildSearchCacheKey(query: string, options?: SearchOptions): string {
  const q = query.trim().toLowerCase();
  const lat = options?.lat != null ? Math.round(options.lat * 1000) / 1000 : '';
  const lng = options?.lng != null ? Math.round(options.lng * 1000) / 1000 : '';
  return `search:${q}:${lat}:${lng}`;
}

async function getCachedSearch(cacheKey: string, ttlMs: number): Promise<Place[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    // Race against a 1-second timeout so a slow/unreachable Supabase never blocks search
    const fetchPromise = sbSelect<{ results: Place[] }>(
      'search_cache',
      `cache_key=eq.${encodeURIComponent(cacheKey)}&created_at=gte.${encodeURIComponent(cutoff)}&select=results&limit=1`
    ).then((rows) => rows[0]?.results ?? null).catch(() => null);

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1000)
    );

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch {
    return null; // cache miss is non-fatal
  }
}

async function setCachedSearch(cacheKey: string, results: Place[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const writePromise = sbUpsert('search_cache', {
      cache_key: cacheKey,
      results,
      created_at: new Date().toISOString(),
    });
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await Promise.race([writePromise, timeout]);
  } catch {
    // Non-blocking — cache write failure must not affect the response
  }
}

export async function searchPlaces(query: string, options?: SearchOptions): Promise<Place[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured. Add it to your .env.local file.');
  }

  // Check Supabase cache before calling Google — saves a billed API call for
  // any query repeated inside the caller's freshness window.
  const cacheKey = buildSearchCacheKey(query, options);
  const cached = await getCachedSearch(cacheKey, options?.cacheTtlMs ?? SEARCH_CACHE_TTL_MS);
  if (cached) return cached;

  // NOTE: reviews intentionally excluded here — requesting reviews elevates the
  // call to the most expensive billing tier. Reviews are only fetched in
  // getPlaceDetails, where the detail page's scoring breakdown needs them.
  // photos is excluded too: nothing renders a Places photo, so requesting them
  // only inflated the response.
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.rating',
    'places.userRatingCount',
    'places.formattedAddress',
    'places.location',
    'places.currentOpeningHours',
    'places.priceLevel',
    'places.googleMapsUri',
  ].join(',');

  const body: Record<string, unknown> = { textQuery: query };

  if (options?.lat != null && options?.lng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: options.lat, longitude: options.lng },
        radius: options.radiusMeters ?? 5000,
      },
    };
  }

  const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
    next: { revalidate: 3600 }, // 1 hour — search results don't change meaningfully faster
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } }).error?.message;
    throw new Error(
      msg || `Google Places API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json() as { places?: Record<string, unknown>[] };

  const result = (data.places || []).filter((p) => {
    const r = (p.rating as number) || 0;
    return r >= MIN_DISPLAY_RATING;
  }).map((p) => {
    const displayName = p.displayName as { text?: string } | undefined;
    const location = p.location as { latitude?: number; longitude?: number } | undefined;
    const openingHours = p.currentOpeningHours as { openNow?: boolean } | undefined;
    const rating = (p.rating as number) || 0;
    const reviewCount = (p.userRatingCount as number) || 0;
    const reviews = toBusinessReviews(p.reviews as RawPlacesReview[] | undefined);

    const rrs = calculateReviewRankScore({
      businessId: p.id as string,
      rating,
      totalReviewCount: reviewCount,
      reviews,
    });

    const trendSignal = computeTrendSignal(
      reviewCount,
      rrs.componentScores.sentiment,
      rrs.componentScores.bayesian
    );

    return {
      place_id: p.id as string,
      name: displayName?.text ?? '',
      rating,
      user_ratings_total: reviewCount,
      formatted_address: (p.formattedAddress as string) || '',
      geometry: {
        location: {
          lat: location?.latitude ?? 0,
          lng: location?.longitude ?? 0,
        },
      },
      opening_hours: openingHours ? { open_now: openingHours.openNow } : undefined,
      price_level: PRICE_LEVEL_MAP[p.priceLevel as string] ?? undefined,
      url: (p.googleMapsUri as string) || undefined,
      smart_score: calculateSmartScore(rating, reviewCount),
      review_rank_score: rrs.finalScore,
      rank_label: rrs.rankLabel,
      score_explanations: rrs.explanations,
      score_components: rrs.componentScores,
      trend_signal: trendSignal,
      trend_label: getTrendLabel(trendSignal),
    };
  });

  // Store in Supabase cache (non-blocking — never delays the response)
  setCachedSearch(cacheKey, result).catch(() => {});

  return result;
}

// ─── Categorization ──────────────────────────────────────────────────────────

/**
 * Google primaryType values that mean "somewhere you sleep" vs "somewhere you
 * visit". Both land in our single `hospitality` category, but Tripadvisor
 * searches them under different categories — and searching a museum against
 * TA's hotels category never matches, which used to burn a call and then cache
 * a permanent "not on Tripadvisor" sentinel for every attraction.
 */
const LODGING_PRIMARY_TYPES = new Set([
  'lodging', 'hotel', 'motel', 'resort_hotel', 'bed_and_breakfast',
  'extended_stay_hotel', 'inn', 'hostel',
]);

const ATTRACTION_PRIMARY_TYPES = new Set([
  'tourist_attraction', 'amusement_park', 'aquarium', 'art_gallery', 'museum',
  'zoo', 'national_park', 'state_park', 'theme_park', 'visitor_center',
]);

const RESTAURANT_PRIMARY_TYPES = new Set([
  'restaurant', 'cafe', 'bakery', 'bar', 'coffee_shop', 'pizza_restaurant',
  'fast_food_restaurant', 'fine_dining_restaurant', 'steak_house',
]);

/**
 * Resolve a business's category, preferring Google's primaryType over the name
 * (which catches hotels with non-obvious names like "The Peninsula"), and the
 * Tripadvisor category to search it under.
 *
 * Shared with the ingestion job so both paths categorize identically.
 */
export function categorizePlace(name: string, primaryType?: string) {
  const type = (primaryType || '').toLowerCase();

  if (LODGING_PRIMARY_TYPES.has(type)) {
    return { category: 'hospitality' as const, taCategory: 'hotels' };
  }
  if (ATTRACTION_PRIMARY_TYPES.has(type)) {
    return { category: 'hospitality' as const, taCategory: 'attractions' };
  }
  if (RESTAURANT_PRIMARY_TYPES.has(type)) {
    return { category: 'food' as const, taCategory: 'restaurants' };
  }

  const category = detectCategory(name);
  return { category, taCategory: undefined };
}

// ─── Place Details cache (Supabase) ──────────────────────────────────────────

/**
 * Place Details requests the `reviews` field, which bills at the most expensive
 * (Enterprise + Atmosphere) tier — and with ~2,600 crawlable business pages, a
 * 6-hour window let bot traffic re-buy each page up to 4x/day. Google permits
 * caching place data for up to 30 days; 14 keeps ratings/reviews fresh enough
 * for a detail page while capping spend at ~2 calls/business/month worst case.
 */
const PLACE_DETAILS_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function buildPlaceDetailsCacheKey(placeId: string): string {
  return `place_details:${placeId}`;
}

/**
 * Read a cached raw Place Details payload from Supabase.
 *
 * Only Google's raw response is stored — scoring and TripAdvisor enrichment
 * still run on every request, so a change to the scoring engine takes effect
 * immediately rather than being frozen into cached rows.
 */
async function getCachedPlaceDetails(placeId: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const cutoff = new Date(Date.now() - PLACE_DETAILS_CACHE_TTL_MS).toISOString();
    // Race against a 1-second timeout so a slow/unreachable Supabase never blocks the page
    const fetchPromise = sbSelect<{ results: Record<string, unknown> }>(
      'search_cache',
      `cache_key=eq.${encodeURIComponent(buildPlaceDetailsCacheKey(placeId))}&created_at=gte.${encodeURIComponent(cutoff)}&select=results&limit=1`
    ).then((rows) => rows[0]?.results ?? null).catch(() => null);

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1000)
    );

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch {
    return null; // cache miss is non-fatal
  }
}

async function setCachedPlaceDetails(
  placeId: string,
  raw: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const writePromise = sbUpsert('search_cache', {
      cache_key: buildPlaceDetailsCacheKey(placeId),
      results: raw,
      created_at: new Date().toISOString(),
    });
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await Promise.race([writePromise, timeout]);
  } catch {
    // Non-blocking — cache write failure must not affect the response
  }
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetail> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured. Add it to your .env.local file.');
  }

  // NOTE: photos intentionally excluded — nothing in the UI renders them, so
  // requesting them only inflated the response and the billing tier.
  const fieldMask = [
    'id',
    'displayName',
    'rating',
    'userRatingCount',
    'formattedAddress',
    'location',
    'currentOpeningHours',
    'priceLevel',
    'internationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    'reviews',
    'primaryType',
  ].join(',');

  // Check the Supabase cache before calling Google. Unlike the Next.js fetch
  // cache, this survives redeploys — so shipping to Vercel no longer re-buys
  // a Place Details call for every business page that was already fetched.
  let p = await getCachedPlaceDetails(placeId);

  if (!p) {
    const response = await fetch(`${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      next: { revalidate: 3600 }, // 1 hour — ratings and review counts move slowly
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = (errBody as { error?: { message?: string } }).error?.message;
      throw new Error(
        msg || `Place Details API request failed: ${response.status} ${response.statusText}`
      );
    }

    p = await response.json() as Record<string, unknown>;

    // Store for the next request (non-blocking — never delays the response)
    setCachedPlaceDetails(placeId, p).catch(() => {});
  }

  const displayName = p.displayName as { text?: string } | undefined;
  const location = p.location as { latitude?: number; longitude?: number } | undefined;
  const openingHours = p.currentOpeningHours as {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  } | undefined;
  const rating = (p.rating as number) || 0;
  const reviewCount = (p.userRatingCount as number) || 0;

  type RawReview = {
    text?: { text?: string };
    rating?: number;
    publishTime?: string;
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  };

  const rawReviews = (p.reviews as RawReview[]) || [];
  const reviews = rawReviews.map((r) => ({
    author_name: r.authorAttribution?.displayName ?? 'Anonymous',
    author_url: r.authorAttribution?.uri,
    profile_photo_url: r.authorAttribution?.photoUri,
    rating: r.rating ?? 0,
    relative_time_description: r.relativePublishTimeDescription ?? '',
    text: r.text?.text ?? '',
  }));

  const rrs = calculateReviewRankScore({
    businessId: p.id as string,
    rating,
    totalReviewCount: reviewCount,
    reviews: toBusinessReviews(rawReviews),
  });

  const trendSignal = computeTrendSignal(
    reviewCount,
    rrs.componentScores.sentiment,
    rrs.componentScores.bayesian
  );

  const businessName = displayName?.text ?? '';
  const primaryType = (p.primaryType as string) || '';

  const { category } = categorizePlace(businessName, primaryType);

  // TA enrichment is CACHE-ONLY on this consumer path: a Supabase read, never
  // a live Tripadvisor call (those happen solely in the nightly ingestion
  // job). On a miss this seeds the business for matching and returns null.
  const taData = await getCachedTAEnrichment(placeId, category).catch(() => null);

  const multiSourceScore = computeMultiSourceScore(
    rating,
    reviewCount,
    taData,
    category,
    rrs.finalScore
  );

  return {
    place_id: p.id as string,
    name: displayName?.text ?? '',
    rating,
    user_ratings_total: reviewCount,
    formatted_address: (p.formattedAddress as string) || '',
    geometry: {
      location: {
        lat: location?.latitude ?? 0,
        lng: location?.longitude ?? 0,
      },
    },
    opening_hours: openingHours
      ? {
          open_now: openingHours.openNow,
          weekday_text: openingHours.weekdayDescriptions,
        }
      : undefined,
    price_level: PRICE_LEVEL_MAP[p.priceLevel as string] ?? undefined,
    primary_type: primaryType || undefined,
    formatted_phone_number: (p.internationalPhoneNumber as string) || undefined,
    website: (p.websiteUri as string) || undefined,
    url: (p.googleMapsUri as string) || undefined,
    reviews,
    smart_score: calculateSmartScore(rating, reviewCount),
    // ALWAYS the single-source score. The TripAdvisor blend used to replace
    // the displayed number here (detail/compare pages) while search results
    // kept the unblended score — the same business showed two different
    // scores depending on the page, and the label below was derived from the
    // unblended value either way. TA data remains visible in the supplemental
    // panel (ta_data / multi_source_score) but no longer alters the score.
    review_rank_score: rrs.finalScore,
    rank_label: rrs.rankLabel,
    score_explanations: rrs.explanations,
    score_components: rrs.componentScores,
    trend_signal: trendSignal,
    trend_label: getTrendLabel(trendSignal),
    ta_data: taData ?? undefined,
    multi_source_score: multiSourceScore,
  };
}
