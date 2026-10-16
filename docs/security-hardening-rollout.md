# Security-hardening rollout

This candidate does not automatically change production settings or apply SQL.
Do not treat a merged application change as completion of every infrastructure gate.

## Application changes

- Async shared fixed-window rate limiting is available for search, results,
  comparison, details, autocomplete, lead/report/checkout requests, coverage,
  and admin access.
- The admin proxy checks its 30-per-minute IP budget before comparing credentials.
  Correct credentials cannot bypass an exhausted budget. Page-level Basic Auth
  remains independent; this change does not introduce identity/MFA.
- Business detail throttling runs in the proxy before page AND metadata rendering.
  The page's daily ISR, business-specific SEO metadata, and persistent caches remain
  intact; do not add request headers to that page simply to meter it.
- RPC keys are HMACs, not raw IP addresses. Shared state uses the database clock,
  atomic counters, bounded indexed cleanup, RLS and service-role-only RPC access.
  Fixed windows can permit a burst across a boundary; this is not a rolling window.
  Service-role key rotation changes counter identities; coordinate rotations with
  active budgets and retain independent provider quotas.
- CSP adds object/base/form restrictions and removes the powered-by header.
  Public-page inline scripts remain allowed pending a separate nonce/hash rollout
  tested against Next.js streaming, ISR, analytics and native WebViews.
- CI uses read-only token permissions, SHA-pinned actions and isolated PostgreSQL
  integration/concurrency checks. SQL tests reject remote hosts, ignore production
  connection variables and use only a fixed synthetic test database.

## Shared-state and budget activation

1. Rehearse the migration and application in isolated staging. Apply
   `supabase/migrations/20261014_shared_rate_limit.sql` only to the intended database
   with explicit release approval. It creates only the counter table/index and
   restricted RPC; no customer tables are changed.
2. Verify the new table's RLS and lack of anon/authenticated access. Verify that
   only service_role can execute the RPC and that two independent clients share
   one allowance. CI performs this against synthetic local PostgreSQL, not a live
   Supabase project's PostgREST gateway.
3. Use the existing server-only Supabase URL and service-role secret in secure
   environment tooling. Never copy production credentials into a preview.
4. Set `RATE_LIMIT_BACKEND=supabase` only after the migration is verified. Missing,
   errored, timed-out or malformed RPC responses deny access. Invalid backend names
   also deny access. Unset/empty/`local` retains the previous per-instance limiter.
5. Set a positive integer `GOOGLE_PLACES_DAILY_REQUEST_LIMIT` chosen by the owner
   from provider pricing/traffic needs. No business dollar budget is assumed here.
   Shared mode blocks new Places fetches if this cap is missing or invalid.
6. The global daily counter covers Places Text Search, Details and Autocomplete,
   **not Geocoding or Tripadvisor**. It counts attempts after the persistent-cache
   check; Next's fetch cache can still serve one of those attempts without a billed
   upstream request. This conservative count is not an invoice meter.
7. Preserve all existing cache keys, TTLs, field masks and freshness checks.
   Persistent cache hits do not consume the global Places counter. Set provider-side
   API restrictions and quotas as independent controls; budget alerts alone do not
   cap spend, and per-request SKU prices differ.
8. Check rejected requests, cache hits, shared failure behavior and representative
   request latency in staging. Do not run valid quotes, payments, emails or paid
   cold searches without specific approval.
9. Request approval for the tested production release, additive migration and
   environment activation. Deployment on `fix/production-security-hardening` is
   disabled until preview isolation is intentionally configured.

## Repository and secret controls

Apply these separately with repository/provider administration approval:

- Require the actual CI `test` check on main, block force-push/deletion, and choose
  PR/review rules that the available maintainers can satisfy. A solo maintainer
  cannot approve their own PR; do not create an unusable release gate.
- Enable automated Dependabot security updates. The committed npm configuration
  is security-only (routine version PR limit zero); the repository setting is still
  necessary. Review grouped security PRs through CI.
- Give production and preview separate default admin-secret records and review
  branch overrides/build access before activation. Never print or compare values
  in chat or commit credentials.
- Plan identity-backed admin MFA or a suitable access gateway separately. Password
  throttling is useful, but not a substitute for per-person access and auditability.

## Recovery

If shared enforcement fails, keep paid work fail-closed while investigating.
Do not silently disable shared protection as an incident fallback. Cache-only
degradation requires a separately tested code path: normal route limits intentionally
deny requests when the shared backend is unavailable. Reverting to an old commit
that ignores the new settings would remove the shared controls.

Do not drop the counter schema during a code rollback, reverse geographic safety
constraints, activate partners, or attempt a PostgreSQL engine downgrade. Database
engine maintenance follows the separate approved upgrade/recovery runbook.
