/**
 * Manual, bounded operator tool. Dry-run is default and uses zero Google calls.
 * --apply resolves at most --limit (max 25) partner city centers and writes them.
 * Run only after production/backfill approval; never expose credentials in CLI.
 */
import { isSupabaseConfigured, sbSelect, sbUpdate } from '../lib/supabase';
import { resolvePartnerServiceCenter, validServiceCity } from '../lib/partnerLocation';

export function parseBackfillArgs(args: string[]): { apply: boolean; limit: number } {
  let apply = false;
  let limit = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply' && !apply) apply = true;
    else if (args[i] === '--limit' && /^\d+$/.test(args[i + 1] ?? '')) limit = Number(args[++i]);
    else throw new Error('Usage: backfill-partner-locations.ts [--limit 1..25] [--apply]');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Limit must be 1..25');
  return { apply, limit };
}

export async function runBackfill(args: string[]): Promise<void> {
  const { apply, limit } = parseBackfillArgs(args);
  if (!isSupabaseConfigured()) throw new Error('Server-side Supabase configuration is required');
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
  if (apply && !apiKey) throw new Error('Geocoding configuration is required for --apply');
  const rows = await sbSelect<{
    id: string; city: string | null; state: string | null; service_radius_miles: number;
  }>('partners',
    'select=id,city,state,service_radius_miles&status=in.(active,pending)'
      + '&or=(latitude.is.null,longitude.is.null,latitude.lt.-90,latitude.gt.90,longitude.lt.-180,longitude.gt.180)'
      + `&order=created_at.asc&limit=${limit}`);
  const candidates = rows.slice(0, limit); // Enforce the cap locally as well as in the DB query.
  const centers = new Map<string, ReturnType<typeof resolvePartnerServiceCenter>>();
  let resolved = 0;
  let unresolved = 0;
  for (const row of candidates) {
    const city = row.city?.trim() ?? '';
    const state = row.state?.trim().toUpperCase() ?? '';
    if (!validServiceCity(city, state) || !Number.isInteger(row.service_radius_miles)
      || row.service_radius_miles < 1 || row.service_radius_miles > 200) {
      console.log(JSON.stringify({ partnerId: row.id, status: 'manual-review-required' }));
      unresolved++;
      continue;
    }
    if (!apply) {
      console.log(JSON.stringify({ partnerId: row.id, status: 'would-resolve-city-center' }));
      continue;
    }
    const key = `${city.toLowerCase()}:${state}`;
    try {
      // Share successes, no-match results AND failures within the batch.
      if (!centers.has(key)) centers.set(key, resolvePartnerServiceCenter(city, state, apiKey));
      const center = await centers.get(key)!;
      if (!center) {
        unresolved++;
        console.log(JSON.stringify({ partnerId: row.id, status: 'manual-review-required' }));
        continue;
      }
      await sbUpdate('partners', `id=eq.${encodeURIComponent(row.id)}`, {
        latitude: center.lat,
        longitude: center.lng,
        service_area_location_source: 'city_center',
        service_area_verified_at: new Date().toISOString(),
      });
      resolved++;
      console.log(JSON.stringify({ partnerId: row.id, status: 'resolved' }));
    } catch {
      // Error objects/URLs can contain API keys or customer data; do not print.
      unresolved++;
      console.log(JSON.stringify({ partnerId: row.id, status: 'resolution-failed' }));
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', selected: candidates.length, resolved, unresolved, limit }));
}

// Imports in tests must not trigger a production read.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/backfill-partner-locations.ts')) {
  runBackfill(process.argv.slice(2)).catch(() => {
    console.error('Backfill stopped. Check arguments/configuration and approved operator runbook.');
    process.exitCode = 1;
  });
}
