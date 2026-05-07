import NavLogo from '@/components/NavLogo';

export default function BusinessLoading() {
  return (
    <div className="relative min-h-screen bg-[#FAF7F0]">
      {/* Nav */}
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <NavLogo size="sm" />
          <span className="text-[#D9CEC8]">/</span>
          <div className="h-4 w-20 rounded bg-[#EDE8E3] animate-pulse" />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 mb-6">
          <div className="flex-1 space-y-3">
            <div className="h-9 w-64 rounded-lg bg-[#EDE8E3] animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="h-5 w-28 rounded bg-[#EDE8E3] animate-pulse" />
              <div className="h-4 w-20 rounded bg-[#EDE8E3] animate-pulse" />
            </div>
          </div>
          <div className="sm:flex-shrink-0 h-20 w-20 rounded-xl bg-[#EDE8E3] animate-pulse" />
        </div>

        {/* Trust summary card */}
        <div className="rounded-2xl border border-[#EDE8E3] bg-white p-5 mb-6 shadow-sm space-y-2.5">
          <div className="h-3 w-32 rounded bg-[#EDE8E3] animate-pulse" />
          <div className="h-4 w-full rounded bg-[#EDE8E3] animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-[#EDE8E3] animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-[#EDE8E3] animate-pulse mt-2" />
        </div>

        {/* Info grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-[#EDE8E3] bg-white p-4 shadow-sm space-y-2">
              <div className="h-3 w-16 rounded bg-[#EDE8E3] animate-pulse" />
              <div className="h-4 w-full rounded bg-[#EDE8E3] animate-pulse" />
              <div className="h-3 w-24 rounded bg-[#EDE8E3] animate-pulse" />
            </div>
          ))}
        </div>

        {/* Customer Intelligence cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#EDE8E3] bg-white p-4 space-y-2">
              <div className="h-3 w-28 rounded bg-[#EDE8E3] animate-pulse" />
              <div className="h-4 w-full rounded bg-[#EDE8E3] animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-[#EDE8E3] animate-pulse" />
            </div>
          ))}
        </div>

        {/* Reviews skeleton */}
        <div className="h-7 w-44 rounded-lg bg-[#EDE8E3] animate-pulse mb-5" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#EDE8E3] bg-white p-5 shadow-sm space-y-2.5">
              <div className="flex justify-between">
                <div className="h-4 w-28 rounded bg-[#EDE8E3] animate-pulse" />
                <div className="h-4 w-16 rounded bg-[#EDE8E3] animate-pulse" />
              </div>
              <div className="h-3.5 w-full rounded bg-[#EDE8E3] animate-pulse" />
              <div className="h-3.5 w-5/6 rounded bg-[#EDE8E3] animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
