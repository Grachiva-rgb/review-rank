/**
 * Star rendering must map rating → filled stars exactly (the external review
 * reported a "1.0 renders five stars" sighting; current code is correct, and
 * this suite keeps it that way). Rendered with react-dom/server so no DOM
 * environment is needed.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StarRating from '../StarRating';

const GOLD = 'text-[#F4B400]"'; // full star (trailing quote excludes the /50 half-star class)
const HALF = 'text-[#F4B400]/50';
const GREY = 'text-[#DDD3CB]';

function stars(rating: number) {
  const html = renderToStaticMarkup(<StarRating rating={rating} />);
  return {
    full: html.split(GOLD).length - 1,
    half: html.split(HALF).length - 1,
    grey: html.split(GREY).length - 1,
    html,
  };
}

describe('StarRating fill mapping', () => {
  it.each([
    [1.0, 1, 0, 4],
    [2.0, 2, 0, 3],
    [3.0, 3, 0, 2],
    [4.0, 4, 0, 1],
    [5.0, 5, 0, 0],
  ])('rating %s → %s full / %s half / %s grey', (rating, full, half, grey) => {
    const s = stars(rating as number);
    expect(s.full).toBe(full);
    expect(s.half).toBe(half);
    expect(s.grey).toBe(grey);
  });

  it('renders half stars for .5 ratings', () => {
    const s = stars(4.5);
    expect(s.full).toBe(4);
    expect(s.half).toBe(1);
    expect(s.grey).toBe(0);
  });
});

describe('StarRating fails safely on invalid input', () => {
  it('0 → all grey', () => {
    expect(stars(0)).toMatchObject({ full: 0, half: 0, grey: 5 });
  });

  it('NaN → all grey (never five decorative gold stars)', () => {
    expect(stars(NaN)).toMatchObject({ full: 0, half: 0, grey: 5 });
  });

  it('below 1 → fractional handling never exceeds the value', () => {
    expect(stars(0.4)).toMatchObject({ full: 0 });
    expect(stars(-3)).toMatchObject({ full: 0, half: 0, grey: 5 });
  });

  it('above 5 (e.g. a 0–100 score passed by mistake) caps at 5 stars', () => {
    expect(stars(87)).toMatchObject({ full: 5 });
    const label = stars(87).html.match(/aria-label="([^"]+)"/)?.[1];
    expect(label).toBe('5 out of 5 stars');
  });
});
