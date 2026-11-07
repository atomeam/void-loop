// Start the $10/month Stripe Checkout for the members gate. The price id and secret key are Pages secrets; nothing is logged.
import { checkoutParams, stripe } from '../../../lib/stripe.js';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) return json({ ok: false, error: 'the monthly plan is not open yet' }, 503);
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 2000)) || {}; } catch (_) { b = {}; }
  const name = String(b.name || '').replace(/[<>&\u0000-\u001f]/g, '').trim().slice(0, 24);
  const email = /^\S+@\S+\.\S+$/.test(String(b.email || '')) ? String(b.email).trim().slice(0, 120) : '';
  const next = String(b.next || '');
  try {
    const s = await stripe(env, '/checkout/sessions', { method: 'POST', body: checkoutParams(env, { name, email, next, origin: new URL(request.url).origin }) });
    if (!s || !s.url) throw new Error('no url');
    return json({ ok: true, url: s.url });
  } catch (_) {
    return json({ ok: false, error: 'Stripe did not start the checkout; try again in a moment' }, 502);
  }
}
