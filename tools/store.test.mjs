// Verse's own store (lib/store.js, functions/api/store/[[path]].js): tokens, license keys, Stripe signatures, the adapter
// falling back to Gumroad without keys, and the routes end to end with a fake env.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { STORE_PRODUCTS, providerOf, signToken, verifyToken, licenseKey, LICENSE_Verse_RE, verifyStripe, buyAnswer, publicCatalog } from '../void-live-deploy/lib/store.js';
import { onRequest } from '../void-live-deploy/functions/api/store/[[path]].js';
import { storeAsk } from '../void-live-deploy/skills/store.js';

const K = 'test-signing-key';
// catalog: every live product has a Gumroad fallback or is free; ids unique; the old dkmcjk permalink is kept as an alias
assert.equal(new Set(STORE_PRODUCTS.map((p) => p.id)).size, STORE_PRODUCTS.length);
for (const p of STORE_PRODUCTS) assert.ok(p.soon || p.cents === 0 || p.gumroad, p.id + ' has no checkout');
assert.ok(STORE_PRODUCTS.find((p) => p.id === 'code-review-pro').alt.includes('dkmcjk'));
assert.ok(publicCatalog().every((p) => typeof p.files === 'number'), 'file keys never leave the server');
// provider: Gumroad unless Stripe is asked for AND both keys exist
assert.equal(providerOf({}).provider, 'gumroad');
assert.equal(providerOf({ STORE_PROVIDER: 'stripe', STRIPE_SECRET_KEY: 'x' }).provider, 'gumroad');
assert.equal(providerOf({ STORE_PROVIDER: 'stripe', STRIPE_SECRET_KEY: 'x', STRIPE_WEBHOOK_SECRET: 'y' }).provider, 'stripe');
// tokens
const tok = await signToken(K, { o: 'free_1', p: 'chess-set-glb', f: 0, e: Date.now() + 60e3 });
assert.equal((await verifyToken(K, tok)).p, 'chess-set-glb');
assert.equal(await verifyToken('other', tok), null, 'wrong key');
assert.equal(await verifyToken(K, tok.slice(0, -2) + 'AA'), null, 'tampered');
assert.equal(await verifyToken(K, await signToken(K, { o: 'x', p: 'y', f: 0, e: Date.now() - 1 })), null, 'expired');
// license keys: format, stable per order+product, different across orders
const L = await licenseKey(K, 'ord_1', 'chess-set-glb');
assert.match(L, LICENSE_Verse_RE); assert.equal(L, await licenseKey(K, 'ord_1', 'chess-set-glb')); assert.notEqual(L, await licenseKey(K, 'ord_2', 'chess-set-glb'));
// Stripe signatures
const body = '{"id":"evt_1"}', t = Math.floor(Date.now() / 1000), sig = createHmac('sha256', 'whsec').update(t + '.' + body).digest('hex');
assert.equal(await verifyStripe('whsec', `t=${t},v1=${sig}`, body), true);
assert.equal(await verifyStripe('whsec', `t=${t},v1=${sig}`, body + ' '), false);
assert.equal(await verifyStripe('whsec', `t=${t - 1000},v1=${sig}`, body), false, 'too old');
// Verse answers "what can I buy"
for (const a of ['tip', 'buy', 'pricing', 'support void']) assert.ok(storeAsk(a), a);
assert.ok(!storeAsk('20% tip on 45') && !storeAsk('buy milk'));
assert.ok(buyAnswer().rows.length === 8 && buyAnswer().rows.every((r) => /utm_source=a-to-mind/.test(r.url)));
assert.ok(storeAsk('what can I buy?') && storeAsk('open the store') && !storeAsk('grocery store near me') && !storeAsk('what can i buy with bitcoin'));

// routes
const env = { SALT: K, ASSETS: { fetch: async () => new Response('glTF', { status: 200 }) } };
const call = async (path, init = {}) => { const r = await onRequest({ request: new Request('https://a-to-mind.com/api/store/' + path, init), env, params: { path: path.split('?')[0].split('/') } }); return { s: r.status, j: r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text(), r }; };
let x = await call('status'); assert.equal(x.j.provider, 'gumroad'); assert.equal(x.j.stripe_keys, false); assert.ok(!JSON.stringify(x.j).includes(K), 'no secret values');
x = await call('checkout', { method: 'POST', body: JSON.stringify({ items: ['one-time-fix', 'void-monthly', 'voidquest-minis'] }) });
assert.equal(x.j.mode, 'gumroad'); assert.deepEqual(x.j.urls.map((u) => u.split('?')[0]), ['https://moonbeam846.gumroad.com/l/eozcma', 'https://moonbeam846.gumroad.com/l/yinmj']); assert.ok(x.j.urls.every((u) => u.includes('utm_medium=checkout')));
x = await call('free', { method: 'POST', body: JSON.stringify({ id: 'chess-set-glb' }) });
assert.equal(x.j.status, 'free'); const dl = new URL(x.j.items[0].downloads[0].url); assert.match(x.j.items[0].license, LICENSE_Verse_RE);
x = await call('download' + dl.search); assert.equal(x.s, 200); assert.match(x.r.headers.get('content-disposition'), /attachment/);
x = await call('download?t=bogus.token'); assert.equal(x.s, 403);
x = await call('free', { method: 'POST', body: JSON.stringify({ id: 'void-monthly' }) }); assert.equal(x.s, 400, 'paid items are never free');
x = await call('webhook/stripe', { method: 'POST', body, headers: { 'stripe-signature': 't=1,v1=00' } }); assert.equal(x.s, 400);
console.log('store: ok (' + STORE_PRODUCTS.length + ' products, tokens, licenses, stripe signatures, gumroad fallback, routes)');

