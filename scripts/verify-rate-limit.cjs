'use strict';

// Synthetic PostgreSQL integration tests only. Never read DATABASE_URL, provider
// credentials, or inherited libpq settings. The database name and user are fixed.
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const host = process.env.REVIEWRANK_TEST_PG_HOST || '127.0.0.1';
const port = process.env.REVIEWRANK_TEST_PG_PORT || '5432';
if (!['127.0.0.1', 'localhost', '::1'].includes(host) &&
    !/^\/tmp\/reviewrank-hardening-pg-[a-zA-Z0-9_-]+$/.test(host)) {
  throw new Error('SQL verification requires an isolated loopback/private test socket.');
}
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error('Invalid local test port.');
}
const env = {
  PATH: process.env.PATH,
  HOME: '/nonexistent-reviewrank-test-home',
  PGHOST: host,
  PGPORT: port,
  PGUSER: 'postgres',
  PGDATABASE: 'reviewrank_rate_limit_test',
  PGCONNECT_TIMEOUT: '3',
  PGSSLMODE: 'disable',
  PGPASSFILE: '/nonexistent-reviewrank-test-passfile',
  PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=3000',
};
const args = ['-X', '-w', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'];

function sql(text, expectedError) {
  const result = spawnSync('psql', [...args, '-c', text], {
    env, encoding: 'utf8', timeout: 15_000,
  });
  if (expectedError) {
    assert.notEqual(result.status, 0, 'untrusted role unexpectedly succeeded');
    assert.match(result.stderr || '', expectedError);
  } else {
    assert.equal(result.status, 0, result.stderr || 'local SQL process failed');
  }
  return result.stdout.trim();
}

function file(relativePath) {
  const result = spawnSync('psql', [...args, '-f', path.join(root, relativePath)], {
    env, encoding: 'utf8', timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr || 'local SQL file failed');
}

async function concurrent(text) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [...args, '-c', text], { env });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => child.kill(), 15_000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(errors || 'local concurrent SQL failed'));
      else resolve(output.trim());
    });
  });
}

async function main() {
  assert.equal(sql('SELECT current_database();'), 'reviewrank_rate_limit_test');
  sql(`DO $roles$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $roles$;`);
  file('supabase/migrations/20261014_shared_rate_limit.sql');
  // A second apply must preserve data/permissions and remain safe.
  file('supabase/migrations/20261014_shared_rate_limit.sql');
  file('scripts/verify-rate-limit.sql');
  for (const role of ['anon', 'authenticated']) {
    sql(`SET ROLE ${role}; SELECT public.reviewrank_rate_limit(repeat('d',64),5,86400000);`,
      /permission denied for function reviewrank_rate_limit/);
    sql(`SET ROLE ${role}; SELECT count(*) FROM public.reviewrank_rate_limit_counters;`,
      /permission denied for table reviewrank_rate_limit_counters/);
  }
  // Unique synthetic key, no raw IP/user identity. Forty concurrent connections
  // must get exactly seven permits, not seven per application/server instance.
  const key = require('node:crypto').randomBytes(32).toString('hex');
  const outcomes = await Promise.all(Array.from({ length: 40 }, () => concurrent(
    `SET ROLE service_role; SELECT public.reviewrank_rate_limit('${key}',7,86400000);`
  )));
  assert.equal(outcomes.filter((value) => value === 't').length, 7);
  assert.equal(outcomes.filter((value) => value === 'f').length, 33);
  assert.equal(sql(`SELECT request_count FROM public.reviewrank_rate_limit_counters WHERE key_hash='${key}';`), '7');
  sql(`DELETE FROM public.reviewrank_rate_limit_counters WHERE key_hash='${key}';`);
  console.log('Shared-limiter SQL passed: idempotence, RLS/privileges, validation, cleanup and 40 concurrent calls (7 allowed).');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
