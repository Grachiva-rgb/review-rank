import { isCoordinates, type Coordinates } from './partnerMatching';

const STATES = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));

export function validServiceCity(city: string, state: string): boolean {
  return city.trim().length >= 2 && city.trim().length <= 80 && STATES.has(state);
}

const normalizedCity = (city: string) =>
  city.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** One cached geocoding lookup at signup/backfill, never in the lead path. */
export async function resolvePartnerServiceCenter(
  city: string,
  state: string,
  apiKey: string
): Promise<Coordinates | null> {
  if (!validServiceCity(city, state)) return null;
  if (!apiKey) throw new Error('Service-area geocoding is not configured');
  const { enforceGoogleApiDailyLimit } = await import('./ratelimit');
  const budget = await enforceGoogleApiDailyLimit('geocoding');
  if (!budget.allowed) throw new Error('Service-area geocoding is unavailable');
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
    + `?address=${encodeURIComponent(`${city}, ${state}`)}`
    + `&components=${encodeURIComponent(`country:US|administrative_area:${state}`)}`
    + `&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('Service-area geocoding is unavailable');
  const body = await res.json() as {
    status?: string;
    results?: Array<{
      partial_match?: boolean;
      types?: string[];
      geometry?: { location?: unknown };
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
    }>;
  };
  if (body.status === 'ZERO_RESULTS') return null;
  if (body.status !== 'OK') throw new Error('Service-area geocoding is unavailable');
  for (const result of body.results ?? []) {
    if (result.partial_match || !isCoordinates(result.geometry?.location)) continue;
    const components = result.address_components ?? [];
    const country = components.find(c => c.types.includes('country'))?.short_name;
    const region = components.find(c => c.types.includes('administrative_area_level_1'))?.short_name;
    const locality = components.find(c => c.types.includes('locality') || c.types.includes('postal_town'));
    if (country !== 'US' || region !== state || !locality
      || normalizedCity(locality.long_name) !== normalizedCity(city)) continue;
    if (!result.types?.some(t => t === 'locality' || t === 'postal_town')) continue;
    return result.geometry!.location as Coordinates;
  }
  return null;
}
