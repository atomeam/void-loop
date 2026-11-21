import { verifyStripe } from '../../../lib/store.js';

const json = (o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { 'content-type': 'application/json', ...extra },
  });

export async function onRequestPost({ request, env }) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, 503);
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return json({ error: 'Missing Stripe-Signature header' }, 400);
  }

  let body;
  try {
    body = await request.text();
  } catch (err) {
    console.warn('stripe webhook failed to read body:', err);
    return json({ error: 'Failed to read request body' }, 400);
  }

  let valid = false;
  try {
    valid = await verifyStripe(secret, sig, body);
  } catch (err) {
    console.warn('stripe webhook signature verification error:', err);
    return json({ error: 'Invalid Stripe-Signature' }, 400);
  }

  if (!valid) {
    return json({ error: 'Invalid Stripe-Signature' }, 400);
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch (err) {
    console.warn('stripe webhook invalid JSON:', err);
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const type = event && typeof event.type === 'string' ? event.type : 'unknown';

  try {
    switch (type) {
      case 'checkout.session.completed':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'customer.subscription.deleted':
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn('stripe webhook event handling error:', err);
  }

  return json({ received: true, type }, 200);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
