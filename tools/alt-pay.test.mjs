// Special items (lib/alt-pay.js + /api/store/special/*): Cash App and USDC-on-Base rails. Never unlock on the buyer's word:
// Cash App waits for the owner; crypto unlocks only on a confirmed on-chain transfer of the exact order amount, once per tx.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { railsOf, specialRails, memoUnits, usdcUnits, usdcText, verifyUsdcTx, USDC_BASE, TRANSFER_TOPIC } from '../void-live-deploy/lib/alt-pay.js';
import { onRequest } from '../void-live-deploy/functions/api/store/[[path]].js';
import { productOf, STORE_PRODUCTS } from '../void-live-deploy/lib/store.js';
// a paid special item of the test's own (lists run 2, 2026-10-21): site-tester, the old fixture, is open as pay-what-you-want until a rail is live
const FIX = 'alt-pay-fixture';
STORE_PRODUCTS.push({ id: FIX, name: 'Alt-pay fixture', cents: 2400, kind: 'download', special: ['cashapp', 'usdc-base'], files: [{ key: 'store/site-tester-v1.zip' }], status: 'live', soon: false });
assert.ok(productOf('site-tester').pwyw && productOf('site-tester').cents === 0 && !productOf('site-tester').soon, 'site-tester is open as pay-what-you-want until a paid rail is live');

const sql = new DatabaseSync(':memory:');
const stmt = (q, a = []) => ({ bind: (...b) => stmt(q, b), run: async () => { const r = sql.prepare(q).run(...a); return { meta: { changes: r.changes } }; }, first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) });
const ADDR = '0x' + 'ab'.repeat(20), TAG = 'ExampleTag';
let chain = { head: 100, receipts: {} };
const BASE_FETCH = async (_u, init) => { const { method, params } = JSON.parse(init.body); return Response.json({ result: method === 'eth_blockNumber' ? '0x' + chain.head.toString(16) : chain.receipts[params[0]] || null }); };
const env = { SALT: 'k', READ_TOKEN: 'owner-secret', DB: { prepare: (q) => stmt(q) }, CASHAPP_CASHTAG: TAG, CRYPTO_USDC_BASE_ADDR: ADDR, BASE_FETCH };
const call = async (path, body, auth) => { const r = await onRequest({ request: new Request('https://a-to-mind.com/api/store/' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + auth } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, params: { path: path.split('/') } }); return { s: r.status, j: await r.json() }; };

// config: rails exist only when Adam sets them; bad values are ignored
assert.deepEqual(railsOf({}), {});
assert.deepEqual(Object.keys(railsOf({ CASHAPP_CASHTAG: '$bad tag', CRYPTO_USDC_BASE_ADDR: '0x12' })), []);
const p = productOf(FIX); assert.ok(p && p.cents > 0);
assert.deepEqual(specialRails(p, {}), []); assert.deepEqual(specialRails(p, env), ['cashapp', 'usdc-base']);
assert.deepEqual(specialRails(productOf('void-monthly'), env), [], 'subscriptions and non-special items have no special rails');
// memo: 1..9999 millionths, stable per order
assert.equal(memoUnits('ord_a'), memoUnits('ord_a')); assert.ok(memoUnits('ord_a') >= 1 && memoUnits('ord_a') <= 9999);
assert.equal(usdcText(24000123n), '24.000123');

// catalog shows the rails; the client cannot pick a price
const cat = await call('catalog'); assert.deepEqual(cat.j.products.find((x) => x.id === FIX).special, ['cashapp', 'usdc-base']);
assert.equal((await call('special/start', { id: FIX, rail: 'paypal', email: 'a@b.co' })).s, 400, 'unsupported rail');
assert.equal((await call('special/start', { id: 'void-monthly', rail: 'cashapp', email: 'a@b.co' })).s, 400, 'item not special');

