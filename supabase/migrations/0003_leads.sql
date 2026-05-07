-- 0003_leads.sql
-- Stores quote/service requests submitted by consumers on business cards.
-- Each row is one inbound lead for a specific business.

create table if not exists leads (
  id                bigserial    primary key,
  business_name     text         not null,
  business_place_id text,
  category          text         not null default 'general',
  contact_name      text         not null,
  contact_phone     text         not null,
  description       text,
  status            text         not null default 'new',  -- new | contacted | closed
  created_at        timestamptz  not null default now()
);

-- Fast lookups for the admin view
create index on leads (created_at desc);
create index on leads (status);
create index on leads (business_place_id);
