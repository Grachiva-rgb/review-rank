'use client';

/**
 * Root error boundary. Without one, any uncaught render error (most
 * plausibly corrupt localStorage on /saved, or a hydration failure) landed
 * on Next's unstyled default screen with no way back.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="rounded-2xl border border-[#EDE8E3] bg-white p-8 shadow-sm">
          <div className="text-xs text-[#8B5E3C] uppercase tracking-widest font-mono mb-3">
            Something went wrong
          </div>
          <h1 className="font-display text-2xl text-[#241C15] mb-3">
            This page hit an unexpected error
          </h1>
          <p className="text-sm text-[#5A4A3F] leading-relaxed mb-6">
            It&apos;s been logged{error.digest ? ` (ref ${error.digest})` : ''}. Trying
            again usually resolves it.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="rounded-xl bg-[#8B5E3C] hover:bg-[#6B4A2F] text-white text-sm font-semibold px-5 py-2.5 transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-xl border border-[#EDE8E3] bg-white text-sm text-[#5A4A3F] px-5 py-2.5 hover:border-[#8B5E3C] transition-colors"
            >
              Back to search
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
