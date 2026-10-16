import { NextRequest, NextResponse } from 'next/server';
import { searchPlaces, normalizeBusiness } from '@/lib/places';
import { rateLimitAsync, clientIp } from '@/lib/ratelimit';

const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
  const verdict = await rateLimitAsync(`places:${clientIp(request)}`, 30, 60_000);
  const { allowed } = verdict;
  if (!allowed) {
    return NextResponse.json(
      { error: verdict.unavailable ? 'Request protection is temporarily unavailable.' : 'Too many requests. Please slow down.' },
      { status: verdict.unavailable ? 503 : 429 }
    );
  }
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || !query.trim()) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: 'Query parameter "q" is too long' }, { status: 400 });
  }

  try {
    const places = await searchPlaces(query.trim());
    const businesses = places.map(normalizeBusiness);
    return NextResponse.json({ businesses, count: businesses.length });
  } catch (error) {
    // Log full details server-side only — never expose internal messages to the client
    console.error('[API /places] Error:', error);
    return NextResponse.json(
      { error: 'Unable to complete request. Please try again.' },
      { status: 500 }
    );
  }
}
