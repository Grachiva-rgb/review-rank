import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlaceDetails } from '@/lib/places';
import { PlaceDetail, TrendSignal } from '@/lib/types';
import NavLogo from '@/components/NavLogo';
import StarRating from '@/components/StarRating';
import SmartScoreBadge from '@/components/SmartScoreBadge';

export const metadata: Metadata = {
  title: 'Compare Businesses',
  description: 'Side-by-side comparison of Review Rank scores, ratings, and trust signals.',
};

interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string; cat?: string }>;
}

const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

// ─── Score component bar ─────────────────────────────────────────────────────

function ScoreBar({ label, value, peer }: { label: string; value: number; peer: number }) {
  const isHigher = value > peer + 1;
  const isLower = value < peer - 1;
  const color = isHigher
    ? 'bg-[#2F6F4E]'
    : isLower
    ? 'bg-[#D9CEC8]'
    : 'bg-[#8B5E3C]/60';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-[#7A6B63]">
        <span>{label}</span>
        <span className={`font-semibold ${isHigher ? 'text-[#2F6F4E]' : isLower ? 'text-[#9A8C85]' : 'text-[#5A4A3F]'}`}>
          {value.toFixed(0)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#EDE8E3] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ─── Trend badge ─────────────────────────────────────────────────────────────

function TrendPill({ signal, label }: { signal?: TrendSignal; label?: string }) {
  if (!signal || signal === 'insufficient_data') {
    return <span className="text-xs text-[#B8A89F]">Not enough data</span>;
  }
  const styles: Record<string, string> = {
    above_average: 'border-[#2F6F4E]/30 bg-[#2F6F4E]/5 text-[#2F6F4E]',
    below_average: 'border-amber-200 bg-amber-50 text-amber-700',
    stable: 'border-[#D9CEC8] bg-[#F7F4F0] text-[#7A6B63]',
  };
  const icons: Record<string, string> = {
    above_average: '↑',
    below_average: '↓',
    stable: '→',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${styles[signal]}`}>
      {icons[signal]} {label}
    </span>
  );
}

// ─── Business column ─────────────────────────────────────────────────────────

function BusinessColumn({
  place,
  peer,
  label,
  cat,
}: {
  place: PlaceDetail;
  peer: PlaceDetail;
  label: 'A' | 'B';
  cat: string;
}) {
  const isHigherScore = place.review_rank_score > peer.review_rank_score;
  const isEqual = Math.abs(place.review_rank_score - peer.review_rank_score) < 1;

  const detailHref = `/business/${place.place_id}${cat ? `?cat=${encodeURIComponent(cat)}` : ''}`;

  return (
    <div className="flex-1 min-w-0 rounded-2xl border border-[#EDE8E3] bg-white p-5 space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#9A8C85]">
            Business {label}
          </span>
          {isHigherScore && !isEqual && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2F6F4E] bg-[#2F6F4E]/8 border border-[#2F6F4E]/20 rounded px-1.5 py-0.5">
              Higher score
            </span>
          )}
        </div>
        <Link href={detailHref}>
          <h2 className="font-display text-xl font-semibold text-[#241C15] hover:text-[#8B5E3C] transition-colors leading-snug">
            {place.name}
          </h2>
        </Link>
        <p className="text-xs text-[#9A8C85]">{place.formatted_address}</p>
      </div>

      {/* Score */}
      <div className="flex items-center gap-4">
        <SmartScoreBadge score={place.review_rank_score} size="lg" />
        <div className="space-y-0.5">
          <p className="text-xs text-[#7A6B63] font-medium">{place.rank_label}</p>
          <TrendPill signal={place.trend_signal} label={place.trend_label} />
        </div>
      </div>

      {/* Rating + reviews */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <StarRating rating={place.rating} />
          <span className="text-sm font-semibold text-[#241C15]">{place.rating.toFixed(1)}</span>
        </div>
        <p className="text-xs text-[#9A8C85]">
          {place.user_ratings_total.toLocaleString()} reviews
        </p>
      </div>

      {/* Score breakdown */}
      {place.score_components && peer.score_components && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-[#5A4A3F] uppercase tracking-widest">Score breakdown</p>
          <ScoreBar label="Rating quality" value={place.score_components.bayesian} peer={peer.score_components.bayesian} />
          <ScoreBar label="Review volume" value={place.score_components.volume} peer={peer.score_components.volume} />
          <ScoreBar label="Recent sentiment" value={place.score_components.sentiment} peer={peer.score_components.sentiment} />
          <ScoreBar label="Consistency" value={place.score_components.consistency} peer={peer.score_components.consistency} />
        </div>
      )}

      {/* Tripadvisor signal row */}
      {place.ta_data && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#5A4A3F] uppercase tracking-widest">Tripadvisor</p>
          <div className="rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#7A6B63]">TA Rating</span>
              <span className="font-mono font-semibold text-[#00AA6C]">
                {place.ta_data.rating.toFixed(1)}★ · {place.ta_data.reviewCount.toLocaleString()} reviews
              </span>
            </div>
            {place.multi_source_score && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7A6B63]">Platform alignment</span>
                <span className="font-mono text-[#241C15]">{place.multi_source_score.platformConsistency}%</span>
              </div>
            )}
            {place.ta_data.travelerRanking && (
              <div className="text-[10px] text-[#7A6B63] leading-relaxed">{place.ta_data.travelerRanking}</div>
            )}
            {place.ta_data.awards?.map((award, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                ★ {award}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explanations */}
      {place.score_explanations?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#5A4A3F] uppercase tracking-widest">Why it ranks here</p>
          <ul className="space-y-1">
            {place.score_explanations.slice(0, 3).map((s, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-[#5A4A3F]">
                <span className="text-[#B8A89F] flex-shrink-0">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Links */}
      <div className="pt-1 flex flex-col gap-2">
        <Link
          href={detailHref}
          className="w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-4 py-2.5 text-center text-xs font-semibold text-[#5A4A3F] hover:bg-[#EDE8E3] transition-colors"
        >
          Full trust analysis →
        </Link>
        {place.url && (
          <a
            href={place.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl border border-[#EDE8E3] bg-white px-4 py-2.5 text-center text-xs text-[#9A8C85] hover:text-[#8B5E3C] transition-colors"
          >
            View on Google Maps ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Comparison insight ───────────────────────────────────────────────────────

function comparisonInsight(a: PlaceDetail, b: PlaceDetail): string {
  const [higher, lower] = a.review_rank_score >= b.review_rank_score ? [a, b] : [b, a];

  if (Math.abs(higher.review_rank_score - lower.review_rank_score) < 2) {
    return `${higher.name} and ${lower.name} have nearly identical scores — the difference is within the margin of the signal.`;
  }

  if (!higher.score_components || !lower.score_components) {
    return `${higher.name} scores ${higher.review_rank_score.toFixed(0)} vs ${lower.review_rank_score.toFixed(0)} for ${lower.name}.`;
  }

  const hc = higher.score_components;
  const lc = lower.score_components;

  const diffs: [string, number][] = [
    ['overall rating quality', hc.bayesian - lc.bayesian],
    ['review volume', hc.volume - lc.volume],
    ['recent review sentiment', hc.sentiment - lc.sentiment],
    ['rating consistency', hc.consistency - lc.consistency],
  ];
  diffs.sort((x, y) => y[1] - x[1]);
  const [topDriver] = diffs[0];

  const scoreDiff = (higher.review_rank_score - lower.review_rank_score).toFixed(0);

  // TA cross-platform signal
  const higherTA = higher.ta_data;
  const lowerTA  = lower.ta_data;
  if (higherTA && lowerTA) {
    const taAgrees = higherTA.rating >= lowerTA.rating;
    if (taAgrees && higher.multi_source_score?.confidence === 'high') {
      return `${higher.name} ranks ${scoreDiff} points higher with stronger scores on both Google and Tripadvisor — a consistent cross-platform trust signal.`;
    }
    if (!taAgrees) {
      return `${higher.name} scores ${scoreDiff} points higher overall, primarily from ${topDriver}. Note: Tripadvisor rates ${lower.name} higher — consider checking both platforms.`;
    }
  }
  if (higherTA && !lowerTA) {
    return `${higher.name} scores ${scoreDiff} points higher and has Tripadvisor enrichment providing additional traveler trust signals.`;
  }

  return `${higher.name} scores ${scoreDiff} points higher, driven primarily by stronger ${topDriver}. ${
    diffs[0][1] > 20 ? `The gap on this signal is significant.` : `The overall difference is moderate.`
  }`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { a, b, cat = '' } = await searchParams;

  if (!a || !b || !PLACE_ID_RE.test(a) || !PLACE_ID_RE.test(b) || a === b) {
    notFound();
  }

  let placeA: PlaceDetail;
  let placeB: PlaceDetail;

  try {
    [placeA, placeB] = await Promise.all([getPlaceDetails(a), getPlaceDetails(b)]);
  } catch {
    notFound();
  }

  const insight = comparisonInsight(placeA, placeB);

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      {/* Nav */}
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/"><NavLogo size="sm" /></Link>
          <span className="text-[#D9CEC8]">/</span>
          <span className="text-sm text-[#7A6B63]">Compare</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Heading */}
        <div className="mb-8 space-y-1">
          <h1 className="font-display text-3xl text-[#241C15]">Side-by-Side Comparison</h1>
          <p className="text-sm text-[#7A6B63]">
            Scores are based on public review signals. No paid rankings.
          </p>
        </div>

        {/* Insight banner */}
        <div className="mb-6 rounded-2xl border border-[#EDE8E3] bg-white px-5 py-4">
          <p className="text-sm text-[#5A4A3F] leading-relaxed">
            <span className="font-semibold text-[#241C15]">Summary: </span>
            {insight}
          </p>
          <p className="mt-1 text-xs text-[#B8A89F]">
            Trend indicators are based on recent review patterns vs. the long-run average.
            Review Rank does not reproduce Google&apos;s ranking algorithm.
          </p>
        </div>

        {/* Comparison columns */}
        <div className="flex flex-col sm:flex-row gap-4">
          <BusinessColumn place={placeA} peer={placeB} label="A" cat={cat} />
          <BusinessColumn place={placeB} peer={placeA} label="B" cat={cat} />
        </div>

        {/* Back to search */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F] underline underline-offset-2 transition-colors"
          >
            ← Start a new search
          </Link>
        </div>
      </main>
    </div>
  );
}
