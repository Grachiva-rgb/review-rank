/**
 * Thin REST client for Supabase PostgREST. We intentionally avoid @supabase/supabase-js
 * to keep the bundle minimal and edge-compatible.
 *
 * All calls require the service role key (server-side only).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

export async function sbInsert<T extends object>(
  table: string,
  row: T,
  opts: { returning?: boolean } = {}
): Promise<unknown> {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({
      Prefer: opts.returning ? 'return=representation' : 'return=minimal',
    }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase insert ${table} failed: ${res.status} ${detail}`);
  }
  return opts.returning ? await res.json() : null;
}

export async function sbSelect<T = unknown>(
  table: string,
  query: string
): Promise<T[]> {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'GET',
    headers: headers(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase select ${table} failed: ${res.status} ${detail}`);
  }
  return (await res.json()) as T[];
}

/**
 * Upsert a row.
 *
 * PostgREST resolves `merge-duplicates` against the primary key unless told
 * otherwise. For tables whose natural key is a UNIQUE column rather than the
 * PK — business_id_mapping, whose PK is a generated UUID — pass `onConflict`
 * with that column name, or the write is treated as a plain insert and fails on
 * the unique constraint.
 */
export async function sbUpsert<T extends object>(
  table: string,
  row: T,
  opts: { onConflict?: string } = {}
): Promise<void> {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  const qs = opts.onConflict
    ? `?on_conflict=${encodeURIComponent(opts.onConflict)}`
    : '';
  const res = await fetch(`${url}/rest/v1/${table}${qs}`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase upsert ${table} failed: ${res.status} ${detail}`);
  }
}

export async function sbUpdate<T extends object>(
  table: string,
  query: string,
  patch: T
): Promise<void> {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase update ${table} failed: ${res.status} ${detail}`);
  }
}
