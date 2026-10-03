-- Reconciliation support: record the Stripe Checkout session on the partner
-- row at creation so paid-but-pending partners (webhook never arrived) can
-- be found and activated by the nightly job instead of silently paying for
-- nothing.
alter table partners add column if not exists checkout_session_id text;
create index if not exists partners_status_created_idx on partners (status, created_at);
