/**
 * THE single source of truth for score-band labels, band styling, and the
 * Rising Star definition.
 *
 * Before this module existed there were four divergent band maps
 * (lib/reviewRankScoring.getRankLabel, two private maps in SmartScoreBadge,
 * and an unused lib/ranking.getScoreLabel) plus three different Rising Star
 * definitions (<300 with a rating gate, <300 without one, and user-facing
 * copy claiming "under 500"). Every surface — cards, business page, compare,
 * methodology — must import from here and only here.
 */

export interface ScoreBand {
  label: string;
  /** Tailwind text colour class */
  text: string;
  /** Tailwind background + border classes */
  bg: string;
}

/** Band thresholds for the 0–100 ReviewRank Score. Mirrored by the methodology page. */
export function getScoreBand(score: number): ScoreBand {
  if (score >= 80) return { label: 'Elite',              text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 65) return { label: 'Highly Trusted',     text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 50) return { label: 'Trusted',            text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' };
  if (score >= 35) return { label: 'Established',        text: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' };
  return                  { label: 'Limited Reputation', text: 'text-red-700',     bg: 'bg-red-50 border-red-200' };
}

/**
 * Rising Star: strong early rating with a shallow review history.
 * One definition, used by the card badge, the results sort, the results
 * callout, and the FilterBar copy. (They previously disagreed: <300 with a
 * rating gate, <300 without one, and "under 500" in user-facing text.)
 */
export const RISING_STAR_MIN_RATING = 4.7;
export const RISING_STAR_MAX_REVIEWS = 300;

export function isRisingStar(rating: number, reviewCount: number): boolean {
  return rating >= RISING_STAR_MIN_RATING && reviewCount < RISING_STAR_MAX_REVIEWS;
}

// ─── Confidence ───────────────────────────────────────────────────────────────
// How much evidence backs the score — SEPARATE from the score itself and never
// modifying it. Thresholds are data-driven from the live inventory's
// review-count distribution (p25≈66, p50≈253, p75≈952 at introduction), so the
// four levels split businesses roughly 47/21/19/13%. Rating-stability inputs
// get added once historical snapshots exist (Phase 4).

export type ConfidenceLevel = 'very_high' | 'high' | 'moderate' | 'low';

export function getConfidence(
  reviewCount: number,
  sampleSize: number
): { level: ConfidenceLevel; label: string } {
  if (reviewCount >= 300 && sampleSize >= 5) return { level: 'very_high', label: 'Very High' };
  if (reviewCount >= 100) return { level: 'high', label: 'High' };
  if (reviewCount >= 25) return { level: 'moderate', label: 'Moderate' };
  return { level: 'low', label: 'Low' };
}
