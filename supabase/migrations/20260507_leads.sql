-- Customer quote-request leads. Referenced by lead_deliveries via lead_id.
create table if not exists leads (
  id                uuid primary key default gen_random_uuid(),
  contact_name      text not null,
  contact_phone     text not null,
  description       text not null,
  business_name     text not null,
  business_place_id text,
  category          text not null default 'general',
  status            text not null default 'new'
                    check (status in ('new','contacted','closed')),
  created_at        timestamptz not null default now()
);

create index if not exists leads_category_idx    on leads (category);
create index if not exists leads_created_at_idx  on leads (created_at desc);

alter table leads enable row level security;
