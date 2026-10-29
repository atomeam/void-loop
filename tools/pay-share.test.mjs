// Pay a percentage, get that percentage (Adam 2026-10-15, lib/pay-share.js, docs/store.md): the amount-to-items mapping,
// forged client amounts ignored (Stripe body, signed webhook metadata, download tokens, Gumroad claims), and the upgrade path.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { unlockCount, shareFor, shareItems, isShareProduct, zipStore, itemKey } from '../void-live-deploy/lib/pay-share.js';
import { STORE_PRODUCTS, publicCatalog, signToken } from '../void-live-deploy/lib/store.js';
import { onRequest } from '../void-live-deploy/functions/api/store/[[path]].js';

// ---- mapping: ceil(p% x N), at least one item for any payment, everything at >= 100%
assert.equal(unlockCount(400, 1000, 10), 4);
assert.equal(unlockCount(401, 1000, 10), 5, 'ceil');
assert.equal(unlockCount(1, 1000, 10), 1, 'any payment gets one');
assert.equal(unlockCount(0, 1000, 10), 0);
assert.equal(unlockCount(1000, 1000, 10), 10); assert.equal(unlockCount(5000, 1000, 10), 10, 'over 100% is everything');
assert.equal(unlockCount(333, 1000, 3), 1); assert.equal(unlockCount(334, 1000, 3), 2); assert.equal(unlockCount(700, 700, 7), 7);
for (let n = 1; n <= 12; n++) for (let c = 0; c <= 1200; c += 7) { const k = unlockCount(c, 1000, n); assert.ok(k >= 0 && k <= n && (c < 1000 || k === n) && (c === 0 || k >= 1)); }
const P = { id: 'test-share-pack', name: 'Test pack', cents: 1000, pwyw: true, kind: 'download', pack: 'print-set', status: 'live', gumroad: 'testshare',
  contents: ['m1.stl', 'm2.stl', 'm3.stl', 'm4.stl', 'm5.stl', 'm6.stl', 'm7.stl', 'm8.stl', 'm9.stl', 'm10.stl', 'README.txt'], files: [{ key: 'store/test-share-pack-v1.zip' }] };
assert.ok(isShareProduct(P)); assert.ok(!isShareProduct({ ...P, cents: 0 }), 'truly free stays free'); assert.ok(!isShareProduct({ ...P, pwyw: false }));
assert.deepEqual(shareItems(P).free, ['README.txt']); assert.equal(shareItems(P).paid.length, 10);
let s = shareFor(P, 400); assert.deepEqual(s.unlocked, ['README.txt', 'm1.stl', 'm2.stl', 'm3.stl', 'm4.stl']); assert.equal(s.upgradeCents, 600); assert.equal(s.pct, 40);
assert.deepEqual(shareFor({ ...P, order: ['m10.stl', 'README.txt', 'm1.stl'] }, 1).unlocked, ['README.txt', 'm10.stl'], 'Verse ranking order, README first');
assert.equal(shareFor(P, 1000).locked.length, 0); assert.equal(shareFor(P, 1000).upgradeCents, 0);
// zip: valid local headers, every file present
const z = zipStore([{ name: 'a.txt', data: new TextEncoder().encode('hi') }]); assert.equal(new DataView(z.buffer).getUint32(0, true), 0x04034b50); assert.ok(Buffer.from(z).includes('a.txt'));

// ---- routes, with an in-memory D1 and R2
const db = new DatabaseSync(':memory:');
const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => db.prepare(sql).run(...a), all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
db.exec('CREATE TABLE void_sales (id TEXT PRIMARY KEY, resource TEXT NOT NULL, sale_id TEXT, subscription_id TEXT, product TEXT, void_id TEXT, verified INTEGER NOT NULL, effect TEXT, raw TEXT NOT NULL, at TEXT NOT NULL)');
const r2 = Object.fromEntries(P.contents.map((n) => [itemKey(P, n), new TextEncoder().encode('data of ' + n)]));
let stripeBody = null;
const env = { SALT: 'k', STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh', STORE_PROVIDER: 'stripe', DB: { prepare: (q) => stmt(q) },
  FILMS: { get: async (k) => (r2[k] ? { arrayBuffer: async () => r2[k].buffer, body: r2[k] } : null) } };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, init) => { if (String(u).includes('api.stripe.com')) { stripeBody = new URLSearchParams(init.body); return Response.json({ url: 'https://checkout.stripe.com/x' }); } return realFetch(u, init); };
