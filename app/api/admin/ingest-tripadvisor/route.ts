/**
 * POST /api/admin/ingest-tripadvisor
 * GET  /api/admin/ingest-tripadvisor  (Vercel Cron)
 *
 * Background ingestion job: fetches Tripadvisor data for one or more businesses
 * and stores results in the Supabase cache (tripadvisor_businesses + business_id_mapping).
 *
 * Auth: Bearer token === ADMIN_SECRET or CRON_SECRET
 * Rate: Only called by scheduled jobs or admin — not in any consumer request path.
 *
 * Body (JSON):
 *   { placeIds: string[] }         — list of Google Place IDs to ingest
 *   OR
 *   { placeId: string }            — single Place ID
 *   OR
 *   {} (empty)                     — refresh all stale records (fetched_at > 7 days ago)
 */

import { NextResponse } from 'next/server';
import { getPlaceDetails, categorizePlace } from '@/lib/places';
import {
  searchTALocation,
  fetchTALocationDetails,
  saveTAMapping,
  saveTABusinessData,
  getCachedTAData,
} from '@/lib/tripadvisor';
import { sbSelect, isSupabaseConfigured } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function isAuthorized(request: Request): boolean {
  const bearer = request.headers.get('authorization')?.replace('Bearer ', '').trim();
  // Accept ADMIN_SECRET (manual calls) or CRON_SECRET (Vercel cron scheduler)
  if (process.env.ADMIN_SECRET && bearer === process.env.ADMIN_SECRET) return true;
  if (process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return true;
  return false;
}

interface StaleRow {
  google_place_id: string;
  ta_location_id: string | null;
}

/** How long TA data stays fresh before the job re-fetches it. */
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long to leave a "not on Tripadvisor" business alone before trying again.
 *
 * Without this the job re-searched every unmatched business every week forever,
 * which is pure spend — a restaurant that isn't listed this week almost
 * certainly isn't listed next week either.
 */
const RETRY_UNMATCHED_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

// Also expose as GET so Vercel Cron can invoke it (crons use GET by default)
export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  // Auth: accepts ADMIN_SECRET (manual) or CRON_SECRET (Vercel scheduler)
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as {
    placeId?: string;
    placeIds?: string[];
  };

  // A known ta_location_id means we can refresh with a single TA details call —
  // no Google Place Details lookup and no TA search. Only genuinely unmatched
  // businesses pay for the full match path.
  const targets = new Map<string, string | null>();

  if (body.placeId) {
    targets.set(body.placeId, null);
  } else if (Array.isArray(body.placeIds) && body.placeIds.length > 0) {
    for (const id of body.placeIds.slice(0, 50)) targets.set(id, null); // hard cap per batch
  } else {
    const staleCutoff = new Date(Date.now() - REFRESH_AFTER_MS).toISOString();
    const retryCutoff = new Date(Date.now() - RETRY_UNMATCHED_AFTER_MS).toISOString();

    // Already matched, data has gone stale → cheap refresh.
    const staleTARows = await sbSelect<{ google_place_id: string; ta_location_id: string }>(
      'tripadvisor_businesses',
      `fetched_at=lt.${encodeURIComponent(staleCutoff)}&select=google_place_id,ta_location_id&limit=50`
    ).catch(() => [] as { google_place_id: string; ta_location_id: string }[]);

    for (const row of staleTARows) {
      if (row.google_place_id) targets.set(row.google_place_id, row.ta_location_id);
    }

    // Never matched, and not attempted recently → full match path.
    const unmatched = await sbSelect<StaleRow>(
      'business_id_mapping',
      `ta_location_id=is.null&or=(matched_at.is.null,matched_at.lt.${encodeURIComponent(retryCutoff)})` +
        `&select=google_place_id,ta_location_id&order=matched_at.asc.nullsfirst&limit=50`
    ).catch(() => [] as StaleRow[]);

    for (const row of unmatched) {
      if (!targets.has(row.google_place_id)) targets.set(row.google_place_id, null);
    }
  }

  const placeIds = Array.from(targets.keys()).slice(0, 50);

  if (placeIds.length === 0) {
    return NextResponse.json({ message: 'Nothing to ingest', ingested: 0 });
  }

  // Process each place
  const results: Array<{ placeId: string; status: 'ok' | 'skipped' | 'error'; detail?: string }> = [];

  for (const placeId of placeIds) {
    try {
      // Check freshness before spending anything on this business.
      const existing = await getCachedTAData(placeId).catch(() => null);
      if (existing?.lastFetched) {
        const age = Date.now() - new Date(existing.lastFetched).getTime();
        if (age < REFRESH_AFTER_MS) {
          results.push({ placeId, status: 'skipped', detail: 'Cache fresh' });
          continue;
        }
      }

      // Refresh path: we already know the TA location, so skip both the Google
      // Place Details call and the TA search.
      let taLocationId = targets.get(placeId) ?? existing?.taLocationId ?? null;

      if (!taLocationId) {
        // Match path: Google gives us the name, address, and type to search on.
        const place = await getPlaceDetails(placeId).catch(() => null);
        if (!place) {
          results.push({ placeId, status: 'error', detail: 'Google place not found' });
          continue;
        }

        // Use the same primaryType-aware categorization as the consumer path,
        // so a museum is searched under attractions rather than hotels.
        const { taCategory, category } = categorizePlace(place.name, place.primary_type);
        const address = place.formatted_address ?? '';

        taLocationId = await searchTALocation(place.name, address, taCategory ?? category);
      }

      if (!taLocationId) {
        results.push({ placeId, status: 'error', detail: 'No TA match found' });
        continue;
      }

      // Fetch TA details
      const taData = await fetchTALocationDetails(taLocationId);
      if (!taData) {
        results.push({ placeId, status: 'error', detail: 'TA details fetch failed' });
        continue;
      }

      // Persist
      await saveTAMapping(placeId, taLocationId, 0.9);
      await saveTABusinessData(placeId, taData);

      results.push({ placeId, status: 'ok' });
    } catch (err) {
      results.push({
        placeId,
        status: 'error',
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    // Respect TA API rate limit: max 5 req/sec
    await new Promise((r) => setTimeout(r, 250));
  }

  const ok      = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors  = results.filter((r) => r.status === 'error').length;

  return NextResponse.json({ ingested: ok, skipped, errors, results });
}
