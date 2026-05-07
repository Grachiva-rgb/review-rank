-- ReviewRank: saved_searches table
-- Run this migration in your Supabase SQL editor or via the Supabase CLI.

create table if not exists public.saved_searches (
  id           uuid primary key default gen_random_uuid(),
  query        text        not null,
  location     text        not null,
  category     text        not null,
  results_json jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- Index for fast lookup by query text
create index if not exists saved_searches_query_idx
  on public.saved_searches (query);

-- Index for chronological listing
create index if not exists saved_searches_created_at_idx
  on public.saved_searches (created_at desc);

-- Optional: enable Row Level Security (recommended for production)
-- alter table public.saved_searches enable row level security;
--
-- Allow all reads (public):
-- create policy "Anyone can read saved searches"
--   on public.saved_searches for select using (true);
--
-- Allow all inserts (public):
-- create policy "Anyone can insert saved searches"
--   on public.saved_searches for insert with check (true);

comment on table  public.saved_searches               is 'Cached search results from Google Places API';
comment on column public.saved_searches.query         is 'Full search string, e.g. "coffee shops in Austin"';
comment on column public.saved_searches.location      is 'Location portion of the search, e.g. "Austin"';
comment on column public.saved_searches.category      is 'Business type portion, e.g. "coffee shops"';
comment on column public.saved_searches.results_json  is 'Array of NormalizedBusiness objects returned by the API';
comment on column public.saved_searches.created_at    is 'Timestamp when the search was cached';
