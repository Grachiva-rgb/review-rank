-- Business report requests submitted by business owners
create table if not exists business_report_requests (
  id               uuid        primary key default gen_random_uuid(),
  business_name    text        not null,
  business_place_id text,
  owner_name       text        not null,
  owner_email      text        not null,
  note             text,
  status           text        not null default 'new',
  created_at       timestamptz not null default now()
);

create index if not exists business_report_requests_created_at_idx
  on business_report_requests (created_at desc);

create index if not exists business_report_requests_status_idx
  on business_report_requests (status);

-- RLS (enable once Supabase auth is configured)
-- alter table business_report_requests enable row level security;
