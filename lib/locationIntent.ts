/**
 * Location Intent Module
 *
 * Adds ZIP-code-aware location filtering to search:
 *  1. Parses ZIP codes from freeform queries ("hotels in 77089")
 *  2. Resolves ZIP to lat/lng centroid via Google Geocoding API
 *  3. Filters results by exact ZIP match or distance radius
 *  4. Produces UI messaging for the location context banner
 *
 * Location relevance is treated as a hard eligibility filter:
 * results outside the radius are excluded regardless of Review Rank Score.
 */

/** US 5-digit ZIP code pattern */
const ZIP_RE = /\b(\d{5})\b/;

/** Valid US state + DC abbreviations */
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]);

/** Full state name → 2-letter code, lowercase keys */
const STATE_NAME_TO_CODE: Record<string, string> = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR',
  'california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE',
  'florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID',
  'illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
  'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD',
  'massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS',
  'missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV',
  'new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY',
  'north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK',
  'oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT',
  'vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV',
  'wisconsin':'WI','wyoming':'WY','district of columbia':'DC',
};

export interface CityState {
  city: string;
  state: string; // always uppercase, e.g. "OH"
}

/**
 * Parse a city + US state from a freeform query or location string.
 * Handles both 2-letter abbreviations and full state names, case-insensitive.
 *
 * "accountant in Hudson OH"    → { city: "Hudson", state: "OH" }
 * "hotels in hudson ohio"      → { city: "hudson", state: "OH" }
 * "dentist near Austin, TX"    → { city: "Austin", state: "TX" }
 * "pizza Boston Massachusetts" → { city: "Boston", state: "MA" }
 */
export function parseCityStateFromQuery(query: string): CityState | null {
  const q = query.trim();

  // 1. Try full state names first (longest match wins — "new hampshire" before "new")
  const stateNames = Object.keys(STATE_NAME_TO_CODE).sort((a, b) => b.length - a.length);
  for (const name of stateNames) {
    const escaped = name.replace(/\s+/g, '\\s+');
    const re = new RegExp(
      `\\b(?:in|near)\\s+([A-Za-z][A-Za-z\\s]*?),?\\s+${escaped}\\b|` +
      `([A-Za-z][A-Za-z\\s]*?),?\\s+${escaped}(?:\\s+\\d{5})?\\s*$`,
      'i'
    );
    const m = q.match(re);
    if (m) {
      const city = (m[1] || m[2] || '').trim();
      if (city.length >= 2) {
        return { city, state: STATE_NAME_TO_CODE[name] };
      }
    }
  }

  // 2. Fall back to 2-letter abbreviations
  const abbrevPatterns = [
    /\b(?:in|near)\s+([A-Za-z][A-Za-z\s]*?),?\s+([A-Za-z]{2})\b/i,
    /([A-Za-z][A-Za-z\s]*?),?\s+([A-Za-z]{2})(?:\s+\d{5})?\s*$/i,
  ];
  for (const re of abbrevPatterns) {
    const m = q.match(re);
    if (m) {
      const stateCode = m[2].toUpperCase();
      if (US_STATES.has(stateCode)) {
        const city = m[1].trim();
        if (city.length >= 2) return { city, state: stateCode };
      }
    }
  }

  return null;
}

/**
 * Extract the US state abbreviation from a Google Places formattedAddress.
 * "123 Main St, Hudson, OH 44236, USA" → "OH"
 * "Hudson, OH, USA"                    → "OH"
 */
export function extractStateFromAddress(address: string): string | null {
  // Primary: state code followed by ZIP
  const m1 = address.match(/,\s+([A-Z]{2})\s+\d{5}/);
  if (m1) return m1[1];
  // Fallback: ", STATE, USA" or ", STATE USA"
  const m2 = address.match(/,\s+([A-Z]{2}),?\s+USA/);
  if (m2 && US_STATES.has(m2[1])) return m2[1];
  return null;
}

/**
 * Resolve a "City, STATE" pair to a geographic centroid via Google Geocoding.
 * Cached 24 h. Returns null on any failure.
 */
export async function geocodeCityState(
  city: string,
  state: string,
  apiKey: string
): Promise<ZipCenter | null> {
  try {
    const address = `${city}, ${state}`;
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(address)}` +
      `&components=country:US|administrative_area:${state}` +
      `&key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== 'OK' || !data.results[0]) return null;

    const { geometry, formatted_address } = data.results[0];
    return {
      lat: geometry.location.lat,
      lng: geometry.location.lng,
      display: formatted_address,
    };
  } catch {
    return null;
  }
}

