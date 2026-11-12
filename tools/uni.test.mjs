// Uni: full pages, a $20 month when Stripe has no price yet, and the existing Multi tier left alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openPath, gatedPath, backPath, money, ensurePrice, resetLive, mintPass, readPass, passage, screen, startCheckout, finishCheckout, applyStripeEvent, CENTS, PRODUCT } from '../void-live-deploy/lib/uni.js';
import { onRequest as gate } from '../void-live-deploy/functions/_middleware.js';
import { onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/uni.js';
import { sessionId } from '../void-live-deploy/lib/void-me.js';

const KEY = 'sk_test_examplekey123456'; // secret-scan: ok
const price = { id: 'price_keep', unit_amount: 2000, recurring: { interval: 'month' } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const html = (body, status = 200) => () => Promise.resolve(new Response(body, { status, headers: { 'content-type': 'text/html' } }));
const ask = (path, headers) => new Request('https://a-to-mind.com' + path, { headers });
const stripe = (opt = {}) => async (url, init) => {
  const u = String(url), method = (init && init.method) || 'GET';
  if (method === 'POST' && u.endsWith('/checkout/sessions')) { if (opt.body) opt.body.s = String(init.body); return Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_page' }); }
  if (method === 'POST' && u.endsWith('/products')) return Response.json({ id: 'prod_new', name: PRODUCT });
  if (method === 'POST' && u.endsWith('/prices')) { if (opt.posted) opt.posted.s = String(init.body); return Response.json({ id: 'price_new', unit_amount: 2000 }); }
  if (u.includes('lookup_keys')) return Response.json({ data: opt.lookup === false ? [] : [price] });
  if (u.includes('/checkout/sessions/')) return Response.json(opt.session || {});
  return Response.json({ data: opt.empty ? [] : [{}] });
};
async function withFetch(fn, impl) { resetLive(); const real = globalThis.fetch; globalThis.fetch = impl; try { return await fn(); } finally { globalThis.fetch = real; resetLive(); } }

test('open paths stay open, full pages are Uni, and a missing key does not lock them', async () => {
  for (const p of ['/', '/index.html', '/void.html', '/404.html', '/api/answer', '/api/status', '/api/publish', '/api/uni', '/privacy/', '/members/', '/store/', '/skills/clock.js', '/films/rss']) assert.equal(openPath(p), true, p);
  for (const p of ['/flights/', '/emojis/', '/books/', '/versus/', '/brain/', '/studies.html', '/@sam']) assert.equal(gatedPath(p), true, p);
  assert.equal(backPath('https://evil.example/x'), '/'); assert.equal(money(CENTS), '$20 a month');
  const page = screen({ cents: CENTS }, '/flights/');
  assert.match(page, /<h1>Uni<\/h1>/); assert.match(page, /Subscribe/); assert.match(page, /href="\/">Free cards/); assert.match(page, /href="\/members\/">Multi/);
  assert.equal(/UniVerse|MultiVerse|Premium|4242/.test(page), false);
  assert.equal(await (await gate({ request: ask('/flights/'), env: {}, next: html('FLIGHTS') })).text(), 'FLIGHTS');
  await withFetch(async () => { assert.equal(await (await gate({ request: ask('/books/'), env: { STRIPE_SECRET_KEY: KEY }, next: html('BOOKS') })).text(), 'BOOKS'); }, async () => new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }));
  await withFetch(async () => {
    const stranger = await gate({ request: ask('/flights/'), env: { STRIPE_SECRET_KEY: KEY, SALT: 'salt' }, next: html('FLIGHTS') });
    assert.match(await stranger.text(), /<h1>Uni<\/h1>/); assert.equal(stranger.headers.get('x-verse-gate'), 'uni');
    resetLive();
    const owner = await gate({ request: ask('/flights/', { authorization: 'Bearer suite-owner-token' }), env: { STRIPE_SECRET_KEY: KEY, SALT: 'salt', READ_TOKEN: 'suite-owner-token' }, next: html('FLIGHTS') });
    assert.equal(await owner.text(), 'FLIGHTS'); assert.equal(owner.headers.get('x-verse-gate'), 'open');
    assert.equal((await gate({ request: ask('/no-such-page/'), env: { STRIPE_SECRET_KEY: KEY, SALT: 'salt' }, next: html('gone', 404) })).status, 404);
  }, stripe());
});

test('prices are reused, Multi can view, Uni is not Multi, and the webhook ignores other plans', async () => {
  assert.equal((await ensurePrice({ STRIPE_SECRET_KEY: KEY }, stripe())).created, false);
  const posted = {};
  assert.equal((await ensurePrice({ STRIPE_SECRET_KEY: KEY }, stripe({ lookup: false, empty: true, posted }))).created, true);
  assert.equal(new URLSearchParams(posted.s).get('unit_amount'), '2000');
  const DB = d1(), token = 'a'.repeat(43);
  DB.raw.exec('CREATE TABLE void_sessions (id TEXT, user_id TEXT, expires INTEGER); CREATE TABLE void_accounts (user_id TEXT, tier TEXT)');
  DB.raw.prepare('INSERT INTO void_sessions (id, user_id, expires) VALUES (?, ?, ?)').run(await sessionId(token), 'user-1', Date.now() + 864e5);
  DB.raw.prepare("INSERT INTO void_accounts (user_id, tier) VALUES ('user-1', 'paid')").run();
  assert.equal(await passage(ask('/brain/', { authorization: 'Bearer ' + token }), { DB }), 'multi');
  const pass = await mintPass({ SALT: 'salt' }, 'sub_abc123');
  assert.ok(await readPass({ SALT: 'salt' }, pass));
  assert.equal(/^Bearer ([A-Za-z0-9_-]{40,64})$/.test('Bearer ' + pass), false);
  assert.equal(await passage(new Request('http://127.0.0.1/flights/', { headers: { 'x-verse-suite': '1' } }), { PASSKEY_RP_ID: 'localhost' }), 'suite');
  assert.equal(await passage(new Request('https://a-to-mind.com/flights/', { headers: { 'x-verse-suite': '1' } }), { PASSKEY_RP_ID: 'localhost' }), '');
  const sent = {};
  const out = await startCheckout({ STRIPE_SECRET_KEY: KEY, SALT: 'salt' }, 'https://a-to-mind.com', '/versus/', stripe({ body: sent }));
  assert.match(out.url, /^https:\/\/checkout\.stripe\.com\//); assert.match(sent.s, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.equal(new URLSearchParams(sent.s).get('line_items[0][price]'), 'price_keep'); assert.equal(new URLSearchParams(sent.s).has('card'), false);
  const done = await finishCheckout({ STRIPE_SECRET_KEY: KEY, SALT: 'salt', DB }, 'cs_test_example123456', stripe({ session: { id: 'cs_test_example123456', status: 'complete', metadata: { plan: 'universe', back: '/books/' }, subscription: { id: 'sub_abc123', status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 86400 } } }));
  assert.equal(done.back, '/books/');
  await withFetch(async () => { assert.equal(await (await gate({ request: ask('/books/', { authorization: 'Bearer ' + pass }), env: { STRIPE_SECRET_KEY: KEY, SALT: 'salt', DB }, next: html('BOOKS') })).text(), 'BOOKS'); }, stripe());
  assert.equal(await applyStripeEvent({ DB }, { type: 'customer.subscription.deleted', data: { object: { id: 'sub_other', metadata: { plan: 'multiverse' } } } }), false);
  const body = JSON.stringify({ type: 'customer.subscription.updated', data: { object: { id: 'sub_abc123', status: 'canceled', metadata: { plan: 'universe' } } } });
  const t = Math.floor(Date.now() / 1000), header = 't=' + t + ',v1=' + createHmac('sha256', 'whsec_exampleexampleexample').update(t + '.' + body).digest('hex'); // secret-scan: ok
  await grantFirst(DB);
  assert.equal((await onRequestPost({ request: new Request('https://a-to-mind.com/api/uni', { method: 'POST', headers: { 'stripe-signature': header }, body }), env: { DB, STRIPE_WEBHOOK_SECRET: 'whsec_exampleexampleexample' } })).status, 200);
  assert.equal((await DB.prepare('SELECT status FROM void_uni WHERE sub = ?').bind('sub_abc123').first()).status, 'canceled');
  const pub = await (await onRequestGet({ request: ask('/api/uni'), env: {} })).json();
  assert.equal(pub.missing, 'STRIPE_SECRET_KEY'); assert.equal(JSON.stringify(pub).includes(KEY), false);
  const hop = await gate({ request: ask('/shopping/'), env: { ASSETS: { fetch: async () => new Response('/shopping/ /store/ 301\n') } }, next: html('STORE') });
  assert.equal(hop.status, 301); assert.equal(hop.headers.get('location'), 'https://a-to-mind.com/store/');
});

async function grantFirst(DB) {
  assert.equal(await applyStripeEvent({ DB }, { type: 'checkout.session.completed', data: { object: { metadata: { plan: 'universe' }, subscription: 'sub_abc123' } } }), true);
}
