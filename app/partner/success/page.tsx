import Link from 'next/link';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { isSupabaseConfigured, sbUpdate } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Verified = 'active' | 'processing' | 'unverified';

/**
 * Verify the checkout session server-side instead of congratulating any
 * visitor unconditionally. If Stripe says the session is paid but our
 * partner row is still pending (webhook delayed/lost), activate it here —
 * idempotent with the webhook, which applies the same patch.
 */
async function verifySession(sessionId: string | undefined): Promise<Verified> {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !isStripeConfigured()) {
    return 'unverified';
  }
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return 'processing';
    }
    const partnerId = (session.metadata?.partner_id as string | undefined) || '';
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (partnerId && customerId && subId && isSupabaseConfigured()) {
      // Belt-and-braces activation; the webhook normally did this already.
      await sbUpdate('partners', `id=eq.${encodeURIComponent(partnerId)}&status=eq.pending`, {
        stripe_customer_id: customerId,
        stripe_subscription_id: subId,
        status: 'active',
        activated_at: new Date().toISOString(),
      }).catch(() => {});
    }
    return 'active';
  } catch {
    return 'unverified';
  }
}

export default async function PartnerSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const verified = await verifySession(session_id);

  const heading =
    verified === 'active' ? 'Welcome to the Partner Program'
    : verified === 'processing' ? 'Payment processing'
    : 'Thanks — confirming your subscription';

  const body =
    verified === 'active'
      ? "Your subscription is active. You'll receive matched leads in your category by email as soon as customers submit requests."
      : verified === 'processing'
      ? 'Your payment is still processing. Your partner account activates automatically the moment Stripe confirms it — no action needed.'
      : "We couldn't verify your checkout session on this page, but if your payment went through, activation happens automatically via Stripe. If you don't receive a confirmation within an hour, contact us.";

  return (
    <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className={`rounded-2xl border p-8 shadow-sm ${
          verified === 'active' ? 'border-emerald-200 bg-emerald-50' : 'border-[#EDE8E3] bg-white'
        }`}>
          <div className={`text-xs uppercase tracking-widest font-mono mb-3 ${
            verified === 'active' ? 'text-emerald-700' : 'text-[#8B5E3C]'
          }`}>
            {verified === 'active' ? "You're in" : 'Almost there'}
          </div>
          <h1 className="font-display text-3xl text-[#241C15] mb-3">{heading}</h1>
          <p className="text-sm text-[#5A4A3F] leading-relaxed mb-6">{body}</p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-[#8B5E3C] hover:bg-[#6B4A2F] text-white text-sm font-semibold px-6 py-3 transition-colors"
          >
            Back to ReviewRank
          </Link>
        </div>
        <p className="text-xs text-[#7A6B63] mt-4">
          Billing questions? <a className="underline hover:text-[#8B5E3C]" href="mailto:partners@reviewrank.app">partners@reviewrank.app</a>
        </p>
      </div>
    </div>
  );
}
