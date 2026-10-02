import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How ReviewRank collects, uses, and protects information.',
};

// NOTE FOR OPERATORS: this draft was written from a factual inventory of what
// the application actually collects, and includes the disclosures Google Maps
// Platform requires of customer applications. It should be reviewed by legal
// counsel before being treated as final. Keep "Last updated" current.

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What we collect',
    body: [
      'Search activity: the business types and locations you search for, including a city, ZIP code, or — only if you grant browser permission — your device location, used to run that search. Precise location is used for the search request and is not stored in an account profile.',
      'Saved businesses and comparisons: stored locally in your browser (localStorage), not on our servers.',
      'Quote and report requests: if you submit a form, we collect the details you provide (name, phone number or email, and your request text) and share them only as described below.',
      'Partner accounts: business contact details and service areas provided during signup. Payments are processed by Stripe; ReviewRank never receives or stores card numbers.',
      'Analytics: we use PostHog to understand how the product is used (pages viewed, interactions, approximate location derived from IP). Form inputs are masked in any session capture.',
      'Server logs: our hosting provider (Vercel) processes IP addresses and request metadata to serve and protect the site.',
    ],
  },
  {
    title: 'How we use it',
    body: [
      'To run searches and show results, to deliver quote requests to the matching service provider, to fulfil report requests, to operate partner subscriptions, to improve the product, and to protect the service from abuse (rate limiting, fraud prevention).',
      'We do not sell personal information. Commercial relationships never affect rankings or scores.',
    ],
  },
  {
    title: 'Who receives data',
    body: [
      'Google (Google Maps Platform): your search queries are used to request business data from the Google Places API. Use of Google Maps features and content is subject to the Google Privacy Policy at https://policies.google.com/privacy, which is incorporated into this policy by reference.',
      'Stripe: payment processing for partner subscriptions (stripe.com/privacy).',
      'Resend: transactional email delivery for lead notifications.',
      'PostHog: product analytics (posthog.com/privacy).',
      'Vercel and Supabase: hosting and data storage infrastructure.',
    ],
  },
  {
    title: 'Retention and deletion',
    body: [
      'Quote/lead and report requests are retained while needed to deliver the service. Search caches expire automatically. Saved businesses live in your own browser and are deleted when you clear site data.',
      'To request deletion of information you have submitted (for example a quote request), contact us at the address below and we will remove it.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'Questions or requests: methodology@reviewrank.app.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display text-lg text-[#241C15]">
            Review<span className="text-[#8B5E3C]">Rank</span>
          </Link>
          <Link href="/" className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F]">
            ← Back to search
          </Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-display text-4xl text-[#241C15] mb-2">Privacy Policy</h1>
        <p className="text-xs text-[#9A8C85] mb-10 font-mono">Last updated: October 2, 2026</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mb-8">
            <h2 className="font-display text-xl text-[#241C15] mb-3">{s.title}</h2>
            <ul className="space-y-2">
              {s.body.map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#5A4A3F] leading-relaxed">
                  <span className="text-[#B8A89F] flex-shrink-0 mt-1">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-xs text-[#9A8C85] leading-relaxed border-t border-[#EDE8E3] pt-6">
          See also our <Link href="/terms" className="underline hover:text-[#8B5E3C]">Terms of Use</Link>.
        </p>
      </main>
    </div>
  );
}
