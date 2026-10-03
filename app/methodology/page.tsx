import Link from 'next/link';
import type { Metadata } from 'next';
import ClientTracker from '@/components/ClientTracker';
import { calculateReviewRankScore, BusinessReview } from '@/lib/reviewRankScoring';

export const metadata: Metadata = {
  // The root layout's title template appends "| ReviewRank".
  title: 'Methodology — How ReviewRank Scores Work',
  description:
    'A transparent breakdown of the ReviewRank Score: Bayesian-adjusted rating, review volume, sampled review sentiment, and rating consistency. No paid placements.',
};

// ─── Worked example — COMPUTED FROM THE PRODUCTION SCORER AT BUILD TIME ──────
// Never hard-code a result here. A previous version of this page printed a
// composite ("87.7") that neither its own printed components (88.27) nor the
// production code (82.5) produced. Running the real scorer makes divergence
// between this page and production impossible.

function sampleReviews(ratings: number[]): BusinessReview[] {
  return ratings.map((rating, i) => ({
    id: String(i),
    rating,
    text: '',
    createdAt: new Date().toISOString(),
    platform: 'google' as const,
  }));
}

const EX = { rating: 4.7, reviews: 412, sample: [5, 5, 4, 5, 5] };
const exampleResult = calculateReviewRankScore({
  businessId: 'methodology-example',
  rating: EX.rating,
  totalReviewCount: EX.reviews,
  reviews: sampleReviews(EX.sample),
});

const SMALL = { rating: 4.9, reviews: 18, sample: [5, 5, 5, 5, 4] };
const smallResult = calculateReviewRankScore({
  businessId: 'methodology-small-example',
  rating: SMALL.rating,
  totalReviewCount: SMALL.reviews,
  reviews: sampleReviews(SMALL.sample),
});

const exEvidence = Math.sqrt(EX.sample.length / EX.reviews);

