import Link from 'next/link';
import type { Metadata } from 'next';
import PartnerForm from './PartnerForm';

export const metadata: Metadata = {
  title: 'Partner Program — Get Matched Local Leads | ReviewRank',
  description:
    'Join the ReviewRank partner program. Receive matched customer leads by category and service area. $99/month, shared-lead model.',
};

function Feature({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EDE8E3] bg-white p-5 shadow-sm">
      <div className="text-xs text-[#8B5E3C] uppercase tracking-widest font-mono mb-2">
        {title}
      </div>
      <p className="text-sm text-[#241C15] leading-relaxed">{body}</p>
    </div>
  );
}

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display text-lg text-[#241C15]">
            Review<span className="text-[#8B5E3C]">Rank</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F] transition-colors"
          >
            ← Back
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="text-xs text-[#8B5E3C] uppercase tracking-widest font-mono mb-3">
            Partner Program
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-[#241C15] leading-tight mb-4">
            Get matched to ready-to-buy customers in your service area
          </h1>
          <p className="text-lg text-[#5A4A3F] leading-relaxed">
            When a customer requests a quote through ReviewRank, matched partner
            businesses in that category and geographic radius receive the lead by
            email within seconds. Flat $99/month. No per-lead fees. No contracts.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <Feature
            title="Flat price"
            body="$99/month. Cancel anytime. No per-lead charges, no commissions, no hidden fees."
          />
          <Feature
            title="Matched, not blasted"
            body="Leads go only to partners in the right category and within the service radius you set."
          />
          <Feature
            title="Ranking-independent"
            body="Partner status does NOT affect your Review Rank Score. We maintain editorial independence."
          />
        </div>

        <div className="rounded-2xl border border-[#EDE8E3] bg-white p-6 sm:p-8 shadow-sm mb-10">
          <h2 className="font-display text-2xl text-[#241C15] mb-5">
            Sign up
          </h2>
          <PartnerForm />
        </div>

        <div className="rounded-2xl border border-[#EDE8E3] bg-[#FAF7F0] p-5">
          <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-2">
            Important disclosure
          </div>
          <p className="text-sm text-[#5A4A3F] leading-relaxed">
            Partner status is clearly separated from rankings. Paying for the
            partner program does not influence your Review Rank Score, your
            position in search results, or your trust tier. Rankings are
            calculated from public review signals only.
          </p>
        </div>

        <div className="mt-10 pt-6 border-t border-[#EDE8E3] text-center">
          <p className="text-xs text-[#7A6B63] font-mono">
            Questions? <a className="underline hover:text-[#8B5E3C]" href="mailto:partners@reviewrank.app">partners@reviewrank.app</a>
          </p>
        </div>
      </main>
    </div>
  );
}
