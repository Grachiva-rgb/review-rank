import type { Metadata } from 'next';
import { getPlaceDetails } from '@/lib/places';
import Link from 'next/link';
import StarRating from '@/components/StarRating';
import SmartScoreBadge from '@/components/SmartScoreBadge';
import BackButton from '@/components/BackButton';
import NavLogo from '@/components/NavLogo';
import ClientTracker from '@/components/ClientTracker';
import SaveButton from '@/components/SaveButton';
import {
  detectCategory,
  getTrustTierFromRRS,
  getTrustTierLabel,
  getTrustTierStyle,
  getBusinessInsights,
} from '@/lib/ranking';

interface BusinessPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cat?: string }>;
}

const PLACE_ID_RE_META = /^[A-Za-z0-9_-]{10,100}$/;

export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  const { id } = await params;
  if (!id || !PLACE_ID_RE_META.test(id)) return {};
  try {
    const place = await getPlaceDetails(id);
    const score = Math.round(place.review_rank_score);
    return {
      title: `${place.name} — Review Rank Score & Trust Analysis`,
      description: `${place.name} has a Review Rank Score of ${score}/100 based on ${place.user_ratings_total.toLocaleString()} reviews. See full trust analysis, ratings, and customer feedback.`,
      openGraph: {
        title: `${place.name} | ReviewRank`,
        description: `Rated ${place.rating}★ across ${place.user_ratings_total.toLocaleString()} reviews. Review Rank Score: ${score}/100.`,
      },
    };
  } catch {
    return {};
  }
}

const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch { /* malformed URL */ }
  return undefined;
}

function PriceLevel({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span className="font-mono text-sm" title={`Price level: ${level}/4`}>
      <span className="text-[#8B5E3C]">{'$'.repeat(level)}</span>
      <span className="text-[#DDD3CB]">{'$'.repeat(4 - level)}</span>
    </span>
  );
}

