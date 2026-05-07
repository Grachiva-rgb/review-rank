import { searchPlaces } from '@/lib/places';
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

  // Build the text query — q takes precedence; if absent, combine category + location
  const rawQuery =
    query.trim() ||
    (category.trim() && location.trim()
      ? `${category.trim()} in ${location.trim()}`
      : category.trim());
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
    places = await searchPlaces(
      searchQuery,
      isGps ? { lat: validLat, lng: validLng } : undefined
    );
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
