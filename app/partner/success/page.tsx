import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function PartnerSuccessPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <div className="text-xs text-emerald-700 uppercase tracking-widest font-mono mb-3">
            You're in
          </div>
          <h1 className="font-display text-3xl text-[#241C15] mb-3">
            Welcome to the Partner Program
          </h1>
          <p className="text-sm text-[#5A4A3F] leading-relaxed mb-6">
            Your subscription is active. You'll receive matched leads in your
            category and service area by email as soon as customers submit
            requests in your area.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-[#8B5E3C] hover:bg-[#6B4A2F] text-white text-sm font-semibold px-6 py-3 transition-colors"
          >
            Back to ReviewRank
          </Link>
        </div>
        <p className="text-xs text-[#7A6B63] mt-4">
          Billing questions? <a className="underline hover:text-[#8B5E3C]" href="mailto:partners@reviewrank.app">partners@reviewrank.app</a>
        </p>
      </div>
    </div>
  );
}
