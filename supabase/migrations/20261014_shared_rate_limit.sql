BEGIN;

CREATE TABLE IF NOT EXISTS public.reviewrank_rate_limit_counters (
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_hash, window_start),
  CONSTRAINT reviewrank_rate_limit_hash_format CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT reviewrank_rate_limit_count_positive CHECK (request_count > 0)
);

CREATE INDEX IF NOT EXISTS reviewrank_rate_limit_expires_idx
  ON public.reviewrank_rate_limit_counters (expires_at);

ALTER TABLE public.reviewrank_rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reviewrank_rate_limit_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.reviewrank_rate_limit_counters TO service_role;

CREATE OR REPLACE FUNCTION public.reviewrank_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_ms integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window_number bigint;
  v_window_start timestamptz;
  v_allowed boolean;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 2147483647
     OR p_window_ms IS NULL OR p_window_ms < 1 OR p_window_ms > 2147483647 THEN
    RAISE EXCEPTION 'invalid rate limit arguments' USING ERRCODE = '22023';
  END IF;

  v_window_number := pg_catalog.floor(
    pg_catalog.date_part('epoch', v_now) * 1000 / p_window_ms
  )::bigint;
  v_window_start := pg_catalog.to_timestamp(
    (v_window_number * p_window_ms)::double precision / 1000
  );

  INSERT INTO public.reviewrank_rate_limit_counters
    (key_hash, window_start, request_count, expires_at)
  VALUES (
    p_key_hash,
    v_window_start,
    1,
    v_window_start + (p_window_ms::double precision * interval '1 millisecond') * 2
  )
  ON CONFLICT (key_hash, window_start) DO UPDATE
    SET request_count = public.reviewrank_rate_limit_counters.request_count + 1
    WHERE public.reviewrank_rate_limit_counters.request_count < p_limit
  RETURNING true INTO v_allowed;

  WITH expired AS (
    SELECT key_hash, window_start
    FROM public.reviewrank_rate_limit_counters
    WHERE expires_at <= v_now
    ORDER BY expires_at
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.reviewrank_rate_limit_counters AS counters
  USING expired
  WHERE counters.key_hash = expired.key_hash
    AND counters.window_start = expired.window_start;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.reviewrank_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reviewrank_rate_limit(text, integer, integer)
  TO service_role;

COMMIT;
