import SearchForm from '@/components/SearchForm';
import NavLogo from '@/components/NavLogo';
import Link from 'next/link';

interface HomePageProps {
  searchParams: Promise<{ category?: string }>;
}

const EXAMPLE_SEARCHES = [
  { label: 'Best mechanic near me', category: 'mechanic' },
  { label: 'Reliable plumber', category: 'plumber' },
  { label: 'Most trusted dentist', category: 'dentist' },
  { label: 'Top-rated HVAC repair', category: 'hvac repair' },
  { label: 'Trusted electrician', category: 'electrician' },
  { label: 'Reputable family lawyer', category: 'family lawyer' },
];

const HOW_WE_RANK = [
  {
    label: 'Rating quality',
    description: 'We consider the star rating, but never alone — a 4.9★ with 3 reviews tells you very little.',
  },
  {
    label: 'Review volume',
    description: 'More reviews mean more signal. A 4.5★ with 800 reviews is far more reliable than a 4.9★ with 4.',
  },
  {
    label: 'Combined trust score',
    description: 'Our Smart Score multiplies both factors, so only businesses that are both highly rated and widely reviewed rise to the top.',
  },
];

const VS_GOOGLE = [
  'Google shows businesses. We help you decide.',
  'Rankings are based on trust signals, not ads or paid placements.',
  'We explain why a business ranks highly, not just where it appears.',
  'We surface reliable businesses faster, reducing the risk of a bad experience.',
];

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const defaultCategory = (params.category || '').slice(0, 100);
  return (
    <main className="relative min-h-screen flex flex-col bg-[#FAF7F0]">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,94,60,0.06),transparent)] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <nav className="px-6 py-4 border-b border-[#EDE8E3]">
          <div className="flex items-center justify-between">
            <NavLogo />
            <div className="flex items-center gap-2 text-xs text-[#7A6B63]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F6F4E]" />
              <span className="hidden sm:inline">No paid rankings · Based on public review signals</span>
              <span className="sm:hidden">No paid rankings</span>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2F6F4E]/20 bg-[#2F6F4E]/5 px-4 py-1.5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F6F4E]" />
            <span className="text-xs text-[#2F6F4E] font-mono">Mechanics · Dentists · HVAC · Lawyers · Restaurants · and more</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl text-[#241C15] leading-tight mb-5 max-w-3xl">
            Find the places
            <br />
            <span className="text-[#8B5E3C]">locals trust most.</span>
          </h1>

          <p className="text-[#5A4A3F] text-lg max-w-xl mb-10 leading-relaxed">
            We rank local businesses using real customer reviews and public signals
            so you can choose with confidence.
          </p>

          <SearchForm defaultCategory={defaultCategory} />

          {/* Example searches */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-[#7A6B63] font-mono w-full sm:w-auto mb-1 sm:mb-0">Try:</span>
            {EXAMPLE_SEARCHES.map((ex) => (
              <Link
                key={ex.label}
                href={`/?category=${encodeURIComponent(ex.category)}`}
                className="rounded-full border border-[#D9CEC8] bg-white px-3 py-1.5 text-xs text-[#5A4A3F] hover:border-[#8B5E3C] hover:text-[#8B5E3C] transition-all shadow-sm"
              >
                {ex.label}
              </Link>
            ))}
          </div>

        </section>

        {/* How we rank */}
        <section className="border-t border-[#EDE8E3] bg-white px-6 py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-2xl text-[#241C15] mb-2 text-center">How we rank businesses</h2>
            <p className="text-sm text-[#7A6B63] text-center mb-8">
              We combine star rating with review volume into a single trust score.
              Businesses cannot pay to improve their ranking.
            </p>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_WE_RANK.map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-sm font-semibold text-[#241C15] mb-1">{item.label}</div>
                  <p className="text-xs text-[#7A6B63] leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-5 py-4 text-center">
              <span className="font-mono text-sm text-[#8B5E3C]">Smart Score = rating × log₁₀(reviews + 1)</span>
              <p className="text-xs text-[#7A6B63] mt-1">
                This formula rewards businesses with both strong ratings and meaningful review depth.
              </p>
            </div>
          </div>
        </section>

        {/* Why use this instead of Google */}
        <section className="border-t border-[#EDE8E3] bg-[#FAF7F0] px-6 py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-2xl text-[#241C15] mb-6 text-center">
              Why use this instead of Google?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {VS_GOOGLE.map((point, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-[#EDE8E3] bg-white px-4 py-4 shadow-sm"
                >
                  <span className="flex-shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-[#8B5E3C]/10 text-[#8B5E3C] text-xs font-bold">
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#241C15] leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#EDE8E3] px-6 py-8 bg-white/50">
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className="font-mono text-sm text-[#8B5E3C] mb-1">rating × log₁₀(n+1)</div>
              <div className="text-xs text-[#7A6B63]">Smart Score formula</div>
            </div>
            <div>
              <div className="font-mono text-sm text-[#241C15] mb-1">Up to 20</div>
              <div className="text-xs text-[#7A6B63]">Results per search</div>
            </div>
            <div>
              <div className="font-mono text-sm text-[#241C15] mb-1">Live</div>
              <div className="text-xs text-[#7A6B63]">Real-time Google data</div>
            </div>
          </div>
          <p className="text-center text-xs text-[#9A8C85] mt-6">
            Powered by Google Places · Rankings are objective and based on public review signals only
          </p>
        </footer>
      </div>
    </main>
  );
}