function Section({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      {kicker && (
        <div className="text-xs text-[#8B5E3C] uppercase tracking-widest font-mono mb-2">
          {kicker}
        </div>
      )}
      <h2 className="font-display text-2xl sm:text-3xl text-[#241C15] mb-4">
        {title}
      </h2>
      <div className="text-sm text-[#5A4A3F] leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function ComponentRow({
  weight,
  name,
  description,
}: {
  weight: string;
  name: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-[#EDE8E3] last:border-0">
      <div className="flex-shrink-0 w-16 text-right">
        <span className="font-mono text-2xl text-[#8B5E3C] font-bold">
          {weight}
        </span>
      </div>
      <div className="flex-1">
        <div className="font-semibold text-[#241C15] mb-1">{name}</div>
        <p className="text-sm text-[#5A4A3F] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function MethodologyPage() {
  const c = exampleResult.componentScores;
  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <ClientTracker event="methodology_viewed" />
      {/* Nav */}
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display text-lg text-[#241C15]">
            Review<span className="text-[#8B5E3C]">Rank</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F] transition-colors"
          >
            ← Back to search
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="text-xs text-[#8B5E3C] uppercase tracking-widest font-mono mb-3">
            Methodology · v1.2
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-[#241C15] leading-tight mb-4">
            How ReviewRank Scores work
          </h1>
          <p className="text-lg text-[#5A4A3F] leading-relaxed">
            Every business on ReviewRank receives a ReviewRank Score between 0
            and 100. The score blends four measurable signals from public review
            data. No business pays to move up. No business can pay to hide a
            score. This page documents exactly how the number is calculated —
            every formula below is the one production runs, and the worked
            example is computed by the production scoring code when this page
            is built.
          </p>
        </div>

        {/* The formula */}
        <Section kicker="The formula" title="Four components, one score">
          <p>
            The ReviewRank Score is a weighted composite of four signals. Each
            is scored on a 0–100 scale before weighting.
          </p>

          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-6 mt-5 shadow-sm">
            <ComponentRow
              weight="55%"
              name="Bayesian-adjusted rating"
              description="A shrinkage estimator pulls every rating toward a global prior (4.2★ across 15 phantom reviews) until a business has enough real reviews to overcome the pull: bayesian = (15 × 4.2 + reviews × rating) / (15 + reviews). The 1–5 result maps to 0–100 as (bayesian − 3.0) / 2.0 × 100, clamped — so 3.0★ scores 0 and 5.0★ scores 100."
            />
            <ComponentRow
              weight="20%"
              name="Review volume"
              description="log₁₀(reviews + 1) / log₁₀(2001) × 100, clamped to 100. Rewards depth of feedback without letting a 10,000-review chain dominate a 400-review local; the curve saturates at 2,000 reviews."
            />
            <ComponentRow
              weight="15%"
              name="Sampled review sentiment"
              description="Average star rating of the up-to-5 reviews Google's API returns, mapped as (avg − 3.0) / 2.0 × 100. Important: Google selects and orders these reviews BY RELEVANCE — the API offers no chronological option, so this is a sample, not the most recent reviews. With no rated reviews in the sample this component is a neutral 50."
            />
            <ComponentRow
              weight="10%"
              name="Rating consistency"
              description="Population standard deviation of the sampled review ratings, scored as (1 − min(stddev / 1.5, 1)) × 100, then multiplied by a direction factor clamp(sampleMean − 3.0, 0, 1) — so uniformity only earns credit when the sample is actually good (v1.2: a uniformly bad 1★ sample previously scored as 'consistent'). With fewer than 2 rated reviews this component defaults to 75."
            />
          </div>

          <p className="mt-4">
            <strong>Evidence blending.</strong> Because sentiment and
            consistency come from a sample of at most 5 reviews, they are
            blended toward priors in proportion to how much of the business the
            sample actually covers: <span className="font-mono text-xs">weight
            = min(0.5, √(sampleSize / totalReviews))</span>. The sentiment
            prior is the overall rating mapped to the same 0–100 scale; the
            consistency prior is 75. For a 412-review business the sample
            weight is ≈ {exEvidence.toFixed(2)}, so the sampled signals
            contribute lightly. The 0.5 cap (v1.2) means that even for a
            business whose sample covers every review it has, the
            relevance-selected sample never outweighs the priors — this bounds
            how far one unlucky sampled review can ever move a score.
          </p>
          <p>
            The weighted composite is clamped to 0–100 and rounded to one
            decimal. (A reserved fraud-signal multiplier exists in the code and
            is currently fixed at 1.0 — it does not affect any score today.)
            Component scores shown on business pages are the post-blending
            values, individually rounded to one decimal; the final score is
            computed from unrounded values, so recomputing from displayed
            components can differ by up to ±0.1.
          </p>
        </Section>

        {/* Worked example */}
        <Section kicker="Worked example" title="Scoring a real business">
          <p>
            A landscaping company with a {EX.rating}★ rating, {EX.reviews}{' '}
            reviews, and sampled review ratings of {EX.sample.join(', ')}.
            Every number below comes from running the production scorer on
            these inputs when this page is built:
          </p>

          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-6 mt-4 shadow-sm font-mono text-xs text-[#241C15]">
            <div className="space-y-2 leading-relaxed">
              <div>
                <span className="text-[#7A6B63]">Bayesian rating (0–100)</span>{' '}
                = <span className="text-[#8B5E3C] font-bold">{c.bayesian.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-[#7A6B63]">Volume</span> ={' '}
                <span className="text-[#8B5E3C] font-bold">{c.volume.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-[#7A6B63]">Sampled sentiment (after blending)</span> ={' '}
                <span className="text-[#8B5E3C] font-bold">{c.sentiment.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-[#7A6B63]">Consistency (after blending)</span> ={' '}
                <span className="text-[#8B5E3C] font-bold">{c.consistency.toFixed(1)}</span>
              </div>
              <div className="pt-3 border-t border-[#EDE8E3]">
                <span className="text-[#7A6B63]">Composite</span> = {c.bayesian.toFixed(1)}×0.55 +{' '}
                {c.volume.toFixed(1)}×0.20 + {c.sentiment.toFixed(1)}×0.15 +{' '}
                {c.consistency.toFixed(1)}×0.10
              </div>
              <div>
                ={' '}
                <span className="text-[#2F6F4E] font-bold text-base">
                  {exampleResult.finalScore} / 100 — {exampleResult.rankLabel}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4">
            A nearby competitor with {SMALL.rating}★ but only {SMALL.reviews}{' '}
            reviews scores {smallResult.finalScore} ({smallResult.rankLabel})
            on the same formula. The Bayesian shrinkage and the volume
            component are doing the work: we need evidence before we declare
            someone the best.
          </p>
        </Section>

        {/* Trust tiers */}
        <Section kicker="How scores map to labels" title="Score bands and trust tiers">
          <p>
            The score maps to a <strong>band label</strong> shown with the
            number:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="font-mono text-xs text-emerald-800 font-bold tracking-widest mb-1">
                80–100 · ELITE
              </div>
              <p className="text-xs text-[#241C15] leading-relaxed">
                Exceptional rating backed by substantial review depth and
                consistent sampled experience.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="font-mono text-xs text-emerald-800 font-bold tracking-widest mb-1">
                65–79 · HIGHLY TRUSTED
              </div>
              <p className="text-xs text-[#241C15] leading-relaxed">
                Strong performer with enough evidence to recommend with
                confidence.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-mono text-xs text-amber-800 font-bold tracking-widest mb-1">
                50–64 · TRUSTED
              </div>
              <p className="text-xs text-[#241C15] leading-relaxed">
                Solid option. Rating, volume, or consistency is slightly below
                top-tier competitors.
              </p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="font-mono text-xs text-orange-800 font-bold tracking-widest mb-1">
                35–49 · ESTABLISHED
              </div>
              <p className="text-xs text-[#241C15] leading-relaxed">
                Present in the market but trailing peers on one or more signals.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#7A6B63] mt-3">
            Scores under 35 are labelled <strong>Limited Reputation</strong>.
            Businesses under 4.0★ are not displayed in ranked results at all,
            regardless of other signals.
          </p>
          <p className="mt-3">
            Separately, internal <strong>evidence tiers</strong> apply additional
            gates on top of the score (e.g. the top tier requires score ≥ 65,
            rating ≥ 4.5, and ≥ 150 reviews). These tiers no longer render as a
            badge — the displayed classification is the score band plus the
            Confidence level, which communicate the same information without a
            third overlapping label — but they still gate conservative features
            such as the quote button and the narrative language.
          </p>
        </Section>

        {/* Data sources */}
        <Section kicker="Data sources" title="Where the data comes from">
          <ul className="list-none space-y-2 mt-1">
            {[
              'Ratings and review counts come from the Google Places API.',
              "Google's API returns at most 5 reviews per business, selected and ordered by RELEVANCE as determined by Google. It offers no way to request the most recent reviews, so sentiment and consistency are computed from this relevance-ranked sample — treat them as a spot-check, not a trend.",
              'For hotels, restaurants, and attractions we also display Tripadvisor data (rating, review count, ranking, awards) in a supplemental panel. Tripadvisor data does NOT change the ReviewRank Score — it is shown side-by-side so you can compare platforms yourself.',
              'The "review sample above/below average" indicator compares the sampled reviews against the long-run rating. It is a proxy, not a measured trend — we do not yet have historical data.',
              'Query-intent handling only affects WHICH businesses appear for a search (filtering out obvious mismatches). It never reorders results: within any list, ordering under the default sort is purely by ReviewRank Score.',
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#5A4A3F] leading-relaxed">
                <span className="text-[#B8A89F] flex-shrink-0 mt-1">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Confidence */}
        <Section kicker="Evidence, separately" title="The Confidence indicator">
          <p>
            Next to every score we show a <strong>Confidence</strong> level —
            how much review evidence backs that score. It never changes the
            score itself; it tells you how seriously to take it. Thresholds
            come from the review-count distribution of businesses we actually
            evaluate:
          </p>
          <ul className="list-none space-y-2 mt-3">
            {[
              'Very High — 300+ reviews and a full 5-review sample.',
              'High — 100 to 299 reviews.',
              'Moderate — 25 to 99 reviews.',
              'Low — fewer than 25 reviews. A 90-point score here is a promising early signal, not an established fact.',
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#5A4A3F] leading-relaxed">
                <span className="text-[#B8A89F] flex-shrink-0 mt-1">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Rating-stability inputs will join this indicator once we have our
            own longitudinal data.
          </p>
        </Section>

        {/* What we don't measure */}
        <Section kicker="Transparency" title="What we don't measure (yet)">
          <p>
            Honest limitations. Any reputation score is only as good as the data
            it sees. Here is what the current ReviewRank Score{' '}
            <strong>does not</strong> incorporate:
          </p>
          <ul className="list-none space-y-2 mt-3">
            {[
              'Full review history. We see the aggregate rating, the review count, and a 5-review relevance-ranked sample — nothing more.',
              'True recency. Because the sample is relevance-ranked, nothing in the score is genuinely "recent". Historical tracking is planned; until it exists we avoid recency claims.',
              'Owner response rate. Planned once we build our own review-tracking backend.',
              'Cross-platform scoring (Yelp, BBB, Facebook, Nextdoor). Tripadvisor data is displayed for hospitality businesses but does not alter the score.',
              'Review velocity. Whether a business earned 400 reviews in 10 years or in 6 months looks identical today.',
              'Individual reviewer credibility. We treat every public reviewer\'s contribution equally.',
              'Paid or sponsored signals. We reject them by design — they would compromise the score.',
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#5A4A3F] leading-relaxed">
                <span className="text-[#B8A89F] flex-shrink-0 mt-1">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* How this differs */}
        <Section kicker="How we compare" title="Different from Google or Yelp">
          <p>
            Google and Yelp rank businesses primarily on raw rating plus proximity,
            with paid placements mixed in. A 5.0★ business with 2 reviews can
            outrank a 4.7★ business with 400 reviews on those platforms.
          </p>
          <p>
            The ReviewRank Score is designed to answer a different question:{' '}
            <em>&quot;If I walked in today, how likely is this to be a good
            experience?&quot;</em> That requires evidence. The Bayesian prior and
            volume signal exist to prevent small-sample businesses from
            outranking well-established competitors purely on statistical luck.
          </p>
          <p>
            We are not a discovery engine. We are a trust layer on top of the
            data the discovery engines already show you.
          </p>
        </Section>

        {/* Update log */}
        <Section kicker="Change log" title="Methodology updates">
          <div className="rounded-2xl border border-[#EDE8E3] bg-white divide-y divide-[#EDE8E3] shadow-sm">
            <div className="p-4">
              <div className="font-mono text-xs text-[#8B5E3C] uppercase tracking-widest mb-1">
                v1.2 — 2026-10-02
              </div>
              <p className="text-sm text-[#241C15] font-medium mb-1">
                Sample-evidence cap, direction-aware consistency, Confidence indicator
              </p>
              <p className="text-xs text-[#7A6B63] leading-relaxed">
                Validated against 4,557 real businesses before shipping: the
                sample-evidence weight is now capped at 0.5 (halves the
                worst-case impact of one unlucky sampled review on small
                businesses), consistency credit now requires the sample to
                actually be good (a uniformly bad sample no longer outscores a
                mostly-great one), and every score now carries a separate
                Confidence level. No list-page ranking changed; 0.9% of
                businesses changed band label.
              </p>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs text-[#8B5E3C] uppercase tracking-widest mb-1">
                v1.1 — 2026-10-02
              </div>
              <p className="text-sm text-[#241C15] font-medium mb-1">
                Transparency corrections
              </p>
              <p className="text-xs text-[#7A6B63] leading-relaxed">
                This page now documents the full production formula, including
                the evidence-blending step for sampled signals, and its worked
                example is computed by the production scorer at build time.
                &quot;Recent sentiment&quot; renamed to &quot;sampled review
                sentiment&quot; — Google&apos;s API returns relevance-ranked
                samples, not recent reviews. Tripadvisor data no longer adjusts
                the score (it previously blended into hospitality scores on
                some pages but not others); it is now display-only.
              </p>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs text-[#8B5E3C] uppercase tracking-widest mb-1">
                v1.0 — 2026-05-07
              </div>
              <p className="text-sm text-[#241C15] font-medium mb-1">
                Initial ReviewRank Score release
              </p>
              <p className="text-xs text-[#7A6B63] leading-relaxed">
                Bayesian rating (55%) + volume (20%) + sentiment (15%) +
                consistency (10%). Minimum display rating raised to 4.0★.
                Replaces the earlier 0–7.5 Smart Score with a 0–100 scale and
                per-business explanation strings.
              </p>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs text-[#8B5E3C] uppercase tracking-widest mb-1">
                v0.5 — 2026-04
              </div>
              <p className="text-sm text-[#241C15] font-medium mb-1">
                Raised baseline from 3.0 to 3.5
              </p>
              <p className="text-xs text-[#7A6B63] leading-relaxed">
                Mid-tier businesses were scoring higher than users felt matched
                reality. Baseline adjustment brought scores in line with
                expectations.
              </p>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs text-[#8B5E3C] uppercase tracking-widest mb-1">
                v0.1 — 2026-03
              </div>
              <p className="text-sm text-[#241C15] font-medium mb-1">
                Smart Score launch
              </p>
              <p className="text-xs text-[#7A6B63] leading-relaxed">
                Simple (rating − baseline) × log₁₀(reviews + 1) on a 0–7.5
                scale.
              </p>
            </div>
          </div>
        </Section>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-[#EDE8E3] bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-[#241C15] font-medium mb-2">
            Questions, critiques, or dataset offers?
          </p>
          <p className="text-xs text-[#7A6B63] mb-4 leading-relaxed">
            We treat methodology transparency as a feature. If you spot a flaw,
            tell us.
          </p>
          <a
            href="mailto:methodology@reviewrank.app"
            className="inline-block rounded-xl bg-[#8B5E3C] hover:bg-[#6B4A2F] text-white text-sm font-semibold px-6 py-3 transition-colors"
          >
            methodology@reviewrank.app
          </a>
        </div>

        <div className="mt-10 pt-6 border-t border-[#EDE8E3] text-center">
          <p className="text-xs text-[#7A6B63] font-mono">
            No paid placements · No sponsored rankings · Public data only
          </p>
        </div>
      </main>
    </div>
  );
}
