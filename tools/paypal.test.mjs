// Verse code review paid with PayPal (lib/paypal.js, functions/api/paypal/): sandbox unless PAYPAL_ENV is "live", an order tied to the
// hash of the exact code, a bad call refused before PayPal is touched, an order for other code or another price refused, the
// read -> capture order (no capture, no read; model busy, no capture), and a used order refused. PayPal is faked: no network, no key.
import assert from 'node:assert/strict';
import { BASE, PRICES, envOf, baseOf, configured, requestHash, orderProblem, createOrder, capture } from '../void-live-deploy/lib/paypal.js';
import * as route from '../void-live-deploy/functions/api/paypal/review.js';
import { onRequestGet as paypalCatalog } from '../void-live-deploy/functions/api/paypal/index.js';

const origin = 'https://a-to-mind.com';
assert.equal(envOf({}), 'sandbox'); assert.equal(envOf({ PAYPAL_ENV: 'Live ' }), 'live'); assert.equal(envOf({ PAYPAL_ENV: 'prod' }), 'sandbox', 'only "live" takes real money');
assert.equal(baseOf({}), BASE.sandbox); assert.equal(baseOf({ PAYPAL_ENV: 'live' }), BASE.live);
assert.equal(configured({ PAYPAL_CLIENT_ID: 'id' }), false); assert.equal(configured({ PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 's' }), true);
const BUGGY = 'function f(x) {\n  if (x = 5) { return eval(x); }\n}';
const H = await requestHash({ code: BUGGY });
assert.match(H, /^vr1-[0-9a-f]{64}$/); assert.ok(H.length <= 127, 'fits PayPal custom_id');
assert.notEqual(await requestHash({ code: BUGGY + ' ' }), H, 'other code, other hash');
assert.notEqual(await requestHash({ code: BUGGY, ask: 'sql' }), H, 'another ask, another hash');

const P = PRICES.review;
assert.equal(orderProblem({ status: 'APPROVED', custom_id: H, value: P.value, currency: P.currency }, { hash: H }), null);
assert.match(orderProblem({ status: 'CREATED', custom_id: H, value: P.value, currency: P.currency }, { hash: H }), /not approved/);
assert.match(orderProblem({ status: 'APPROVED', custom_id: 'vr1-other', value: P.value, currency: P.currency }, { hash: H }), /different code/);
assert.match(orderProblem({ status: 'APPROVED', custom_id: H, value: '0.01', currency: P.currency }, { hash: H }), /not for/);
assert.match(orderProblem({ status: 'COMPLETED', custom_id: H, value: P.value, currency: P.currency }, { hash: H }), /already used/);

