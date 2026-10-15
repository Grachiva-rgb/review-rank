import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isStripeConfigured, PARTNER_MONTHLY_CENTS } from '@/lib/stripe';
import { isSupabaseConfigured, sbInsert } from '@/lib/supabase';
import { normalizePartnerCategory } from '@/lib/categories';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { resolvePartnerServiceCenter, validServiceCity } from '@/lib/partnerLocation';

const MAX_STR = 120;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATE_RE = /^[A-Za-z]{2}$/;

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(`partner-checkout:${clientIp(req)}`, 5, 1_800_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Partner program is not yet configured on this environment.' },
      { status: 503 }
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Partner enrollment is temporarily unavailable.' }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const business_name = typeof b.business_name === 'string' ? b.business_name.trim().slice(0, MAX_STR) : '';
  const contact_email = typeof b.contact_email === 'string' ? b.contact_email.trim().slice(0, MAX_STR) : '';
  const contact_phone = typeof b.contact_phone === 'string' ? b.contact_phone.trim().slice(0, MAX_STR) : '';
  const categoryRaw   = typeof b.category === 'string' ? b.category.trim().slice(0, 50) : '';
  const category      = normalizePartnerCategory(categoryRaw) ?? '';
  const city          = typeof b.city === 'string' ? b.city.trim().slice(0, 80) : '';
  const stateRaw      = typeof b.state === 'string' ? b.state.trim().toUpperCase() : '';
  const state         = STATE_RE.test(stateRaw) ? stateRaw : '';
  const radius        = b.service_radius_miles == null ? 25 : Number(b.service_radius_miles);

  if (!business_name) return NextResponse.json({ error: 'Business name is required.' }, { status: 400 });
  if (!EMAIL_RE.test(contact_email)) return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });
  if (!category) {
    return NextResponse.json(
      { error: categoryRaw ? 'Unknown category. Please choose one from the list.' : 'Category is required.' },
      { status: 400 }
    );
  }
  if (!validServiceCity(city, state)) {
    return NextResponse.json({ error: 'A service city and valid US state are required.' }, { status: 400 });
  }
  if (!Number.isInteger(radius) || radius < 1 || radius > 200) {
    return NextResponse.json({ error: 'Service radius must be a whole number from 1 to 200 miles.' }, { status: 400 });
  }
  // Validate configuration before spending on geocoding or creating a row.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!origin) {
    return NextResponse.json({ error: 'Checkout is not properly configured.' }, { status: 503 });
  }
  let center: Awaited<ReturnType<typeof resolvePartnerServiceCenter>>;
  try {
    center = await resolvePartnerServiceCenter(city, state, process.env.GOOGLE_PLACES_API_KEY ?? '');
  } catch {
    return NextResponse.json({ error: 'We cannot verify your service area right now. Please try again later.' }, { status: 503 });
  }
  if (!center) {
    return NextResponse.json({ error: 'Please enter a recognized service city and state.' }, { status: 422 });
  }

  // Create a pending partner record up front so the webhook can correlate.
  let partnerId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const inserted = (await sbInsert(
        'partners',
        {
          business_name, contact_email, contact_phone,
          category, city, state,
          latitude: center.lat,
          longitude: center.lng,
          service_area_location_source: 'city_center',
          service_area_verified_at: new Date().toISOString(),
          service_radius_miles: radius,
          monthly_price_cents: PARTNER_MONTHLY_CENTS,
          status: 'pending',
        },
        { returning: true }
      )) as Array<{ id: string }> | null;
      partnerId = inserted?.[0]?.id ?? null;
      if (!partnerId) {
        return NextResponse.json({ error: 'Could not save your service area. Please try again.' }, { status: 503 });
      }
    } catch (err) {
      console.error('[partner/checkout] Supabase insert failed:', err);
      // Never charge for a signup whose routable partner record was not saved.
      return NextResponse.json({ error: 'Could not save your service area. Please try again.' }, { status: 503 });
    }
  }

  // Use a configured site URL rather than the request Origin header.
  // Trusting Origin would allow an attacker to forge the header and set
  // Stripe's success/cancel URLs to an arbitrary domain.
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: contact_email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'ReviewRank Partner — Monthly',
            description: 'Matched local leads in your category and service area.',
          },
          recurring: { interval: 'month' },
          unit_amount: PARTNER_MONTHLY_CENTS,
        },
        quantity: 1,
      }],
      success_url: `${origin}/partner/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/partner?canceled=1`,
      metadata: {
        partner_id: partnerId ?? '',
        business_name, contact_email, category,
        city, state,
        service_radius_miles: String(radius),
      },
      subscription_data: {
        metadata: {
          partner_id: partnerId ?? '',
          business_name, contact_email, category,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[partner/checkout] Stripe error:', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500 }
    );
  }
}
