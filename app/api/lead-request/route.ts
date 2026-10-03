import { NextRequest, NextResponse } from 'next/server';
import { deliverLeadToPartners } from '@/lib/leadDelivery';
import { normalizePartnerCategory } from '@/lib/categories';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Loose phone pattern — accepts common formats like (555) 000-0000, +1 555 000 0000, etc.
const PHONE_RE    = /^[\d\s\-\(\)\+\.]{7,20}$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

const MAX_NAME  = 120;
const MAX_PHONE = 30;
const MAX_DESC  = 600;

const DEL = 0x7f;
const MAX_CONTROL = 0x1f;
const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;

function isControl(code: number): boolean {
  return code <= MAX_CONTROL || code === DEL;
}

/**
 * Replace every control character with a space.
 *
 * For values that reach an email header: contact_name is interpolated into the
 * Resend `subject` in lib/leadDelivery.ts, and a CR/LF inside a header value is
 * the classic header-injection primitive. Resend's JSON API most likely rejects
 * or escapes this itself, but that guarantee should not live in a third party's
 * parser.
 *
 * Written against code points rather than a regex character class so the source
 * contains no escape sequences that a future edit could silently corrupt.
 */
function stripControl(s: string): string {
  let out = '';
  for (const ch of s) {
    out += isControl(ch.codePointAt(0) ?? 0) ? ' ' : ch;
  }
  return out;
}

/**
 * Drop control characters but keep tabs and line breaks — for free-text that
 * only lands in an HTML body (already escaped by leadHtml) or the admin UI,
 * where the user's line breaks are meaningful and harmless.
 */
function stripControlKeepBreaks(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === TAB || code === LF || code === CR || !isControl(code)) out += ch;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const { allowed } = rateLimit(`lead-request:${clientIp(request)}`, 5, 3_600_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    contact_name,
    contact_phone,
    description,
    business_name,
    business_place_id,
    business_lat,
    business_lng,
    category,
  } = body as Record<string, unknown>;

  // Validate required fields
  if (!contact_name || typeof contact_name !== 'string' || !contact_name.trim()) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  }
  if (!contact_phone || typeof contact_phone !== 'string' || !contact_phone.trim()) {
    return NextResponse.json({ error: 'Please enter a phone number.' }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Please describe what you need.' }, { status: 400 });
  }
  if (!business_name || typeof business_name !== 'string' || !business_name.trim()) {
    return NextResponse.json({ error: 'business_name is required' }, { status: 400 });
  }

  // Sanitize + length-cap
  const sanitized = {
    contact_name:      stripControl(contact_name).trim().slice(0, MAX_NAME),
    contact_phone:     stripControl(contact_phone).trim().slice(0, MAX_PHONE),
    description:       stripControlKeepBreaks(description).trim().slice(0, MAX_DESC),
    business_name:     stripControl(business_name).trim().slice(0, MAX_NAME),
    business_place_id: (typeof business_place_id === 'string' && PLACE_ID_RE.test(business_place_id.trim()))
                         ? business_place_id.trim()
                         : null,
    // Normalize the incoming category string against the canonical partner
    // taxonomy. This collapses drift between the consumer-side ranking enum
    // (BusinessCategory — e.g. "automotive", "home_services") and the
    // partner-side slugs stored in the `partners` table (e.g. "auto-repair",
    // "general-contractor"). Unknown or missing categories fall back to
    // "other" so the lead is still persisted but matches no partner.
    category:          normalizePartnerCategory(
                         typeof category === 'string' ? category : null
                       ) ?? 'other',
    status: 'new',
  };

  // Validate phone format
  if (!PHONE_RE.test(sanitized.contact_phone)) {
    return NextResponse.json(
      { error: 'Please enter a valid phone number.' },
      { status: 400 }
    );
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let leadId: string | undefined;
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer':        'return=representation',
        },
        body: JSON.stringify(sanitized),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[API /lead-request] Supabase insert error:', res.status, detail);
        return NextResponse.json(
          { error: 'Unable to submit request. Please try again.' },
          { status: 500 }
        );
      }

      // Extract inserted lead id for delivery correlation.
      try {
        const rows = (await res.json()) as Array<{ id?: string }>;
        leadId = rows?.[0]?.id;
      } catch { /* representation may be empty — non-fatal */ }

      // Await delivery. Serverless functions freeze unresolved promises once
      // the response is returned, so fire-and-forget drops the email send.
      // The partner-matching loop is fast (single Supabase select + Resend
      // sends, typically <2s total), so awaiting is worth the latency.
      try {
        // The quote button has always sent the business's coordinates; this
        // route used to drop them, which made radius matching dead code.
        const lat = typeof business_lat === 'number' && Number.isFinite(business_lat)
          && business_lat >= -90 && business_lat <= 90 ? business_lat : undefined;
        const lng = typeof business_lng === 'number' && Number.isFinite(business_lng)
          && business_lng >= -180 && business_lng <= 180 ? business_lng : undefined;

        await deliverLeadToPartners({
          leadId,
          category:     sanitized.category,
          businessName: sanitized.business_name,
          contactName:  sanitized.contact_name,
          contactPhone: sanitized.contact_phone,
          description:  sanitized.description,
          lat,
          lng,
        });
      } catch (err) {
        // Delivery failures must not block the user from submitting their
        // request. Log and continue.
        console.error('[lead-request] delivery error:', err);
      }
    } else {
      // Supabase not configured — log category/business info only (no PII)
      console.log('[lead-request] New lead (Supabase not configured):', {
        category: sanitized.category,
        business_name: sanitized.business_name,
        business_place_id: sanitized.business_place_id,
        submitted_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /lead-request] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to submit request. Please try again.' },
      { status: 500 }
    );
  }
}
