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

  // ─── Auto & Home Services ──────────────────────────────────────────────────

  mechanic: {
    canonicalQuery: 'auto repair mechanic',
    excludePatterns: [
      /mechanical\s*engineer/i,
      /auto\s*parts\s*(store|shop)/i,
      /body\s*shop/i,
      /tow(ing)?\s*(company|service|truck)/i,
    ],
    includePatterns: [
      /auto\s*(repair|service|mechanic)/i,
      /car\s*(repair|service|mechanic)/i,
      /oil\s*change/i,
      /transmission/i,
      /brake/i,
    ],
  },

  plumber: {
    canonicalQuery: 'plumber plumbing service',
    excludePatterns: [/plumbing\s*(supply|wholesale|parts|distributor)/i, /plumbing\s*school/i],
    includePatterns: [/plumb(er|ing)/i, /pipe\s*repair/i, /drain\s*(cleaning|service)/i],
  },

  electrician: {
    canonicalQuery: 'electrician electrical service',
    excludePatterns: [
      /electrical\s*(supply|wholesale|parts|school|contractor\s*school)/i,
      /solar\s*(panel|company|install)/i,
    ],
    includePatterns: [/electrician/i, /electrical\s*(repair|service|contractor)/i, /wiring/i],
  },

  hvac: {
    canonicalQuery: 'HVAC air conditioning heating service',
    excludePatterns: [/hvac\s*(school|training|parts|supply)/i],
    includePatterns: [
      /hvac/i,
      /air\s*conditioning/i,
      /furnace/i,
      /heating\s*(and|&)?\s*cooling/i,
      /heat\s*pump/i,
    ],
  },

  landscaping: {
    canonicalQuery: 'landscaping lawn care service',
    excludePatterns: [
      /landscaping\s*(school|supply|materials)/i,
      /nursery\s*(only|plant\s*store)/i,
    ],
    includePatterns: [
      /landscap/i,
      /lawn\s*(care|service|mowing|maintenance)/i,
      /yard\s*(care|service)/i,
      /tree\s*(service|trimm|removal)/i,
    ],
  },

  cleaner: {
    canonicalQuery: 'house cleaning service',
    excludePatterns: [
      /car\s*(wash|detail)/i,
      /dry\s*clean(ing|er)?/i,
      /carpet\s*cleaning\s*(supply|equipment)/i,
    ],
    includePatterns: [
      /house\s*clean/i,
      /home\s*clean/i,
      /maid\s*service/i,
      /janitorial/i,
      /commercial\s*clean/i,
    ],
  },

  'dry cleaner': {
    canonicalQuery: 'dry cleaning laundry service',
    excludePatterns: [/laundromat/i],
    includePatterns: [/dry\s*clean/i, /laundry\s*service/i, /alteration/i, /tailoring/i],
  },

  pest: {
    canonicalQuery: 'pest control exterminator',
    excludePatterns: [/pest\s*(supply|product|store)/i],
    includePatterns: [/pest\s*control/i, /exterminator/i, /termite/i, /rodent\s*control/i],
  },

  mover: {
    canonicalQuery: 'moving company movers',
    excludePatterns: [/truck\s*rental/i, /storage\s*(only|facility\s*only)/i],
    includePatterns: [/moving\s*company/i, /movers/i, /relocation\s*service/i],
  },

  locksmith: {
    canonicalQuery: 'locksmith key service',
    excludePatterns: [/lock\s*(supply|store|wholesale)/i],
    includePatterns: [/locksmith/i, /key\s*(cutting|duplication|copy)/i],
  },

  roofer: {
    canonicalQuery: 'roofing contractor',
    excludePatterns: [/roofing\s*(supply|material|wholesale)/i],
    includePatterns: [/roofer/i, /roofing\s*(contractor|company|service)/i, /roof\s*repair/i],
  },

  // ─── Health & Medical ──────────────────────────────────────────────────────

  dentist: {
    canonicalQuery: 'dentist dental office',
    excludePatterns: [
      /dental\s*(school|college|lab|supply|equipment)/i,
      /denture\s*(lab|center)/i,
    ],
    includePatterns: [
      /dentist/i,
      /dental\s*(office|practice|clinic)/i,
      /orthodont/i,
      /pediatric\s*dent/i,
    ],
  },

  chiropractor: {
    canonicalQuery: 'chiropractor chiropractic clinic',
    excludePatterns: [/chiropractic\s*(school|college|supply)/i],
    includePatterns: [/chiropractor/i, /chiropractic/i, /spinal\s*(care|adjust)/i],
  },

  'physical therapy': {
    canonicalQuery: 'physical therapy clinic',
    excludePatterns: [/physical\s*therapy\s*(school|college|supply)/i],
    includePatterns: [
      /physical\s*ther/i,
      /physiotherapy/i,
      /sports\s*(rehab|medicine\s*physical)/i,
      /occupational\s*ther/i,
    ],
  },

  optometrist: {
    canonicalQuery: 'eye doctor optometrist',
    excludePatterns: [/optometry\s*(school|college)/i, /vision\s*(insurance|plan)/i],
    includePatterns: [
      /optometrist/i,
      /eye\s*(doctor|care|clinic|center)/i,
      /vision\s*(center|care)/i,
      /ophthalmol/i,
    ],
  },

  'eye doctor': {
    canonicalQuery: 'eye doctor optometrist',
    excludePatterns: [/optometry\s*(school|college)/i],
    includePatterns: [/optometrist/i, /eye\s*(doctor|care|clinic)/i, /vision\s*(center|care)/i],
  },

  vet: {
    canonicalQuery: 'veterinarian animal hospital',
    excludePatterns: [
      /veteran(s)?\s*(affairs|hospital|service|memorial|administration)/i,
      /va\s*(hospital|clinic|center)/i,
    ],
    includePatterns: [
      /veterinarian/i,
      /vet(erinary)?\s*(clinic|hospital|care|center)/i,
      /animal\s*(hospital|clinic|care)/i,
    ],
  },

  pharmacy: {
    canonicalQuery: 'pharmacy drug store',
    excludePatterns: [/pharmacy\s*(school|college|wholesale)/i, /pharmaceutical\s*company/i],
    includePatterns: [/pharmacy/i, /drug\s*store/i, /compounding/i, /rx/i],
  },

  therapist: {
    canonicalQuery: 'mental health therapist counselor',
    excludePatterns: [
      /massage\s*therapist/i,
      /physical\s*therapist/i,
      /occupational\s*therapist/i,
    ],
    includePatterns: [
      /mental\s*health/i,
      /therapist/i,
      /counselor/i,
      /psychologist/i,
      /psychiatrist/i,
      /counseling/i,
    ],
  },

  // ─── Food & Drink ──────────────────────────────────────────────────────────

  restaurant: {
    canonicalQuery: 'restaurant',
    excludePatterns: [
      /restaurant\s*(supply|equipment|furniture)/i,
      /food\s*(distributor|wholesaler|supplier)/i,
    ],
    includePatterns: [/restaurant/i, /diner/i, /bistro/i, /eatery/i, /grill/i, /kitchen/i],
  },

  pizza: {
    canonicalQuery: 'pizza restaurant',
    excludePatterns: [
      /pizza\s*(supply|dough|ingredient|wholesale)/i,
      /pizza\s*box/i,
    ],
    includePatterns: [/pizza/i, /pizzeria/i, /pie/i],
  },

  coffee: {
    canonicalQuery: 'coffee shop cafe',
    excludePatterns: [
      /coffee\s*(roaster\s*wholesale|bean\s*supplier|distributor)/i,
      /coffee\s*machine\s*(repair|service|sales)/i,
    ],
    includePatterns: [
      /coffee\s*(shop|house|bar|cafe)/i,
      /caf[eé]/i,
      /espresso/i,
      /latte/i,
      /roastery/i,
    ],
  },

  cafe: {
    canonicalQuery: 'coffee shop cafe',
    excludePatterns: [/internet\s*cafe/i, /cyber\s*cafe/i, /gaming\s*cafe/i],
    includePatterns: [/caf[eé]/i, /coffee/i, /bakery\s*cafe/i, /bistro/i],
  },

  bakery: {
    canonicalQuery: 'bakery bread shop',
    excludePatterns: [/bakery\s*(supply|equipment|wholesale)/i],
    includePatterns: [/bakery/i, /bak(er|ery)/i, /pastry/i, /bread/i, /cake\s*shop/i],
  },

  sushi: {
    canonicalQuery: 'sushi restaurant',
    excludePatterns: [/sushi\s*(grade|supply|fish\s*market)/i],
    includePatterns: [/sushi/i, /japanese\s*restaurant/i, /hibachi/i, /ramen/i],
  },

  // ─── Beauty & Personal Care ────────────────────────────────────────────────

  barber: {
    canonicalQuery: 'barber shop haircut',
    excludePatterns: [/barbecue/i, /bbq/i, /barber\s*(school|college|supply)/i],
    includePatterns: [/barber(shop)?/i, /haircut/i, /men.s\s*(hair|grooming|cut)/i],
  },

  hair: {
    canonicalQuery: 'hair salon',
    excludePatterns: [
      /hair\s*(loss\s*treatment\s*supply|extension\s*wholesale|product\s*supplier)/i,
      /wig\s*(store|shop|boutique)/i,
    ],
    includePatterns: [
      /hair\s*(salon|studio|color|stylist|cut)/i,
      /salon/i,
      /blowout/i,
      /balayage/i,
    ],
  },

  salon: {
    canonicalQuery: 'hair salon beauty salon',
    excludePatterns: [
      /salon\s*(supply|wholesale|equipment)/i,
      /beauty\s*school/i,
      /cosmetology\s*school/i,
    ],
    includePatterns: [
      /hair\s*salon/i,
      /beauty\s*salon/i,
      /full\s*service\s*salon/i,
      /nail\s*salon/i,
    ],
  },

  waxing: {
    canonicalQuery: 'waxing salon hair removal',
    excludePatterns: [/car\s*wax/i, /floor\s*wax/i, /candle\s*wax/i],
    includePatterns: [/wax(ing)?/i, /hair\s*removal/i, /sugaring/i, /threading/i],
  },

  // ─── Finance & Professional ────────────────────────────────────────────────

  accountant: {
    canonicalQuery: 'accountant CPA accounting firm',
    excludePatterns: [
      /accounting\s*(software|school|college|program)/i,
      /quickbooks\s*(training|consultant)/i,
    ],
    includePatterns: [
      /accountant/i,
      /cpa/i,
      /accounting\s*(firm|office|service)/i,
      /tax\s*(prep|service|professional)/i,
      /bookkeeping/i,
    ],
  },

  tax: {
    canonicalQuery: 'tax preparation service',
    excludePatterns: [
      /tax\s*(attorney\s*only|law\s*school)/i,
      /tax\s*software/i,
    ],
    includePatterns: [
      /tax\s*(prep|preparation|service|professional)/i,
      /cpa/i,
      /accountant/i,
      /h\s*&\s*r\s*block/i,
    ],
  },

  realtor: {
    canonicalQuery: 'realtor real estate agent',
    excludePatterns: [
      /real\s*estate\s*(school|college|law|investing\s*course)/i,
      /property\s*management\s*(company\s*only)/i,
    ],
    includePatterns: [
      /realtor/i,
      /real\s*estate\s*(agent|broker|company|group)/i,
      /realty/i,
      /keller\s*williams/i,
      /re\s*\/\s*max/i,
    ],
  },

  insurance: {
    canonicalQuery: 'insurance agent',
    excludePatterns: [
      /insurance\s*(school|training|software|wholesale)/i,
    ],
    includePatterns: [
      /insurance\s*(agent|agency|broker|company)/i,
      /allstate/i,
      /state\s*farm/i,
      /farmers\s*insurance/i,
    ],
  },

  // ─── Pets ──────────────────────────────────────────────────────────────────

  groomer: {
    canonicalQuery: 'pet grooming dog groomer',
    excludePatterns: [
      /wedding\s*groo/i,
      /groom(ing)?\s*(suit|attire|tuxedo)/i,
      /bridal/i,
    ],
    includePatterns: [
      /pet\s*groo/i,
      /dog\s*groo/i,
      /cat\s*groo/i,
      /mobile\s*groo/i,
    ],
  },

  'dog groomer': {
    canonicalQuery: 'dog grooming pet salon',
    excludePatterns: [],
    includePatterns: [/dog\s*groo/i, /pet\s*(salon|spa|groo)/i],
  },

  // ─── Education & Childcare ─────────────────────────────────────────────────

  daycare: {
    canonicalQuery: 'daycare child care center',
    excludePatterns: [/daycare\s*(software|management|supply)/i],
    includePatterns: [
      /daycare/i,
      /child\s*care/i,
      /preschool/i,
      /early\s*(learning|childhood|education)/i,
    ],
  },

  tutor: {
    canonicalQuery: 'tutoring academic tutor',
    excludePatterns: [/tutor(ing)?\s*(software|app|platform)/i],
    includePatterns: [
      /tutor/i,
      /tutoring\s*(center|service)/i,
      /learning\s*center/i,
      /academic\s*(coach|support)/i,
    ],
  },

  // ─── Hospitality & Travel ──────────────────────────────────────────────────

  hotel: {
    canonicalQuery: 'hotel',
    excludePatterns: [
      /hotel\s*(management\s*school|supply|furniture|software)/i,
      /hospitality\s*school/i,
    ],
    includePatterns: [
      /hotel/i,
      /inn/i,
      /resort/i,
      /suites/i,
      /lodge/i,
      /marriott/i,
      /hilton/i,
      /hyatt/i,
    ],
  },

  motel: {
    canonicalQuery: 'motel',
    excludePatterns: [],
    includePatterns: [/motel/i, /motor\s*inn/i, /inn/i, /lodge/i],
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
