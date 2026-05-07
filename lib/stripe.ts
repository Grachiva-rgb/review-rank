import Stripe from 'stripe';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  // Let the Stripe SDK pick its pinned API version. We avoid forcing a
  // specific apiVersion string so we don't fight the SDK's typed literal.
  cached = new Stripe(key, { typescript: true });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Monthly subscription price for the Partner plan, in cents. */
export const PARTNER_MONTHLY_CENTS = 9900;
