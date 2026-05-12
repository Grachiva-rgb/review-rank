import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { jsonLd } from '@/lib/jsonLd';
import Link from 'next/link';
import { searchPlaces } from '@/lib/places';
import { SEO_CATEGORIES, SEO_CITIES, getCategoryBySlug, getCityBySlug } from '@/lib/seo';
import NavLogo from '@/components/NavLogo';
import BusinessCard from '@/components/BusinessCard';
import CompareBar from '@/components/CompareBar';
import NearMeSearch from '@/components/NearMeSearch';

// Revalidate each page once per day (ISR)
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ category: string; city: string }>;
}

export async function generateStaticParams() {
  return SEO_CATEGORIES.flatMap((cat) =>
    SEO_CITIES.map((city) => ({ category: cat.slug, city: city.slug }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: catSlug, city: citySlug } = await params;
  const cat = getCategoryBySlug(catSlug);
  const city = getCityBySlug(citySlug);
  if (!cat || !city) return {};

  const title = `Best ${cat.plural} in ${city.display}`;
  const description = `Find the most trusted ${cat.plural.toLowerCase()} in ${city.display}. ${cat.description} Rankings based on review quality, volume, and consistency — no paid placements.`;

  return {
    title,
    description,
    openGraph: { title: `${title} | ReviewRank`, description },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://reviewrank.app'}/${catSlug}/${citySlug}`,
    },
  };
}

export default async function CategoryCityPage({ params }: PageProps) {
  const { category: catSlug, city: citySlug } = await params;
  const cat = getCategoryBySlug(catSlug);
  const city = getCityBySlug(citySlug);

  if (!cat || !city) notFound();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://reviewrank.app';

  let places: Awaited<ReturnType<typeof searchPlaces>> = [];
  let fetchError = false;

  try {
    places = await searchPlaces(`${cat.searchQuery} in ${city.searchName}`);
    places.sort((a, b) => b.review_rank_score - a.review_rank_score);
  } catch {
    fetchError = true;
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',             item: siteUrl },
      { '@type': 'ListItem', position: 2, name: cat.plural,         item: `${siteUrl}/${catSlug}` },
      { '@type': 'ListItem', position: 3, name: city.display,       item: `${siteUrl}/${catSlug}/${citySlug}` },
    ],
  };

  const itemListJsonLd = places.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Best ${cat.plural} in ${city.display}`,
        numberOfItems: places.length,
        itemListElement: places.slice(0, 10).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.name,
          item: {
            '@type': 'LocalBusiness',
            name: p.name,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: p.rating,
              reviewCount: p.user_ratings_total,
              bestRating: 5,
              worstRating: 1,
            },
          },
        })),
      }
    : null;

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd) }}
        />
      )}

      {/* Nav */}
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/"><NavLogo size="sm" /></Link>
          <span className="text-[#D9CEC8]">/</span>
          <Link href="/" className="text-[#7A6B63] hover:text-[#241C15] text-sm transition-colors">
            Home
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Near-me CTA — lets users search their actual location when not in this city */}
        <NearMeSearch
          categoryPlural={cat.plural}
          categorySlug={cat.slug}
          currentCity={city.display}
        />

        {/* Header */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[#9A8C85] mb-4 font-mono">
            <Link href="/" className="hover:text-[#8B5E3C]">ReviewRank</Link>
            <span>/</span>
            <span className="text-[#5A4A3F]">{cat.plural}</span>
            <span>/</span>
            <span className="text-[#5A4A3F]">{city.display}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl text-[#241C15] leading-tight mb-3">
            Best <span className="text-[#8B5E3C]">{cat.plural}</span>
            <br />in {city.display}
          </h1>
          <p className="text-[#5A4A3F] text-base sm:text-lg max-w-2xl leading-relaxed">
            {cat.description} Ranked by the ReviewRank Score — a measure of review quality,
            volume, and consistency. <strong>No paid placements.</strong>
          </p>

          {/* Trust callout */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#2F6F4E]/20 bg-[#2F6F4E]/5 px-4 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F6F4E] flex-shrink-0" />
            <span className="text-xs text-[#2F6F4E]">
              Rankings based on public review signals only — businesses cannot pay to rank higher
            </span>
          </div>
        </div>

        {/* Results */}
        {fetchError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-red-700 font-medium mb-1">Could not load rankings</p>
            <p className="text-[#7A6B63] text-sm">Please try again or search directly.</p>
            <Link
              href={`/results?category=${encodeURIComponent(cat.searchQuery)}&location=${encodeURIComponent(city.display)}`}
              className="inline-block mt-4 text-sm text-[#8B5E3C] hover:text-[#6B4A2F]"
            >
              Try a live search →
            </Link>
          </div>
        ) : places.length === 0 ? (
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-12 text-center shadow-sm">
            <p className="text-[#241C15] text-lg mb-1">No results found</p>
            <p className="text-[#7A6B63] text-sm">Try a different city or category.</p>
            <Link
              href="/"
              className="inline-block mt-4 text-sm text-[#8B5E3C] hover:text-[#6B4A2F]"
            >
              ← New search
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {places.map((place, index) => (
              <BusinessCard
                key={place.place_id}
                place={place}
                rank={index + 1}
                category={cat.businessCategory}
              />
            ))}
          </div>
        )}
        <CompareBar />

        {/* How we rank callout */}
        <div className="mt-12 rounded-2xl border border-[#EDE8E3] bg-white p-6">
          <h2 className="font-display text-xl text-[#241C15] mb-2">How we rank {cat.plural.toLowerCase()}</h2>
          <p className="text-sm text-[#5A4A3F] leading-relaxed mb-3">
            The ReviewRank Score combines star rating with review volume into a single trust score.
            A 4.7★ business with 800 reviews ranks higher than a 5.0★ business with 4 reviews —
            because volume gives us confidence the rating is real.
          </p>
          <Link href="/methodology" className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F]">
            Read the full methodology →
          </Link>
        </div>

        {/* Explore other cities / categories */}
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-5">
            <h3 className="font-display text-base text-[#241C15] mb-3">
              {cat.plural} in other cities
            </h3>
            <div className="flex flex-wrap gap-2">
              {SEO_CITIES.filter((c) => c.slug !== citySlug).slice(0, 6).map((c) => (
                <Link
                  key={c.slug}
                  href={`/${catSlug}/${c.slug}`}
                  className="text-xs rounded-full border border-[#D9CEC8] px-3 py-1.5 text-[#5A4A3F] hover:border-[#8B5E3C] hover:text-[#8B5E3C] transition-colors"
                >
                  {c.display}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-5">
            <h3 className="font-display text-base text-[#241C15] mb-3">
              Other services in {city.display}
            </h3>
            <div className="flex flex-wrap gap-2">
              {SEO_CATEGORIES.filter((c) => c.slug !== catSlug).slice(0, 6).map((c) => (
                <Link
                  key={c.slug}
                  href={`/${c.slug}/${citySlug}`}
                  className="text-xs rounded-full border border-[#D9CEC8] px-3 py-1.5 text-[#5A4A3F] hover:border-[#8B5E3C] hover:text-[#8B5E3C] transition-colors"
                >
                  {c.plural}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Search CTA */}
        <div className="mt-8 rounded-2xl border border-[#EDE8E3] bg-[#FAF7F0] p-6 text-center">
          <p className="text-[#241C15] font-display text-lg mb-1">
            Not seeing what you need?
          </p>
          <p className="text-sm text-[#7A6B63] mb-4">
            Search any category or city for live, up-to-date rankings.
          </p>
          <Link
            href={`/results?category=${encodeURIComponent(cat.searchQuery)}&location=${encodeURIComponent(city.display)}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#8B5E3C] px-6 py-2.5 text-sm text-white hover:bg-[#6B4A2F] transition-colors"
          >
            Search {cat.plural} in {city.display} →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EDE8E3] mt-16 px-4 py-8 text-center bg-white/50">
        <p className="text-xs text-[#9A8C85]">
          Powered by Google Places · Rankings are objective and based on public review signals only ·{' '}
          <Link href="/methodology" className="hover:text-[#8B5E3C]">How it works</Link>
        </p>
      </footer>
    </div>
  );
}
