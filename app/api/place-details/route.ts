import { NextRequest, NextResponse } from 'next/server';
import { getPlaceDetails, normalizeBusiness } from '@/lib/places';

// Google Place IDs are alphanumeric with underscores/hyphens, typically 27 chars
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('id');

  if (!placeId || !placeId.trim()) {
    return NextResponse.json({ error: 'Parameter "id" (place_id) is required' }, { status: 400 });
  }

  if (!PLACE_ID_RE.test(placeId.trim())) {
    return NextResponse.json({ error: 'Invalid place ID format' }, { status: 400 });
  }

  try {
    const place = await getPlaceDetails(placeId.trim());
    const business = normalizeBusiness(place);
    return NextResponse.json({ business });
  } catch (error) {
    // Log full details server-side only — never expose internal messages to the client
    console.error('[API /place-details] Error:', error);
    return NextResponse.json(
      { error: 'Unable to complete request. Please try again.' },
      { status: 500 }
    );
  }
}
