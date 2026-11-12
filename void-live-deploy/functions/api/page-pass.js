// Uni checkout. GET is the public status (no secrets) or the return from Stripe. POST starts Checkout, or takes Stripe's signed webhook.
// A stranger can open Checkout. They are not a member until Stripe says the session is a paid UniVerse subscription.
import { verifyStripe } from '../../lib/store.js';
import { liveState, startCheckout, finishCheckout, mintPass, savedHtml, backPath, applyStripeEvent, resetLive } from '../../lib/page-pass.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('session_id');
  if (id) {
    const done = await finishCheckout(env, id).catch(() => null);
    if (!done) return json({ ok: false, error: 'that checkout is not a paid subscription' }, 400);
    resetLive();
    const token = await mintPass(env, done.sub);
    return new Response(savedHtml(token, done.back), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  }
  const live = await liveState(env);
  return json({ on: live.on, label: 'Uni', product: 'UniVerse', cents: live.cents || 0, every: 'month', webhook: !!live.webhook, ...(live.on ? {} : { missing: live.missing }) });
}

export async function onRequestPost({ request, env }) {
  if (request.headers.get('stripe-signature')) {
    if (!env.STRIPE_WEBHOOK_SECRET) return json({ ok: false, missing: 'STRIPE_WEBHOOK_SECRET' }, 503);
    const body = await request.text();
    if (!(await verifyStripe(env.STRIPE_WEBHOOK_SECRET, request.headers.get('stripe-signature'), body))) return json({ ok: false }, 400);
    let event = null; try { event = JSON.parse(body); } catch (_) { return json({ ok: false }, 400); }
    const ok = await applyStripeEvent(env, event).catch(() => false);
    return json({ ok: !!ok });
  }
  const back = backPath(new URLSearchParams(await request.text()).get('back') || '');
  const out = await startCheckout(env, new URL(request.url).origin, back);
  if (!out.url) return json({ ok: false, missing: out.error || 'checkout' }, 503);
  return Response.redirect(out.url, 303);
}