/**
 * Hard-filter a places array to only include results whose formattedAddress
 * contains the given US state abbreviation.
 * This prevents "Hudson OH" searches from returning Hudson MA / Hudson NY results.
 */
export function filterByState<T extends { formatted_address: string }>(
  places: T[],
  state: string
): T[] {
  return places.filter((p) => extractStateFromAddress(p.formatted_address) === state);
}

/**
 * Extract the first 5-digit US ZIP code from a query string.
 * "hotels in 77089"    → "77089"
 * "best gym near me"   → null
 */
export function parseZipFromQuery(query: string): string | null {
  const m = query.match(ZIP_RE);
  return m ? m[1] : null;
}

/**
 * Extract the ZIP code embedded in a Google Places `formattedAddress` string.
 * "4501 N Shepherd Dr, Houston, TX 77018, USA" → "77018"
 */
export function extractZipFromAddress(address: string): string | null {
  const m = address.match(ZIP_RE);
  return m ? m[1] : null;
}

/**
 * Haversine great-circle distance in statute miles.
 */
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Resolved centroid for a ZIP code */
export interface ZipCenter {
  lat: number;
  lng: number;
  /** Canonical display form returned by the geocoder, e.g. "Houston, TX 77089" */
  display: string;
}

/**
 * Geocode any free-form location string (city name, neighborhood, address)
 * to a lat/lng centroid. Used as a fallback when no ZIP or city+state
 * abbreviation is detected — e.g. "new orleans", "downtown houston".
 * Cached 24 h. Returns null on any failure.
 */
export async function geocodeLocationString(
  location: string,
  apiKey: string
): Promise<ZipCenter | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(location)}` +
      `&components=country:US` +
      `&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (data.status !== 'OK' || !data.results[0]) return null;
    const { geometry, formatted_address } = data.results[0];
    return { lat: geometry.location.lat, lng: geometry.location.lng, display: formatted_address };
  } catch {
    return null;
  }
}

/**
 * Resolve a ZIP code to a geographic centroid using the Google Geocoding API.
 * Results are cached for 24 hours (Vercel CDN / Next.js fetch cache).
 * Returns null on any failure — the caller should degrade gracefully.
 */
export async function geocodeZip(
  zip: string,
  apiKey: string
): Promise<ZipCenter | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(zip)}&components=country:US&key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      next: { revalidate: 86400 }, // cache 24 h
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== 'OK' || !data.results[0]) return null;

    const { geometry, formatted_address } = data.results[0];
    return {
      lat: geometry.location.lat,
      lng: geometry.location.lng,
      display: formatted_address,
    };
  } catch {
    return null;
  }
}

/** Shape returned by filterByZipOrRadius */
export interface ZipFilterResult<T> {
  /** Businesses whose formattedAddress contains exactly targetZip */
  exactZip: T[];
  /** Businesses within radiusMiles of the ZIP centroid but not in exactZip */
  nearby: T[];
  /** Businesses excluded because they are outside the radius */
  excluded: T[];
}

type PlaceShape = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
};

/**
 * Partition a places array into exact-ZIP, nearby, and excluded buckets.
 *
 * @param places      - array of Place objects (must have formatted_address + geometry)
 * @param targetZip   - the ZIP code the user searched for
 * @param center      - lat/lng centroid of targetZip (from geocodeZip)
 * @param radiusMiles - fallback radius when exact-ZIP results are scarce (default 5 mi)
 */
export function filterByZipOrRadius<T extends PlaceShape>(
  places: T[],
  targetZip: string,
  center: ZipCenter,
  radiusMiles = 5
): ZipFilterResult<T> {
  const exactZip: T[] = [];
  const nearby: T[] = [];
  const excluded: T[] = [];

  for (const place of places) {
    const placeZip = extractZipFromAddress(place.formatted_address);
    if (placeZip === targetZip) {
      exactZip.push(place);
      continue;
    }

    const { lat, lng } = place.geometry.location;
    const dist = calculateDistanceMiles(center.lat, center.lng, lat, lng);
    if (dist <= radiusMiles) {
      nearby.push(place);
    } else {
      excluded.push(place);
    }
  }

  return { exactZip, nearby, excluded };
}

/** Minimum exact-ZIP results required before we expand to nearby radius */
const MIN_EXACT_RESULTS = 3;

export interface ZipSearchOutcome<T> {
  /** Final ordered result list to render */
  places: T[];
  /**
   * Human-readable message for the UI banner, or null if no ZIP filtering applied.
   * Examples:
   *   "Showing hotels in 77089"
   *   "Not enough results in 77089 — showing nearby results within 5 miles."
   */
  locationMessage: string | null;
  /** Whether any nearby-radius expansion was needed */
  expandedToNearby: boolean;
}

