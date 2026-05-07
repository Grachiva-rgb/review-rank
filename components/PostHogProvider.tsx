'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

/**
 * Client-side PostHog initialiser. No-ops when the key is missing so local
 * dev and preview builds keep working without analytics configured.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (!key) return;
    if (posthog.__loaded) return;

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false, // we capture manually below so query strings are included
      capture_pageleave: true,
      autocapture: true,
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.debug(false);
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    posthog.capture('$pageview', { $current_url: url, pathname });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Thin typed wrapper over posthog.capture so event names stay consistent
 * across the codebase. Safe to call when PostHog isn't initialised.
 */
export const track = {
  searchPerformed(props: { category: string; location: string; isGps: boolean; resultCount: number }) {
    if (!posthog.__loaded) return;
    posthog.capture('search_performed', props);
  },
  businessViewed(props: { placeId: string; rank?: number; score: number; tier: string }) {
    if (!posthog.__loaded) return;
    posthog.capture('business_viewed', props);
  },
  leadSubmitted(props: { placeId: string; category: string; businessName: string }) {
    if (!posthog.__loaded) return;
    posthog.capture('lead_submitted', props);
  },
  methodologyViewed() {
    if (!posthog.__loaded) return;
    posthog.capture('methodology_viewed');
  },
  reportRequested(props: { placeId: string; businessName: string }) {
    if (!posthog.__loaded) return;
    posthog.capture('report_requested', props);
  },
  partnerCheckoutStarted(props: { category: string; city: string }) {
    if (!posthog.__loaded) return;
    posthog.capture('partner_checkout_started', props);
  },
};
