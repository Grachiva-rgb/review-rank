// Skeleton while the two Place Details calls resolve — previously the user
// stared at the prior page/blank tab for the full duration of two upstream
// API round-trips with zero feedback.
export default function CompareLoading() {
  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="border-b border-[#EDE8E3] px-4 py-4">
        <div className="max-w-4xl mx-auto h-6 w-40 rounded bg-[#EDE8E3] animate-pulse" />
      </div>
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="h-8 w-64 rounded bg-[#EDE8E3] animate-pulse mb-8" />
        <div className="grid sm:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-[#EDE8E3] bg-white p-6 space-y-4">
              <div className="h-6 w-3/4 rounded bg-[#EDE8E3] animate-pulse" />
              <div className="h-16 w-24 rounded-xl bg-[#EDE8E3] animate-pulse" />
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-3 w-full rounded bg-[#F2EDE7] animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