export default async function BusinessPage({ params, searchParams }: BusinessPageProps) {
  const { id } = await params;
  const { cat } = await searchParams;

  if (!id || !PLACE_ID_RE.test(id)) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium mb-1">Business not found</p>
          <Link href="/" className="text-[#8B5E3C] hover:text-[#6B4A2F] text-sm">← Back to search</Link>
        </div>
      </div>
    );
  }

  let place = null;
  let errorOccurred = false;

  try {
    place = await getPlaceDetails(id);
  } catch (err) {
    console.error('[BusinessPage] getPlaceDetails error:', err);
    errorOccurred = true;
  }

  if (errorOccurred || !place) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium mb-1">Could not load this business</p>
          <p className="text-[#7A6B63] text-sm mb-4">Please try again or search for another business.</p>
          <Link href="/" className="text-[#8B5E3C] hover:text-[#6B4A2F] text-sm">← Back to search</Link>
        </div>
      </div>
    );
  }

  const mapsUrl =
    safeUrl(place.url) ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;
  const websiteUrl = safeUrl(place.website);

  // Detect category from the search query that led here (passed as ?cat=)
  const category = detectCategory(cat || '');
  const tier = getTrustTierFromRRS(place.review_rank_score, place.rating, place.user_ratings_total);
  const tierLabel = getTrustTierLabel(tier);
  const tierStyle = getTrustTierStyle(tier);
  const insights = getBusinessInsights(place.rating, place.user_ratings_total, category);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://reviewrank.app';

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: place.name,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: place.rating,
      reviewCount: place.user_ratings_total,
      bestRating: 5,
      worstRating: 1,
    },
    address: place.formatted_address
      ? { '@type': 'PostalAddress', streetAddress: place.formatted_address }
      : undefined,
    telephone: place.formatted_phone_number || undefined,
    url: websiteUrl || mapsUrl,
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Results', item: `${siteUrl}/results` },
      { '@type': 'ListItem', position: 3, name: place.name, item: `${siteUrl}/business/${place.place_id}` },
    ],
  };

  return (
    <div className="relative min-h-screen bg-[#FAF7F0]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ClientTracker
        event="business_viewed"
        placeId={place.place_id}
        score={place.review_rank_score}
        tier={tier || 'none'}
      />
      <div className="relative z-10">
        {/* Nav */}
        <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Link href="/"><NavLogo size="sm" /></Link>
            <span className="text-[#D9CEC8]">/</span>
            <BackButton />
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-4 py-10">
          {/* Header — stacks on mobile, side-by-side on sm+ */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="font-display text-3xl sm:text-4xl text-[#241C15] leading-tight">
                  {place.name}
                </h1>
                {tier && (
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${tierStyle}`}
                  >
                    {tier === 'highly_trusted' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2F6F4E]" />
                    )}
                    {tierLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap mb-3">
                <StarRating rating={place.rating} size="lg" />
                <span className="font-mono text-xl text-[#241C15]">{place.rating.toFixed(1)}</span>
                <span className="text-[#7A6B63] text-sm">
                  ({place.user_ratings_total.toLocaleString()} reviews)
                </span>
                <PriceLevel level={place.price_level} />
              </div>

              {place.opening_hours && (
                <span
                  className={`text-sm inline-flex items-center gap-1.5 ${
                    place.opening_hours.open_now ? 'text-[#2F6F4E]' : 'text-[#7A6B63]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      place.opening_hours.open_now ? 'bg-[#2F6F4E]' : 'bg-[#D9CEC8]'
                    }`}
                  />
                  {place.opening_hours.open_now ? 'Open now' : 'Currently closed'}
                </span>
              )}
            </div>

            <div className="sm:flex-shrink-0 flex flex-col items-center gap-3">
              <SmartScoreBadge score={place.review_rank_score} size="lg" />
              <SaveButton
                business={{
                  placeId: place.place_id,
                  name: place.name,
                  rating: place.rating,
                  reviewCount: place.user_ratings_total,
                  score: place.review_rank_score,
                  address: place.formatted_address ?? '',
                  category: cat ?? '',
                }}
              />
            </div>
          </div>

          {/* Quick Trust Summary */}
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-5 mb-6 shadow-sm">
            <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-3">
              Quick Trust Summary
            </div>
            <p className="text-sm text-[#241C15] leading-relaxed font-medium">
              {insights.trustSummary}
            </p>
            <p className="text-xs text-[#7A6B63] mt-3 leading-relaxed">
              {insights.reliabilitySignal}
            </p>
          </div>

          {/* Info grid */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-[#EDE8E3] bg-white p-4 shadow-sm">
              <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-2">Address</div>
              <p className="text-sm text-[#241C15] leading-relaxed">{place.formatted_address}</p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#8B5E3C] hover:text-[#6B4A2F] mt-2 inline-flex items-center min-h-[44px] transition-colors"
              >
                Open in Google Maps ↗
              </a>
            </div>

            <div className="rounded-2xl border border-[#EDE8E3] bg-white p-4 shadow-sm">
              <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-2">Contact</div>
              {place.formatted_phone_number ? (
                <a
                  href={`tel:${place.formatted_phone_number}`}
                  className="text-sm text-[#241C15] hover:text-[#8B5E3C] transition-colors inline-flex items-center min-h-[44px] mb-1"
                >
                  {place.formatted_phone_number}
                </a>
              ) : (
                <p className="text-sm text-[#7A6B63] mb-2">No phone listed</p>
              )}
              {websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#8B5E3C] hover:text-[#6B4A2F] transition-colors inline-flex items-center min-h-[44px]"
                >
                  Visit website ↗
                </a>
              ) : (
                <span className="text-xs text-[#D9CEC8]">No website listed</span>
              )}
            </div>
          </div>

          {/* Hours */}
          {place.opening_hours && (
            <div className="rounded-2xl border border-[#EDE8E3] bg-white p-4 mb-6 shadow-sm">
              <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-3">Hours</div>
              {place.opening_hours.weekday_text && place.opening_hours.weekday_text.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-1">
                  {place.opening_hours.weekday_text.map((line, i) => (
                    <p key={i} className="text-xs text-[#5A4A3F] font-mono">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#7A6B63]">
                  Hours not available — check{' '}
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#8B5E3C]">
                    Google Maps
                  </a>{' '}
                  for current hours.
                </p>
              )}
            </div>
          )}

          {/* Customer Intelligence — 3-column grid */}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-[#2F6F4E]/20 bg-[#2F6F4E]/5 p-4">
              <div className="text-xs text-[#2F6F4E] uppercase tracking-widest font-mono mb-3">
                What customers praise
              </div>
              <p className="text-sm text-[#241C15] leading-relaxed">{insights.whatCustomersPraise}</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs text-amber-700 uppercase tracking-widest font-mono mb-3">
                Common considerations
              </div>
              <p className="text-sm text-[#241C15] leading-relaxed">{insights.commonConsiderations}</p>
            </div>

            <div className="rounded-2xl border border-[#8B5E3C]/20 bg-[#8B5E3C]/5 p-4">
              <div className="text-xs text-[#8B5E3C] uppercase tracking-widest font-mono mb-3">
                Best for
              </div>
              <p className="text-sm text-[#241C15] leading-relaxed">{insights.bestFor}</p>
            </div>
          </div>

          {/* Smart Score Breakdown */}
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-5 mb-6 shadow-sm">
            <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-4">
              Smart Score Breakdown
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <div className="font-mono text-2xl text-[#8B5E3C]">{place.rating.toFixed(1)}</div>
                <div className="text-xs text-[#7A6B63] mt-0.5">Rating</div>
              </div>
              <span className="text-[#D9CEC8] text-xl font-mono">×</span>
              <div className="text-center">
                <div className="font-mono text-lg text-[#241C15]">
                  log₁₀({place.user_ratings_total.toLocaleString()}+1)
                </div>
                <div className="text-xs text-[#7A6B63] mt-0.5">Review volume</div>
              </div>
              <span className="text-[#D9CEC8] text-xl font-mono">=</span>
              <div className="text-center">
                <div className="font-mono text-2xl text-[#2F6F4E]">
                  {Math.round(place.review_rank_score)}
                  <span className="text-sm opacity-60">/100</span>
                </div>
                <div className="text-xs text-[#7A6B63] mt-0.5">Review Rank Score</div>
              </div>
            </div>
            {place.score_explanations && place.score_explanations.length > 0 && (
              <ul className="text-xs text-[#5A4A3F] mt-4 border-t border-[#EDE8E3] pt-3 space-y-1.5 leading-relaxed">
                {place.score_explanations.map((reason, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[#B8A89F] select-none flex-shrink-0">·</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-[#9A8C85] mt-3 leading-relaxed">
              Review Rank Score (0–100) blends a Bayesian-adjusted rating, review volume,
              recent sentiment, and rating consistency. It's a predictive reputation estimate —
              not a replica of Google or Yelp's ranking.
            </p>
          </div>

          {/* Reviews */}
          {place.reviews && place.reviews.length > 0 ? (
            <div>
              <h2 className="font-display text-2xl text-[#241C15] mb-5">Customer Reviews</h2>
              <div className="space-y-4">
                {place.reviews.slice(0, 5).map((review, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-[#EDE8E3] bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="text-sm font-medium text-[#241C15]">{review.author_name}</span>
                        <span className="text-xs text-[#7A6B63] ml-2">{review.relative_time_description}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <StarRating rating={review.rating} size="sm" />
                        <span className="font-mono text-xs text-[#5A4A3F]">{review.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    {/* review.text is JSX-interpolated — React escapes HTML by default */}
                    <p className="text-sm text-[#5A4A3F] leading-relaxed line-clamp-4">
                      {review.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#EDE8E3] bg-[#FAF7F0] p-6 text-center mb-6">
              <p className="text-sm text-[#7A6B63]">No individual reviews are available for this location.</p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#8B5E3C] hover:text-[#6B4A2F] mt-2 inline-block transition-colors"
              >
                Read reviews on Google Maps ↗
              </a>
            </div>
          )}

          {/* Owner CTA */}
          <div className="rounded-2xl border border-[#EDE8E3] bg-[#FAF7F0] p-5 mb-6 mt-2">
            <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-2">
              Own this business?
            </div>
            <p className="text-sm text-[#5A4A3F] leading-relaxed mb-4">
              See why this business ranks here and how customers describe it. Get a breakdown of your Smart Score and what it would take to reach the next trust tier.
            </p>
            <a
              href={`/report-request?businessId=${encodeURIComponent(place.place_id)}&businessName=${encodeURIComponent(place.name)}`}
              className="block sm:inline-block w-full sm:w-auto text-center rounded-xl bg-[#8B5E3C] hover:bg-[#6B4A2F] text-white text-sm font-semibold px-5 py-3.5 transition-colors min-h-[44px] flex items-center justify-center sm:flex-none"
            >
              Get Ranking Report — $19
            </a>
            <p className="text-xs text-[#9A8C85] mt-3">
              Reports do not affect rankings.
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-[#EDE8E3] text-center space-y-1">
            <p className="text-xs text-[#7A6B63] font-mono">
              Data sourced from Google Places API · ReviewRank Smart Score
            </p>
            <p className="text-xs text-[#9A8C85]">
              Rankings are based on public review signals only. No paid placements.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
