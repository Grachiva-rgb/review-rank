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
