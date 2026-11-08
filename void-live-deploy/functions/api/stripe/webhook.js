// Stripe's subscription webhook. The signature is checked over the raw body with STRIPE_WEBHOOK_SECRET; the event keeps
// void_memberships current. A verified event is always acknowledged, so Stripe does not retry a row we could not read;
// the claim endpoint reads the live subscription again and is the source of truth for the first cookie.
import { verifyStripeSignature, stripe, fromSubscription, saveMembership, setMembershipStatus } from '../../../lib/stripe.js';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ ok: false, error: 'the webhook is not configured' }, 503);
  const raw = await request.text();
  if (!(await verifyStripeSignature(raw, request.headers.get('stripe-signature') || '', env.STRIPE_WEBHOOK_SECRET))) return json({ ok: false, error: 'bad signature' }, 400);
  let event;
  try { event = JSON.parse(raw); } catch (_) { return json({ received: true }); }
  const o = (event.data && event.data.object) || {};
  try {
    if (event.type === 'checkout.session.completed' && o.subscription) {
      const sub = typeof o.subscription === 'object' ? o.subscription : await stripe(env, '/subscriptions/' + encodeURIComponent(String(o.subscription)));
      await saveMembership(env, fromSubscription(sub, { name: (o.metadata && o.metadata.name) || '', email: (o.customer_details && o.customer_details.email) || o.customer_email || '' }));
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await saveMembership(env, fromSubscription(o));
    } else if (event.type === 'invoice.payment_failed' && o.subscription) {
      await setMembershipStatus(env, typeof o.subscription === 'object' ? o.subscription.id : o.subscription, 'past_due');
    }
  } catch (_) { /* verified event: acknowledge; the next event or the claim reads the live subscription */ }
  return json({ received: true });
}
