import { Place, PlaceDetail, NormalizedBusiness } from './types';
import { calculateSmartScore, MIN_DISPLAY_RATING } from './ranking';

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
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  };

  const reviews = ((p.reviews as RawReview[]) || []).map((r) => ({
    author_name: r.authorAttribution?.displayName ?? 'Anonymous',
    author_url: r.authorAttribution?.uri,
    profile_photo_url: r.authorAttribution?.photoUri,
    rating: r.rating ?? 0,
    relative_time_description: r.relativePublishTimeDescription ?? '',
    text: r.text?.text ?? '',
  }));

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
  };
}
