import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, sbSelect } from '@/lib/supabase';
import { normalizePartnerCategory } from '@/lib/categories';
import { rateLimit, clientIp } from '@/lib/ratelimit';

interface PartnerRow {
  id: string;
  latitude: number | null;
  longitude: number | null;
  service_radius_miles: number;
}

function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * GET /api/partner-coverage?category=home_services&lat=41.49&lng=-81.69
 *
 * Returns { hasPartner: boolean } — true if at least one active partner is
 * configured for this category and covers the given coordinates.
 *
 * Used by QuoteButton to decide whether to render at all.
 * Response is cached for 5 minutes at the CDN layer.
 */
export async function GET(request: NextRequest) {
  const { allowed } = rateLimit(`partner-coverage:${clientIp(request)}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ hasPartner: false }, { status: 429 });
  }

  const { searchParams } = request.nextUrl;
  const rawCategory = searchParams.get('category') ?? '';
  const rawLat = searchParams.get('lat');
  const rawLng = searchParams.get('lng');

  const category = normalizePartnerCategory(rawCategory) ?? rawCategory;
  const lat = rawLat != null ? parseFloat(rawLat) : NaN;
  const lng = rawLng != null ? parseFloat(rawLng) : NaN;

  if (!category) {
    return NextResponse.json({ hasPartner: false });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ hasPartner: false });
  }

  try {
    const rows = await sbSelect<PartnerRow>(
      'partners',
      `select=id,latitude,longitude,service_radius_miles&status=eq.active&category=eq.${encodeURIComponent(category)}`
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { hasPartner: false },
        { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
      );
    }

    // If no valid coordinates provided, presence of any active partner in
    // the category is enough to show the button.
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { hasPartner: true },
        { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
      );
    }

    // At least one partner must cover the business's coordinates.
    const hasPartner = rows.some((p) => {
      if (p.latitude == null || p.longitude == null) return true; // no geo restriction
      return milesBetween({ lat, lng }, { lat: p.latitude, lng: p.longitude }) <= p.service_radius_miles;
    });

    return NextResponse.json(
      { hasPartner },
      { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
    );
  } catch (err) {
    console.error('[partner-coverage] lookup failed:', err);
    return NextResponse.json({ hasPartner: false });
  }
}
