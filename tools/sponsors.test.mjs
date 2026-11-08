// Starboard's sponsor grid and claim wall (lib/sponsors.js, functions/api/x402/sponsor/[plan].js, functions/api/sponsors.js,
// functions/api/claim.js): a tile is bought over x402 into Verse's wallet and written only after the payment settles; sponsor income counts
// only once the chain shows it; half of it is the house share; a claim is paid only from the rest and never past it; views and claims from
// Verse's own runs, crawlers, tests and the owner never count as billable. Every outside call is faked.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { HOUSE_BPS, PLANS, CLAIM, cleanUrl, checkTile, startOf, endOf, grid, split, poolUnits, claimOk, planSpec } from '../void-live-deploy/lib/sponsors.js';
import { requirementsOf } from '../void-live-deploy/lib/x402.js';
import { VERSE_WALLET } from '../void-live-deploy/lib/verse-wallet-address.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';
import * as buy from '../void-live-deploy/functions/api/x402/sponsor/[plan].js';
import * as sponsors from '../void-live-deploy/functions/api/sponsors.js';
import * as claim from '../void-live-deploy/functions/api/claim.js';

const origin = 'https://a-to-mind.com', PAYER = '0x3333333333333333333333333333333333333333';
const PERSON = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const unb64 = (s) => JSON.parse(Buffer.from(s, 'base64').toString());
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a); return r == null ? null : col ? r[col] : r; } });
  return { raw: db, prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
}
let txn = 0;
const pay = (value, to = VERSE_WALLET) => b64({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x' + 'cd'.repeat(65), authorization: { from: PAYER, to, value: String(value), validAfter: '0', validBefore: '9999999999', nonce: '0x' + String(++txn).padStart(64, '0') } } });
const realFetch = globalThis.fetch;
function facilitator(settles = true) {
  const calls = []; let n = 0;
  globalThis.fetch = async (url) => {
    const u = String(url); calls.push(u);
    if (u.endsWith('/verify')) return Response.json({ isValid: true, payer: PAYER });
    if (u.endsWith('/settle')) return settles ? Response.json({ success: true, transaction: '0x' + String(++n).padStart(2, '0').repeat(32), network: 'base', payer: PAYER }) : Response.json({ success: false, errorReason: 'insufficient_funds' });
    return new Response('offline in tests', { status: 503 });
  };
  return calls;
}
let ip = 0;
const req = (path, method, body, headers = {}) => new Request(origin + path, { method, headers: { 'cf-connecting-ip': '203.0.113.' + (++ip % 250), 'user-agent': PERSON, 'content-type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
const TILE = { slot: 's1', title: 'Moon Bakery', url: 'https://moon-bakery.example.com/', text: 'Bread baked at night.' };

// the pure rules
assert.equal(HOUSE_BPS, 5000, 'the house share is half');
assert.equal(cleanUrl('http://x.example.com/'), '', 'https only');
assert.equal(cleanUrl('https://user:pw@x.example.com/'), '', 'no user or password');
assert.equal(cleanUrl('https://x.example.com:8443/'), '', 'no port');
assert.equal(cleanUrl('https://127.0.0.1/'), '', 'no IP address');
assert.equal(cleanUrl('https://printer.local/'), '', 'no local host');
assert.equal(cleanUrl('https://intranet/'), '', 'no single-label host');
assert.equal(cleanUrl('https://moon-bakery.example.com/a?b=1'), 'https://moon-bakery.example.com/a?b=1');
assert.equal(checkTile({ ...TILE, slot: 's9' }).ok, false);
assert.equal(checkTile({ ...TILE, title: 'x' }).ok, false);
assert.equal(checkTile({ ...TILE, title: '<b>Moon</b>‮' }).title, 'bMoon/b', 'markup and control characters go');
assert.equal(checkTile([]).ok, false);
const t0 = Date.parse('2026-11-06T00:00:00Z');
const r1 = { slot: 's1', status: 'paid', starts: '2026-11-05T00:00:00Z', ends: '2026-11-07T00:00:00Z', id: 'a', title: 'A', url: 'https://a.example.com/' };
assert.equal(startOf([r1], 's1', t0), '2026-11-07T00:00:00.000Z', 'a new tile is queued after the one bought before it');
assert.equal(startOf([r1], 's2', t0), new Date(t0).toISOString(), 'an empty slot starts now');
assert.equal(endOf('2026-11-07T00:00:00.000Z', 7), '2026-11-14T00:00:00.000Z');
const g = grid([r1], t0);
assert.equal(g[0].tile.id, 'a'); assert.equal(g[0].open, false); assert.equal(g[1].open, true); assert.equal(g.length, 6);
assert.deepEqual(split({ sponsorCents: 501, claimedCents: 3 }), { house_bps: 5000, sponsor_cents: 501, house_cents: 250, pool_cents: 251, claimed_cents: 3, paid_out_cents: 0, available_cents: 248 });
assert.equal(poolUnits(1000000n, 0n), 500000n); assert.equal(poolUnits(1000000n, 600000n), 0n, 'the pool never goes below zero');
const okArgs = { cls: 'person', owner: false, address: PAYER, poolLeft: 500000n };
assert.equal(claimOk(okArgs).ok, true);
assert.equal(claimOk({ ...okArgs, cls: 'bot' }).status, 409, 'a crawler is refused');
assert.equal(claimOk({ ...okArgs, cls: 'ours' }).status, 409, 'Verse\'s own run is refused');
assert.equal(claimOk({ ...okArgs, owner: true }).status, 409, 'the owner is refused');
assert.equal(claimOk({ ...okArgs, address: '0x12' }).status, 400);
assert.equal(claimOk({ ...okArgs, mineInWindow: 1 }).status, 429);
assert.equal(claimOk({ ...okArgs, addressInWindow: 1 }).status, 429);
assert.equal(claimOk({ ...okArgs, today: CLAIM.perDay }).status, 429);
assert.equal(claimOk({ ...okArgs, poolLeft: 9999n }).status, 409, 'an empty pool is refused');
assert.equal(requirementsOf(planSpec('week'), VERSE_WALLET, origin).v1.maxAmountRequired, String(PLANS.week.units));
assert.equal(planSpec('year'), null);

// GET, HEAD and a POST without payment: 402 naming Verse's wallet on Base, at the plan's price; a bad tile is refused before any payment
const env = { DB: d1(), SALT: 'test-salt', READ_TOKEN: 'owner-token' };
for (const plan of Object.keys(PLANS)) {
  const r = await buy.onRequestGet({ request: req('/api/x402/sponsor/' + plan, 'GET'), env, params: { plan } });
  assert.equal(r.status, 402, plan + ' GET is a 402');
  const v2 = unb64(r.headers.get('payment-required'));
  assert.equal(v2.accepts[0].payTo, VERSE_WALLET); assert.equal(v2.accepts[0].amount || v2.accepts[0].maxAmountRequired, String(PLANS[plan].units));
  assert.equal((await buy.onRequestHead({ request: req('/api/x402/sponsor/' + plan, 'HEAD'), env, params: { plan } })).status, 402);
}
assert.equal((await buy.onRequestGet({ request: req('/api/x402/sponsor/year', 'GET'), env, params: { plan: 'year' } })).status, 404);
{
  const calls = facilitator();
  try {
    const bad = await buy.onRequestPost({ request: req('/api/x402/sponsor/day', 'POST', { ...TILE, url: 'http://moon.example.com/' }, { 'x-payment': pay(PLANS.day.units) }), env, params: { plan: 'day' } });
    assert.equal(bad.status, 400); assert.equal(calls.length, 0, 'a bad tile never reaches the facilitator');
    assert.equal((await buy.onRequestPost({ request: req('/api/x402/sponsor/day', 'POST', TILE), env, params: { plan: 'day' } })).status, 402, 'no payment, no tile');
  } finally { globalThis.fetch = realFetch; }
}
assert.equal((await buy.onRequestGet({ request: req('/api/x402/sponsor/day', 'GET'), env: {}, params: { plan: 'day' } })).status, 503, 'no database, closed, nothing charged');

// a payment that does not settle writes no tile
{
  facilitator(false);
  try {
    const r = await buy.onRequestPost({ request: req('/api/x402/sponsor/day', 'POST', TILE, { 'x-payment': pay(PLANS.day.units) }), env, params: { plan: 'day' } });
    assert.equal(r.status, 402); assert.equal((await r.json()).paid, false);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS c FROM void_sponsor').get().c, 0);
  } finally { globalThis.fetch = realFetch; }
}

// the paid flow: verified, settled, recorded for the treasury, the tile written; a second buy of the same slot is queued after it
let tile1, tile2;
{
  facilitator();
  try {
    const r = await buy.onRequestPost({ request: req('/api/x402/sponsor/day', 'POST', TILE, { 'x-payment': pay(PLANS.day.units) }), env, params: { plan: 'day' } });
    assert.equal(r.status, 200); const j = await r.json(); tile1 = j.tile;
    assert.equal(j.ok, true); assert.equal(j.paid, true); assert.ok(r.headers.get('x-payment-response'));
    const row = env.DB.raw.prepare('SELECT * FROM void_x402').get();
    assert.equal(row.service, 'sponsor-day'); assert.equal(row.status, 'settled'); assert.equal(row.units, String(PLANS.day.units)); assert.equal(row.pay_to, VERSE_WALLET.toLowerCase());
    const r2 = await buy.onRequestPost({ request: req('/api/x402/sponsor/week', 'POST', { ...TILE, title: 'Second' }, { 'x-payment': pay(PLANS.week.units) }), env, params: { plan: 'week' } });
    tile2 = (await r2.json()).tile;
    assert.equal(tile2.starts, tile1.ends, 'the second buyer gets every day paid for, after the first');
  } finally { globalThis.fetch = realFetch; }
}

// before the chain shows the payment: the tile stands, but nothing counts as income and the claim wall stays shut
resetGuard();
{
  const v = await sponsors.sponsorView(env);
  assert.equal(v.slots[0].tile.id, tile1.id); assert.equal(v.split.sponsor_cents, 0); assert.equal(v.split.waiting_cents, 600);
  const c = await claim.onRequestPost({ request: req('/api/claim', 'POST', { address: PAYER }), env });
  assert.equal(c.status, 409, 'no claim while the pool holds nothing confirmed');
}

// the chain shows both payments: 6 USDC in, 3 to the house, 3 in the pool
env.DB.raw.prepare("UPDATE void_x402 SET status = 'verified'").run();
{
  const v = await sponsors.sponsorView(env);
  assert.equal(v.split.sponsor_cents, 600); assert.equal(v.split.house_cents, 300); assert.equal(v.split.pool_cents, 300);
  assert.equal(v.plans.find((p) => p.id === 'week').price_usdc, '5'); assert.ok(!JSON.stringify(v).includes(PAYER.toLowerCase()), 'no address in the public read');
  const get = await sponsors.onRequestGet({ env }); assert.equal(get.status, 200); assert.equal((await get.json()).slots.length, 6);
}

// views: a person counts as billable; Verse's own run, a crawler and the owner are counted as excluded
{
  const view = (headers, body = {}) => sponsors.onRequestPost({ request: req('/api/sponsors', 'POST', { tiles: [tile1.id, tile2.id, 'tile:0x' + 'ff'.repeat(32)], ...body }, headers), env });
  assert.equal((await (await view({})).json()).billable, true);
  assert.equal((await (await view({ 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' })).json()).billable, false);
  assert.equal((await (await view({ 'x-void-test': '1' })).json()).billable, false);
  assert.equal((await (await view({}, { w: 1 })).json()).billable, false, 'a driven browser is ours');
  assert.equal((await (await view({ authorization: 'Bearer owner-token' })).json()).billable, false, 'the owner is not billable');
  const v = await sponsors.sponsorView(env);
  assert.deepEqual(v.slots[0].views_30d, { people: 1, excluded: 4 }, 'only the live tile counts, and the unknown id is dropped');
  assert.equal((await sponsors.onRequestPost({ request: req('/api/sponsors', 'POST', { tiles: ['x'] }), env })).status, 400);
  assert.equal((await sponsors.onRequestPost({ request: req('/api/sponsors', 'POST', { tiles: [tile1.id] }), env: { DB: env.DB } })).status, 503, 'no SALT, closed');
}

// claims: refused for crawlers, Verse's own runs and the owner; one per visitor and per address; never past the pool
{
  const post = (body, headers = {}) => claim.onRequestPost({ request: req('/api/claim', 'POST', body, headers), env });
  assert.equal((await post({ address: PAYER }, { 'user-agent': 'curl/8.4.0' })).status, 409);
  assert.equal((await post({ address: PAYER }, { 'x-void-test': '1' })).status, 409);
  assert.equal((await post({ address: PAYER }, { authorization: 'Bearer owner-token' })).status, 409);
  assert.equal((await post({ address: 'nope' })).status, 400);
  const fixed = { 'cf-connecting-ip': '198.51.100.7' };
  const ok = await post({ address: PAYER }, fixed); assert.equal(ok.status, 200); assert.equal((await ok.json()).owed_usdc, '0.01');
  assert.equal((await post({ address: '0x' + '44'.repeat(20) }, fixed)).status, 429, 'one claim per visitor in the window');
  assert.equal((await post({ address: PAYER })).status, 429, 'one claim per address in the window');
  const row = env.DB.raw.prepare('SELECT * FROM void_claims').get();
  assert.equal(row.status, 'owed'); assert.equal(row.address, PAYER.toLowerCase()); assert.equal(row.units, String(CLAIM.units));
  const pub = await (await claim.onRequestGet({ env })).json();
  assert.equal(pub.pool_cents, 299); assert.equal(pub.open, true); assert.ok(!JSON.stringify(pub).includes(PAYER.toLowerCase()));
}

// the pool limit: fill the claims to the pool, then the next claim is refused even with every other check passing
{
  const used = Number(env.DB.raw.prepare('SELECT SUM(CAST(units AS INTEGER)) AS u FROM void_claims').get().u);
  env.DB.raw.prepare("INSERT INTO void_claims (id, at, day, who, address, units, status) VALUES ('fill', '2026-01-01T00:00:00Z', '2026-01-01', 'old', '0x0', ?, 'paid')").run(String(1500000 * 2 - used));
  assert.equal((await claim.onRequestPost({ request: req('/api/claim', 'POST', { address: '0x' + '55'.repeat(20) }), env })).status, 409, 'the pool is empty');
  assert.equal((await (await claim.onRequestGet({ env })).json()).open, false);
  // and the guarded insert holds even if the pre-checks were passed: with the pool spent, no row is added
  const before = env.DB.raw.prepare('SELECT COUNT(*) AS c FROM void_claims').get().c;
  const r = env.DB.raw.prepare("INSERT INTO void_claims (id, at, day, who, address, units, status) SELECT 'x', '2026-11-06T00:00:00Z', '2026-11-06', 'w', 'a', '10000', 'owed' WHERE (SELECT COALESCE(SUM(CAST(units AS INTEGER)), 0) FROM void_x402 WHERE service LIKE 'sponsor-%' AND status = 'verified') * (10000 - 5000) / 10000 - (SELECT COALESCE(SUM(CAST(units AS INTEGER)), 0) FROM void_claims) >= 10000").run();
  assert.equal(Number(r.changes), 0); assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS c FROM void_claims').get().c, before);
  const v = await sponsors.sponsorView(env);
  assert.equal(v.split.available_cents, 0); assert.equal(v.split.claimed_cents, 300); assert.equal(v.split.claimed_cents <= v.split.pool_cents, true, 'claims never pass the pool');
}

// a payment the chain does not show takes its tile off the grid
env.DB.raw.prepare("UPDATE void_x402 SET status = 'not on chain' WHERE service = 'sponsor-day'").run();
assert.ok(!(await sponsors.sponsorView(env)).slots[0].tile, 'slot s1 has no live tile now: the next one starts later')
assert.ok(!(await sponsors.sponsorView(env)).slots.some((s) => s.tile && s.tile.id === tile1.id), 'the unpaid tile is gone');

console.log('sponsors: ok');
