/**
 * POST /api/admin/ingest-tripadvisor
 *
 * Background ingestion job: fetches Tripadvisor data for one or more businesses
 * and stores results in the Supabase cache (tripadvisor_businesses + business_id_mapping).
 *
 * Auth: Bearer token === ADMIN_SECRET
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
import { getPlaceDetails } from '@/lib/places';
import {
  searchTALocation,
  fetchTALocationDetails,
  saveTAMapping,
  saveTABusinessData,
  getCachedTAData,
} from '@/lib/tripadvisor';
import { sbSelect, isSupabaseConfigured } from '@/lib/supabase';
import { detectCategory } from '@/lib/ranking';

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

  let placeIds: string[] = [];

  if (body.placeId) {
    placeIds = [body.placeId];
  } else if (Array.isArray(body.placeIds) && body.placeIds.length > 0) {
    placeIds = body.placeIds.slice(0, 50); // hard cap per batch
  } else {
    // Refresh stale: records not updated in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stale = await sbSelect<StaleRow>(
      'business_id_mapping',
      `select=google_place_id,ta_location_id&order=matched_at.asc.nullsfirst&limit=50`
    ).catch(() => [] as StaleRow[]);

    const staleTARows = await sbSelect<{ google_place_id: string }>(
      'tripadvisor_businesses',
      `fetched_at=lt.${encodeURIComponent(sevenDaysAgo)}&select=google_place_id&limit=50`
    ).catch(() => [] as { google_place_id: string }[]);

    const staleSet = new Set([
      ...stale.filter((r) => !r.ta_location_id).map((r) => r.google_place_id),
      ...staleTARows.map((r) => r.google_place_id),
    ]);
    placeIds = Array.from(staleSet).slice(0, 50);
  }

  if (placeIds.length === 0) {
    return NextResponse.json({ message: 'Nothing to ingest', ingested: 0 });
  }

  // Process each place
  const results: Array<{ placeId: string; status: 'ok' | 'skipped' | 'error'; detail?: string }> = [];

  for (const placeId of placeIds) {
    try {
      // Fetch Google data to get business name + address
      const place = await getPlaceDetails(placeId).catch(() => null);
      if (!place) {
        results.push({ placeId, status: 'error', detail: 'Google place not found' });
        continue;
      }

      // Check if already cached and fresh (< 7 days)
      const existing = await getCachedTAData(placeId).catch(() => null);
      if (existing?.lastFetched) {
        const age = Date.now() - new Date(existing.lastFetched).getTime();
        if (age < 7 * 24 * 60 * 60 * 1000) {
          results.push({ placeId, status: 'skipped', detail: 'Cache fresh' });
          continue;
        }
      }

      const category = detectCategory(place.name);
      const address  = place.formatted_address ?? '';

      // Search Tripadvisor for a matching location
      const taLocationId = await searchTALocation(place.name, address, category);
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