// a fake PayPal: token, create, get, capture
function paypal(o = {}) {
  const calls = [], orders = {};
  const f = async (url, init = {}) => {
    const u = new URL(url), path = u.pathname, m = init.method || 'GET';
    calls.push(m + ' ' + u.origin + path);
    assert.ok(url.startsWith(o.base || BASE.sandbox), 'sandbox host unless live');
    if (path === '/v1/oauth2/token') return Response.json({ access_token: 'tok' });
    assert.equal(init.headers.authorization, 'Bearer tok');
    if (path === '/v2/checkout/orders' && m === 'POST') {
      const b = JSON.parse(init.body), id = 'ORDER' + (Object.keys(orders).length + 1) + 'ABCDEF';
      assert.equal(b.intent, 'CAPTURE'); assert.ok(b.payment_source.paypal.experience_context.return_url.startsWith(origin + '/code-review/'));
      orders[id] = { status: o.approve === false ? 'CREATED' : 'APPROVED', u: b.purchase_units[0] };
      return Response.json({ id, status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=' + id }] }, { status: 200 });
    }
    const id = path.split('/')[4], ord = orders[id];
    if (!ord) return Response.json({ name: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    if (path.endsWith('/capture')) {
      if (o.captureFails) return Response.json({ name: 'UNPROCESSABLE_ENTITY' }, { status: 422 });
      ord.status = 'COMPLETED';
      return Response.json({ id, status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', custom_id: ord.u.custom_id, amount: { ...(o.captureAmount || ord.u.amount) } }] } }] });
    }
    return Response.json({ id, status: ord.status, purchase_units: [{ custom_id: ord.u.custom_id, amount: ord.u.amount }] });
  };
  return { f, calls, orders };
}
{
  const pp = paypal(), env = { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 's' };
  const o = await createOrder(env, { hash: H, returnUrl: origin + '/code-review/?paypal=return', cancelUrl: origin + '/code-review/' }, pp.f);
  assert.match(o.approve, /checkoutnow\?token=/);
  assert.equal(pp.orders[o.id].u.custom_id, H); assert.deepEqual(pp.orders[o.id].u.amount, { currency_code: P.currency, value: P.value });
  assert.equal((await capture(env, o.id, { hash: H }, paypal({ captureAmount: { currency_code: 'USD', value: '0.10' } }).f)).ok, false, 'unknown order elsewhere');
}

// ---- the route ----
const answer = JSON.stringify({ findings: [{ file: '', line: 2, kind: 'bug', text: '= should be ===', quote: '  if (x = 5) { return eval(x); }' }] });
const envWith = (extra = {}) => ({ AI: { run: async () => ({ response: answer }) }, PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 's', ...extra });
const post = (env, body, pp) => route.onRequestPost({ request: new Request(origin + '/api/paypal/review', { method: 'POST', body: JSON.stringify(body) }), env, fetchImpl: pp && pp.f });
{
  assert.equal((await post(envWith({ PAYPAL_CLIENT_ID: '' }), { action: 'order', code: BUGGY })).status, 503, 'not set up: closed, nothing charged');
  const pp = paypal();
  assert.equal((await post(envWith(), { action: 'order', code: 'x' }, pp)).status, 400, 'a bad call is refused before PayPal is touched');
  assert.equal(pp.calls.length, 0);
  const ord = await (await post(envWith(), { action: 'order', code: BUGGY }, pp)).json();
  assert.equal(ord.ok, true); assert.equal(ord.sandbox, true); assert.equal(ord.price, P.value); assert.match(ord.approve_url, /sandbox\.paypal\.com/);

  // other code on the same order: refused, nothing captured
  const other = await post(envWith(), { action: 'review', order_id: ord.order_id, code: BUGGY + '\n// more' }, pp);
  assert.equal(other.status, 402); assert.match((await other.json()).error, /different code/);
  assert.ok(!pp.calls.some((c) => c.includes('/capture')), 'no capture for a mismatch');

  // model busy: no capture, the order stays approved
  const busy = await (await post(envWith({ AI: { run: async () => { throw new Error('busy'); } } }), { action: 'review', order_id: ord.order_id, code: BUGGY }, pp)).json();
  assert.equal(busy.paid, false); assert.equal(busy.answer, undefined); assert.equal(pp.orders[ord.order_id].status, 'APPROVED');

  // the paid read: read, then capture, then the answer
  const paid = await (await post(envWith(), { action: 'review', order_id: ord.order_id, code: BUGGY }, pp)).json();
  assert.equal(paid.paid, true); assert.equal(paid.review, 'model'); assert.ok(paid.answer, 'the closer read is given'); assert.equal(paid.paypal.capture_id, 'CAP1'); assert.equal(paid.paypal.sandbox, true);
  assert.equal(paid.tier, 'paypal');

  // the same order again: refused
  const again = await post(envWith(), { action: 'review', order_id: ord.order_id, code: BUGGY }, pp);
  assert.equal(again.status, 409);
}
{
  // capture refused or short: no read
  for (const o of [{ captureFails: true }, { captureAmount: { currency_code: 'USD', value: '0.10' } }]) {
    const pp = paypal(o);
    const ord = await (await post(envWith(), { action: 'order', code: BUGGY }, pp)).json();
    const r = await (await post(envWith(), { action: 'review', order_id: ord.order_id, code: BUGGY }, pp)).json();
    assert.equal(r.paid, false); assert.equal(r.answer, undefined, 'no completed capture of the full price, no read');
  }
  // not approved yet
  const pp = paypal({ approve: false });
  const ord = await (await post(envWith(), { action: 'order', code: BUGGY }, pp)).json();
  const r = await post(envWith(), { action: 'review', order_id: ord.order_id, code: BUGGY }, pp);
  assert.equal(r.status, 402); assert.match((await r.json()).error, /not approved/);
  // live mode talks to the live host
  const live = paypal({ base: BASE.live });
  const lo = await (await post(envWith({ PAYPAL_ENV: 'live' }), { action: 'order', code: BUGGY }, live)).json();
  assert.equal(lo.sandbox, false);
}
{
  const cat = await (await paypalCatalog({ request: new Request(origin + '/api/paypal'), env: envWith() })).json();
  assert.equal(cat.sandbox, true); assert.equal(cat.services[0].open, true); assert.equal(cat.services[0].url, origin + '/api/paypal/review');
  assert.equal((await (await paypalCatalog({ request: new Request(origin + '/api/paypal'), env: {} })).json()).services[0].open, false);
}
console.log('paypal: ok');
