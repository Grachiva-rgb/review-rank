import { normalizePartnerCategory } from './categories';
import { isSupabaseConfigured, sbSelect } from './supabase';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PartnerRow {
  id: string;
  business_name: string;
  contact_email: string;
  category: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  service_radius_miles: number;
}

export function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== 'object') return false;
  const { lat, lng } = value as Record<string, unknown>;
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/** Missing/invalid geography is never interpreted as nationwide coverage. */
export function matchesServiceArea(
  partner: Pick<PartnerRow, 'latitude' | 'longitude' | 'service_radius_miles'>,
  location: Coordinates
): boolean {
  const center = { lat: partner.latitude, lng: partner.longitude };
  const radius = partner.service_radius_miles;
  if (!isCoordinates(location) || !isCoordinates(center)
    || typeof radius !== 'number' || !Number.isFinite(radius) || radius < 1 || radius > 200) {
    return false;
  }
  const rad = Math.PI / 180;
  const dLat = (location.lat - center.lat) * rad;
  const dLng = (location.lng - center.lng) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(center.lat * rad) * Math.cos(location.lat * rad) * Math.sin(dLng / 2) ** 2;
  const distance = 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  return distance <= radius;
}

/** The same fail-closed matcher serves both coverage checks and email delivery. */
export async function findMatchingPartners(category: string, location: Coordinates): Promise<PartnerRow[]> {
  const canonical = normalizePartnerCategory(category);
  if (!canonical || !isCoordinates(location) || !isSupabaseConfigured()) return [];
  const rows = await sbSelect<PartnerRow>(
    'partners',
    `select=id,business_name,contact_email,category,status,latitude,longitude,service_radius_miles`
      + `&status=eq.active&category=eq.${encodeURIComponent(canonical)}`
  );
  // Check again locally: a malformed/legacy record cannot widen coverage.
  return rows.filter(p => p.status === 'active' && p.category === canonical
    && matchesServiceArea(p, location));
}