// ---- the shopping floor (lib/store.js): a cart a person can read, the money in one place, a delivery told as steps
import { cartLines, cartTotals, usdCents, cartUrl, catalogCsv, searchProducts, kindsOf, sortProducts, DELIVERY_STEPS, deliveryDone } from '../void-live-deploy/lib/store.js';
const CAT = [
  { id: 'a', name: 'Alpha Monthly', cents: 4900, kind: 'membership', every: 'month', published: '2026-10-01' },
  { id: 'b', name: 'Beta Review Pro', cents: 1000, kind: 'license', published: '2026-10-02' },
  { id: 'c', name: 'Gamma Kit', cents: 0, kind: 'download' },
  { id: 'd', name: 'Delta Sessions', cents: 2500, kind: 'service', soon: true },
];
assert.deepEqual(cartLines(CAT, 'a,b:2').map((l) => [l.id, l.qty]), [['a', 1], ['b', 2]]);
assert.equal(cartLines(CAT, 'nope:3,c:1,d:1,b:11,b').length, 1, 'unknown ids, free items, soon items and 11-as-a-count are dropped');
assert.equal(cartLines(CAT, 'b:3,b:2')[0].qty, 5, 'the same product twice adds up, still capped at 9');
assert.equal(cartTotals(cartLines(CAT, 'a,b:2')).total, 6900);
assert.equal(usdCents(6900), '$69.00');
assert.equal(cartUrl(cartLines(CAT, 'a,b:2')), '/store/?cart=a%2Cb%3A2');
assert.equal(cartUrl([]), '/store/');
assert.equal(searchProducts(CAT, 'review pro').length, 1);
assert.equal(searchProducts(CAT, '').length, 4);
assert.equal(searchProducts(CAT, 'zzz').length, 0, 'a search that matches nothing is an empty result, not an error');
assert.deepEqual(kindsOf(CAT).map(([k, n]) => k + ':' + n), ['download:1', 'license:1', 'membership:1', 'service:1']);
assert.equal(sortProducts(CAT, 'price-asc')[0].id, 'c');
assert.equal(sortProducts(CAT, 'price-desc')[0].id, 'a');
assert.equal(sortProducts(CAT, 'newest')[0].id, 'b');
assert.match(catalogCsv(CAT), /^id,name,kind,cents,price,every,availability/);
assert.match(catalogCsv(CAT), /"a","Alpha Monthly","membership","4900","49\.00","month","available now"/);
assert.match(catalogCsv(CAT), /"d","Delta Sessions","service","2500","25\.00","","coming soon"/);
assert.equal(DELIVERY_STEPS.length, 5);
const demoOrder = { code: 'ABCD1234', status: 'paid', items: [{ license: 'Verse-AAAA-BBBB', downloads: [{ url: '/x' }] }] };
assert.equal(deliveryDone(demoOrder)['License key issued'], true);
assert.equal(deliveryDone(demoOrder)['Signed downloads ready: links last 24 hours, re-open them any time'], true);
assert.equal(deliveryDone({ code: 'ABCD1234', items: [] })['Ordered'], false);
console.log('store floor: cart, totals, csv, delivery steps ok');

// the payment page sends buyers to /store/receipt/: it is the same page as /store/, so a receipt never runs an older cart
// (an old copy there read carts as plain ids and showed them empty) and gets every store fix; a receipt link fills the code only
{ // /store/receipt/ is the store page, with copy, save and a code-only receipt link
  const a = readFileSync(new URL('../void-live-deploy/store/index.html', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../void-live-deploy/store/receipt/index.html', import.meta.url), 'utf8');
  assert.equal(b, a, 'copy store/index.html to store/receipt/index.html after editing it');
  for (const s of ['id="rcopy"', 'id="rsave"', "q.get('code')", 'for="le"', 'for="lc"', 'aria-live="polite"']) assert.ok(a.includes(s), s);
  assert.ok(!/q\.get\('email'\)/.test(a), 'a link never carries the email');
}
