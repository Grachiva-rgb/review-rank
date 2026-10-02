/**
 * score-explain — print the complete ReviewRank Score calculation ladder for
 * arbitrary inputs, using the PRODUCTION scoring code (no reimplementation).
 *
 * Usage:
 *   npm run score -- <rating> <reviewCount> [sampleRatings]
 *   npm run score -- 4.7 412 5,5,4,5,5
 *   npm run score -- 4.9 18
 *
 * Use this to verify any business's score in seconds, reproduce the
 * methodology page's worked example, or debug a reported discrepancy.
 */
import {
  calculateReviewRankScore,
  bayesianRating,
  volumeScore,
  sentimentScore,
  consistencyScore,
  BusinessReview,
} from '../lib/reviewRankScoring';
import { getScoreBand } from '../lib/scoreBands';
import { getTrustTierFromRRS, getTrustTierLabel } from '../lib/ranking';

const [ratingArg, countArg, sampleArg] = process.argv.slice(2);

if (!ratingArg || !countArg) {
  console.error('Usage: npm run score -- <rating> <reviewCount> [sampleRatings e.g. 5,5,4,5,5]');
  process.exit(1);
}

const rating = Number(ratingArg);
const reviewCount = Number(countArg);
const sample = sampleArg ? sampleArg.split(',').map(Number) : [];

if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
  console.error(`Invalid rating "${ratingArg}" — expected 0–5.`);
  process.exit(1);
}
if (!Number.isInteger(reviewCount) || reviewCount < 0) {
  console.error(`Invalid review count "${countArg}" — expected a non-negative integer.`);
  process.exit(1);
}
if (sample.some((r) => !Number.isFinite(r) || r < 0 || r > 5)) {
  console.error(`Invalid sample ratings "${sampleArg}" — expected comma-separated 0–5 values.`);
  process.exit(1);
}

const reviews: BusinessReview[] = sample.map((r, i) => ({
  id: String(i),
  rating: r,
  text: '',
  createdAt: new Date().toISOString(),
  platform: 'google' as const,
}));

const result = calculateReviewRankScore({
  businessId: 'cli',
  rating,
  totalReviewCount: reviewCount,
  reviews,
});

const rawBayes = bayesianRating(rating, reviewCount);
const rawSentiment = sentimentScore(reviews);
const rawConsistency = consistencyScore(reviews);
const evidence = sample.length > 0
  ? Math.min(1, Math.sqrt(sample.length / Math.max(reviewCount, sample.length)))
  : 0;
const tier = getTrustTierFromRRS(result.finalScore, rating, reviewCount);

const f = (n: number) => n.toFixed(2).padStart(7);

console.log(`
Observed rating        ${f(rating)}  (${reviewCount.toLocaleString()} reviews)
Sample ratings         ${sample.length ? sample.join(', ') : '(none)'}

Bayesian rating        ${f(rawBayes)}  → 0–100: ${f(result.componentScores.bayesian)}   × 55%
Volume score                      → 0–100: ${f(result.componentScores.volume)}   × 20%
Sentiment (raw)        ${f(rawSentiment)}
Consistency (raw)      ${f(rawConsistency)}
Evidence weight        ${f(evidence)}  = min(1, √(${sample.length}/${Math.max(reviewCount, sample.length)}))
Sentiment (blended)               → 0–100: ${f(result.componentScores.sentiment)}   × 15%
Consistency (blended)             → 0–100: ${f(result.componentScores.consistency)}   × 10%

Final ReviewRank Score ${String(result.finalScore).padStart(7)} / 100
Band label             ${getScoreBand(result.finalScore).label}
Tier badge             ${getTrustTierLabel(tier) || '(none — gates not met)'}

Explanations:
${result.explanations.map((e) => `  · ${e}`).join('\n')}
`);
