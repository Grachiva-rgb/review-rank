/**
 * Cross-layer contract: the search (card) path and the detail path must
 * produce IDENTICAL scores, labels, and confidence for the same underlying
 * business data. Both must delegate to calculateReviewRankScore — this suite
 * fails if a presentation layer ever grows its own scoring logic or the two
 * data mappers drift.
 *
 * Google's fetch is stubbed; Supabase is unconfigured in the test env, so
 * caches, enrichment, and TA lookups all take their documented fallback
 * paths (empty sample on both sides → true apples-to-apples parity).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPlaces, getPlaceDetails } from '../places';
import { calculateReviewRankScore } from '../reviewRankScoring';
import { getScoreBand, getConfidence } from '../scoreBands';

const BIZ = {
  id: 'ChIJtest000000000000000000',
  displayName: { text: 'Contract Test Plumbing' },
  formattedAddress: '1 Test St, Testville, OH 44236, USA',
  location: { latitude: 41.0, longitude: -81.0 },
  rating: 4.6,
  userRatingCount: 212,
};

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
  // Supabase deliberately unconfigured → cache reads/writes and sample
  // enrichment no-op, matching both paths' documented fallback behavior.
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes(':searchText')) return jsonResponse({ places: [BIZ] });
    if (u.includes('/places/')) return jsonResponse({ ...BIZ, reviews: [] });
    throw new Error(`unexpected fetch in contract test: ${u}`);
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('card path and detail path agree', () => {
  it('score, band label, and confidence are identical for the same business', async () => {
    const [card] = await searchPlaces('plumbers in testville');
    const detail = await getPlaceDetails(BIZ.id);

    expect(card.review_rank_score).toBe(detail.review_rank_score);
    expect(card.rank_label).toBe(detail.rank_label);
    expect(card.confidence).toBe(detail.confidence);
    expect(card.score_components).toEqual(detail.score_components);
  });

  it('both equal the canonical scorer output — no presentation-layer math', async () => {
    const canonical = calculateReviewRankScore({
      businessId: BIZ.id,
      rating: BIZ.rating,
      totalReviewCount: BIZ.userRatingCount,
      reviews: [],
    });
    const [card] = await searchPlaces('plumbers in testville');

    expect(card.review_rank_score).toBe(canonical.finalScore);
    expect(card.rank_label).toBe(canonical.rankLabel);
    expect(card.rank_label).toBe(getScoreBand(canonical.finalScore).label);
    expect(card.confidence).toBe(getConfidence(BIZ.userRatingCount, 0).label);
  });
});
