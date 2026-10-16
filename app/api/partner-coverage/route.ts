import { NextRequest, NextResponse } from 'next/server';
import { normalizePartnerCategory } from '@/lib/categories';
import { rateLimitAsync, clientIp } from '@/lib/ratelimit';
import { getCachedLeadBusiness, LEAD_PLACE_ID_RE } from '@/lib/leadLocation';
import { findMatchingPartners } from '@/lib/partnerMatching';

/**
 * GET /api/partner-coverage?category=home_services&business_place_id=...
 *
 * Returns { hasPartner: boolean } — true if at least one active partner is
 * configured for this category and covers the server-cached business area.
 *
 * Used by QuoteButton to decide whether to render at all.
 * Response is cached for 5 minutes at the CDN layer.
 */
export async function GET(request: NextRequest) {
  const verdict = await rateLimitAsync(`partner-coverage:${clientIp(request)}`, 60, 60_000);
  const { allowed } = verdict;
  if (!allowed) {
    return NextResponse.json({ hasPartner: false }, { status: verdict.unavailable ? 503 : 429 });
  }

  const { searchParams } = request.nextUrl;
  const rawCategory = searchParams.get('category') ?? '';
  const placeId = searchParams.get('business_place_id') ?? '';

  // Only ever query with a slug from the canonical taxonomy. This previously
  // fell back to the raw user string, which put unvalidated input into a
  // PostgREST filter for no benefit — a category outside the taxonomy cannot
  // match a partner row anyway.
  const category = normalizePartnerCategory(rawCategory);
  if (!category || !LEAD_PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ hasPartner: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const business = await getCachedLeadBusiness(placeId);
    if (!business) {
      return NextResponse.json({ hasPartner: false }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const hasPartner = (await findMatchingPartners(category, business.location)).length > 0;

    return NextResponse.json(
      { hasPartner },
      { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
    );
  } catch (err) {
    console.error('[partner-coverage] lookup failed:', err);
    return NextResponse.json({ hasPartner: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
