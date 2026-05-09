/**
 * Search Intent Module
 *
 * Improves search quality by:
 *  1. Rewriting ambiguous queries before they hit Google Places
 *  2. Filtering out results that don't match the user's intent
 *
 * This is a pure TypeScript module — no external dependencies, no API calls.
 * Add entries to SEARCH_INTENT_MAP to expand coverage.
 */

export interface SearchIntentConfig {
  /** Clearer query to send to Google Places instead of the raw term */
  canonicalQuery: string;
  /**
   * Business name / type patterns that strongly indicate a mismatch.
   * Results whose names match any of these are removed (subject to MIN_RESULTS floor).
   */
  excludePatterns: RegExp[];
  /**
   * Business name / type patterns that confirm a strong match.
   * Used to bubble these results to the top when mixed results are returned.
   */
  includePatterns?: RegExp[];
}

/**
 * Intent map keyed by the normalised user search term (lowercase, trimmed).
 * Covers the most common ambiguous consumer searches.
 */
export const SEARCH_INTENT_MAP: Record<string, SearchIntentConfig> = {
  gym: {
    canonicalQuery: 'fitness gym',
    excludePatterns: [
      /gymnastics/i,
      /gymnastic\s*(center|centre|studio|academy|school|club)/i,
      /swim(ming)?\s*(school|lesson|class|academ|center|centre)/i,
      /aquatic(s)?\s*(center|centre|complex)/i,
      /recreation\s*(center|centre)/i,
      /ymca/i,
    ],
    includePatterns: [
      /fitness/i,
      /health\s*club/i,
      /crossfit/i,
      /workout/i,
      /personal\s*train/i,
      /strength/i,
      /bodybuilding/i,
    ],
  },

  nail: {
    canonicalQuery: 'nail salon',
    excludePatterns: [
      /hardware/i,
      /fastener/i,
      /supply\s*store/i,
      /roofing/i,
      /construction\s*supply/i,
    ],
    includePatterns: [/nail\s*(salon|spa|studio|bar)/i, /manicure/i, /pedicure/i],
  },

  spa: {
    canonicalQuery: 'day spa',
    excludePatterns: [
      /auto(motive)?\s*spa/i,
      /car\s*(wash|spa|detail)/i,
      /detail(ing)?\s*spa/i,
    ],
    includePatterns: [
      /day\s*spa/i,
      /massage/i,
      /facial/i,
      /skincare/i,
      /wellness/i,
    ],
  },

  bar: {
    canonicalQuery: 'bar pub',
    excludePatterns: [
      /bar\s*association/i,
      /bar\s*(prep|review|exam|course)/i,
      /attorney/i,
      /law\s*(firm|office)/i,
    ],
    includePatterns: [/pub/i, /tavern/i, /lounge/i, /brewery/i, /craft\s*beer/i],
  },

  trainer: {
    canonicalQuery: 'personal trainer',
    excludePatterns: [
      /dog\s*train/i,
      /pet\s*train/i,
      /animal\s*train/i,
      /canine/i,
    ],
    includePatterns: [/personal\s*train/i, /fitness\s*coach/i, /strength\s*coach/i],
  },

  studio: {
    canonicalQuery: 'fitness studio',
    excludePatterns: [
      /creative\s*agency/i,
      /production\s*studio/i,
      /recording\s*studio/i,
      /film\s*studio/i,
      /photography\s*studio/i,
      /graphic\s*design/i,
    ],
    includePatterns: [/yoga/i, /pilates/i, /barre/i, /dance/i, /fitness/i, /martial\s*arts/i],
  },

  pool: {
    canonicalQuery: 'swimming pool service',
    excludePatterns: [
      /billiard/i,
      /pool\s*hall/i,
      /pool\s*table/i,
      /snooker/i,
    ],
    includePatterns: [/pool\s*(service|cleaning|repair|installation)/i, /swimming\s*pool/i],
  },

  clinic: {
    canonicalQuery: 'medical clinic',
    excludePatterns: [
      /veterinary\s*clinic/i,
      /vet\s*clinic/i,
      /animal\s*clinic/i,
      /pet\s*clinic/i,
    ],
    includePatterns: [/urgent\s*care/i, /medical\s*clinic/i, /family\s*medicine/i, /walk.?in/i],
  },

  massage: {
    canonicalQuery: 'massage therapy',
    excludePatterns: [
      /auto(motive)?\s*massage/i,
      /car\s*massage/i,
    ],
    includePatterns: [
      /massage\s*therapy/i,
      /therapeutic\s*massage/i,
      /deep\s*tissue/i,
      /sports\s*massage/i,
    ],
  },

  facial: {
    canonicalQuery: 'facial spa treatment',
    excludePatterns: [/trauma/i, /surgery/i, /reconstructive/i],
    includePatterns: [/facial/i, /esthetician/i, /skincare/i, /aesthetics/i],
  },

  pilates: {
    canonicalQuery: 'pilates studio',
    excludePatterns: [],
    includePatterns: [/pilates/i, /reformer/i],
  },

  yoga: {
    canonicalQuery: 'yoga studio',
    excludePatterns: [],
    includePatterns: [/yoga/i, /meditation/i, /mindfulness/i],
  },

  tattoo: {
    canonicalQuery: 'tattoo shop',
    excludePatterns: [/tattoo\s*removal/i],
    includePatterns: [/tattoo/i, /ink/i, /piercing/i],
  },

  lawyer: {
    canonicalQuery: 'law firm attorney',
    excludePatterns: [/law\s*school/i, /legal\s*aid\s*society/i],
    includePatterns: [/law\s*firm/i, /attorney/i, /legal\s*services/i],
  },

  doctor: {
    canonicalQuery: 'primary care doctor',
    excludePatterns: [/veterinarian/i, /vet\s*(clinic|hospital)/i, /animal\s*hospital/i],
    includePatterns: [/family\s*medicine/i, /internal\s*medicine/i, /primary\s*care/i],
  },
};

