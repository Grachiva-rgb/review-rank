'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** e.g. "restaurants", "mechanics" */
  categoryPlural: string;
  /** e.g. "restaurants" (slug used in the search query) */
  categorySlug: string;
  /** e.g. "Cleveland" — the current page's city */
  currentCity: string;
}

/**
 * Shown on pre-ranked category/city pages.
 * Lets the user find the same category near their actual location —
 * useful when they landed on a city page that isn't their city.
 */
export default function NearMeSearch({ categoryPlural, categorySlug, currentCity }: Props) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'denied' | 'unavailable'>('idle');

  const handleClick = () => {
    if (!navigator.geolocation) {
      setState('unavailable');
      return;
    }

    setState('loading');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        router.push(
          `/results?category=${encodeURIComponent(categorySlug)}&lat=${lat}&lng=${lng}&location=current+location`
        );
      },
      (err) => {
        setState(err.code === 1 ? 'denied' : 'unavailable');
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="mb-6 rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-4 py-3">
      {(state === 'idle' || state === 'loading') && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-[#5A4A3F] flex-1">
            Showing {categoryPlural.toLowerCase()} in <strong>{currentCity}</strong>.
            {' '}Not there?
          </p>
          <button
            type="button"
            onClick={handleClick}
            disabled={state === 'loading'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B4A2F] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {state === 'loading' ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Getting location…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Find {categoryPlural.toLowerCase()} near me
              </>
            )}
          </button>
        </div>
      )}

      {(state === 'denied' || state === 'unavailable') && (
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="text-sm text-[#5A4A3F]">
            <span className="font-medium text-amber-800">Location access is off.</span>
            {' '}
            <a
              href={`/results?category=${encodeURIComponent(categorySlug)}`}
              className="underline underline-offset-2 text-[#8B5E3C] hover:text-[#6B4A2F]"
            >
              Search by city or ZIP instead →
            </a>
            {state === 'denied' && (
              <span className="block mt-1 text-xs text-amber-700">
                To enable GPS: Settings → Privacy → Location → allow reviewrank.app
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
