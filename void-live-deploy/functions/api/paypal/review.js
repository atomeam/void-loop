// Verse code review paid with PayPal (lib/paypal.js), for people and agents who pay with PayPal instead of USDC (functions/api/x402/).
// GET  /api/paypal                                   what is for sale through PayPal, the price, sandbox or live, whether it is open
// POST /api/paypal/review { action: 'order', code | diff, lang?, ask? }
//        -> { order_id, approve_url, price, currency, sandbox }: the buyer approves the order on PayPal (approve_url); the order is
//           tied to the hash of exactly this request, so it pays for this code and nothing else
// POST /api/paypal/review { action: 'review', order_id, code | diff, lang?, ask? }
//        -> the approved order is read back from PayPal and checked (approved, this code, the full price), the AI closer read runs,
//           the payment is captured, and only a completed capture releases the read. Model busy: nothing is captured, the order
//           stays approved and the same call can be tried again. No capture, no read, no charge.
// Verse never sees a card or a PayPal login. Sandbox unless PAYPAL_ENV is "live"; sandbox money is never counted as income.
import { PRICES, envOf, configured, requestHash, createOrder, getOrder, orderProblem, capture, orderIdOk } from '../../../lib/paypal.js';
import { reviewWith, reviewOpen, modelsOn } from '../review.js';

const J = (b, s = 200, h = {}) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store', ...h } });

export async function catalog({ request, env }) {
  const origin = new URL(request.url).origin, p = PRICES.review;
  return J({ provider: 'PayPal (Orders v2)', mode: envOf(env), sandbox: envOf(env) !== 'live',
    services: [{ id: 'review', url: origin + '/api/paypal/review', price: p.value, currency: p.currency, description: p.description,
      open: configured(env) && modelsOn(env),
      how: 'POST { action: "order", code } -> approve_url; the payer approves it on PayPal; POST { action: "review", order_id, code } with the same code -> the closer read, paid on capture' }],
    other_ways_to_pay: { x402_usdc_on_base: origin + '/api/x402' } }, 200, { 'cache-control': 'public, max-age=60' });
}

export async function onRequestPost({ request, env, fetchImpl }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return J({ error: 'bad json' }, 400); }
  if (!b || (b.action !== 'order' && b.action !== 'review')) return J({ error: 'send { action: "order" | "review", code | diff }' }, 400);
  if (!reviewOpen(b)) return J({ error: 'send { code } or { diff }' }, 400); // checked before PayPal is touched, so a bad call never costs anything
  if (!configured(env)) return J({ error: 'PayPal checkout is not set up yet; nothing is charged' }, 503);
  if (!modelsOn(env)) return J({ error: 'the closer read is off right now; no payment is taken' }, 503);
  const hash = await requestHash(b), origin = new URL(request.url).origin, sandbox = envOf(env) !== 'live';

  if (b.action === 'order') {
    try {
      const o = await createOrder(env, { hash, returnUrl: origin + '/code-review/?paypal=return#try', cancelUrl: origin + '/code-review/?paypal=cancel#try' }, fetchImpl);
      return J({ ok: true, order_id: o.id, approve_url: o.approve, price: PRICES.review.value, currency: PRICES.review.currency, sandbox });
    } catch (_) { return J({ error: 'PayPal could not start the order just now; nothing was charged, try again' }, 503); }
  }

  if (!orderIdOk(b.order_id)) return J({ error: 'send the order_id PayPal gave you' }, 400);
  let o; try { o = await getOrder(env, b.order_id, fetchImpl); } catch (_) { return J({ error: 'PayPal could not be read just now; nothing was charged, try again' }, 503); }
  const problem = orderProblem(o, { hash });
  if (problem) return J({ error: problem, paid: false }, o.status === 'COMPLETED' ? 409 : 402);
  let captured = null;
  const a = { tier: 'paypal', left: 1, spend: async () => {
    const c = await capture(env, b.order_id, { hash }, fetchImpl);
    if (!c.ok) throw new Error(c.reason);
    captured = c;
  } };
  const res = await reviewWith(b, a, env);
  if (!captured) { // the read did not happen (model busy) or PayPal did not complete the capture: nothing was taken, and the answer says so
    const body = await res.json().catch(() => ({}));
    return J({ ...body, answer: undefined, paid: false, note: (body.note ? body.note + '; ' : '') + 'no payment was taken: the order is still approved, try the same call again' }, 200);
  }
  const body = await res.json();
  return J({ ...body, paid: true, paypal: { order_id: b.order_id, capture_id: captured.captureId, amount: PRICES.review.value, currency: PRICES.review.currency, sandbox } });
}
