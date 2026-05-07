/**
 * Canonical partner-category taxonomy.
 *
 * This module is the single source of truth for partner categories. Every
 * place that writes a `category` value into the `partners` or `leads` tables
 * — and every place that matches leads to partners — must go through this
 * module. Historically the partner form and the consumer-side lead form used
 * different vocabularies ("pest control" vs "pest-control", "automotive" vs
 * "auto repair", etc.), which silently broke matching. The fix is to use
 * kebab-case slugs as storage values and funnel all input through
 * {@link normalizePartnerCategory}.
 */
import type { BusinessCategory } from './ranking';

// ── Canonical slugs stored in the DB ────────────────────────────────────────
export const PARTNER_CATEGORIES = [
  'landscaping',
  'plumbing',
  'electrical',
  'hvac',
  'roofing',
  'cleaning',
  'painting',
  'auto-repair',
  'pest-control',
  'moving',
  'general-contractor',
  'other',
] as const;

export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

// ── Human-readable labels for UI display ────────────────────────────────────
export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  'landscaping':        'Landscaping',
  'plumbing':           'Plumbing',
  'electrical':         'Electrical',
  'hvac':               'HVAC',
  'roofing':            'Roofing',
  'cleaning':           'Cleaning',
  'painting':           'Painting',
  'auto-repair':        'Auto Repair',
  'pest-control':       'Pest Control',
  'moving':             'Moving',
  'general-contractor': 'General Contractor',
  'other':              'Other',
};

// ── Aliases — maps legacy + ranking-taxonomy values to canonical slugs ──────
// Keys must be lowercased. Add entries here whenever a new synonym shows up.
const PARTNER_CATEGORY_ALIASES: Record<string, PartnerCategory> = {
  // Legacy display-form values (pre-slug migration)
  'pest control':         'pest-control',
  'auto repair':          'auto-repair',
  'general contractor':   'general-contractor',

  // BusinessCategory taxonomy from lib/ranking.ts
  'automotive':           'auto-repair',
  'home_services':        'general-contractor',

  // Common user spellings
  'a/c':                  'hvac',
  'ac':                   'hvac',
  'heating':              'hvac',
  'cooling':              'hvac',
  'exterminator':         'pest-control',
  'pest':                 'pest-control',
  'lawn care':            'landscaping',
  'lawn':                 'landscaping',
  'yard':                 'landscaping',
  'mover':                'moving',
  'painter':              'painting',
  'plumber':              'plumbing',
  'electrician':          'electrical',
  'roofer':               'roofing',
  'mechanic':             'auto-repair',
  'car repair':           'auto-repair',
  'contractor':           'general-contractor',
  'general':              'other',
};

/**
 * Normalize any incoming category string to a canonical slug, or return
 * `null` if the input can't be mapped. Whitespace is trimmed, case is
 * folded, and spaces are replaced with hyphens as a last-resort fallback.
 *
 * Examples:
 *   normalizePartnerCategory("Pest Control")   → "pest-control"
 *   normalizePartnerCategory("auto repair")    → "auto-repair"
 *   normalizePartnerCategory("automotive")     → "auto-repair"
 *   normalizePartnerCategory("home_services")  → "general-contractor"
 *   normalizePartnerCategory("xyz")            → null
 */
export function normalizePartnerCategory(
  raw: string | null | undefined
): PartnerCategory | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;

  // Exact canonical slug
  if ((PARTNER_CATEGORIES as readonly string[]).includes(t)) {
    return t as PartnerCategory;
  }

  // Known alias
  if (PARTNER_CATEGORY_ALIASES[t]) {
    return PARTNER_CATEGORY_ALIASES[t];
  }

  // Last-resort: collapse whitespace to hyphens and retry
  const hyphenated = t.replace(/\s+/g, '-');
  if ((PARTNER_CATEGORIES as readonly string[]).includes(hyphenated)) {
    return hyphenated as PartnerCategory;
  }

  return null;
}

/**
 * Map a ranking-taxonomy BusinessCategory (used by consumer pages) to a
 * partner slug. Used by `QuoteButton` on business detail pages so that
 * leads for e.g. an auto-repair shop (BusinessCategory `automotive`) match
 * partners who registered in the `auto-repair` bucket.
 */
export function businessCategoryToPartnerCategory(
  c: BusinessCategory
): PartnerCategory {
  return normalizePartnerCategory(c) ?? 'other';
}

/** True iff `raw` normalizes to a known partner slug. */
export function isPartnerCategory(raw: string): raw is PartnerCategory {
  return normalizePartnerCategory(raw) !== null;
}
