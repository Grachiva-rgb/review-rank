import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms governing use of ReviewRank.',
};

// NOTE FOR OPERATORS: contains the notices Google Maps Platform ToS
// §3.2.2(a) requires of customer applications (Google Maps content notice +
// links to Google's end-user terms and privacy policy). Review with legal
// counsel before treating as final.

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'The service',
    body: [
      'ReviewRank ranks local businesses using public review signals and a documented scoring methodology. Scores are statistical estimates, not guarantees of service quality. Rankings cannot be purchased; commercial relationships never influence scores or ranking positions.',
      'Business information, ratings, and reviews displayed on ReviewRank are sourced from the Google Places API. ReviewRank’s 0–100 score and analysis are our own and are not produced or endorsed by Google.',
    ],
  },
  {
    title: 'Google Maps features and content',
    body: [
      'This application includes Google Maps features and content. By using ReviewRank, you agree that use of Google Maps features and content is subject to the then-current versions of the Google Maps/Google Earth Additional Terms of Service at https://maps.google.com/help/terms_maps/ and the Google Privacy Policy at https://policies.google.com/privacy.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'Do not scrape, bulk-download, or redistribute data from ReviewRank; do not probe, overload, or attempt to bypass security or rate-limiting controls; do not use the service to harass businesses or submit fraudulent quote requests.',
    ],
  },
  {
    title: 'Quote requests and reports',
    body: [
      'Quote requests you submit are forwarded to matching service providers. ReviewRank is not a party to any resulting engagement and does not guarantee responses, pricing, or workmanship.',
      'Ranking reports are informational analyses of public review signals at the time of preparation.',
    ],
  },
  {
    title: 'Partner subscriptions',
    body: [
      'Partner subscriptions are billed through Stripe under the pricing shown at checkout and may be cancelled at any time, effective at the end of the current billing period. Partner status never affects scores or rankings.',
    ],
  },
  {
    title: 'Disclaimers',
    body: [
      'The service is provided “as is” without warranties of any kind. To the maximum extent permitted by law, ReviewRank is not liable for decisions made in reliance on scores, rankings, or displayed business data, or for the accuracy of third-party content.',
    ],
  },
  {
    title: 'Contact',
    body: ['Questions about these terms: methodology@reviewrank.app.'],
  },
];

export default function TermsPage() {
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
        <h1 className="font-display text-4xl text-[#241C15] mb-2">Terms of Use</h1>
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
          See also our <Link href="/privacy" className="underline hover:text-[#8B5E3C]">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
