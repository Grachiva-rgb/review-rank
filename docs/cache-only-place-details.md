# Cache-only place details

`getPlaceDetails` reads the existing fresh Supabase detail cache before requiring
`GOOGLE_PLACES_API_KEY`. A key is required only when an actual Google request is
needed. This lets a provider-key-free staging preview exercise cached business
details without enabling paid provider requests.

## Preserved behavior

- The cache key, raw Google payload shape, existing freshness window, scoring,
  attribution, and cache-write behavior are unchanged.
- Missing, expired, unavailable, or timed-out caches do not use stale data.
  Without a Google key they fail before any Google request.
- A configured-key cache miss retains the existing request field mask, escaped
  place ID, response handling, and best-effort cache write.
- Consumer Tripadvisor enrichment remains cache-only. This change does not
  enable Tripadvisor ingestion or add provider credentials.
- API validation and generic error responses are unchanged.

## Acceptance

Use an existing fresh, non-hospitality synthetic detail fixture in staging, with
Google Places and Tripadvisor keys absent. Verify the detail API returns the
cached business and the business page renders its name. No quote submission is
needed to verify this change.

Unit regressions mock all outbound fetches and cover both cache hits and
fail-closed misses. Never use a real provider key for these tests.

This fix does not change search caching, prove production billing savings,
complete the result-card quote-modal journey, or independently verify previously
saved lead location/consent fields. Those checks remain separately tracked.