// Cash App: manual queue, never unlocked by the buyer
const ca = (await call('special/start', { id: FIX, rail: 'cashapp', email: 'a@b.co', cents: 1, price: 0 })).j;
assert.equal(ca.pay, '$24.00', 'price from the catalog, never the body'); assert.ok(ca.link.startsWith('https://cash.app/$' + TAG + '/24.00'));
assert.equal((await call('special/confirm', { code: ca.code, email: 'a@b.co', ref: 'x' })).s, 400, 'reference required');
const c1 = await call('special/confirm', { code: ca.code, email: 'a@b.co', ref: 'ABCD1234' }); assert.equal(c1.s, 202); assert.equal(c1.j.status, 'awaiting');
const r1 = await call('lookup', { code: ca.code, email: 'a@b.co' }); assert.equal(r1.j.status, 'awaiting'); assert.equal(r1.j.items[0].downloads.length, 0, 'no downloads while awaiting');
assert.equal((await call('special/queue')).s, 403); assert.equal((await call('special/approve', { order: ca.order }, 'nope')).s, 403, 'only the owner approves');
assert.equal((await call('special/queue', null, 'owner-secret')).j.awaiting.length, 1);
assert.equal((await call('special/approve', { order: ca.order }, 'owner-secret')).j.ok, true);
assert.equal((await call('lookup', { code: ca.code, email: 'a@b.co' })).j.status, 'paid');

// USDC on Base: exact amount, right token, right address, confirmed, once
const co = (await call('special/start', { id: FIX, rail: 'usdc-base', email: 'c@d.co' })).j;
const units = usdcUnits(2400, co.order); assert.equal(co.exact_units, units.toString()); assert.equal(co.to, ADDR);
const pad = (a) => '0x' + a.slice(2).padStart(64, '0'), hx = (n) => '0x' + BigInt(n).toString(16);
const rc = (o = {}) => ({ status: '0x1', blockNumber: hx(90), logs: [{ address: o.token || USDC_BASE, topics: [TRANSFER_TOPIC, pad('0x' + '11'.repeat(20)), pad(o.to || ADDR)], data: hx(o.units ?? units) }] });
const T = (n) => '0x' + String(n).repeat(64).slice(0, 64);
chain.receipts = { [T(1)]: rc({ units: units - 1n }), [T(2)]: rc({ token: '0x' + '22'.repeat(20) }), [T(3)]: rc({ to: '0x' + '33'.repeat(20) }), [T(4)]: { ...rc(), blockNumber: hx(99) }, [T(5)]: { ...rc(), status: '0x0' }, [T(6)]: rc() };
const conf = (tx) => call('special/confirm', { code: co.code, email: 'c@d.co', ref: tx });
assert.equal((await conf('0x1234')).s, 400, 'not a hash');
assert.match((await conf(T(1))).j.error, /amount/); assert.match((await conf(T(2))).j.error, /USDC/); assert.match((await conf(T(3))).j.error, /USDC/);
assert.equal((await conf(T(4))).j.retry, true, 'too few confirmations'); assert.match((await conf(T(5))).j.error, /failed/);
assert.equal((await conf(T(7))).j.retry, true, 'unknown tx: wait');
const ok = await conf(T(6)); assert.equal(ok.j.status, 'paid'); assert.equal(ok.j.items[0].downloads.length, 1);
const co2 = (await call('special/start', { id: FIX, rail: 'usdc-base', email: 'c@d.co' })).j;
chain.receipts[T(6)] = rc({ units: usdcUnits(2400, co2.order) });
assert.equal((await call('special/confirm', { code: co2.code, email: 'c@d.co', ref: T(6) })).s, 409, 'a tx pays one order only');
assert.equal((await call('special/approve', { order: co2.order }, 'owner-secret')).j.ok, false, 'crypto is never hand-approved');
assert.equal((await verifyUsdcTx({ BASE_RPC_URL: 'x' }, T(6), ADDR, units, async () => { throw new Error('down'); })).retry, true);
console.log('alt-pay ok');

// x402-style resource: off by default; 402 with exact requirements; unlocks only on a verified tx for that order
const xr = (h) => onRequest({ request: new Request('https://a-to-mind.com/api/store/x402/' + FIX, { headers: h || {} }), env, params: { path: ['x402', FIX] } });
assert.equal((await xr()).status, 404, 'x402 off without the flag');
env.X402_ENABLED = 'on';
const q = await xr(); assert.equal(q.status, 402); const req = (await q.json()).accepts[0];
assert.equal(req.payTo, ADDR); assert.equal(req.maxAmountRequired, usdcUnits(2400, req.extra.order).toString());
const T8 = T(8); chain.receipts[T8] = rc({ units: BigInt(req.maxAmountRequired) });
assert.equal((await xr({ 'x-payment': JSON.stringify({ order: req.extra.order, tx: T(1) }) })).status, 402, 'wrong amount stays 402');
const paid = await xr({ 'x-payment': JSON.stringify({ order: req.extra.order, tx: T8 }) }); assert.equal(paid.status, 200); assert.equal((await paid.json()).status, 'paid');
console.log('x402 ok');
