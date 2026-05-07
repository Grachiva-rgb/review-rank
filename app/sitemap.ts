import type { MetadataRoute } from 'next';
import { SEO_CATEGORIES, SEO_CITIES } from '@/lib/seo';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://reviewrank.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,                   lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/methodology`,  lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/partner`,      lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const categoryPages: MetadataRoute.Sitemap = SEO_CATEGORIES.flatMap((cat) =>
    SEO_CITIES.map((city) => ({
      url: `${SITE_URL}/${cat.slug}/${city.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  return [...staticPages, ...categoryPages];
}
