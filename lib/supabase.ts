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
/**
 * Insert a row, silently doing nothing if a row with the same `onConflict`
 * column already exists. Unlike sbUpsert (merge-duplicates), this never
 * overwrites existing column values — use it to seed rows whose fields other
 * writers own (e.g. registering a business for ingestion without resetting
 * its matched_at backoff).
 */
export async function sbInsertIgnore<T extends object>(
  table: string,
  row: T,
  onConflict: string
): Promise<void> {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  const res = await fetch(
    `${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
      body: JSON.stringify(row),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase insert-ignore ${table} failed: ${res.status} ${detail}`);
  }
}

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

/**
 * Delete rows matching `query`.
 *
 * `query` is REQUIRED and must be non-empty. PostgREST happily deletes every
 * row in a table when handed no filter, so an empty query is treated as a
 * programming error rather than passed through.
 */
export async function sbDelete(table: string, query: string): Promise<void> {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!query.trim()) {
    throw new Error(`sbDelete ${table}: refusing to delete with an empty filter`);
  }
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase delete ${table} failed: ${res.status} ${detail}`);
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
