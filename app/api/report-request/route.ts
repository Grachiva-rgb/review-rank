import { NextRequest, NextResponse } from 'next/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 254;
const MAX_NOTE_LEN = 1000;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { owner_name, owner_email, business_name, business_place_id, note } = body as Record<string, unknown>;

  // Validate required fields
  if (!owner_name || typeof owner_name !== 'string' || !owner_name.trim()) {
    return NextResponse.json({ error: 'owner_name is required' }, { status: 400 });
  }
  if (!owner_email || typeof owner_email !== 'string' || !owner_email.trim()) {
    return NextResponse.json({ error: 'owner_email is required' }, { status: 400 });
  }
  if (!business_name || typeof business_name !== 'string' || !business_name.trim()) {
    return NextResponse.json({ error: 'business_name is required' }, { status: 400 });
  }

  // Sanitize + length limits
  const sanitized = {
    owner_name: owner_name.trim().slice(0, MAX_NAME_LEN),
    owner_email: owner_email.trim().slice(0, MAX_EMAIL_LEN).toLowerCase(),
    business_name: business_name.trim().slice(0, MAX_NAME_LEN),
    business_place_id: typeof business_place_id === 'string' ? business_place_id.trim().slice(0, 200) : null,
    note: typeof note === 'string' ? note.trim().slice(0, MAX_NOTE_LEN) : null,
  };

  // Validate email format
  if (!EMAIL_RE.test(sanitized.owner_email)) {
    return NextResponse.json({ error: 'owner_email is not a valid email address' }, { status: 400 });
  }

  try {
    // Attempt to persist via Supabase REST API if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/business_report_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(sanitized),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[API /report-request] Supabase insert error:', res.status, detail);
        return NextResponse.json({ error: 'Unable to submit request. Please try again.' }, { status: 500 });
      }
    } else {
      // Supabase not configured — log server-side only
      console.log('[report-request] New submission (Supabase not configured):', {
        business_name: sanitized.business_name,
        business_place_id: sanitized.business_place_id,
        owner_name: sanitized.owner_name,
        owner_email: sanitized.owner_email,
        note: sanitized.note,
        submitted_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /report-request] Error:', error);
    return NextResponse.json({ error: 'Unable to submit request. Please try again.' }, { status: 500 });
  }
}
