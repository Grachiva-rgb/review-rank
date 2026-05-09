import { Place, PlaceDetail, NormalizedBusiness } from './types';
import { calculateSmartScore, MIN_DISPLAY_RATING, detectCategory } from './ranking';
import { calculateReviewRankScore, BusinessReview, computeTrendSignal, getTrendLabel } from './reviewRankScoring';
import { getCachedTAData } from './tripadvisor';
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
 * Normalize the Places API's recent-review shape into BusinessReview — the
 * input shape our scoring engine expects. Places API v1 returns up to ~5
 * most recent reviews per business; that's the signal we use for sentiment
 * and consistency sub-scores.
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
}

// ─── Search result cache (Supabase) ──────────────────────────────────────────

const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

async function getCachedSearch(cacheKey: string): Promise<Place[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const cutoff = new Date(Date.now() - SEARCH_CACHE_TTL_MS).toISOString();
    const rows = await sbSelect<{ results: Place[] }>(
      'search_cache',
      `cache_key=eq.${encodeURIComponent(cacheKey)}&created_at=gte.${encodeURIComponent(cutoff)}&select=results&limit=1`
    );
    return rows[0]?.results ?? null;
  } catch {
    return null; // cache miss is non-fatal
  }
}

async function setCachedSearch(cacheKey: string, results: Place[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await sbUpsert('search_cache', {
      cache_key: cacheKey,
      results,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-blocking — cache write failure must not affect the response
  }
}

export async function searchPlaces(query: string, options?: SearchOptions): Promise<Place[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured. Add it to your .env.local file.');
  }

  // Check Supabase cache before calling Google — saves a Pro-tier API call for
  // any query repeated within the 30-minute TTL window.
  const cacheKey = buildSearchCacheKey(query, options);
  const cached = await getCachedSearch(cacheKey);
  if (cached) return cached;

  // NOTE: reviews intentionally excluded here — requesting reviews elevates the call
  // to the Pro billing tier (5–10x cost). Reviews are only fetched in getPlaceDetails
  // where they are actually needed for the scoring breakdown on the detail page.
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.rating',
    'places.userRatingCount',
    'places.formattedAddress',
    'places.location',
    'places.photos',
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
      photos: (p.photos as Place['photos']) || undefined,
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

export async function getPlaceDetails(placeId: string): Promise<PlaceDetail> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured. Add it to your .env.local file.');
  }

  const fieldMask = [
    'id',
    'displayName',
    'rating',
    'userRatingCount',
    'formattedAddress',
    'location',
    'photos',
    'currentOpeningHours',
    'priceLevel',
    'internationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    'reviews',
  ].join(',');

  const response = await fetch(`${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } }).error?.message;
    throw new Error(
      msg || `Place Details API request failed: ${response.status} ${response.statusText}`
    );
  }

  const p = await response.json() as Record<string, unknown>;

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

  const category = detectCategory(displayName?.text ?? '');

  // Fetch TA enrichment from Supabase cache (non-blocking — null on any failure)
  const taData = await getCachedTAData(placeId).catch(() => null);

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
    photos: (p.photos as PlaceDetail['photos']) || undefined,
    opening_hours: openingHours
      ? {
          open_now: openingHours.openNow,
          weekday_text: openingHours.weekdayDescriptions,
        }
      : undefined,
    price_level: PRICE_LEVEL_MAP[p.priceLevel as string] ?? undefined,
    formatted_phone_number: (p.internationalPhoneNumber as string) || undefined,
    website: (p.websiteUri as string) || undefined,
    url: (p.googleMapsUri as string) || undefined,
    reviews,
    smart_score: calculateSmartScore(rating, reviewCount),
    review_rank_score: taData ? multiSourceScore.finalScore : rrs.finalScore,
    rank_label: rrs.rankLabel,
    score_explanations: rrs.explanations,
    score_components: rrs.componentScores,
    trend_signal: trendSignal,
    trend_label: getTrendLabel(trendSignal),
    ta_data: taData ?? undefined,
    multi_source_score: multiSourceScore,
  };
}
