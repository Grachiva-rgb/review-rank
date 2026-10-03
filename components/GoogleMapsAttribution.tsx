/**
 * Google Maps attribution — REQUIRED by Google Maps Platform policy whenever
 * Places API content is displayed without a Google Map (ToS §3.2.2(b);
 * Places API policies "Attribution requirements").
 *
 * Policy constraints implemented here:
 * - Text form "Google Maps" (logo preferred where art assets exist; text is
 *   the sanctioned fallback for constrained UI) in a sans-serif, weight 400,
 *   12–16px, approved grey #5E5E5E, with translate="no" and unmodified
 *   capitalization.
 * - Must sit within the same visual container as the Google-sourced content,
 *   near its top or bottom — NOT in a distant page footer.
 * - Must not be positioned so it appears to attribute ReviewRank's
 *   proprietary score to Google — always attach it to the Google data
 *   (ratings, review counts, reviews, contact info), never to the score.
 */
export default function GoogleMapsAttribution({
  className = '',
}: {
  className?: string;
}) {
  return (
    <span
      translate="no"
      className={`inline-flex items-center gap-1 text-xs text-[#5E5E5E] font-sans font-normal ${className}`}
    >
      Business data: Google Maps
    </span>
  );
}
