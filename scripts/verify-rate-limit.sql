-- Run against an isolated Supabase-compatible PostgreSQL database after applying
-- 20261014_shared_rate_limit.sql. This script makes no provider/network calls and
-- rolls back its synthetic counter writes.
BEGIN;

DO $test$
DECLARE
  v_key text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  v_other_key text := 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  v_public_execute boolean;
  v_input record;
BEGIN
  IF to_regprocedure('public.reviewrank_rate_limit(text,integer,integer)') IS NULL THEN
    RAISE EXCEPTION 'shared rate-limit RPC missing';
  END IF;

  IF NOT has_function_privilege('service_role',
    'public.reviewrank_rate_limit(text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute rate-limit RPC';
  END IF;
  IF has_function_privilege('anon',
    'public.reviewrank_rate_limit(text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated',
    'public.reviewrank_rate_limit(text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'untrusted role can execute rate-limit RPC';
  END IF;
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc AS function
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(function.proacl, pg_catalog.acldefault('f', function.proowner))
    ) AS privilege
    WHERE function.oid = 'public.reviewrank_rate_limit(text,integer,integer)'::regprocedure
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ) INTO v_public_execute;
  IF v_public_execute THEN
    RAISE EXCEPTION 'PUBLIC can execute rate-limit RPC';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid =
    'public.reviewrank_rate_limit_counters'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on rate-limit counters';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviewrank_rate_limit_counters') THEN
    RAISE EXCEPTION 'unexpected rate-limit table policies';
  END IF;

  -- Long synthetic windows avoid a flaky test at a minute boundary.
  IF NOT public.reviewrank_rate_limit(v_key, 2, 2147483647) THEN
    RAISE EXCEPTION 'first fixed-window request was denied';
  END IF;
  IF NOT public.reviewrank_rate_limit(v_key, 2, 2147483647) THEN
    RAISE EXCEPTION 'second fixed-window request was denied';
  END IF;
  IF public.reviewrank_rate_limit(v_key, 2, 2147483647) THEN
    RAISE EXCEPTION 'request beyond configured limit was allowed';
  END IF;
  IF NOT public.reviewrank_rate_limit(v_other_key, 1, 2147483647) THEN
    RAISE EXCEPTION 'independent key did not receive an independent counter';
  END IF;

  BEGIN
    PERFORM public.reviewrank_rate_limit('invalid-hash', 1, 60000);
    RAISE EXCEPTION 'malformed HMAC key was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  FOR v_input IN SELECT * FROM (VALUES
    (NULL::text, 1, 1000), (v_key, 0, 1000), (v_key, -1, 1000),
    (v_key, NULL::integer, 1000), (v_key, 1, 0),
    (v_key, 1, -1), (v_key, 1, NULL::integer)
  ) AS inputs(key_hash, request_limit, window_ms)
  LOOP
    BEGIN
      PERFORM public.reviewrank_rate_limit(v_input.key_hash, v_input.request_limit, v_input.window_ms);
      RAISE EXCEPTION 'invalid bounds were accepted';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid='public.reviewrank_rate_limit(text,integer,integer)'::regprocedure
      AND prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)
  ) THEN RAISE EXCEPTION 'RPC security context is not fixed'; END IF;

  UPDATE public.reviewrank_rate_limit_counters SET request_count=2147483646
  WHERE key_hash=v_key;
  IF NOT public.reviewrank_rate_limit(v_key,2147483647,2147483647)
     OR public.reviewrank_rate_limit(v_key,2147483647,2147483647) THEN
    RAISE EXCEPTION 'maximum-count overflow protection failed';
  END IF;

  INSERT INTO public.reviewrank_rate_limit_counters
    (key_hash,window_start,request_count,expires_at)
  SELECT md5('expired-' || n::text) || md5('fixture-' || n::text),
    to_timestamp(1),1,to_timestamp(2) FROM generate_series(1,150) AS n;
  PERFORM public.reviewrank_rate_limit(repeat('c',64),2,2147483647);
  IF (SELECT count(*) FROM public.reviewrank_rate_limit_counters
      WHERE expires_at<=clock_timestamp())<>50 THEN
    RAISE EXCEPTION 'expiry cleanup was not bounded to 100';
  END IF;
  PERFORM public.reviewrank_rate_limit(repeat('c',64),2,2147483647);
  IF EXISTS (SELECT FROM public.reviewrank_rate_limit_counters
      WHERE expires_at<=clock_timestamp()) THEN
    RAISE EXCEPTION 'expired fixture rows were not cleaned';
  END IF;
END;
$test$;

ROLLBACK;
