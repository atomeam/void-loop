// Verse's other pay-per-call services (functions/api/x402/[service].js): every service in lib/x402.js SERVICES has a route, answers GET and
// a POST without payment with a 402 that names Verse's wallet on Base, refuses a call that cannot work before any payment, settles only the
// work done (verify -> the free route -> settle), and gives back a refusal with paid: false and no settlement. Every outside call is faked.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SERVICES, requirements, bazaarOf } from '../void-live-deploy/lib/x402.js';
import { VERSE_WALLET } from '../void-live-deploy/lib/verse-wallet-address.js';
import { usdcIncome } from '../void-live-deploy/lib/verse-wallet.js';
import * as paid from '../void-live-deploy/functions/api/x402/[service].js';
import * as review from '../void-live-deploy/functions/api/x402/review.js';
import { onRequestGet as catalog } from '../void-live-deploy/functions/api/x402/index.js';
import * as backtest from '../void-live-deploy/functions/api/x402/backtest.js';
import * as arbitrage from '../void-live-deploy/functions/api/x402/arbitrage.js';
const OWN = { review, backtest, arbitrage }; // services with a route file of their own

const VERSE = '0x1111111111111111111111111111111111111111', PAYER = '0x3333333333333333333333333333333333333333', TX = '0x' + 'ab'.repeat(32);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const unb64 = (s) => JSON.parse(Buffer.from(s, 'base64').toString());
const origin = 'https://a-to-mind.com';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a); return r == null ? null : col ? r[col] : r; } });
  return { raw: db, prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
}
const pay = (to = VERSE) => b64({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x' + 'cd'.repeat(65), authorization: { from: PAYER, to, value: '50000', validAfter: '0', validBefore: '9999999999', nonce: '0x' + '01'.repeat(32) } } });
const realFetch = globalThis.fetch;
function facilitator() {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = String(url); calls.push(u);
    if (u.endsWith('/verify')) return Response.json({ isValid: true, payer: PAYER });
    if (u.endsWith('/settle')) return Response.json({ success: true, transaction: TX, network: 'base', payer: PAYER });
    return new Response('offline in tests', { status: 503 });
  };
  return calls;
}
const ctx = (name, method, body, headers = {}, env) => ({ request: new Request(origin + '/api/x402/' + name, { method, headers: { 'cf-connecting-ip': '203.0.113.' + Math.floor(Math.random() * 250), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }),
  env, params: { service: name }, waitUntil: () => {} });

// every service sold has a route, and the Bazaar declaration has the v2 shape (info.input with a body example, info.output, a schema)
for (const [name, s] of Object.entries(SERVICES)) {
  assert.ok(OWN[name] || paid.PAID[name], name + ' has a paid route');
  assert.equal(s.units, 50000, name + ' is 0.05 USDC');
  const bz = bazaarOf(s);
  assert.equal(bz.info.input.type, 'http'); assert.equal(bz.info.input.method, 'POST'); assert.ok(bz.info.input.body); assert.equal(bz.info.output.type, 'json'); assert.ok(bz.schema.properties.input);
  assert.equal(requirements(name, VERSE, origin).v1.outputSchema.input.discoverable, true);
}
assert.deepEqual(Object.keys(paid.PAID).sort(), Object.keys(SERVICES).filter((k) => !OWN[k]).sort(), 'no route for a service that is not sold');

// GET, HEAD and a POST without payment: 402 naming the repo wallet on Base (what a Bazaar probe and an agent see)
for (const name of Object.keys(paid.PAID)) {
  const env = { DB: d1() };
  const g = await paid.onRequestGet(ctx(name, 'GET', null, {}, env));
  assert.equal(g.status, 402, name + ' GET is a 402');
  const v2 = unb64(g.headers.get('payment-required'));
  assert.equal(v2.accepts[0].payTo, VERSE_WALLET); assert.equal(v2.accepts[0].network, 'eip155:8453'); assert.equal(v2.resource.url, origin + '/api/x402/' + name);
  assert.ok(v2.extensions.bazaar.info.input.body, name + ' declares itself for the Bazaar');
  assert.equal((await paid.onRequestHead(ctx(name, 'HEAD', null, {}, env))).status, 402);
  assert.equal((await paid.onRequestPost(ctx(name, 'POST', {}, {}, env))).status, 400, name + ': an empty call is refused before any payment');
}
// the services with a route file of their own (the trading bots' backtest and the arbitrage scan, through lib/x402-call.js): the same 402s
for (const name of ['backtest', 'arbitrage']) {
  const env = { DB: d1() }, r = OWN[name];
  const g = await r.onRequestGet(ctx(name, 'GET', null, {}, env));
  assert.equal(g.status, 402, name + ' GET is a 402');
  const v2 = unb64(g.headers.get('payment-required'));
  assert.equal(v2.accepts[0].payTo, VERSE_WALLET); assert.equal(v2.accepts[0].network, 'eip155:8453'); assert.equal(v2.resource.url, origin + '/api/x402/' + name);
  assert.ok(v2.extensions.bazaar.info.input.body, name + ' declares itself for the Bazaar');
  assert.equal((await r.onRequestHead(ctx(name, 'HEAD', null, {}, env))).status, 402);
  assert.equal((await r.onRequestPost(ctx(name, 'POST', {}, {}, env))).status, 400, name + ': an empty call is refused before any payment');
}
assert.equal((await paid.onRequestGet(ctx('nope', 'GET', null, {}, { DB: d1() }))).status, 404);
assert.equal((await review.onRequestGet(ctx('review', 'GET', null, {}, { DB: d1() }))).status, 402, 'code review answers the Bazaar probe too');

const DIGEST = { text: 'Energy can be stored in batteries. Energy can also be stored by pumping water uphill. Flywheels store energy as motion. These are the three ways we cover today.', ask: 'what are the three ways' };
{
  const env = { DB: d1() };
  const r402 = await paid.onRequestPost(ctx('digest', 'POST', DIGEST, {}, env));
  assert.equal(r402.status, 402); assert.equal((await r402.json()).accepts[0].payTo, VERSE_WALLET);
  assert.equal((await paid.onRequestPost(ctx('digest', 'POST', DIGEST, { 'x-payment': pay(PAYER) }, env))).status, 402, 'a payment to anyone else is refused');

  // the work done: verified, the free route answers, settled, given with the settlement header, recorded for the treasury
  const calls = facilitator();
  try {
    const ok = await paid.onRequestPost(ctx('digest', 'POST', DIGEST, { 'x-payment': pay(VERSE_WALLET) }, env));
    assert.equal(ok.status, 200); const j = await ok.json();
    assert.equal(j.ok, true); assert.ok(j.points.length);
    assert.equal(unb64(ok.headers.get('x-payment-response')).transaction, TX);
    assert.deepEqual(calls.filter((u) => /verify|settle/.test(u)).map((u) => u.split('/').pop()), ['verify', 'settle']);
    const row = env.DB.raw.prepare('SELECT * FROM void_x402').get();
    assert.equal(row.service, 'digest'); assert.equal(row.status, 'settled'); assert.equal(row.pay_to, VERSE_WALLET.toLowerCase());
  } finally { globalThis.fetch = realFetch; }

  // a refusal from the free route: given back with paid: false, never settled
  const env2 = { DB: d1() };
  const calls2 = facilitator();
  try {
    const no = await paid.onRequestPost(ctx('image', 'POST', { prompt: 'x' }, { 'x-payment': pay(VERSE_WALLET) }, env2));
    const nj = await no.json();
    assert.equal(nj.paid, false, 'no picture, no charge'); assert.equal(no.headers.get('x-payment-response'), null);
    assert.ok(!calls2.some((u) => u.endsWith('/settle')), 'nothing settled');
    assert.equal(env2.DB.raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'void_x402'").get().n, 0, 'nothing recorded');
  } finally { globalThis.fetch = realFetch; }
}

// the catalog lists every service with its price and where it is paid
{
  const g = await (await catalog({ request: new Request(origin + '/api/x402'), env: { DB: d1() } })).json();
  assert.equal(g.pay_to, VERSE_WALLET);
  assert.deepEqual(g.services.map((s) => s.id).sort(), Object.keys(SERVICES).sort());
  assert.ok(g.services.every((s) => s.price_usdc === '0.050000' && s.url === origin + SERVICES[s.id].path));
  assert.equal(g.services.find((s) => s.id === 'digest').open, true, 'digest needs no model');
  assert.equal(g.services.find((s) => s.id === 'appraise').open, false, 'appraise needs the vision model');
}
// the treasury counts each service's confirmed calls on its own (only rows read back on chain)
assert.deepEqual(usdcIncome([{ status: 'verified', units: '50000', service: 'digest' }, { status: 'verified', units: '50000', service: 'digest' }, { status: 'verified', units: '50000', service: 'answer' }, { status: 'settled', units: '50000', service: 'image' }]).by_service,
  { digest: { calls: 2, cents: 10 }, answer: { calls: 1, cents: 5 } });
console.log('x402 services: ok');
