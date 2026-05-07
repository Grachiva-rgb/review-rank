-- Partners: businesses paying to receive matched leads.
create table if not exists partners (
  id                     uuid primary key default gen_random_uuid(),
  business_name          text not null,
  contact_email          text not null,
  contact_phone          text,
  category               text not null,
  city                   text,
  state                  text,
  latitude               double precision,
  longitude              double precision,
  service_radius_miles   integer not null default 25,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text not null default 'pending'
                         check (status in ('pending','active','past_due','canceled')),
  monthly_price_cents    integer not null default 9900,
  created_at             timestamptz not null default now(),
  activated_at           timestamptz,
  canceled_at            timestamptz
);

create index if not exists partners_category_idx on partners (category) where status = 'active';
create index if not exists partners_geo_idx       on partners (latitude, longitude) where status = 'active';

-- Lead deliveries: record of which partners received which leads.
create table if not exists lead_deliveries (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null,
  partner_id     uuid not null references partners(id) on delete cascade,
  delivered_at   timestamptz not null default now(),
  email_status   text not null default 'pending'
                 check (email_status in ('pending','sent','failed','bounced')),
  resend_id      text,
  error_message  text
);

create index if not exists lead_deliveries_lead_idx    on lead_deliveries (lead_id);
create index if not exists lead_deliveries_partner_idx on lead_deliveries (partner_id);

-- RLS: keep these server-only for now. Only service role writes/reads.
alter table partners         enable row level security;
alter table lead_deliveries  enable row level security;