// ─── Word strip list ─────────────────────────────────────────────────────────
// Common modifiers that don't change intent — stripped before intent lookup
const STRIP_WORDS = /\b(best|top|top.rated|trusted|local|good|great|near\s*me|nearby|cheap|affordable|reliable|professional|licensed|certified|affordable)\b/gi;

/**
 * Extract the core intent keyword from a freeform user query.
 * "best fitness gym near me" → "fitness gym"
 * "reliable plumber"         → "plumber"
 */
function extractIntentKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(STRIP_WORDS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up intent config by matching the query against known keys.
 * Tries exact match first, then single-word containment.
 */
function lookupIntent(normalized: string): SearchIntentConfig | null {
  // Exact match
  if (SEARCH_INTENT_MAP[normalized]) return SEARCH_INTENT_MAP[normalized];

  // Single-word keys: check if the normalized query contains or equals the key
  for (const [key, config] of Object.entries(SEARCH_INTENT_MAP)) {
    if (!key.includes(' ')) {
      // Match if query is exactly the key or starts/ends with it as a standalone word
      const wordBoundary = new RegExp(`\\b${key}\\b`, 'i');
      if (wordBoundary.test(normalized)) return config;
    }
  }

  return null;
}

/**
 * Rewrites an ambiguous category string into a clearer Google Places query.
 *
 * Examples:
 *   "gym"          → "fitness gym"
 *   "fitness gym"  → "fitness gym"  (already specific, returned as-is)
 *   "plumber"      → "plumber"      (not in map, returned as-is)
 *   "nail"         → "nail salon"
 */
export function normalizeSearchQuery(category: string): string {
  if (!category.trim()) return category;
  const key = extractIntentKey(category);
  const intent = lookupIntent(key);
  if (!intent) return category;

  // Only rewrite if the canonical query is more specific than what was typed
  if (intent.canonicalQuery.toLowerCase() !== key) {
    return intent.canonicalQuery;
  }
  return category;
}

/**
 * Minimum number of results to preserve even after filtering.
 * Prevents an aggressive intent filter from producing an empty results page.
 */
const MIN_RESULTS = 3;

/**
 * Filters and re-ranks a Places result array based on inferred search intent.
 *
 * - Results matching exclude patterns are removed (subject to MIN_RESULTS floor).
 * - Results matching include patterns are moved to the front of the list.
 *
 * Returns the original array unchanged if no intent config is found.
 */
export function filterByIntent<T extends { name: string }>(
  places: T[],
  category: string
): T[] {
  if (places.length === 0 || !category.trim()) return places;

  const key = extractIntentKey(category);
  const intent = lookupIntent(key);
  if (!intent) return places;

  // Separate matches from mismatches
  const excluded: T[] = [];
  const kept: T[] = [];

  for (const place of places) {
    const isExcluded = intent.excludePatterns.some((rx) => rx.test(place.name));
    if (isExcluded) {
      excluded.push(place);
    } else {
      kept.push(place);
    }
  }

  // If filtering would leave fewer than MIN_RESULTS, restore some excluded results
  const safeKept =
    kept.length >= MIN_RESULTS
      ? kept
      : [...kept, ...excluded].slice(0, Math.max(MIN_RESULTS, kept.length));

  // Bubble up strong include-pattern matches to the top
  if (!intent.includePatterns || intent.includePatterns.length === 0) return safeKept;

  const strong: T[] = [];
  const rest: T[] = [];
  for (const place of safeKept) {
    const isStrong = intent.includePatterns.some((rx) => rx.test(place.name));
    if (isStrong) strong.push(place);
    else rest.push(place);
  }

  return [...strong, ...rest];
}
