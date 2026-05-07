import { NextRequest, NextResponse } from 'next/server';

// Loose phone pattern — accepts common formats like (555) 000-0000, +1 555 000 0000, etc.
const PHONE_RE = /^[\d\s\-\(\)\+\.]{7,20}$/;

const MAX_NAME  = 120;
const MAX_PHONE = 30;
const MAX_DESC  = 600;

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

  const {
    contact_name,
    contact_phone,
    description,
    business_name,
    business_place_id,
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
    contact_name:      contact_name.trim().slice(0, MAX_NAME),
    contact_phone:     contact_phone.trim().slice(0, MAX_PHONE),
    description:       description.trim().slice(0, MAX_DESC),
    business_name:     business_name.trim().slice(0, MAX_NAME),
    business_place_id: typeof business_place_id === 'string'
                         ? business_place_id.trim().slice(0, 200)
                         : null,
    category:          typeof category === 'string'
                         ? category.trim().slice(0, 50)
                         : 'general',
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

    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer':        'return=minimal',
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
    } else {
      // Supabase not configured — log to server console
      console.log('[lead-request] New lead (Supabase not configured):', {
        ...sanitized,
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
