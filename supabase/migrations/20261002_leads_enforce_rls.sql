-- Two conflicting `leads` migrations shipped historically:
--   0003_leads.sql          — id bigserial, NO row level security
--   20260507_leads.sql      — id uuid, RLS enabled
-- Both used `create table if not exists`, so whichever ran first won silently.
-- If 0003 won, the leads table (customer names, phone numbers, job details)
-- has sequential integer ids and is readable with the anon key.
--
-- This migration is idempotent and safe under EITHER schema: it only enforces
-- RLS (the service-role key bypasses RLS, so application code is unaffected).
-- 0003_leads.sql is deleted from the repo alongside this change so fresh
-- environments can no longer pick the unprotected variant.

alter table if exists leads enable row level security;

-- No policies are created deliberately: like partners/lead_deliveries, the
-- table is service-role-only.
