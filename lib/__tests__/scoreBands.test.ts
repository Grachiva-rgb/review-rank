import { describe, it, expect } from 'vitest';
import { getScoreBand, isRisingStar } from '../scoreBands';

describe('getScoreBand — the single band map', () => {
  it.each([
    [100, 'Elite'],
    [80, 'Elite'],
    [79.9, 'Highly Trusted'],
    [65, 'Highly Trusted'],
    [64.9, 'Trusted'],
    [50, 'Trusted'],
    [49.9, 'Established'],
    [35, 'Established'],
    [34.9, 'Limited Reputation'],
    [0, 'Limited Reputation'],
  ])('score %s → %s', (score, label) => {
    expect(getScoreBand(score as number).label).toBe(label);
  });
});

describe('isRisingStar — one definition for sort, badge, callout, and copy', () => {
  it('requires BOTH the rating gate and the review-count gate', () => {
    expect(isRisingStar(4.7, 299)).toBe(true);
    expect(isRisingStar(4.69, 299)).toBe(false); // rating gate
    expect(isRisingStar(4.7, 300)).toBe(false); // count gate (strict <300)
    expect(isRisingStar(5.0, 1)).toBe(true);
  });
});
