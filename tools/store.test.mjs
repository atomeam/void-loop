// Verse's own store (lib/store.js, functions/api/store/[[path]].js): tokens, license keys, Stripe signatures, the adapter
// falling back to Gumroad without keys, and the routes end to end with a fake env.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { STORE_PRODUCTS, providerOf, signToken, verifyToken, licenseKey, LICENSE_V01D_RE, verifyStripe, buyAnswer, publicCatalog } from '../void-live-deploy/lib/store.js';
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
assert.match(L, LICENSE_V01D_RE); assert.equal(L, await licenseKey(K, 'ord_1', 'chess-set-glb')); assert.notEqual(L, await licenseKey(K, 'ord_2', 'chess-set-glb'));
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
assert.equal(x.j.status, 'free'); const dl = new URL(x.j.items[0].downloads[0].url); assert.match(x.j.items[0].license, LICENSE_V01D_RE);
x = await call('download' + dl.search); assert.equal(x.s, 200); assert.match(x.r.headers.get('content-disposition'), /attachment/);
x = await call('download?t=bogus.token'); assert.equal(x.s, 403);
x = await call('free', { method: 'POST', body: JSON.stringify({ id: 'void-monthly' }) }); assert.equal(x.s, 400, 'paid items are never free');
x = await call('webhook/stripe', { method: 'POST', body, headers: { 'stripe-signature': 't=1,v1=00' } }); assert.equal(x.s, 400);
console.log('store: ok (' + STORE_PRODUCTS.length + ' products, tokens, licenses, stripe signatures, gumroad fallback, routes)');
