import type { Metadata } from 'next';
import { searchPlaces } from '@/lib/places';
import { normalizeSearchQuery, filterByIntent } from '@/lib/searchIntent';
import {
  parseZipFromQuery,
  geocodeZip,
  applyZipFilter,
  parseCityStateFromQuery,
  geocodeCityState,
  filterByState,
  applyCityFilter,
} from '@/lib/locationIntent';
import ResultsClient from '@/components/ResultsClient';
import Link from 'next/link';

interface ResultsPageProps {
  searchParams: Promise<{
    q?: string;
    location?: string;
    category?: string;
    lat?: string;
    lng?: string;
  }>;
}

const MAX_QUERY_LENGTH = 200;
const MAX_LABEL_LENGTH = 100; // location / category display strings

export async function generateMetadata({ searchParams }: ResultsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const category = (params.category || '').slice(0, MAX_LABEL_LENGTH).trim();
  const location = (params.location || '').slice(0, MAX_LABEL_LENGTH).trim();
  const q = (params.q || '').slice(0, MAX_LABEL_LENGTH).trim();

  if (category && location) {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return {
      title: `Best ${cap(category)} in ${location}`,
      description: `Find trusted ${category} in ${location} ranked by review quality, volume, and consistency — not paid placements or star averages alone.`,
    };
  }
  if (q) {
    return {
      title: `${q} Rankings`,
      description: `Discover top-ranked results for "${q}" scored by real customer review signals.`,
    };
  }
  return {
    title: 'Local Business Rankings',
    description: 'Find trusted local businesses ranked by review quality, volume, and consistency.',
  };
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = await searchParams;
  const query = params.q || '';
  const location = (params.location || '').slice(0, MAX_LABEL_LENGTH);
  const category = (params.category || '').slice(0, MAX_LABEL_LENGTH);

  // Validate and clamp GPS coordinates to valid geographic ranges
  const rawLat = params.lat ? parseFloat(params.lat) : undefined;
  const rawLng = params.lng ? parseFloat(params.lng) : undefined;
  const validLat = rawLat != null && !isNaN(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : undefined;
  const validLng = rawLng != null && !isNaN(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : undefined;
  const isGps = validLat != null && validLng != null;

  // Apply intent normalisation when using category search (not freeform q=)
  // e.g. "gym" → "fitness gym" before building the Google Places query
  const normalizedCategory = query.trim() ? category.trim() : normalizeSearchQuery(category.trim());

  // Detect ZIP code in query or location field ("hotels in 77089", "77089")
  const targetZip =
    parseZipFromQuery(query.trim()) ||
    parseZipFromQuery(normalizedCategory) ||
    parseZipFromQuery(location.trim()) ||
    null;

  // Detect city+state ("Hudson OH", "Austin, TX") — used when no ZIP is present
  const cityState = !targetZip
    ? parseCityStateFromQuery(query.trim()) ||
      parseCityStateFromQuery(location.trim()) ||
      parseCityStateFromQuery(normalizedCategory)
    : null;

  // Resolve ZIP or city+state to lat/lng centroid (cached 24 h; null on any failure)
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
  const zipCenter = targetZip && !isGps
    ? await geocodeZip(targetZip, apiKey).catch(() => null)
    : null;

  const cityStateCenter = cityState && !isGps && !zipCenter
    ? await geocodeCityState(cityState.city, cityState.state, apiKey).catch(() => null)
    : null;

  // Location bias priority: GPS > ZIP centroid (tight 8 km) > city+state centroid (15 km)
  const locationBias = isGps
    ? { lat: validLat!, lng: validLng! }
    : zipCenter
      ? { lat: zipCenter.lat, lng: zipCenter.lng, radiusMeters: 8000 }
      : cityStateCenter
        ? { lat: cityStateCenter.lat, lng: cityStateCenter.lng, radiusMeters: 15000 }
        : undefined;

  // Build the text query — q takes precedence; if absent, combine category + location
  const rawQuery =
    query.trim() ||
    (normalizedCategory && location.trim()
      ? `${normalizedCategory} in ${location.trim()}`
      : normalizedCategory);
  const searchQuery = rawQuery.slice(0, MAX_QUERY_LENGTH);

  if (!searchQuery) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">No search query provided.</p>
          <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm">
            ← Start a new search
          </Link>
        </div>
      </div>
    );
  }

  let places: Awaited<ReturnType<typeof searchPlaces>> = [];
  let error: string | null = null;
  let locationMessage: string | null = null;

  try {
    const raw = await searchPlaces(searchQuery, locationBias);

    // Remove results that don't match the user's intent (e.g. gymnastics for "gym")
    const intentFiltered = filterByIntent(raw, category.trim() || query.trim());

    const categoryLabel = (category.trim() || query.trim() || 'results').toLowerCase();

    if (targetZip) {
      // ZIP path: ZIP radius filter (hard eligibility)
      const zipOutcome = applyZipFilter(intentFiltered, targetZip, zipCenter, categoryLabel);
      places = zipOutcome.places;
      locationMessage = zipOutcome.locationMessage;
    } else if (cityState) {
      // City+state path:
      //   1. Hard-filter by state (drops Hudson MA / Hudson NY)
      //   2. Then filter to city name / distance radius (drops Stow, OH etc.)
      const stateFiltered = filterByState(intentFiltered, cityState.state);
      const cityOutcome = applyCityFilter(stateFiltered, cityState, cityStateCenter, categoryLabel);
      places = cityOutcome.places;
      locationMessage = cityOutcome.locationMessage;
    } else {
      places = intentFiltered;
    }
  } catch (err) {
    // Log details server-side; show only a generic message to the client
    console.error('[ResultsPage] searchPlaces error:', err);
    error = 'Unable to load results. Please try again.';
  }

  return (
    <ResultsClient
      places={places}
      query={searchQuery}
      location={location}
      category={category}
      error={error}
      isGps={isGps}
      locationMessage={locationMessage}
    />
  );
}
