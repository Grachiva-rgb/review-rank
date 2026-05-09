'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Place, SortFilter } from '@/lib/types';
import { detectCategory, BusinessCategory } from '@/lib/ranking';
import BusinessCard from './BusinessCard';
import FilterBar from './FilterBar';
import SearchForm from './SearchForm';
import CompareBar from './CompareBar';
import { track } from './PostHogProvider';

interface ResultsClientProps {
  places: Place[];
  query: string;
  location: string;
  category: string;
  error: string | null;
  isGps?: boolean;
  /** Optional message shown when ZIP-radius filtering was applied */
  locationMessage?: string | null;
}

export default function ResultsClient({
  places,
  query,
  location,
  category,
  error,
  isGps = false,
  locationMessage = null,
}: ResultsClientProps) {
  const [filter, setFilter] = useState<SortFilter>('smart_score');

  useEffect(() => {
    track.searchPerformed({
      category: category || '',
      location: location || '',
      isGps,
      resultCount: places.length,
    });
    // Fire once per (category, location) change — not on filter toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, location, isGps]);

  const detectedCategory: BusinessCategory = useMemo(
    () => detectCategory(category || query),
    [category, query]
  );

  const sortedPlaces = useMemo(() => {
    return [...places].sort((a, b) => {
      // Default "smart_score" filter now sorts by the 0–100 Review Rank Score
      // which blends Bayesian rating, volume, sentiment, and consistency.
      if (filter === 'smart_score') return b.review_rank_score - a.review_rank_score;
      if (filter === 'rating') return b.rating - a.rating;
      if (filter === 'reviews') return b.user_ratings_total - a.user_ratings_total;
      // rising_stars: high rating, prioritise under-300-review businesses
      if (filter === 'rising_stars') {
        const aRising = a.user_ratings_total < 300 ? 1 : 0;
        const bRising = b.user_ratings_total < 300 ? 1 : 0;
        if (aRising !== bRising) return bRising - aRising;
        return b.rating - a.rating;
      }
      return b.review_rank_score - a.review_rank_score;
    });
  }, [places, filter]);

  const risingStars = useMemo(
    () => places.filter((p) => p.rating >= 4.7 && p.user_ratings_total < 300),
    [places]
  );

  const safeQuery = (() => {
    try { return decodeURIComponent(query); } catch { return query; }
  })();

  const displayTitle = isGps && category ? (
    <>{category} <span className="text-[#7A6B63]">near</span> <span className="text-[#8B5E3C]">current location</span></>
  ) : category && location ? (
    <>{category} <span className="text-[#7A6B63]">in</span> {location}</>
  ) : (
    safeQuery
  );

  return (
    <div className="relative min-h-screen bg-[#FAF7F0]">
      <div className="relative z-10">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 min-w-0">
            <Link href="/" className="font-display text-lg text-[#241C15] flex-shrink-0" title="Home">
              Review<span className="text-[#8B5E3C]">Rank</span>
            </Link>
            {/* Explicit home link — visible on desktop where clicking the wordmark isn't obvious */}
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-[#7A6B63] hover:text-[#241C15] transition-colors flex-shrink-0"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </Link>
            <Link
              href="/saved"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-[#7A6B63] hover:text-[#8B5E3C] transition-colors flex-shrink-0"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Saved
            </Link>

            {/* Desktop: full compact search form */}
            <div className="hidden sm:flex flex-1 justify-end min-w-0 overflow-hidden">
              <SearchForm
                defaultLocation={location}
                defaultCategory={category}
                variant="compact"
              />
            </div>

            {/* Mobile: tap-to-refine pill showing current search */}
            <Link
              href={`/?category=${encodeURIComponent(category)}`}
              className="sm:hidden flex-1 flex items-center justify-end min-w-0"
            >
              <span className="flex items-center gap-1.5 rounded-full border border-[#D9CEC8] bg-white px-3 py-1.5 text-xs text-[#5A4A3F] max-w-[180px] truncate shadow-sm">
                <svg className="h-3 w-3 flex-shrink-0 text-[#8B5E3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate">{category || 'Edit search'}</span>
                <svg className="h-3 w-3 flex-shrink-0 text-[#9A8C85]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </span>
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="font-display text-3xl sm:text-4xl text-[#241C15] capitalize mb-1">
              {displayTitle}
            </h1>
            <p className="text-xs text-[#7A6B63]">
              Ranked by trust — balancing rating quality with review depth
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-red-700 font-medium mb-1">Failed to load results</p>
              <p className="text-[#7A6B63] text-sm">Unable to load results. Please try again.</p>
              <Link
                href="/"
                className="inline-block mt-4 text-sm text-[#8B5E3C] hover:text-[#6B4A2F]"
              >
                ← Try a new search
              </Link>
            </div>
          ) : places.length === 0 ? (
            <div className="rounded-2xl border border-[#EDE8E3] bg-white p-12 text-center shadow-sm">
              <p className="text-[#241C15] text-lg">No results found</p>
              <p className="text-[#7A6B63] text-sm mt-1">
                Try a different business type or location
              </p>
              <Link
                href="/"
                className="inline-block mt-4 text-sm text-[#8B5E3C] hover:text-[#6B4A2F]"
              >
                ← Back to search
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <FilterBar
                  currentFilter={filter}
                  onFilterChange={setFilter}
                  count={sortedPlaces.length}
                />
              </div>

              {/* Location context banner — shown when ZIP filtering was applied */}
              {locationMessage && (
                <div className="mb-5 rounded-xl border border-[#D9CEC8] bg-[#FAF7F0] px-4 py-3 flex items-center gap-2">
                  <svg className="h-4 w-4 flex-shrink-0 text-[#8B5E3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-xs text-[#5A4A3F]">{locationMessage}</p>
                </div>
              )}

              {/* Rising Stars callout */}
              {risingStars.length > 0 && filter !== 'rising_stars' && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 text-sm font-medium">Rising Stars</span>
                    <span className="text-xs text-amber-600">
                      {risingStars.length} {risingStars.length === 1 ? 'business' : 'businesses'}{' '}
                      with strong ratings and under 300 reviews
                    </span>
                  </div>
                  <button
                    onClick={() => setFilter('rising_stars')}
                    className="text-xs text-amber-700 font-medium hover:text-amber-900 transition-colors min-h-[44px] flex items-center px-1"
                  >
                    Show rising stars →
                  </button>
                </div>
              )}

              <div className="grid gap-4 sm:gap-5">
                {sortedPlaces.map((place, index) => (
                  <BusinessCard
                    key={place.place_id}
                    place={place}
                    rank={index + 1}
                    category={detectedCategory}
                  />
                ))}
              </div>

              {/* Trust footer */}
              <div className="mt-10 pt-6 border-t border-[#EDE8E3] text-center space-y-1">
                <p className="text-xs text-[#7A6B63] font-mono">
                  Rankings are based on public review signals only. No paid placements.
                </p>
                <p className="text-xs text-[#9A8C85]">
                  Designed to reduce bad experiences and help you choose with confidence.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
      <CompareBar />
    </div>
  );
}
