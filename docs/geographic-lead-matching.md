# Geographic lead matching — rollout for issue #12

## Behavior

- Quote requests are for the **area of the viewed business**, not an inferred
  customer job address. The form names this area and requires explicit consent
  to sharing with matching local partners; the viewed business is not guaranteed
  to receive the request.
- The server reads the exact business ID/name/coordinates from fresh,
  service-role-owned detail/search caches. Browser names/coordinates are ignored.
  A cache miss/unavailable database rejects the request, without a Google call.
- Coverage and delivery share the active/category/radius matcher. Unknown,
  nonfinite, out-of-range partner/lead coordinates and invalid radii never match.
  Coverage is an advisory five-minute hint; delivery always matches again.
- Partner signup requires a recognized US service city/state and measures the
  radius from that **city center**, not an exact business address. Signup
  performs one 24-hour-cached geocoding lookup and saves the center before Stripe
  checkout. Geocoding/database failure never becomes nationwide coverage or a
  checkout for an unsaved partner.
- Existing partners with absent/invalid centers remain excluded until reviewed
  and backfilled. No scoring formula or cache retention period changes.

## Approved operator rollout (not executed by this pull request)

1. Confirm the deployment revision, existing partner/lead schemas and applied
   RLS migrations. Obtain approval for production migration and any paid
   geocoding backfill.
2. Apply `supabase/migrations/20261013_geographic_lead_matching.sql` before the
   application change. It adds nullable provenance/consent fields, a search-cache
   containment index, and idempotent bounds checks, preserving existing rows
   with `NOT VALID`. Review table sizes and choose an approved migration window
   because index creation can temporarily block cache writes. It does not resolve
   partners, contact customers, or change subscription statuses.
3. With server-side environment variables supplied securely, inspect a bounded
   batch:

   ```sh
   npx tsx scripts/backfill-partner-locations.ts --limit 10
   ```

   Dry-run reads at most 10 candidate partner records, prints IDs/statuses only,
   makes no Google calls and performs no writes.
4. Review the partner-declared service city/state and radius with the business.
   Only with backfill approval, run the same command with `--apply`.
   The hard per-invocation ceiling is 25 selected partners and at most 25
   geocoding attempts, with identical city/state lookups reused in the batch.
   Native CLI fetch does not provide Next's persistent fetch cache: do not
   assume repeated CLI runs are free. Failures remain unmatched; correct
   manually flagged records before they repeatedly occupy the oldest batch.
5. Inspect results and remaining unknown/invalid locations before another
   approved batch. Do not enable unknown-location nationwide fallback to restore
   volume. Validate SQL constraints after repairing legacy records.
6. Deploy a preview and test cache-hit quote submissions, cold-cache rejection,
   forged coordinates, inside/outside coverage, missing partner centers, signup
   failure, and consent. Use test mail/Stripe only. Confirm usage: quote and
   coverage paths must generate zero Google requests.
7. After preview checks and separate deployment approval, deploy production and
   monitor delivery failures, rejected area lookups, lead counts and signup
   geocoding volume. Old clients without consent fail closed and must reload.

## Limits

This is coarse business-area matching, not proof that a partner covers a
customer's exact job address. Exact-address quoting needs a separately designed,
consented location flow. API quotas/retention compliance and shared rate limits
remain separate tracked issues. Do not undo the safety fix during rollback:
rolling back code can restore category-wide sharing; retain a fail-closed
submission gate until reviewed. The additive schema can remain.
