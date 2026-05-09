import type { Metadata } from 'next';
import { searchPlaces } from '@/lib/places';
import { normalizeSearchQuery, filterByIntent } from '@/lib/searchIntent';
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

  try {
    const raw = await searchPlaces(
      searchQuery,
      isGps ? { lat: validLat, lng: validLng } : undefined
    );
    // Remove results that don't match the user's intent (e.g. gymnastics for "gym")
    // and bubble strong matches to the top, using the original category as the intent key
    places = filterByIntent(raw, category.trim() || query.trim());
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
    />
  );
}
