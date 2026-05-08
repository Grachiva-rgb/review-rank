/**
 * Multi-source scoring: blends Google and Tripadvisor signals for hospitality categories.
 *
 * For all non-hospitality categories the function returns a single-source result
 * that is fully backward-compatible with the existing scoring pipeline.
 *
 * Weighting (hospitality categories only):
 *   Google      60%
 *   Tripadvisor 40%
 *
 * Tripadvisor is a trust *enhancement* signal — not the sole ranking authority.
 * The Travelers' Choice award adds a small additive bump (+2 pts max) only
 * when confidence is medium or high, so a single award cannot manufacture trust.
 */

import type {
  ReviewSource,
  MultiSourceScore,
  ConfidenceLevel,
  TripadvisorBusinessData,
} from './types';
import { buildReviewSources, isHospitalityCategory } from './tripadvisor';
import { bayesianRating, volumeScore } from './reviewRankScoring';

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Compute a multi-source final score and confidence object.
 *
 * @param googleRating         - Aggregate Google rating (0–5)
 * @param googleCount          - Total Google review count
 * @param ta                   - Tripadvisor data from cache (null if not available)
 * @param category             - Business category slug (used to determine weighting)
 * @param existingRRScore      - The pre-computed single-source Review Rank Score
 *                               (used as base; TA blend modifies it modestly)
 */
export function computeMultiSourceScore(
  googleRating: number,
  googleCount: number,
  ta: TripadvisorBusinessData | null | undefined,
  category: string,
  existingRRScore: number
): MultiSourceScore {
  const isHospitality = isHospitalityCategory(category);
  const sources = buildReviewSources(googleRating, googleCount, ta, category);

  if (!ta || !isHospitality) {
    // No TA data or non-hospitality: single-source pass-through
    const confidence: ConfidenceLevel = googleCount > 200 ? 'medium' : 'low';
    return {
      finalScore: existingRRScore,
      confidence: 'single_source',
      confidenceReason: 'Score based on Google reviews only. Tripadvisor data not yet available for this business.',
      platformConsistency: 100,
      sources,
      isHospitalityCategory: false,
      travelersChoiceAward: false,
    };
  }

  // ── Blended Bayesian rating ───────────────────────────────────────────────
  // Compute Bayesian for each source, then blend by weight.
  const googleBayesian = bayesianRating(googleRating, googleCount);
  const taBayesian     = bayesianRating(ta.rating, ta.reviewCount, 4.0, 10); // TA prior: 4.0, lower C
  const blendedBayesian = googleBayesian * 0.60 + taBayesian * 0.40;

  // Combined volume (log-scaled on total across both platforms)
  const totalReviews = googleCount + ta.reviewCount;
  const combinedVolume = volumeScore(totalReviews);

  // Blended final score (replace bayesian component; keep volume, sentiment, consistency from existing)
  // Existing score is dominated by bayesian (55%); we nudge it by the blended bayesian delta.
  const bayesianDelta = blendedBayesian - googleBayesian; // usually small (< 5 pts)
  let blendedScore = existingRRScore + bayesianDelta * 0.55;

  // ── Platform consistency ──────────────────────────────────────────────────
  const ratingDiff = Math.abs(googleRating - ta.rating);
  const platformConsistency = Math.round((1 - Math.min(ratingDiff / 2.5, 1)) * 100);

  // ── Confidence level ──────────────────────────────────────────────────────
  let confidence: ConfidenceLevel;
  let confidenceReason: string;

  if (ratingDiff <= 0.2 && totalReviews > 500) {
    confidence = 'high';
    confidenceReason = `High confidence — strong alignment between Google and Tripadvisor across ${totalReviews.toLocaleString()} reviews.`;
  } else if (ratingDiff <= 0.5 && totalReviews > 100) {
    confidence = 'medium';
    confidenceReason = `Medium confidence — ratings broadly consistent across Google and Tripadvisor.`;
  } else if (ratingDiff > 0.5) {
    confidence = 'low';
    confidenceReason = `Mixed signals — Google (${googleRating.toFixed(1)}★) and Tripadvisor (${ta.rating.toFixed(1)}★) ratings diverge. Check both sources.`;
  } else {
    confidence = 'medium';
    confidenceReason = `Based on Google and Tripadvisor reviews combined.`;
  }

  // ── Travelers' Choice award boost (+2 pts, capped) ───────────────────────
  const travelersChoiceAward = Boolean(
    ta.awards?.some((a) => a.toLowerCase().includes("travelers' choice") || a.toLowerCase().includes("travellers' choice"))
  );
  if (travelersChoiceAward && confidence !== 'low') {
    blendedScore += 2;
  }

  const finalScore = Math.round(Math.min(100, Math.max(0, blendedScore)) * 10) / 10;

  return {
    finalScore,
    confidence,
    confidenceReason,
    platformConsistency,
    sources,
    isHospitalityCategory: true,
    travelersChoiceAward,
  };
}

// ─── Confidence label helpers ─────────────────────────────────────────────────

export function confidenceLevelLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':          return 'High Confidence';
    case 'medium':        return 'Medium Confidence';
    case 'low':           return 'Low Confidence';
    case 'single_source': return 'Google Only';
  }
}

export function confidenceLevelColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':          return 'text-[#2F6F4E] bg-[#2F6F4E]/8 border-[#2F6F4E]/25';
    case 'medium':        return 'text-[#8B5E3C] bg-[#8B5E3C]/8 border-[#8B5E3C]/25';
    case 'low':           return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'single_source': return 'text-[#7A6B63] bg-[#FAF7F0] border-[#EDE8E3]';
  }
}
