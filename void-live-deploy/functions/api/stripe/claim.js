// Confirm the $10/month Checkout Session and set the members gate's signed cookie. The session id comes back on success_url;
// the server reads the subscription from Stripe itself, so the browser's word is never trusted.
import { signSession, sessionCookie } from '../../../lib/member-gate.js';
import { stripe, fromSubscription, saveMembership, ACTIVE } from '../../../lib/stripe.js';
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) return json({ ok: false, error: 'the monthly plan is not open yet' }, 503);
  const secret = env.SESSION_KEY || env.SALT;
  if (!secret) return json({ ok: false, error: 'membership is not configured yet' }, 503);
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 2000)) || {}; } catch (_) { b = {}; }
  const id = String(b.session_id || '').trim();
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return json({ ok: false, error: 'that checkout is not complete' }, 400);
  try {
    const s = await stripe(env, '/checkout/sessions/' + encodeURIComponent(id) + '?expand[]=subscription');
    if (s.mode !== 'subscription' || s.status !== 'complete' || !['paid', 'no_payment_required'].includes(s.payment_status)) return json({ ok: false, error: 'that checkout is not paid yet' }, 402);
    const sub = s.subscription && typeof s.subscription === 'object' ? s.subscription : await stripe(env, '/subscriptions/' + encodeURIComponent(String(s.subscription || '')));
    const price = sub && sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
    if (price !== env.STRIPE_PRICE_ID) return json({ ok: false, error: 'that checkout is not the monthly plan' }, 400);
    if (!ACTIVE.has(String(sub.status))) return json({ ok: false, error: 'the subscription is not active yet' }, 402);
    const m = await saveMembership(env, fromSubscription(sub, { name: (s.metadata && s.metadata.name) || '', email: (s.customer_details && s.customer_details.email) || s.customer_email || '' }));
    const until = Number(m.until) || 0, name = m.name || 'Verse member';
    const token = await signSession({ v: 1, k: 'stripe', id: m.id, name, until, exp: Date.now() + 180 * 864e5 }, secret);
    return json({ ok: true, signedIn: true, name, until }, 200, { 'set-cookie': sessionCookie(token, 180 * 86400) });
  } catch (_) {
    return json({ ok: false, error: 'Stripe did not confirm the membership; try again' }, 502);
  }
}
