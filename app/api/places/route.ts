import { NextRequest, NextResponse } from 'next/server';
import { searchPlaces, normalizeBusiness } from '@/lib/places';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
  const { allowed } = rateLimit(`places:${clientIp(request)}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
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
