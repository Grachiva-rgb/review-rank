import { SEO_CATEGORIES, SEO_CITIES } from './seo';
import { buildSearchCacheKey, SEO_SEARCH_CACHE_TTL_MS } from './places';
import { isSupabaseConfigured, sbSelect } from './supabase';

export const SEO_STATIC_PARAMS_BATCH_SIZE = 40;
export const SEO_STATIC_BUILD_SAFETY_MARGIN_MS = 2 * 60 * 60 * 1000;

export interface SeoStaticParam {
  category: string;
  city: string;
}

interface CacheKeyRow {
  cache_key: string;
}

/**
 * Return only SEO routes with a fresh persistent search-cache entry.
 *
 * This is metadata-only and deliberately bounded: a cold/misconfigured cache
 * yields no build-time prerenders, leaving the routes available for on-demand
 * rendering and ISR rather than triggering paid Google searches at build time.
 */
export async function getFreshSeoStaticParams(
  now = Date.now()
): Promise<SeoStaticParam[]> {
  if (!isSupabaseConfigured()) return [];

  const candidates = SEO_CATEGORIES.flatMap((category) =>
    SEO_CITIES.map((city) => ({
      param: { category: category.slug, city: city.slug },
      cacheKey: buildSearchCacheKey(`${category.searchQuery} in ${city.searchName}`),
    }))
  );
  const cutoff = new Date(
    now - SEO_SEARCH_CACHE_TTL_MS + SEO_STATIC_BUILD_SAFETY_MARGIN_MS
  ).toISOString();
  const freshKeys = new Set<string>();

  try {
    for (let offset = 0; offset < candidates.length; offset += SEO_STATIC_PARAMS_BATCH_SIZE) {
      const batch = candidates.slice(offset, offset + SEO_STATIC_PARAMS_BATCH_SIZE);
      const quotedKeys = batch.map(({ cacheKey }) =>
        `"${cacheKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      ).join(',');
      const query =
        `cache_key=in.${encodeURIComponent(`(${quotedKeys})`)}` +
        `&created_at=gte.${encodeURIComponent(cutoff)}` +
        '&results=not.is.null&select=cache_key' +
        `&limit=${batch.length}`;
      const rows = await sbSelect<CacheKeyRow>('search_cache', query);
      const batchKeys = new Set(batch.map(({ cacheKey }) => cacheKey));
      for (const row of rows) {
        if (batchKeys.has(row.cache_key)) freshKeys.add(row.cache_key);
      }
    }
  } catch {
    // Never turn a metadata outage into a paid cold prerender or partial list.
    return [];
  }

  return candidates
    .filter(({ cacheKey }) => freshKeys.has(cacheKey))
    .map(({ param }) => param);
}
