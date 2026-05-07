import NavLogo from '@/components/NavLogo';

export default function ResultsLoading() {
  return (
    <div className="relative min-h-screen bg-[#FAF7F0]">
      {/* Sticky header skeleton */}
      <header className="sticky top-0 z-20 border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <NavLogo size="sm" />
          <div className="flex-1 flex justify-end">
            <div className="h-8 w-48 rounded-lg bg-[#EDE8E3] animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Title skeleton */}
        <div className="mb-6 space-y-2">
          <div className="h-9 w-56 rounded-lg bg-[#EDE8E3] animate-pulse" />
          <div className="h-3 w-40 rounded bg-[#EDE8E3] animate-pulse" />
        </div>

        {/* Filter bar skeleton */}
        <div className="mb-5 flex items-center gap-2">
          <div className="h-4 w-24 rounded bg-[#EDE8E3] animate-pulse" />
          <div className="h-7 w-24 rounded-lg bg-[#EDE8E3] animate-pulse" />
          <div className="h-7 w-24 rounded-lg bg-[#EDE8E3] animate-pulse" />
          <div className="h-7 w-24 rounded-lg bg-[#EDE8E3] animate-pulse" />
        </div>

        {/* Business card skeletons */}
        <div className="grid gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-5 rounded-2xl border border-[#EDE8E3] bg-white px-5 py-5 shadow-sm"
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-9 pt-1">
                <div className="h-8 w-7 rounded bg-[#EDE8E3] animate-pulse" />
              </div>
              <div className="flex-shrink-0 w-px bg-[#EDE8E3]" />
              {/* Content */}
              <div className="flex-1 space-y-2.5">
                <div className="h-5 w-48 rounded bg-[#EDE8E3] animate-pulse" />
                <div className="h-3.5 w-32 rounded bg-[#EDE8E3] animate-pulse" />
                <div className="h-3 w-56 rounded bg-[#EDE8E3] animate-pulse" />
                <div className="h-3 w-64 rounded bg-[#EDE8E3] animate-pulse" />
              </div>
              {/* Score badge */}
              <div className="flex-shrink-0 self-center h-14 w-14 rounded-xl bg-[#EDE8E3] animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
