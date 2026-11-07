// PayPal checkout for Verse's paid code review (functions/api/paypal/review.js). People and agents who would rather pay with PayPal
// than with USDC (lib/x402.js) buy one AI closer read for a fixed price through PayPal's Orders v2 REST API
// (https://developer.paypal.com/docs/api/orders/v2/): Verse creates an order whose custom_id is the hash of the exact code to review,
// the buyer approves it on PayPal, Verse checks the approved order still matches that code, runs the closer read, then captures the
// payment, and only a completed capture for the full price releases the read. No capture, no read; no read, no capture.
//
// Sandbox by default: PAYPAL_ENV must be exactly "live" before a real payment is taken, so sandbox orders (test money) are never
// counted as income. Keys: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, Cloudflare secrets only; Verse never sees a card or a PayPal login.
export const BASE = { sandbox: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' };
export const PRICES = { review: { value: '1.00', currency: 'USD', description: 'Verse code review: one AI closer read of the code you sent' } };
const ID_RE = /^[A-Z0-9]{8,40}$/; // PayPal order ids are upper-case letters and digits

export const envOf = (env = {}) => String(env.PAYPAL_ENV || '').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
export const baseOf = (env = {}) => BASE[envOf(env)];
export const configured = (env = {}) => !!(String(env.PAYPAL_CLIENT_ID || '').trim() && String(env.PAYPAL_CLIENT_SECRET || '').trim());
export const orderIdOk = (id) => ID_RE.test(String(id || ''));

/** The hash that ties an order to the exact request it pays for: sha256 over the code or diff, the language and the ask. */
export async function requestHash(b) {
  const canon = JSON.stringify({ code: typeof b.code === 'string' ? b.code : null, diff: typeof b.diff === 'string' ? b.diff : null, lang: b.lang ? String(b.lang) : null, ask: b.ask ? String(b.ask) : null });
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
  return 'vr1-' + [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function token(env, f) {
  const basic = btoa(String(env.PAYPAL_CLIENT_ID).trim() + ':' + String(env.PAYPAL_CLIENT_SECRET).trim());
  const r = await f(baseOf(env) + '/v1/oauth2/token', { method: 'POST', headers: { authorization: 'Basic ' + basic, 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) throw new Error('PayPal token refused (' + r.status + ')');
  return j.access_token;
}
async function call(env, path, init, f) {
  const t = await token(env, f);
  const r = await f(baseOf(env) + path, { ...init, headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json', ...(init.headers || {}) } });
  const j = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, j: j || {} };
}

/** Create the order for one service, tied to `hash`. -> { id, approve } */
export async function createOrder(env, { service = 'review', hash, returnUrl, cancelUrl }, fetchImpl) {
  const p = PRICES[service];
  if (!p) throw new Error('unknown service');
  const res = await call(env, '/v2/checkout/orders', { method: 'POST', headers: { 'paypal-request-id': 'verse-' + hash.slice(4, 40) + '-' + Date.now().toString(36) },
    body: JSON.stringify({ intent: 'CAPTURE',
      payment_source: { paypal: { experience_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'PAY_NOW', brand_name: 'Verse', shipping_preference: 'NO_SHIPPING' } } },
      purchase_units: [{ reference_id: service, custom_id: hash, description: p.description, amount: { currency_code: p.currency, value: p.value } }] }) }, fetchImpl || fetch);
  const link = (res.j.links || []).find((l) => l && (l.rel === 'payer-action' || l.rel === 'approve'));
  if (!res.ok || !orderIdOk(res.j.id) || !link) throw new Error('PayPal did not create the order (' + res.status + ')');
  return { id: res.j.id, approve: String(link.href) };
}

/** The order as PayPal holds it now. -> { status, custom_id, value, currency } */
export async function getOrder(env, id, fetchImpl) {
  if (!orderIdOk(id)) return { status: 'BAD_ID' };
  const res = await call(env, '/v2/checkout/orders/' + id, { method: 'GET' }, fetchImpl || fetch);
  if (!res.ok) return { status: res.status === 404 ? 'NOT_FOUND' : 'UNREADABLE' };
  const u = (res.j.purchase_units || [])[0] || {};
  return { status: String(res.j.status || ''), custom_id: String(u.custom_id || ''), value: String((u.amount || {}).value || ''), currency: String((u.amount || {}).currency_code || '') };
}

/** Does this order pay for this request at this price? -> null when it does, else the reason. Pure. */
export function orderProblem(o, { hash, service = 'review' }) {
  const p = PRICES[service];
  if (!o || o.status === 'NOT_FOUND' || o.status === 'BAD_ID') return 'no such PayPal order';
  if (o.status === 'COMPLETED') return 'this order was already used for a review';
  if (o.status !== 'APPROVED') return 'the order is not approved on PayPal yet (' + (o.status || 'unknown') + ')';
  if (o.custom_id !== hash) return 'the order was made for different code: send the same code you paid for';
  if (o.value !== p.value || o.currency !== p.currency) return 'the order is not for ' + p.value + ' ' + p.currency;
  return null;
}

/** Capture the approved order. -> { ok, captureId?, reason? }: ok only for a COMPLETED capture of the full price for this hash. */
export async function capture(env, id, { hash, service = 'review' }, fetchImpl) {
  const p = PRICES[service];
  const res = await call(env, '/v2/checkout/orders/' + id + '/capture', { method: 'POST', headers: { 'paypal-request-id': 'verse-capture-' + id, prefer: 'return=representation' }, body: '{}' }, fetchImpl || fetch);
  const u = ((res.j.purchase_units || [])[0]) || {};
  const c = (((u.payments || {}).captures) || [])[0] || {};
  const amt = c.amount || {};
  if (!res.ok || res.j.status !== 'COMPLETED' || c.status !== 'COMPLETED') return { ok: false, reason: 'PayPal did not complete the payment (' + (c.status || res.j.status || res.status) + ')' };
  if (String(amt.value) !== p.value || String(amt.currency_code) !== p.currency) return { ok: false, reason: 'the captured amount is not ' + p.value + ' ' + p.currency };
  if (c.custom_id && String(c.custom_id) !== hash) return { ok: false, reason: 'the capture is for a different request' };
  return { ok: true, captureId: String(c.id || '') };
}
