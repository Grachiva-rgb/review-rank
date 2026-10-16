import { afterEach, describe, expect, it, vi } from 'vitest';

const { isSupabaseConfiguredMock, sbSelectMock } = vi.hoisted(() => ({
  isSupabaseConfiguredMock: vi.fn(),
  sbSelectMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock,
  sbSelect: sbSelectMock,
}));

import { getFreshSeoStaticParams, SEO_STATIC_PARAMS_BATCH_SIZE } from '../seoStaticParams';
import { buildSearchCacheKey, SEO_SEARCH_CACHE_TTL_MS } from '../places';
import { SEO_CATEGORIES, SEO_CITIES } from '../seo';
import {
  GoogleApiBudgetError,
  rethrowIfGoogleApiBudgetError,
} from '../googleApiBudgetError';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fresh SEO static params', () => {
  it('selects only cache keys returned from bounded, fresh metadata batches', async () => {
    const now = 1_700_000_000_000;
    const candidates = SEO_CATEGORIES.flatMap((category) =>
      SEO_CITIES.map((city) => ({
        param: { category: category.slug, city: city.slug },
        key: buildSearchCacheKey(`${category.searchQuery} in ${city.searchName}`),
      }))
    );
    const expectedCutoff = new Date(
      now - SEO_SEARCH_CACHE_TTL_MS + 2 * 60 * 60 * 1000
    ).toISOString();
    isSupabaseConfiguredMock.mockReturnValue(true);
    sbSelectMock.mockImplementation(async (_table: string, query: string) => {
      const batchIndex = sbSelectMock.mock.calls.length - 1;
      return batchIndex === 0
        ? [{ cache_key: candidates[0].key }]
        : batchIndex === 1
          ? [{ cache_key: candidates[SEO_STATIC_PARAMS_BATCH_SIZE].key }]
          : [];
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const params = await getFreshSeoStaticParams(now);

    expect(params).toEqual([
      candidates[0].param,
      candidates[SEO_STATIC_PARAMS_BATCH_SIZE].param,
    ]);
    expect(sbSelectMock).toHaveBeenCalledTimes(Math.ceil(candidates.length / SEO_STATIC_PARAMS_BATCH_SIZE));
    for (const [index, [table, query]] of
      (sbSelectMock.mock.calls as unknown as [string, string][]).entries()) {
      expect(table).toBe('search_cache');
      expect(query).toContain('cache_key=in.');
      expect(query).toContain(`created_at=gte.${encodeURIComponent(expectedCutoff)}`);
      expect(query).toContain('results=not.is.null');
      expect(query).toContain('select=cache_key');
      const limit = Number(query.match(/&limit=(\d+)/)?.[1]);
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(SEO_STATIC_PARAMS_BATCH_SIZE);
      const inFilter = decodeURIComponent(query.split('&')[0].replace('cache_key=in.', ''));
      const expectedKeys = candidates
        .slice(index * SEO_STATIC_PARAMS_BATCH_SIZE, (index + 1) * SEO_STATIC_PARAMS_BATCH_SIZE)
        .map(({ key }) => `"${key}"`)
        .join(',');
      expect(inFilter).toBe(`(${expectedKeys})`);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no prerender candidates when Supabase is not configured', async () => {
    isSupabaseConfiguredMock.mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await getFreshSeoStaticParams()).toEqual([]);
    expect(sbSelectMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no candidates when any metadata batch fails', async () => {
    isSupabaseConfiguredMock.mockReturnValue(true);
    sbSelectMock
      .mockResolvedValueOnce([{ cache_key: 'search:first' }])
      .mockRejectedValueOnce(new Error('synthetic metadata failure'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await getFreshSeoStaticParams()).toEqual([]);
    expect(sbSelectMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SEO budget error ISR behavior', () => {
  it('rethrows budget errors while leaving ordinary failures for the page fallback', () => {
    const budgetError = new GoogleApiBudgetError('Google Places daily request limit reached.');
    let thrown: unknown;
    try {
      rethrowIfGoogleApiBudgetError(budgetError);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(budgetError);
    expect(() => rethrowIfGoogleApiBudgetError(new Error('ordinary search failure'))).not.toThrow();
  });
});
