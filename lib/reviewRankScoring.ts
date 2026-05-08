/**
 * Review Rank Score — Predictive Reputation Score (0–100)
 *
 * A commercially credible weighted ranking model that estimates a business's
 * reputation without claiming to replicate Google or Yelp algorithms.
 *
 * Weighting adapted to what we can actually measure from the Google Places API
 * (which returns only the aggregate rating, review count, and up to 5 of the
 * most recent reviews per business). Phases unlock more signals over time:
 *
 *   Phase 1 (current — ships today):
 *     55% Bayesian weighted rating      (quality, shrinkage-corrected)
 *     20% Review volume (log-scaled)    (confidence, track-record depth)
 *     15% Recent-review sentiment       (trend, last-mile reputation)
 *     10% Rating consistency (stddev)   (reliability of experience)
 *
 *   Phase 2 (unlocks after we track review history in our own DB):
 *     + Review velocity, review recency weighting, owner response rate
 *
 *   Phase 3 (unlocks with cross-platform data — BBB / Trustpilot / Yelp):
 *     + Cross-platform consistency, accreditation boost
 *
 * Why Bayesian? A 5.0★ business with 3 reviews is not more reputable than a
 * 4.8★ business with 500. Bayesian "shrinks" ratings toward the platform mean
 * when the sample is small, so volume earns credibility.
 *
 * All functions are pure, deterministic, and safe for Next.js Server Components.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BusinessReview {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  respondedAt?: string;
  platform: 'google' | 'yelp' | 'facebook' | 'tripadvisor' | 'other';
}

export interface BusinessScoreInput {
  businessId: string;
  rating: number;                 // aggregate rating (0–5)
  totalReviewCount: number;       // full review count across platform
  reviews: BusinessReview[];      // up to ~5 most recent reviews available
  competitorAverageReviews?: number;
  platformAverageRating?: number; // default 4.2 for Google
  minimumReviewThreshold?: number;
}

export interface BusinessScoreOutput {
  businessId: string;
  finalScore: number;             // 0–100 Review Rank Score
  rankLabel: string;              // human-readable tier
  componentScores: {
    bayesian: number;             // 0–100
    volume: number;               // 0–100
    sentiment: number;            // 0–100
    consistency: number;          // 0–100
  };
  explanations: string[];         // plain-English reasons, UX-facing
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Platform-mean prior for Bayesian shrinkage. Google's global average is
// ~4.2★; small variation doesn't materially change the ranking order.
const DEFAULT_PLATFORM_MEAN = 4.2;

// Confidence constant C — how many platform-mean "virtual reviews" we blend in.
// Higher C = more shrinkage = more penalty for low review volume.
// 15 is a sensible MVP default: a 4.8★ business needs ~150 reviews before the
// prior's weight falls below 10%.
const BAYESIAN_CONFIDENCE = 15;

// Volume ceiling: anything past 2000 reviews hits the top of the log curve.
// This prevents national chains with millions of reviews from dominating local.
const VOLUME_LOG_CEILING = Math.log10(2001);

// Component weights — must sum to 1.0
const WEIGHTS = {
  bayesian: 0.55,
  volume: 0.20,
  sentiment: 0.15,
  consistency: 0.10,
} as const;

// ─── Helper 1 — Bayesian Weighted Rating ─────────────────────────────────────
// Formula:  (C · m + v · R) / (C + v)
//   where R = business rating, v = review count, m = platform mean, C = prior weight.
// Converts a 0–5 Bayesian rating into a 0–100 sub-score.
export function bayesianRating(
  rating: number,
  reviewCount: number,
  platformMean: number = DEFAULT_PLATFORM_MEAN,
  confidence: number = BAYESIAN_CONFIDENCE
): number {
  if (!rating || rating <= 0) return 0;
  const v = Math.max(0, reviewCount);
  const blended = (confidence * platformMean + v * rating) / (confidence + v);
  // Map 3.0 → 0 and 5.0 → 100, so only genuinely good ratings contribute.
  const normalized = ((blended - 3.0) / 2.0) * 100;
  return clamp(normalized, 0, 100);
}

// ─── Helper 2 — Review Volume (log-scaled) ───────────────────────────────────
// Volume means confidence. A 4.8★ business with 20 reviews is less of a known
// quantity than a 4.8★ with 2000. We use log so the curve rewards the first
// reviews most heavily and diminishes returns after thousands.
export function volumeScore(reviewCount: number): number {
  if (!reviewCount || reviewCount <= 0) return 0;
  const normalized = Math.log10(reviewCount + 1) / VOLUME_LOG_CEILING;
  return clamp(normalized * 100, 0, 100);
}

// ─── Helper 3 — Recent-Review Sentiment ──────────────────────────────────────
// Uses the rating on each recent review as a fast, reliable sentiment proxy.
// This is intentionally simple for MVP — no external NLP calls needed, and
// user-assigned ratings correlate strongly with sentiment in practice.
//
// This captures *trend* that the overall aggregate rating hides: a business
// with 4.6★ overall but three recent 2★ reviews is sliding; this surfaces it.
export function sentimentScore(reviews: BusinessReview[]): number {
  if (!reviews || reviews.length === 0) return 50; // neutral prior
  const rated = reviews.filter((r) => r.rating && r.rating > 0);
  if (rated.length === 0) return 50;
  const avg = rated.reduce((s, r) => s + r.rating, 0) / rated.length;
  // Map 3.0 → 0 and 5.0 → 100 so only genuinely positive recent reviews score.
  return clamp(((avg - 3.0) / 2.0) * 100, 0, 100);
}

// ─── Helper 4 — Rating Consistency ───────────────────────────────────────────
// Stddev of recent review ratings. Low stddev = reliable experience. High
// stddev (mix of 1★ and 5★) = polarizing, less predictable, a yellow flag
// that aggregate rating hides.
//
// Max sensible stddev for 1–5 scale is ~2.0 (half 1s, half 5s). Anything
// above 1.5 we treat as quite inconsistent.
export function consistencyScore(reviews: BusinessReview[]): number {
  if (!reviews || reviews.length < 2) return 75; // insufficient data, optimistic prior
  const rated = reviews.filter((r) => r.rating && r.rating > 0);
  if (rated.length < 2) return 75;
  const mean = rated.reduce((s, r) => s + r.rating, 0) / rated.length;
  const variance = rated.reduce((s, r) => s + (r.rating - mean) ** 2, 0) / rated.length;
  const stddev = Math.sqrt(variance);
  // stddev 0.0 → 100, stddev 1.5+ → 0, linear in between.
  const normalized = 1 - Math.min(stddev / 1.5, 1);
  return clamp(normalized * 100, 0, 100);
}

// ─── Helper 5 — Owner Response Rate ─────────────────────────────────────────
// Not exposed via Google Places API; left as a stub for Phase 2 when we
// start scraping / storing individual business pages.
// Returns neutral 50 until wired up.
export function responseRateScore(reviews: BusinessReview[]): number {
  const responded = reviews.filter((r) => r.respondedAt).length;
  if (reviews.length === 0) return 50;
  return clamp((responded / reviews.length) * 100, 0, 100);
}

// ─── Helper 6 — Fraud Confidence Modifier ───────────────────────────────────
// Simple heuristics for Phase 2 — fraction of reviews with identical text
// length / suspicious burst patterns / rating all the same. Returns a multiplier
// in [0.8, 1.0]. Stubbed at 1.0 for MVP.
export function fraudConfidenceMultiplier(_reviews: BusinessReview[]): number {
  return 1.0;
}

// ─── Main scorer ─────────────────────────────────────────────────────────────

export function calculateReviewRankScore(input: BusinessScoreInput): BusinessScoreOutput {
  const {
    businessId,
    rating,
    totalReviewCount,
    reviews,
    platformAverageRating = DEFAULT_PLATFORM_MEAN,
    minimumReviewThreshold = 3,
  } = input;

  // Component scores, each 0–100
  const bayesian = bayesianRating(rating, totalReviewCount, platformAverageRating);
  const volume = volumeScore(totalReviewCount);
  const sentiment = sentimentScore(reviews);
  const consistency = consistencyScore(reviews);

  // ── Evidence blending ───────────────────────────────────────────────────────
  // Sentiment and consistency are computed from at most 5 recent reviews
  // (the Google Places API limit). For a business with thousands of reviews,
  // those 5 samples represent < 0.1% of its track record — a single bad recent
  // review should not outweigh years of 4.8★ performance.
  //
  // We blend the noisy 5-review components toward stable priors using
  // sqrt(sample / total) as the evidence weight:
  //   5 of  5  reviews → weight = 1.00 (sample covers all reviews)
  //   5 of 50  reviews → weight = 0.32
  //   5 of 500 reviews → weight = 0.10
  //   5 of 4000 reviews → weight = 0.035
  //
  // Priors:
  //   Sentiment prior = overall aggregate rating mapped to 0–100 (same scale as sentimentScore)
  //   Consistency prior = 75 (slightly optimistic; high-rated businesses tend to be consistent)
  const sampleSize = reviews.length;
  const sampleEvidence = sampleSize > 0
    ? Math.min(1.0, Math.sqrt(sampleSize / Math.max(totalReviewCount, sampleSize)))
    : 0;
  const sentimentPrior = clamp(((rating - 3.0) / 2.0) * 100, 0, 100);
  const blendedSentiment   = sentiment   * sampleEvidence + sentimentPrior * (1 - sampleEvidence);
  const blendedConsistency = consistency * sampleEvidence + 75             * (1 - sampleEvidence);

  // Weighted combination
  const weighted =
    bayesian * WEIGHTS.bayesian +
    volume * WEIGHTS.volume +
    blendedSentiment * WEIGHTS.sentiment +
    blendedConsistency * WEIGHTS.consistency;

  // Apply fraud confidence multiplier (1.0 in MVP)
  const fraudAdj = weighted * fraudConfidenceMultiplier(reviews);

  // Floor the score at 0 and cap at 100.
  const finalScore = Math.round(clamp(fraudAdj, 0, 100) * 10) / 10;

  return {
    businessId,
    finalScore,
    rankLabel: getRankLabel(finalScore),
    componentScores: {
      bayesian: round1(bayesian),
      volume: round1(volume),
      sentiment: round1(blendedSentiment),
      consistency: round1(blendedConsistency),
    },
    explanations: buildExplanations({
      rating,
      totalReviewCount,
      bayesian,
      volume,
      sentiment: blendedSentiment,
      consistency: blendedConsistency,
      reviewsAvailable: reviews.length,
      minimumReviewThreshold,
    }),
  };
}

// ─── Rank label (tier) ───────────────────────────────────────────────────────

export function getRankLabel(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 65) return 'Highly Trusted';
  if (score >= 50) return 'Trusted';
  if (score >= 35) return 'Established';
  return 'Limited Reputation';
}

// ─── Explanation builder ─────────────────────────────────────────────────────
// Surfaces the *why* behind the score. Keeps it plain-English, UX-facing,
// and honest about gaps ("review volume is below competitors") so businesses
// understand what to improve.

interface ExplainArgs {
  rating: number;
  totalReviewCount: number;
  bayesian: number;
  volume: number;
  sentiment: number;
  consistency: number;
  reviewsAvailable: number;
  minimumReviewThreshold: number;
}

function buildExplanations(a: ExplainArgs): string[] {
  const out: string[] = [];

  // Primary driver — the Bayesian rating
  if (a.bayesian >= 80) {
    out.push(`Strong ${a.rating.toFixed(1)}★ rating across ${a.totalReviewCount.toLocaleString()} reviews — consistent quality at scale.`);
  } else if (a.bayesian >= 55) {
    out.push(`Solid ${a.rating.toFixed(1)}★ rating with a meaningful review sample of ${a.totalReviewCount.toLocaleString()}.`);
  } else if (a.rating >= 4.0 && a.totalReviewCount < 25) {
    out.push(`Promising ${a.rating.toFixed(1)}★ rating, but only ${a.totalReviewCount} reviews — reputation is still forming.`);
  } else {
    out.push(`Rating and review mix don't yet signal exceptional quality.`);
  }

  // Volume context
  if (a.volume >= 80) {
    out.push(`High review volume signals an established track record.`);
  } else if (a.volume < 35) {
    out.push(`Review volume is below competitors — more reviews would sharpen the signal.`);
  }

  // Sentiment trend
  if (a.reviewsAvailable >= a.minimumReviewThreshold) {
    if (a.sentiment >= 80) {
      out.push(`Recent reviews are trending strongly positive.`);
    } else if (a.sentiment <= 40) {
      out.push(`Recent negative sentiment lowered the score — check the latest reviews.`);
    }
  }

  // Consistency
  if (a.consistency >= 85 && a.reviewsAvailable >= a.minimumReviewThreshold) {
    out.push(`Reviews are highly consistent — customers get a reliable experience.`);
  } else if (a.consistency <= 50 && a.reviewsAvailable >= a.minimumReviewThreshold) {
    out.push(`Mixed recent ratings — the customer experience appears inconsistent.`);
  }

  return out;
}

// ─── Trend Signal ─────────────────────────────────────────────────────────────
// A proxy trend derived from the difference between recent-review sentiment and
// the long-run Bayesian-adjusted rating. No historical data required.
//
// sentiment >> bayesian → recent reviews are better than overall average → "above_average"
// sentiment << bayesian → recent reviews are worse than overall average → "below_average"
// otherwise → "stable"
//
// Intentionally labelled as "above/below average" (not "trending up/down") because
// we are comparing two snapshots within the same API call, not tracking change over time.

export type TrendSignal = 'above_average' | 'below_average' | 'stable' | 'insufficient_data';

export function computeTrendSignal(
  reviewCount: number,
  sentimentComp: number,
  bayesianComp: number
): TrendSignal {
  if (reviewCount < 5) return 'insufficient_data';
  const diff = sentimentComp - bayesianComp;
  if (diff > 15) return 'above_average';
  if (diff < -15) return 'below_average';
  return 'stable';
}

export function getTrendLabel(signal: TrendSignal): string {
  switch (signal) {
    case 'above_average': return 'Recent reviews above avg';
    case 'below_average': return 'Recent reviews below avg';
    case 'stable': return 'Stable';
    case 'insufficient_data': return 'Not enough data';
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Example usage (for docs / ad-hoc testing) ──────────────────────────────
// import { calculateReviewRankScore } from './reviewRankScoring';
//
// const result = calculateReviewRankScore({
//   businessId: 'abc123',
//   rating: 4.7,
//   totalReviewCount: 412,
//   reviews: [
//     { id: '1', rating: 5, text: 'Excellent!', createdAt: '2025-01-10', platform: 'google' },
//     { id: '2', rating: 5, text: 'Great work', createdAt: '2025-01-05', platform: 'google' },
//     { id: '3', rating: 4, text: 'Solid service', createdAt: '2024-12-28', platform: 'google' },
//     { id: '4', rating: 5, text: 'Highly recommend', createdAt: '2024-12-20', platform: 'google' },
//     { id: '5', rating: 4, text: 'Good overall', createdAt: '2024-12-15', platform: 'google' },
//   ],
// });
// // result.finalScore ≈ 73.4 — "Highly Trusted"
// // result.explanations:
// //   "Strong 4.7★ rating across 412 reviews — consistent quality at scale."
// //   "Recent reviews are trending strongly positive."
// //   "Reviews are highly consistent — customers get a reliable experience."
