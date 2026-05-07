'use client';

import Link from 'next/link';
import { useSavedBusinesses } from '@/hooks/useSavedBusinesses';
import NavLogo from '@/components/NavLogo';
import SmartScoreBadge from '@/components/SmartScoreBadge';
import StarRating from '@/components/StarRating';

export default function SavedPage() {
  const { saved, removeSaved, hydrated } = useSavedBusinesses();

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      {/* Nav */}
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/"><NavLogo size="sm" /></Link>
          <span className="text-[#D9CEC8]">/</span>
          <span className="text-sm text-[#7A6B63]">Saved businesses</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl text-[#241C15] mb-1">Saved Businesses</h1>
          <p className="text-sm text-[#7A6B63]">
            Businesses you've bookmarked for future reference.
          </p>
        </div>

        {!hydrated ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[#EDE8E3] bg-white h-24 animate-pulse" />
            ))}
          </div>
        ) : saved.length === 0 ? (
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-10 text-center">
            <svg
              className="h-10 w-10 text-[#D9CEC8] mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <p className="text-[#5A4A3F] font-medium mb-1">No saved businesses yet</p>
            <p className="text-sm text-[#7A6B63] mb-6">
              Tap the heart on any business card to save it here.
            </p>
            <Link
              href="/"
              className="inline-block rounded-xl bg-[#8B5E3C] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6B4A2F] transition-colors"
            >
              Search businesses
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {saved.map((biz) => {
              const detailHref = `/business/${biz.placeId}${biz.category ? `?cat=${encodeURIComponent(biz.category)}` : ''}`;
              const savedDate = new Date(biz.savedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={biz.placeId}
                  className="flex gap-4 rounded-2xl border border-[#EDE8E3] bg-white px-5 py-4 shadow-sm"
                >
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <Link href={detailHref}>
                        <h2 className="font-display text-lg font-semibold text-[#241C15] hover:text-[#8B5E3C] transition-colors leading-snug">
                          {biz.name}
                        </h2>
                      </Link>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <StarRating rating={biz.rating} />
                      <span className="text-sm font-medium text-[#241C15]">{biz.rating.toFixed(1)}</span>
                      <span className="text-xs text-[#9A8C85]">
                        {biz.reviewCount.toLocaleString()} reviews
                      </span>
                    </div>

                    <p className="text-xs text-[#9A8C85] truncate mb-2">{biz.address}</p>

                    <div className="flex items-center gap-1 -mx-1">
                      <Link
                        href={detailHref}
                        className="text-xs text-[#5A4A3F] hover:text-[#241C15] transition-colors px-1 py-2 min-h-[44px] flex items-center"
                      >
                        Full trust analysis →
                      </Link>
                      <span className="text-[#EDE8E3] select-none">·</span>
                      <span className="text-xs text-[#B8A89F] px-1">Saved {savedDate}</span>
                    </div>
                  </div>

                  {/* Score + remove */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <SmartScoreBadge score={biz.score} />
                    <button
                      type="button"
                      onClick={() => removeSaved(biz.placeId)}
                      aria-label="Remove from saved"
                      className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-[#8B5E3C]/40 bg-[#8B5E3C]/5 text-[#8B5E3C] hover:bg-[#8B5E3C]/10 transition-colors min-h-[36px]"
                    >
                      <svg className="h-4 w-4" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      Saved
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="pt-4 text-center">
              <Link
                href="/"
                className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F] underline underline-offset-2 transition-colors"
              >
                Search for more businesses
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
