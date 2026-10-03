'use server';

/**
 * Admin mutations. Server actions invoked from /admin/* pages, which sit
 * behind HTTP Basic Auth in middleware.ts (the action POST targets the
 * protected /admin route itself, so the same auth gate applies).
 *
 * Until these existed, the leads/report tables had status columns no code
 * could ever update — rows stayed 'new' forever and the "N new" badge
 * became meaningless after week one.
 */
import { revalidatePath } from 'next/cache';
import { sbUpdate, isSupabaseConfigured } from '@/lib/supabase';

const LEAD_STATUSES = new Set(['new', 'contacted', 'closed']);
const REPORT_STATUSES = new Set(['new', 'in_progress', 'fulfilled', 'closed']);
const ID_RE = /^[0-9a-f-]{36}$/i;

export async function updateLeadStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!isSupabaseConfigured() || !ID_RE.test(id) || !LEAD_STATUSES.has(status)) return;
  await sbUpdate('leads', `id=eq.${encodeURIComponent(id)}`, { status }).catch(() => {});
  revalidatePath('/admin/leads');
}

export async function updateReportStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!isSupabaseConfigured() || !ID_RE.test(id) || !REPORT_STATUSES.has(status)) return;
  await sbUpdate('business_report_requests', `id=eq.${encodeURIComponent(id)}`, { status }).catch(() => {});
  revalidatePath('/admin/reports');
}
