-- Apply before deploying geographic lead matching. No automatic geocoding,
-- paid API calls, or updates to existing partners occur in this migration.
alter table partners
  add column if not exists service_area_location_source text,
  add column if not exists service_area_verified_at timestamptz;

alter table leads
  add column if not exists service_area_latitude double precision,
  add column if not exists service_area_longitude double precision,
  add column if not exists service_area_source text,
  add column if not exists partner_sharing_consented_at timestamptz;

-- Quote buttons on search cards use exact-ID JSONB containment. Keep that
-- lookup indexed rather than scanning every retained result array.
create index if not exists search_cache_lead_business_idx
  on search_cache using gin (results jsonb_path_ops)
  where cache_key like 'search:%';

-- NOT VALID preserves legacy rows for a controlled operator review; new writes
-- must satisfy the constraints. NULL partner centers remain ineligible in code.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partners_service_area_bounds' and conrelid = 'partners'::regclass
  ) then
    alter table partners add constraint partners_service_area_bounds check (
      service_radius_miles between 1 and 200
      and (
        (latitude is null and longitude is null)
        or (latitude is not null and longitude is not null
          and latitude between -90 and 90 and longitude between -180 and 180)
      )
    ) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_service_area_bounds' and conrelid = 'leads'::regclass
  ) then
    alter table leads add constraint leads_service_area_bounds check (
      (service_area_latitude is null and service_area_longitude is null)
      or (service_area_latitude is not null and service_area_longitude is not null
        and service_area_latitude between -90 and 90
        and service_area_longitude between -180 and 180)
    ) not valid;
  end if;
end $$;
