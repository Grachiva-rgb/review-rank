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
 *   {} (empty)                     — refresh stale records (fetched_at older than
 *                                    REFRESH_AFTER_MS) plus a reserved share of
 *                                    never-matched businesses
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

/**
 * How long TA data stays fresh before the job re-fetches it.
 *
 * Deliberately SHORTER than the cron interval. When this equalled the weekly
 * schedule, a row written just after one run was ~6d23h old at the next run,
 * got skipped as fresh, and then waited a further week — refreshing at ~14 days
 * instead of 7. Vercel fires crons within the hour, so which rows fell on which
 * side of the boundary was effectively random. Keep this below the schedule
 * interval so every run reliably catches the previous period's rows.
 */
const REFRESH_AFTER_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Upper bound on businesses selected per run. The real limiter is TIME_BUDGET_MS
 * below — this just bounds the Supabase query.
 */
const MAX_PER_RUN = 150;

/**
 * Slots held back for never-matched businesses.
 *
 * Stale refreshes are added to the target set first, so once there were 50+ of
 * them they consumed the entire batch and the unmatched-business branch never
 * ran — new hospitality businesses would never get matched to Tripadvisor at
 * all. Reserving a floor guarantees the match path always makes progress.
 */
const MIN_MATCH_SLOTS = 15;

/**
 * Stop starting new businesses after this much wall time.
 *
 * maxDuration is 60s and each business costs ~250ms of rate-limit sleep plus the
 * TA round trip, so a large batch cannot finish in one invocation. Ending
 * cleanly and reporting what's left beats being killed mid-loop.
 */
const TIME_BUDGET_MS = 45_000;

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
    for (const id of body.placeIds.slice(0, MAX_PER_RUN)) targets.set(id, null);
  } else {
    const staleCutoff = new Date(Date.now() - REFRESH_AFTER_MS).toISOString();
    const retryCutoff = new Date(Date.now() - RETRY_UNMATCHED_AFTER_MS).toISOString();

    // Already matched, data has gone stale → cheap refresh (1 TA call, no search).
    const staleTARows = await sbSelect<{ google_place_id: string; ta_location_id: string }>(
      'tripadvisor_businesses',
      `fetched_at=lt.${encodeURIComponent(staleCutoff)}` +
        `&select=google_place_id,ta_location_id&order=fetched_at.asc&limit=${MAX_PER_RUN}`
    ).catch(() => [] as { google_place_id: string; ta_location_id: string }[]);

    // Never matched, and not attempted recently → full match path (3 calls).
    const unmatched = await sbSelect<StaleRow>(
      'business_id_mapping',
      `ta_location_id=is.null&or=(matched_at.is.null,matched_at.lt.${encodeURIComponent(retryCutoff)})` +
        `&select=google_place_id,ta_location_id&order=matched_at.asc.nullsfirst&limit=${MAX_PER_RUN}`
    ).catch(() => [] as StaleRow[]);

    const staleRows = staleTARows.filter((r) => r.google_place_id);

    // Divide the batch so neither branch can crowd the other out entirely:
    // refreshes get whatever is left after reserving a floor for new matches,
    // and any slots the match path doesn't need fall back to refreshes.
    const reserved  = Math.min(MIN_MATCH_SLOTS, unmatched.length);
    const staleTake = Math.min(staleRows.length, MAX_PER_RUN - reserved);
    const matchTake = Math.min(unmatched.length, MAX_PER_RUN - staleTake);

    // Oldest first, so a backlog drains in a predictable order rather than
    // re-picking the same rows every run.
    for (const row of staleRows.slice(0, staleTake)) {
      targets.set(row.google_place_id, row.ta_location_id);
    }
    for (const row of unmatched.slice(0, matchTake)) {
      if (!targets.has(row.google_place_id)) targets.set(row.google_place_id, null);
    }
  }

  const placeIds = Array.from(targets.keys()).slice(0, MAX_PER_RUN);

  if (placeIds.length === 0) {
    return NextResponse.json({ message: 'Nothing to ingest', ingested: 0 });
  }

  // Process each place
  const results: Array<{ placeId: string; status: 'ok' | 'skipped' | 'error'; detail?: string }> = [];
  const startedAt = Date.now();
  let deferred = 0;

  for (const [index, placeId] of placeIds.entries()) {
    // Out of time: stop cleanly. Every business already processed has been
    // committed individually, so nothing done so far is lost — the remainder
    // is simply still stale and gets picked up by the next run.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred = placeIds.length - index;
      break;
    }

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

  // `deferred` > 0 on consecutive runs means the backlog is growing faster than
  // one invocation can drain it — raise the cron frequency rather than
  // MAX_PER_RUN, since the ceiling is wall time, not batch size.
  return NextResponse.json({
    ingested: ok,
    skipped,
    errors,
    deferred,
    selected: placeIds.length,
    elapsedMs: Date.now() - startedAt,
    results,
  });
}
