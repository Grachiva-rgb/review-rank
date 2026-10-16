# Managed PostgreSQL security-upgrade runbook

Planning only: this document does not authorize a restart, upgrade, or maintenance window.
Keep project-specific engine versions, recovery evidence, and operational findings in
the owner's private release record, rather than in this public repository.

## Preparation

1. Confirm the exact project, current managed image/build where available, and
   supported target in Supabase. Record backport evidence if available. Unknown
   backport coverage is not reassurance and need not delay an otherwise safe
   move to a supported patched target. The advisor is not a complete engine-CVE inventory.
2. Prefer a provider-supported, security-patched minor release on the current major
   line. Do not combine this work with a major upgrade or unrelated migrations.
3. Verify a recent backup/PITR point, retention, recovery point, and an isolated
   restore rehearsal. Record measured restore time and verification results
   privately. A healthy dashboard or backup timestamp is not restore evidence.
4. Rehearse in isolated staging with representative schema/extensions and the
   candidate application. Do not copy paid provider keys or production credentials.
5. Obtain owner approval for the exact target, maintenance window, expected
   interruption, operator, recovery decision points, and communication plan.

## Compatibility

Read the current [Supabase upgrade notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
and applicable release notes. That notice includes detection queries for ltree
indexes, GiST float indexes, custom selectivity estimators, and legacy pgcrypto
ciphers. Run only approved read-only metadata checks before maintenance; do not
decrypt user data or create helper functions without specific authorization.
Review Vault and all installed extensions against the supported target.

## Execution and acceptance

- Use Supabase's supported dashboard/provider procedure, not application SQL, to
  upgrade the managed engine. Do not guess UI labels; follow current provider guidance.
- Preserve grants, server-side service-role access, and RLS. Do not add permissive
  policies to clear informational deny-by-default advisor observations.
- Verify engine/build metadata, extension health, application availability,
  security headers, unauthorized-access rejection, cache readability, and the
  existing geographic schema/index/constraints after the provider reports ready.
- Use invalid/synthetic rejection paths by default: no valid quotes, partner
  activation, paid lookups, emails, payments, or production test leads.
- Existing geographic lead-matching changes are additive application migrations,
  not engine-upgrade or rollback steps. Preserve consent and fail-closed behavior.
- Watch application/database health using aggregate telemetry without logging PII
  or credential values. Record evidence and the actual interruption privately.

## Abort/recovery

Do not start with uncertain project identity/target support, missing restore evidence,
staging regressions, or absent maintenance approval. Stop on unexpected provider
status, integrity concerns, or failed acceptance checks. Use the approved,
provider-supported recovery procedure; never promise a blind engine downgrade,
destructive repair, or category-wide quote fallback.
