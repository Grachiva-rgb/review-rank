import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { isSupabaseConfigured, sbUpdate, sbSelect } from '@/lib/supabase';

// Stripe requires the raw request body to verify the signature. Route handlers
// need the Node runtime for access to the raw body text.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const raw = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[partner/webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await activatePartnerFromSession(session);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await markPartnerStatus(sub.id, 'canceled');
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = extractSubscriptionId(invoice);
        if (subId) await markPartnerStatus(subId, 'past_due');
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = extractSubscriptionId(invoice);
        if (subId) await markPartnerStatus(subId, 'active');
        break;
      }
      default:
        // Ignore unhandled event types silently.
        break;
    }
  } catch (err) {
    console.error('[partner/webhook] Handler error:', event.type, err);
    // Return 500 so Stripe retries.
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * The Stripe SDK type definitions moved subscription off of Invoice in recent
 * versions; surface it in a version-tolerant way without forcing a pinned
 * apiVersion literal.
 */
function extractSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const inv = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } } };
  };
  const raw =
    inv.subscription ??
    inv.parent?.subscription_details?.subscription ??
    undefined;
  if (!raw) return undefined;
  return typeof raw === 'string' ? raw : raw.id;
}

async function activatePartnerFromSession(session: Stripe.Checkout.Session) {
  if (!isSupabaseConfigured()) return;

  const partnerId     = (session.metadata?.partner_id as string | undefined) || '';
  const customerId    = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subId         = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const email         = (session.metadata?.contact_email as string | undefined) || session.customer_email || '';

  if (!customerId || !subId) return;

  const patch = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subId,
    status: 'active',
    activated_at: new Date().toISOString(),
  };

  if (partnerId) {
    await sbUpdate('partners', `id=eq.${encodeURIComponent(partnerId)}`, patch);
    return;
  }

  // Fallback: correlate by email for the most recent pending row.
  if (email) {
    await sbUpdate(
      'partners',
      `contact_email=eq.${encodeURIComponent(email)}&status=eq.pending`,
      patch
    );
  }
}

async function markPartnerStatus(subscriptionId: string, status: 'active' | 'past_due' | 'canceled') {
  if (!isSupabaseConfigured()) return;
  const patch: Record<string, unknown> = { status };
  if (status === 'canceled') patch.canceled_at = new Date().toISOString();
  await sbUpdate(
    'partners',
    `stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}`,
    patch
  );
}

// GET used by ops for quick sanity check that the route is mounted.
export async function GET() {
  const rows = isSupabaseConfigured()
    ? await sbSelect<{ count: number }>('partners', 'select=id&limit=1').then(
        (r) => ({ supabase: 'ok', sample: r.length })
      ).catch((e: unknown) => ({ supabase: 'error', error: String(e) }))
    : { supabase: 'not-configured' };
  return NextResponse.json({
    ok: true,
    stripe: isStripeConfigured() ? 'configured' : 'not-configured',
    ...rows,
  });
}