/**
 * Extract the city name from a Google Places formattedAddress.
 * "123 Main St, Hudson, OH 44236, USA" → "Hudson"
 * Matches the segment immediately before ", STATE ZIP" or ", STATE, USA".
 */
export function extractCityFromAddress(address: string): string | null {
  // Primary: ", City, ST 12345[, USA]"  — works with or without trailing USA
  const m1 = address.match(/,\s+([^,]+),\s+[A-Z]{2}\s+\d{5}/);
  if (m1) return m1[1].trim();
  // Fallback: ", City, ST, USA" (no ZIP)
  const m2 = address.match(/,\s+([^,]+),\s+[A-Z]{2},?\s+USA/);
  if (m2) return m2[1].trim();
  return null;
}

/**
 * High-level orchestrator for city+state searches.
 * Filters results to those matching the city name or within radiusMiles of the centroid.
 * Mirrors the logic of applyZipFilter but scoped to a city rather than a ZIP.
 */
export function applyCityFilter<T extends PlaceShape>(
  places: T[],
  cityState: CityState,
  center: ZipCenter | null,
  categoryLabel: string,
  radiusMiles = 5
): ZipSearchOutcome<T> {
  const targetCity = cityState.city.toLowerCase();
  const displayCity = `${cityState.city}, ${cityState.state}`;

  // ── Step 1: city name matching (works with or without geocoding) ──────────
  const exactCity: T[] = [];
  const notExactCity: T[] = [];

  for (const place of places) {
    const placeCity = extractCityFromAddress(place.formatted_address);
    if (placeCity && placeCity.toLowerCase() === targetCity) {
      exactCity.push(place);
    } else {
      notExactCity.push(place);
    }
  }

  // ── Step 2: distance fallback for non-exact-city results (requires geocoding) ─
  const nearby: T[] = [];
  if (center) {
    for (const place of notExactCity) {
      const { lat, lng } = place.geometry.location;
      const dist = calculateDistanceMiles(center.lat, center.lng, lat, lng);
      if (dist <= radiusMiles) nearby.push(place);
    }
  }

  // ── Step 3: decide what to return ─────────────────────────────────────────
  if (exactCity.length >= MIN_EXACT_RESULTS) {
    return {
      places: exactCity,
      locationMessage: `Showing ${categoryLabel} in ${displayCity}`,
      expandedToNearby: false,
    };
  }

  const combined = [...exactCity, ...nearby];

  if (combined.length === 0) {
    // City name matching AND distance fallback both found nothing —
    // return all state-filtered results as a last resort
    return {
      places,
      locationMessage: `Results outside your search area — not enough found directly in ${displayCity}`,
      expandedToNearby: true,
    };
  }

  const msg =
    exactCity.length === 0
      ? `Not enough results in ${displayCity} — showing nearby results within ${radiusMiles} miles.`
      : `Showing ${categoryLabel} in and near ${displayCity}`;

  return {
    places: combined,
    locationMessage: msg,
    expandedToNearby: true,
  };
}

/**
 * High-level orchestrator: given a pre-filtered places array, apply ZIP logic
 * and return the final result list plus a UI message.
 *
 * Returns { places, locationMessage: null } unchanged when center is null
 * (i.e. geocoding failed or no ZIP was detected).
 */
export function applyZipFilter<T extends PlaceShape>(
  places: T[],
  targetZip: string,
  center: ZipCenter | null,
  categoryLabel: string,
  radiusMiles = 5
): ZipSearchOutcome<T> {
  if (!center) {
    return { places, locationMessage: null, expandedToNearby: false };
  }

  const { exactZip, nearby } = filterByZipOrRadius(places, targetZip, center, radiusMiles);

  if (exactZip.length >= MIN_EXACT_RESULTS) {
    return {
      places: exactZip,
      locationMessage: `Showing ${categoryLabel} in ${targetZip}`,
      expandedToNearby: false,
    };
  }

  // Not enough exact matches — expand to nearby
  const combined = [...exactZip, ...nearby];
  const msg =
    exactZip.length === 0
      ? `No results found directly in ${targetZip} — showing nearby results within ${radiusMiles} miles.`
      : `Not enough results in ${targetZip} — showing nearby results within ${radiusMiles} miles.`;

  return {
    places: combined,
    locationMessage: msg,
    expandedToNearby: true,
  };
}
