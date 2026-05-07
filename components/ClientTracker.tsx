'use client';

import { useEffect } from 'react';
import { track } from './PostHogProvider';

/**
 * Lightweight fire-and-forget tracker for Server Component pages.
 * Mount with the event type + payload and it records once on mount.
 */
type TrackerProps =
  | { event: 'business_viewed'; placeId: string; score: number; tier: string }
  | { event: 'methodology_viewed' }
  | { event: 'report_requested'; placeId: string; businessName: string };

export default function ClientTracker(props: TrackerProps) {
  useEffect(() => {
    if (props.event === 'business_viewed') {
      track.businessViewed({
        placeId: props.placeId,
        score: props.score,
        tier: props.tier,
      });
    } else if (props.event === 'methodology_viewed') {
      track.methodologyViewed();
    } else if (props.event === 'report_requested') {
      track.reportRequested({
        placeId: props.placeId,
        businessName: props.businessName,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