const call = async (path, init = {}) => { const r = await onRequest({ request: new Request('https://a-to-mind.com/api/store/' + path, init), env, params: { path: path.split('?')[0].split('/') } }); const ct = r.headers.get('content-type') || ''; return { s: r.status, j: ct.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer()), r }; };
const post = (path, b) => call(path, { method: 'POST', body: JSON.stringify(b) });
const hook = (obj) => { const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: obj } }), t = Math.floor(Date.now() / 1000); return call('webhook/stripe', { method: 'POST', body, headers: { 'stripe-signature': `t=${t},v1=` + createHmac('sha256', 'wh').update(t + '.' + body).digest('hex') } }); };
const zipNames = (u8) => { const out = []; const dv = new DataView(u8.buffer, u8.byteOffset); let o = 0; while (dv.getUint32(o, true) === 0x04034b50) { const sz = dv.getUint32(o + 18, true), nl = dv.getUint16(o + 26, true); out.push(new TextDecoder().decode(u8.subarray(o + 30, o + 30 + nl))); o += 30 + nl + sz; } return out; };

STORE_PRODUCTS.push({ ...P, soon: false });
try {
  assert.equal(publicCatalog().find((p) => p.id === P.id).share.items.length, 10, 'the card gets the ordered list');
  assert.ok(!JSON.stringify(publicCatalog().find((p) => p.id === P.id).share).includes('store/'), 'no R2 keys on the card');
  assert.equal((await post('free', { id: P.id })).s, 400, 'a priced pwyw pack is not a free download');
  // checkout: the buyer's chosen amount is clamped to $1..price, any price/discount fields are ignored
  await post('checkout', { items: [P.id], pay: 400, price: 0, unit_amount: 0, coupon: 'FREE' });
  assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '400'); assert.equal(stripeBody.get('metadata[share]'), P.id); assert.ok(!stripeBody.has('discounts[0][coupon]'));
  await post('checkout', { items: [P.id], pay: 0 }); assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '1000', 'no $0 checkout');
  await post('checkout', { items: [P.id], pay: -50 }); assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '100', 'floor $1');
  await post('checkout', { items: [P.id], pay: 99999 }); assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '1000');
  assert.equal((await post('checkout', { items: [P.id, 'one-time-fix'], pay: 400 })).s, 400, 'a share pack checks out alone');
  // the signed webhook's amount_total decides; forged metadata (paid, pct, k) is ignored
  await hook({ id: 'cs_test_share_0001', payment_status: 'paid', amount_total: 400, metadata: { items: P.id, share: P.id, paid: '1000', pct: '100', k: '10' }, customer_email: 'b@x.co', payment_intent: 'pi_1' });
  let x = await call('order?session=cs_test_share_0001'); const it = x.j.items[0];
  assert.equal(it.share.got, 4); assert.equal(it.share.of, 10); assert.equal(it.share.upgrade.cents, 600); assert.equal(it.downloads.length, 1);
  let dl = await call('download' + new URL(it.downloads[0].url).search); assert.equal(dl.s, 200);
  assert.deepEqual(zipNames(dl.j), ['README.txt', 'm1.stl', 'm2.stl', 'm3.stl', 'm4.stl']);
  assert.match(dl.r.headers.get('content-disposition'), /4-of-10\.zip/);
  // a forged token asking for more items changes nothing (the count comes from the order row)
  const forged = await signToken('k', { o: x.j.order, p: P.id, z: 1, k: 10, pct: 100, e: Date.now() + 60e3 });
  assert.equal(zipNames((await call('download?t=' + forged)).j).length, 5);
  assert.equal((await call('download?t=' + await signToken('wrong', { o: x.j.order, p: P.id, z: 1, e: Date.now() + 60e3 }))).s, 403);
  // upgrade: the server charges exactly the difference, whatever the client says; the top-up is credited by order id
  assert.equal((await post('checkout', { items: [P.id], upgrade: x.j.code, email: 'other@x.co' })).s, 404, 'only the buyer');
  await post('checkout', { items: [P.id], upgrade: x.j.code, email: 'b@x.co', pay: 1 });
  assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '600'); assert.equal(stripeBody.get('metadata[upgrade]'), x.j.order);
  await hook({ id: 'cs_test_share_0002', payment_status: 'paid', amount_total: 600, metadata: { items: P.id, upgrade: x.j.order }, payment_intent: 'pi_2' });
  await hook({ id: 'cs_test_share_0002', payment_status: 'paid', amount_total: 600, metadata: { items: P.id, upgrade: x.j.order }, payment_intent: 'pi_2' }); // retried: once
  x = await call('order?session=cs_test_share_0001'); assert.equal(x.j.items[0].share.got, 10); assert.equal(x.j.items[0].share.upgrade, null); assert.equal(x.j.items[0].share.paid, 1000);
  assert.equal(zipNames((await call('download' + new URL(x.j.items[0].downloads[0].url).search)).j).length, 11);
  assert.equal((await post('checkout', { items: [P.id], upgrade: x.j.code, email: 'b@x.co' })).s, 400, 'nothing left to pay');
  // Gumroad: the amount comes from the keyed ping gumroad.js stored, never from the claim body
  const raw = new URLSearchParams({ sale_id: 'grSALE001', product_permalink: 'testshare', price: '300', email: 'g@x.co', seller_id: 'I1O8RSqkcoRWcew39cQx7A==' }).toString();
  db.prepare("INSERT INTO void_sales VALUES ('sale:grSALE001:1','sale','grSALE001',NULL,'testshare',NULL,0,'recorded',?,'2026-10-15')").run(raw);
  assert.equal((await post('share/claim', { sale_id: 'grSALE001', email: 'nope@x.co' })).s, 404, 'email must match the sale');
  x = await post('share/claim', { sale_id: 'grSALE001', email: 'g@x.co', price: 1000, cents: 1000 });
  assert.equal(x.j.items[0].share.got, 3, 'Gumroad $3 of $10 = 3 of 10'); assert.equal(x.j.items[0].share.paid, 300);
  const testRaw = new URLSearchParams({ sale_id: 'grTEST002', product_permalink: 'testshare', price: '1000', email: 't@x.co', seller_id: 'I1O8RSqkcoRWcew39cQx7A==', test: 'true' }).toString();
  db.prepare("INSERT INTO void_sales VALUES ('sale:grTEST002:1','sale','grTEST002',NULL,'testshare',NULL,0,'recorded',?,'2026-10-15')").run(testRaw);
  assert.equal((await post('share/claim', { sale_id: 'grTEST002', email: 't@x.co' })).s, 403, 'test pings are not trusted');
  // Gumroad upgrade: the order code in url_params is credited
  const upRaw = new URLSearchParams({ sale_id: 'grSALE003', product_permalink: 'testshare', price: '700', email: 'g@x.co', seller_id: 'I1O8RSqkcoRWcew39cQx7A==', 'url_params[upgrade]': x.j.code }).toString();
  db.prepare("INSERT INTO void_sales VALUES ('sale:grSALE003:1','sale','grSALE003',NULL,'testshare',NULL,0,'recorded',?,'2026-10-15')").run(upRaw);
  x = await post('share/claim', { sale_id: 'grSALE003', email: 'g@x.co' }); assert.equal(x.j.items[0].share.got, 10);
  // a Gumroad refund ping kills the links
  db.prepare("INSERT INTO void_sales VALUES ('refund:grSALE001:2','refund','grSALE001',NULL,'testshare',NULL,0,'recorded','refunded=true','2026-10-15')").run();
  assert.equal((await call('download' + new URL(x.j.items[0].downloads[0].url).search)).s, 403);
} finally { STORE_PRODUCTS.pop(); globalThis.fetch = realFetch; }
assert.ok(STORE_PRODUCTS.filter((p) => p.pwyw && !p.cents).every((p) => !isShareProduct(p)), 'the live free packs stay fully free');
console.log('pay-share: ok (mapping, forged amounts ignored, Stripe + Gumroad, upgrade credited by order id, refunds)');
