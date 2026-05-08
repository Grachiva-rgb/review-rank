import Link from 'next/link';
import { Place } from '@/lib/types';
import { BusinessCategory, getTrustTierFromRRS, getTrustTierLabel, getTrustTierStyle, getRankingExplanation } from '@/lib/ranking';
import StarRating from './StarRating';
import SmartScoreBadge from './SmartScoreBadge';
import QuoteButton from './QuoteButton';
import SaveButton from './SaveButton';
import CompareButton from './CompareButton';
import TrendBadge from './TrendBadge';

interface BusinessCardProps {
  place: Place;
  rank: number;
  category?: BusinessCategory;
}

const RANK_COLORS: Record<number, string> = {
  1: 'text-[#8B5E3C]',
  2: 'text-[#8A8A8A]',
  3: 'text-[#B45309]',
};

function PriceLevel({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span className="font-mono text-xs tracking-tight">
      <span className="text-[#8B5E3C]">{'$'.repeat(level)}</span>
      <span className="text-[#D9CEC8]">{'$'.repeat(4 - level)}</span>
    </span>
  );
}

export default function BusinessCard({ place, rank, category = 'general' }: BusinessCardProps) {
  const rankColor = RANK_COLORS[rank] ?? 'text-[#C2C2C2]';
  const tier = getTrustTierFromRRS(place.review_rank_score, place.rating, place.user_ratings_total);
  const tierLabel = getTrustTierLabel(tier);
  const tierStyle = getTrustTierStyle(tier);
  // Prefer the dynamic score-derived explanations (driver-based) if available;
  // fall back to category-generic language for older cached records.
  const explanations = place.score_explanations?.length
    ? place.score_explanations
    : [getRankingExplanation(place.rating, place.user_ratings_total, category)];

  // Flag business as a rising star: high rating, limited review history
  const isRisingStar = place.rating >= 4.7 && place.user_ratings_total < 300;

  const mapsUrl =
    place.url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.name + ' ' + place.formatted_address
    )}&query_place_id=${place.place_id}`;

  const detailHref = `/business/${place.place_id}?cat=${encodeURIComponent(category)}`;

  return (
    <div className="group relative flex gap-5 rounded-2xl border border-[#EDE8E3] bg-white px-5 py-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-[#D9CEC8]">
      {/* Rank numeral */}
      <div className="flex-shrink-0 w-9 pt-0.5 text-right">
        <span className={`font-display text-3xl font-bold leading-none select-none ${rankColor}`}>
          {rank}
        </span>
      </div>

      {/* Divider */}
      <div className="flex-shrink-0 w-px bg-[#EDE8E3] self-stretch" />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Name + tier badge */}
        <div className="flex items-start gap-2 flex-wrap mb-1">
          <Link href={detailHref}>
            <h3 className="font-display text-lg font-semibold leading-snug text-[#241C15] group-hover:text-[#8B5E3C] transition-colors">
              {place.name}
            </h3>
          </Link>
          {tier && (
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest flex-shrink-0 mt-0.5 ${tierStyle}`}
            >
              {tier === 'highly_trusted' && (
                <span className="h-1 w-1 rounded-full bg-[#2F6F4E] opacity-80" />
              )}
              {tierLabel}
            </span>
          )}
          {isRisingStar && !tier && (
            <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 flex-shrink-0 mt-0.5">
              Rising Star
            </span>
          )}
        </div>

        {/* Rating row */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {place.rating > 0 ? (
            <>
              <StarRating rating={place.rating} />
              <span className="text-sm font-medium text-[#241C15]">{place.rating.toFixed(1)}</span>
            </>
          ) : (
            <span className="text-xs text-[#9A8C85]">Not yet rated</span>
          )}
          <span className="text-xs text-[#9A8C85]">
            {place.user_ratings_total > 0
              ? `${place.user_ratings_total.toLocaleString()} reviews`
              : 'No reviews yet'}
          </span>
          <PriceLevel level={place.price_level} />
          {place.opening_hours !== undefined && (
            <span
              className={`text-xs inline-flex items-center gap-1 ${
                place.opening_hours.open_now ? 'text-[#2F6F4E]' : 'text-[#9A8C85]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  place.opening_hours.open_now ? 'bg-[#2F6F4E]' : 'bg-[#D9CEC8]'
                }`}
              />
              {place.opening_hours.open_now ? 'Open now' : 'Closed'}
            </span>
          )}
        </div>

        {/* Address */}
        <p className="text-xs text-[#9A8C85] mt-1.5 truncate">{place.formatted_address}</p>

        {/* Score explanations — driver-based plain-English reasons */}
        <ul className="text-xs text-[#5A4A3F] mt-2.5 leading-relaxed space-y-1">
          {explanations.slice(0, 3).map((reason, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-[#B8A89F] select-none flex-shrink-0">·</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>

        {/* Lead gen CTA — only for eligible service categories with an established trust tier */}
        {tier !== null && (
          <QuoteButton
            businessName={place.name}
            businessId={place.place_id}
            category={category}
          />
        )}

        {/* Links */}
        <div className="flex items-center gap-1 mt-1 -mx-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#9A8C85] hover:text-[#8B5E3C] transition-colors px-2 py-2.5 min-h-[44px] flex items-center"
          >
            View on Maps ↗
          </a>
          <span className="text-[#EDE8E3] select-none">·</span>
          <Link
            href={detailHref}
            className="text-xs text-[#5A4A3F] hover:text-[#241C15] transition-colors px-2 py-2.5 min-h-[44px] flex items-center"
          >
            Full trust analysis →
          </Link>
        </div>
      </div>

      {/* Score + actions */}
      <div className="flex-shrink-0 self-start flex flex-col items-center gap-2 pt-0.5">
        <SmartScoreBadge score={place.review_rank_score} />
        {place.trend_signal && place.trend_signal !== 'insufficient_data' && (
          <TrendBadge signal={place.trend_signal} label={place.trend_label ?? ''} />
        )}
        <SaveButton
          size="sm"
          business={{
            placeId: place.place_id,
            name: place.name,
            rating: place.rating,
            reviewCount: place.user_ratings_total,
            score: place.review_rank_score,
            address: place.formatted_address,
            category: category,
          }}
        />
        <CompareButton
          size="sm"
          business={{
            placeId: place.place_id,
            name: place.name,
            score: place.review_rank_score,
            category: category,
          }}
        />
      </div>
    </div>
  );
}
