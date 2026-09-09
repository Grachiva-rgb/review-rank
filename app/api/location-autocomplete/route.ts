import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { isSupabaseConfigured, sbSelect, sbUpsert } from '@/lib/supabase';

interface Suggestion {
  label: string;
  placeId: string;
}

/**
 * Place-name suggestions for a location prefix effectively never change, and
 * this is the most frequently called Google endpoint in the app — one request
 * per typing pause, per user. A long TTL is the single biggest lever on
 * autocomplete spend.
 */
const AUTOCOMPLETE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Minimum prefix length. Two-character prefixes match half the country, so the
 * suggestions are useless to the user but still billed.
 */
const MIN_QUERY_LENGTH = 3;

/**
 * Collapse trivially different spellings onto one cache entry: "Austin ",
 * "austin", and "AUSTIN" are the same lookup and shouldn't be billed 3 times.
 */
function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function readCache(q: string): Promise<Suggestion[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const cutoff = new Date(Date.now() - AUTOCOMPLETE_CACHE_TTL_MS).toISOString();
    // Race a 1-second timeout so slow Supabase never delays a keystroke.
    const lookup = sbSelect<{ results: Suggestion[] }>(
      'search_cache',
      `cache_key=eq.${encodeURIComponent(`autocomplete:${q}`)}` +
        `&created_at=gte.${encodeURIComponent(cutoff)}&select=results&limit=1`
    ).then((rows) => rows[0]?.results ?? null).catch(() => null);

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
    return await Promise.race([lookup, timeout]);
  } catch {
    return null;
  }
}

function writeCache(q: string, results: Suggestion[]): void {
  if (!isSupabaseConfigured()) return;
  // Fire-and-forget — a cache write must never delay the response.
  sbUpsert('search_cache', {
    cache_key: `autocomplete:${q}`,
    results,
    created_at: new Date().toISOString(),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const { allowed } = rateLimit(`location-autocomplete:${clientIp(req)}`, 40, 60_000);
  if (!allowed) {
    return NextResponse.json([], { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get('q') ?? '';
  if (raw.length > 200) return NextResponse.json([]);

  const q = normalizeQuery(raw);
  if (q.length < MIN_QUERY_LENGTH) return NextResponse.json([]);

  // Served from cache, this costs nothing and survives redeploys.
  const cached = await readCache(q);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json([]);

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', q);
  url.searchParams.set('types', 'geocode');
  url.searchParams.set('language', 'en');
  url.searchParams.set('key', key);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json([]);

    const data = await res.json();
    const suggestions: Suggestion[] = (data.predictions ?? []).map(
      (p: { description: string; place_id: string }) => ({
        label: p.description.replace(/, USA$/, ''),
        placeId: p.place_id,
      })
    );

    // Cache empty results too — a prefix with no matches won't gain any.
    writeCache(q, suggestions);

    return NextResponse.json(suggestions, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json([]);
  }
}
