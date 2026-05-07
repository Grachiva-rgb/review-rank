import Link from 'next/link';
import type { Metadata } from 'next';
import ClientTracker from '@/components/ClientTracker';

export const metadata: Metadata = {
  title: 'Methodology — How Review Rank Scores Work | ReviewRank',
  description:
    'A transparent breakdown of the Review Rank Score: Bayesian-adjusted rating, review volume, recent sentiment, and rating consistency. No paid placements.',
};

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
            Methodology · v1.0
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-[#241C15] leading-tight mb-4">
            How Review Rank Scores work
          </h1>
          <p className="text-lg text-[#5A4A3F] leading-relaxed">
            Every business on ReviewRank receives a Review Rank Score between 0
            and 100. The score blends four measurable signals from public review
            data. No business pays to move up. No business can pay to hide a
            score. This page documents exactly how the number is calculated.
          </p>
        </div>

        {/* The formula */}
        <Section kicker="The formula" title="Four components, one score">
          <p>
            The Review Rank Score is a weighted composite of four independent
            signals. Each is scored on a 0–100 scale before weighting.
          </p>

          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-6 mt-5 shadow-sm">
            <ComponentRow
              weight="55%"
              name="Bayesian-adjusted rating"
              description="We use a shrinkage estimator that pulls every rating toward a global prior (4.2★ across 15 phantom reviews) until a business has enough real reviews to overcome that pull. A single glowing 5.0★ review no longer beats a 4.7★/400-review competitor."
            />
            <ComponentRow
              weight="20%"
              name="Review volume"
              description="Log-scaled to reward depth of feedback without letting a 10,000-review chain dominate a 400-review local. The curve saturates around 2,000 reviews."
            />
            <ComponentRow
              weight="15%"
              name="Recent sentiment"
              description="Average rating across the 5 most recent reviews surfaced by Google. Flags businesses whose experience has recently shifted — up or down."
            />
            <ComponentRow
              weight="10%"
              name="Rating consistency"
              description="Standard deviation of recent review ratings. A business delivering 4.6, 4.7, 4.5, 4.8, 4.6 is scored higher than one delivering 5, 5, 1, 5, 5 — even when the mean is identical."
            />
          </div>

          <p className="mt-4">
            The composite is then clamped to 0–100 and rounded to one decimal.
          </p>
        </Section>

        {/* Worked example */}
        <Section kicker="Worked example" title="Scoring a real business">
          <p>
            Consider a landscaping company with a 4.7★ rating, 412 reviews, and
            recent reviews of 4.8, 4.6, 4.9, 4.5, 4.7.
          </p>

          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-6 mt-4 shadow-sm font-mono text-xs text-[#241C15]">
            <div className="space-y-2 leading-relaxed">
              <div>
                <span className="text-[#7A6B63]">Bayesian rating</span> = (15 ×
                4.2 + 412 × 4.7) / (15 + 412) ={' '}
                <span className="text-[#8B5E3C] font-bold">4.68</span>
              </div>
              <div>
                → normalised to 0–100:{' '}
                <span className="text-[#8B5E3C] font-bold">89.2</span>
              </div>
              <div className="pt-2">
                <span className="text-[#7A6B63]">Volume</span> = log₁₀(412+1) /
                log₁₀(2001) × 100 ={' '}
                <span className="text-[#8B5E3C] font-bold">79.1</span>
              </div>
              <div className="pt-2">
                <span className="text-[#7A6B63]">Sentiment</span> = avg(4.8, 4.6,
                4.9, 4.5, 4.7) / 5 × 100 ={' '}
                <span className="text-[#8B5E3C] font-bold">94.0</span>
              </div>
              <div className="pt-2">
                <span className="text-[#7A6B63]">Consistency</span> = (1 −
                stddev/2) × 100 ={' '}
                <span className="text-[#8B5E3C] font-bold">92.9</span>
              </div>
              <div className="pt-3 border-t border-[#EDE8E3]">
                <span className="text-[#7A6B63]">Composite</span> = 89.2×0.55 +
                79.1×0.20 + 94.0×0.15 + 92.9×0.10
              </div>
              <div>
                ={' '}
                <span className="text-[#2F6F4E] font-bold text-base">
                  87.7 / 100 — Elite
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4">
            A nearby competitor with 4.9★ but only 18 reviews would score ~63.
            The Bayesian shrinkage is doing the work: we need evidence before we
            declare someone the best.
          </p>
        </Section>

        {/* Trust tiers */}
        <Section kicker="How scores map to tiers" title="Trust tiers">
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="font-mono text-xs text-emerald-800 font-bold tracking-widest mb-1">
                80–100 · ELITE
              </div>
              <p className="text-xs text-[#241C15] leading-relaxed">
                Exceptional rating backed by substantial review depth and
                consistent recent experience.
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
            Businesses under 4.0★ are not displayed in ranked results at all,
            regardless of other signals.
          </p>
        </Section>

        {/* What we don't measure */}
        <Section
          kicker="Transparency"
          title="What we don't measure (yet)"
        >
          <p>
            Honest limitations. Any reputation score is only as good as the data
            it sees. Here is what the current Review Rank Score{' '}
            <strong>does not</strong> incorporate:
          </p>
          <ul className="list-none space-y-2 mt-3">
            {[
              'Full review history. Google Places returns the 5 most recent public reviews. Sentiment and consistency are estimated from that window.',
              'Owner response rate. We plan to add this in v1.1 once we build our own review-tracking backend.',
              'Cross-platform signals (Yelp, BBB, Facebook, Nextdoor). Single-source for now to avoid biasing against businesses who haven\'t claimed every profile.',
              'Review velocity. Whether a business earned 400 reviews in 10 years or in 6 months looks identical today.',
              'Individual reviewer credibility. We treat every public reviewer\'s contribution equally.',
              'Paid or sponsored signals. We reject them by design — they would compromise the score.',
            ].map((item, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-[#5A4A3F] leading-relaxed"
              >
                <span className="text-[#B8A89F] flex-shrink-0 mt-1">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* How this differs */}
        <Section
          kicker="How we compare"
          title="Different from Google or Yelp"
        >
          <p>
            Google and Yelp rank businesses primarily on raw rating plus proximity,
            with paid placements mixed in. A 5.0★ business with 2 reviews can
            outrank a 4.7★ business with 400 reviews on those platforms.
          </p>
          <p>
            Review Rank Score is designed to answer a different question:{' '}
            <em>"If I walked in today, how likely is this to be a good
            experience?"</em> That requires evidence. The Bayesian prior and
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
                v1.0 — 2026-05-07
              </div>
              <p className="text-sm text-[#241C15] font-medium mb-1">
                Initial Review Rank Score release
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
