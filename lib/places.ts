import { Place, PlaceDetail, NormalizedBusiness } from './types';
import { calculateSmartScore, MIN_DISPLAY_RATING } from './ranking';
import { calculateReviewRankScore, BusinessReview } from './reviewRankScoring';

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

export async function searchPlaces(query: string, options?: SearchOptions): Promise<Place[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured. Add it to your .env.local file.');
  }

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
    'places.reviews',
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
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } }).error?.message;
    throw new Error(
      msg || `Google Places API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json() as { places?: Record<string, unknown>[] };

  return (data.places || []).filter((p) => {
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
    };
  });
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
    review_rank_score: rrs.finalScore,
    rank_label: rrs.rankLabel,
    score_explanations: rrs.explanations,
  };
}
