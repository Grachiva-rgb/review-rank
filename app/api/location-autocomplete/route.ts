import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { isSupabaseConfigured, sbSelect, sbUpsert } from '@/lib/supabase';
import { geocodeZip } from '@/lib/locationIntent';

interface Suggestion {
  label: string;
  placeId: string;
}

/**
 * Autocomplete (New) — https://places.googleapis.com/v1/places:autocomplete
 *
 * Migrated off the legacy maps.googleapis.com endpoint, which entered Legacy
 * status on 2025-03-01, is feature frozen, and reported failures as HTTP 200
 * with a `status` field in the body. The rest of the app already uses Places API
 * (New) via places:searchText with the same key, so this removes the only
 * dependency on the legacy product.
 */
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

/**
 * Place-name suggestions for a location prefix effectively never change, and
 * this is the most frequently called Google endpoint in the app — one request
 * per typing pause, per user. A long TTL is the single biggest lever on
 * autocomplete spend.
 */
const AUTOCOMPLETE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Cache key prefix. Bumped on contract changes so stale entries are not served
 * for the rest of their 30-day TTL:
 *   - `autocomplete:`  → `autocomplete2:` legacy-API migration
 *   - `autocomplete2:` → `autocomplete3:` zip-code fix — v2 entries hold street
 *     addresses for 5-digit inputs (Google read "44236" as a house number near
 *     the Ashburn serverless region and the old fallback served them).
 */
const CACHE_PREFIX = 'autocomplete3:';

/**
 * Minimum prefix length. Two-character prefixes match half the country, so the
 * suggestions are useless to the user but still billed.
 */
const MIN_QUERY_LENGTH = 3;

/**
 * Prediction types we want for a "City or zip code" field.
 *
 * The request now also sends `includedPrimaryTypes: ['(regions)']` — the
 * documented collection for localities, postal codes, and administrative
 * areas — so Google stops proposing street addresses in the first place
 * (an unconstrained request let "44236" match house numbers near the
 * serverless region, e.g. "44236 Mossy Brook Square, Ashburn, VA"). This
 * response-side filter stays as a second line of defence, but it no longer
 * falls back to the unfiltered list: for this field, an empty dropdown is
 * correct when nothing location-like matches, and the old fallback served
 * exactly the street addresses the filter exists to remove.
 */
const LOCATION_TYPES = new Set([
  'locality',
  'sublocality',
  'sublocality_level_1',
  'neighborhood',
  'postal_code',
  'postal_code_prefix',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'country',
]);

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
      `cache_key=eq.${encodeURIComponent(`${CACHE_PREFIX}${q}`)}` +
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
    cache_key: `${CACHE_PREFIX}${q}`,
    results,
    created_at: new Date().toISOString(),
  }).catch(() => {});
}

interface PlacePrediction {
  placeId?: string;
  text?: { text?: string };
  types?: string[];
}

/** Map the API response to our suggestion shape, preferring location-like hits. */
function toSuggestions(raw: unknown): Suggestion[] {
  const suggestions = (raw as { suggestions?: Array<{ placePrediction?: PlacePrediction }> })
    ?.suggestions ?? [];

  const all = suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is PlacePrediction => Boolean(p?.placeId && p?.text?.text))
    .map((p) => ({
      label: (p.text!.text as string).replace(/, USA$/, ''),
      placeId: p.placeId as string,
      types: p.types ?? [],
    }));

  return all
    .filter((p) => p.types.some((t) => LOCATION_TYPES.has(t)))
    .map(({ label, placeId }) => ({ label, placeId }));
}

/** Pure 5-digit US zip — resolved via Geocoding instead of Autocomplete. */
const ZIP_RE = /^\d{5}$/;

/**
 * Resolve a zip to a single "City, ST 12345" suggestion.
 *
 * Autocomplete is the wrong tool for a complete zip: Google treats the digits
 * as a possible house number and biases toward the request's origin — which is
 * the serverless region, not the user. Geocoding interprets a 5-digit
 * `address` as a postal code reliably, is cached 24 h by the fetch cache, and
 * bills on a cheaper SKU than an autocomplete request.
 */
async function zipSuggestion(zip: string, apiKey: string): Promise<Suggestion[]> {
  const center = await geocodeZip(zip, apiKey);
  if (!center) return [];
  return [
    {
      label: center.display.replace(/, USA$/, ''),
      // The client only renders labels; this just needs to be a stable key.
      placeId: `zip-${zip}`,
    },
  ];
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

  // A complete zip skips Autocomplete entirely — see zipSuggestion.
  if (ZIP_RE.test(q)) {
    try {
      const suggestions = await zipSuggestion(q, key);
      // Don't cache an empty result here: geocodeZip returns null on transient
      // failures too, and caching one would hide the zip for 30 days.
      if (suggestions.length > 0) writeCache(q, suggestions);
      return NextResponse.json(suggestions, {
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
      });
    } catch (err) {
      console.error('[location-autocomplete] zip geocode failed:', err);
      return NextResponse.json([]);
    }
  }

  try {
    const res = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // No spaces permitted anywhere in the field mask.
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.types',
      },
      body: JSON.stringify({
        input: q,
        languageCode: 'en',
        includedRegionCodes: ['us'],
        // Only localities, postal codes, and administrative areas — never
        // street addresses. See the LOCATION_TYPES comment.
        includedPrimaryTypes: ['(regions)'],
      }),
      next: { revalidate: 86400 },
    });

    // Unlike the legacy endpoint, this API signals failure with a real HTTP
    // status. Log the reason and do NOT cache it — a cached failure would
    // suppress suggestions for the whole 30-day TTL.
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(
        `[location-autocomplete] places:autocomplete ${res.status}: ${detail.slice(0, 300)}`
      );
      return NextResponse.json([]);
    }

    const suggestions = toSuggestions(await res.json());

    // Caching an empty result is correct here: the request succeeded and that
    // prefix genuinely has no matches.
    writeCache(q, suggestions);

    return NextResponse.json(suggestions, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('[location-autocomplete] request failed:', err);
    return NextResponse.json([]);
  }
}
