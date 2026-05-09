-- Search result cache
-- Reduces Google Places Text Search API calls for repeated/common queries.
-- TTL enforced at query time (30 minutes). Old rows are periodically cleaned
-- up by the search_cache_cleanup scheduled function (or manual DELETE).

CREATE TABLE IF NOT EXISTS search_cache (
  cache_key    TEXT        PRIMARY KEY,
  results      JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Used when TTL-filtering rows on read and when running cleanup
CREATE INDEX IF NOT EXISTS search_cache_created_at_idx ON search_cache (created_at);

-- Only service role can access (no public read/write)
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;
