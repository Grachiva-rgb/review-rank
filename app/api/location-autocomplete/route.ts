import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json([]);

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', q);
  url.searchParams.set('types', 'geocode');
  url.searchParams.set('language', 'en');
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json([]);

  const data = await res.json();
  const suggestions = (data.predictions ?? []).map((p: { description: string; place_id: string }) => ({
    label: p.description.replace(/, USA$/, ''),
    placeId: p.place_id,
  }));

  return NextResponse.json(suggestions, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}
