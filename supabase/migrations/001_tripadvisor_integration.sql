-- ============================================================
-- 001_tripadvisor_integration.sql
-- Run this in your Supabase SQL Editor to enable TA integration
-- ============================================================

-- Maps Google Place IDs to Tripadvisor location IDs
CREATE TABLE IF NOT EXISTS business_id_mapping (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id  TEXT UNIQUE NOT NULL,
  ta_location_id   TEXT,
  match_confidence DECIMAL(3,2),          -- 0.00–1.00
  matched_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tripadvisor business snapshot (refreshed weekly by ingestion job)
CREATE TABLE IF NOT EXISTS tripadvisor_businesses (
  ta_location_id   TEXT PRIMARY KEY,
  google_place_id  TEXT REFERENCES business_id_mapping(google_place_id),
  name             TEXT,
  rating           DECIMAL(3,1),
  review_count     INTEGER,
  category         TEXT,
  traveler_ranking TEXT,                  -- e.g. "#4 of 3,102 Restaurants in Cleveland"
  price_level      TEXT,                  -- '$' | '$$ - $$$' | '$$$$'
  awards           JSONB DEFAULT '[]',    -- ["Travelers' Choice 2025"]
  subratings       JSONB DEFAULT '{}',    -- {food, service, value, ambiance, ...}
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_id_mapping_google
  ON business_id_mapping(google_place_id);

CREATE INDEX IF NOT EXISTS idx_tripadvisor_businesses_google
  ON tripadvisor_businesses(google_place_id);

CREATE INDEX IF NOT EXISTS idx_tripadvisor_businesses_fetched
  ON tripadvisor_businesses(fetched_at);

-- Optional: ingestion error log for debugging
CREATE TABLE IF NOT EXISTS ingestion_errors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    TEXT,
  source      TEXT DEFAULT 'tripadvisor',
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: service role key bypasses RLS automatically.
-- Enable RLS to block anon/public access (reads must use service role key).
ALTER TABLE business_id_mapping    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tripadvisor_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_errors       ENABLE ROW LEVEL SECURITY;
