// Verse's treasury: the realized-revenue math, the split (Atom's cut first, the reserve, the buckets), the spend queue, the weekly
// review, the cut's revision rule, the public API on a real SQLite standing in for D1, and the found-money parsers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { realized, feeCents, balances, bucketWeights, clampShares, split, queueSpends, review, reviseCut, BUCKETS } from '../void-live-deploy/lib/treasury.js';
import { onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/treasury.js';
import { money, hackathonFinds, bountyFinds, settlementFinds, affiliateFinds, upsellFinds } from './found-money.mjs';

const policy = JSON.parse(readFileSync(new URL('../void-live-deploy/treasury/policy.json', import.meta.url), 'utf8'));
const ping = (o) => new URLSearchParams(o).toString();

// fees: Gumroad's published 10% + 50c plus 2.9% + 30c on a direct sale, 30% flat on Discover
assert.equal(feeCents(4900), Math.round(4900 * 0.129) + 80);
assert.equal(feeCents(4900, { discover: true }), 1470);
assert.equal(feeCents(50), 50, 'never more than the price');

// realized: test purchases are never money; a refund takes the price back and the processing stays lost; each sale counted once
const rows = [
  { resource: 'sale', sale_id: 'a', raw: ping({ sale_id: 'a', price: '4900' }) },
  { resource: 'sale', sale_id: 'a', raw: ping({ sale_id: 'a', price: '4900' }) },           // the API copy of the same sale
  { resource: 'sale', sale_id: 't', raw: ping({ sale_id: 't', price: '4900', test: 'true' }) },
  { resource: 'sale', sale_id: 'b', raw: ping({ sale_id: 'b', price: '1000' }) },
  { resource: 'refund', sale_id: 'b', raw: ping({ sale_id: 'b' }) },
];
const m = realized(rows);
assert.equal(m.sales, 2);
assert.equal(m.gross_cents, 5900);
assert.equal(m.realized_cents, 4900 - feeCents(4900) - (Math.round(1000 * 0.029) + 30));
assert.equal(realized([]).realized_cents, 0, 'no sales, no money');

// policy: Verse chose a stated cut inside its own bounds, with reasons
assert.ok(policy.owner_cut.share >= policy.owner_cut.min && policy.owner_cut.share <= policy.owner_cut.max);
for (const k of ['owner_cut', 'reserve', 'buckets']) assert.ok(policy[k].why.length > 80, k + ' has its reason');
assert.ok(policy.candidates.every((c) => BUCKETS.includes(c.bucket)), 'every candidate is in a bucket');

// weights: each between 10% and 50%, summing to 1
const w = bucketWeights(policy, { candidates: policy.candidates });
assert.ok(Math.abs(Object.values(w).reduce((n, x) => n + x, 0) - 1) < 1e-3);
for (const k of BUCKETS) assert.ok(w[k] >= 0.0999 && w[k] <= 0.5001, k + ' ' + w[k]);
const c = clampShares({ a: 100, b: 1, c: 1, d: 1 });
assert.equal(c.a, 0.5); assert.ok(c.b >= 0.1);

// split: every cent accounted for, the owner cut first and exact, the reserve at its share
for (const n of [1, 99, 4900, 123457]) {
  const s = split(n, policy, { weights: w });
  assert.equal(s.reduce((t, r) => t + r.cents, 0), n, 'every cent of ' + n);
  assert.equal((s.find((r) => r.bucket === 'owner') || { cents: 0 }).cents, Math.floor(n * policy.owner_cut.share));
}
// giving: a tenth of what is left after Atom's cut, taken after the cut (which stays exact) and before the reserve
{ const s = split(10000, policy, { weights: w }), g = s.find((r) => r.bucket === 'giving');
  assert.equal(policy.giving.share, 0.1); assert.equal(g.cents, Math.floor((10000 - Math.floor(10000 * policy.owner_cut.share)) * 0.1));
  assert.ok(s.findIndex((r) => r.bucket === 'giving') < s.findIndex((r) => r.bucket === 'reserve'), 'giving before the reserve');
  assert.equal(split(10000, { ...policy, giving: undefined }, { weights: w }).find((r) => r.bucket === 'giving'), undefined, 'no pledge, no pot');
  const b = balances([{ kind: 'alloc', bucket: 'giving', cents: 700 }, { kind: 'given', bucket: 'giving', cents: 500 }]);
  assert.equal(b.pots.giving, 200, 'a recorded gift leaves the giving pot'); }
const full = split(10000, policy, { weights: w, pots: { reserve: policy.reserve.target_cents } });
assert.ok(full.find((r) => r.bucket === 'reserve').cents < split(10000, policy, { weights: w }).find((r) => r.bucket === 'reserve').cents, 'a full reserve takes less');
// a refund comes out of the reserve first and never takes a pot below zero
const back = split(-500, policy, { pots: { owner: 900, reserve: 300, infrastructure: 400, tools: 100, growth: 0, bounties: 0 } });
assert.deepEqual(back.map((r) => [r.bucket, r.cents]), [['reserve', -300], ['infrastructure', -200]]);

// spends: only what a bucket can afford, free path first, each logged ready to execute with what it needs; never twice while open
const pots = { owner: 0, reserve: 0, infrastructure: 2000, tools: 0, growth: 0, bounties: 3000 };
const q = queueSpends(pots, policy.candidates, { credentials: policy.spending.credentials });
assert.ok(q.length >= 1 && q.every((s) => s.status === 'ready to execute' && s.needs));
for (const k of BUCKETS) assert.ok(q.filter((s) => s.bucket === k).reduce((n, s) => n + s.cents, 0) <= pots[k], k + ' never overspent');
assert.ok(!q.some((s) => s.id === 'workers-paid' && s.cents > 2000));
assert.equal(queueSpends(pots, policy.candidates, { queued: q.map((s) => s.id) }).filter((s) => q.some((x) => x.id === s.id)).length, 0);
assert.deepEqual(queueSpends({ infrastructure: 0, tools: 0, growth: 0, bounties: 0 }, policy.candidates), [], 'no money, no spend');

// review: nothing measured teaches nothing; a bucket that returned twice what it expected gains; moves sum to zero
const r0 = review(policy, { pots, candidates: policy.candidates });
assert.deepEqual(r0.learned, {});
assert.match(r0.reason, /nothing was learned/);
assert.equal(r0.moves.reduce((n, x) => n + x.cents, 0), 0);
const r1 = review(policy, { pots, candidates: policy.candidates, spends: [{ bucket: 'growth', return_score: 2 }] });
assert.ok(r1.learned.growth > 1 && r1.weights.growth >= r0.weights.growth);

// the cut's own rule: no money, no change; covered three times over with a full reserve, a step up
assert.equal(reviseCut(policy, {}), null);
const up = reviseCut(policy, { realized30: 10000, running30: 1000, reserve: policy.reserve.target_cents });
assert.equal(up.share, +(policy.owner_cut.share + policy.owner_cut.step).toFixed(2));
assert.ok(up.reason);

// the API on SQLite standing in for D1
function fakeEnv(extra = {}) {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  const DB = { raw: db, prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
  const ASSETS = { fetch: async (u) => new Response(JSON.stringify(policy), { headers: { 'content-type': 'application/json' } }) };
  return { DB, ASSETS, READ_TOKEN: 'owner-secret', ...extra };
}
const env = fakeEnv();
let res = await onRequestGet({ request: new Request('https://a-to-mind.com/api/treasury'), env });
let t = await res.json();
assert.equal(res.status, 200);
assert.equal(t.balance_cents, 0, 'zero sales: a zero balance, nothing invented');
assert.equal(t.entries.length, 0);
assert.match(t.source.gumroad_api, /off/);
// a real sale arrives (as the ping records it): split on the next read, once
await env.DB.prepare('INSERT INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES (?, ?, ?, NULL, ?, NULL, 1, ?, ?, ?)')
  .bind('sale:s1:x', 'sale', 's1', 'verse', 'recorded', ping({ sale_id: 's1', price: '4900', email: 'buyer@example.com' }), '2026-11-04').run();
t = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/treasury'), env })).json();
const real = 4900 - feeCents(4900);
assert.equal(t.revenue.realized_cents, real);
assert.equal(t.split_cents, real, 'all of it split');
assert.equal(t.pots.owner, Math.floor(real * policy.owner_cut.share), "Atom's cut first");
assert.ok(!JSON.stringify(t).includes('buyer@example.com') && !JSON.stringify(t).includes('"s1"'), 'nothing about the buyer or the sale id is public');
const again = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/treasury'), env })).json();
assert.equal(again.entries.filter((e) => e.kind === 'alloc').length, t.entries.filter((e) => e.kind === 'alloc').length, 'a second read splits nothing twice');
// owner-only writes
assert.equal((await onRequestPost({ request: new Request('https://a-to-mind.com/api/treasury', { method: 'POST', body: '{"action":"review"}' }), env })).status, 401);
const own = (body) => onRequestPost({ request: new Request('https://a-to-mind.com/api/treasury', { method: 'POST', headers: { authorization: 'Bearer owner-secret' }, body: JSON.stringify(body) }), env });
const rv = await (await own({ action: 'review' })).json();
assert.ok(rv.ok && rv.reason);
assert.equal((await (await own({ action: 'reconcile' })).json()).ok, false, 'no Gumroad token: says so, reads nothing');
assert.equal((await own({ action: 'paid', cents: 100 })).status, 200);
t = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/treasury'), env })).json();
assert.equal(t.pots.owner, Math.floor(real * policy.owner_cut.share) - 100);
assert.equal(t.reviews.length, 1);
// reconcile with a token reads Gumroad's sales into the same table, deduplicated
const env2 = fakeEnv({ GUMROAD_ACCESS_TOKEN: 'tok' });
await onRequestGet({ request: new Request('https://a-to-mind.com/api/treasury'), env: env2 });
const { reconcile } = await import('../void-live-deploy/functions/api/treasury.js');
const fakeGumroad = async () => new Response(JSON.stringify({ success: true, sales: [{ id: 'g1', price: 4900 }, { id: 'g2', price: 1000, refunded: true }, { id: 'g3', price: 4900, test: true }] }));
assert.deepEqual(await reconcile(env2, fakeGumroad), { ok: true, added: 4 });
assert.deepEqual(await reconcile(env2, fakeGumroad), { ok: true, added: 0 }, 'a second read adds nothing');
t = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/treasury'), env: env2 })).json();
assert.equal(t.revenue.sales, 2, 'the test purchase is not money');
assert.equal(t.revenue.realized_cents, real - (Math.round(1000 * 0.029) + 30));

// found money: only numbers a source states; walls and farms out
assert.deepEqual(money('$<span data-currency-value>1,000,000</span>'), { cents: 100000000, currency: 'USD' });
assert.equal(money('no amount'), null);
const hk = hackathonFinds([{ id: 1, title: 'A', open_state: 'open', invite_only: false, displayed_location: { location: 'Online' }, themes: [{ name: 'Web' }], prize_amount: '$<span>5,000</span>', url: 'https://a.devpost.com/' },
  { id: 2, title: 'B', open_state: 'open', invite_only: true, displayed_location: { location: 'Online' }, themes: [{ name: 'Web' }], prize_amount: '$1', url: 'https://b' },
  { id: 3, title: 'C', open_state: 'open', invite_only: false, displayed_location: { location: 'Paris' }, themes: [{ name: 'Web' }], prize_amount: '$1', url: 'https://c' }], ['web']);
assert.equal(hk.length, 1); assert.equal(hk[0].value_cents, null, 'a prize pool is not an estimate of winnings'); assert.equal(hk[0].status, 'ready to claim');
const bf = bountyFinds([{ title: 'Fix x', html_url: 'https://github.com/o/r/issues/1', labels: [{ name: '💎 Bounty' }, { name: '$250' }], repository_url: 'https://api.github.com/repos/o/r' },
  { title: 'Done', html_url: 'https://github.com/o/r/issues/2', labels: [{ name: '💰 Rewarded' }, { name: '$900' }] }, { title: 'no amount', html_url: 'https://github.com/o/r/issues/3', labels: [] }]);
assert.deepEqual(bf.map((b) => b.value_cents), [25000]);
const sf = settlementFinds('<rss><item><title>$5M Google privacy class action settlement</title><link>https://topclassactions.com/x</link></item><item><title>Zumba settlement</title><link>https://y</link></item></rss>', ['Google']);
assert.equal(sf.length, 1); assert.equal(sf[0].value_cents, null);
const af = affiliateFinds([['a/index.html', '<a href="https://www.amazon.com/dp/1">x</a> https://amazon.com/b']], [{ domains: ['amazon.com'], program: 'Amazon Associates', url: 'https://affiliate-program.amazon.com/' }]);
assert.match(af[0].title, /2 times/);
const uf = upsellFinds([{ k: '/team/', n: 29 }, { k: '/store/', n: 5 }, { k: '/', n: 99 }], (p) => p === '/store/');
assert.deepEqual(uf.map((u) => u.id), ['upsell:/team/']);
console.log('treasury: ok');
// the weekly review runs once a week whoever asks (a read of a new week, or the owner), never twice
{
  const { weeklyReview, weekOf } = await import('../void-live-deploy/functions/api/treasury.js');
  assert.equal(weekOf('2026-11-04T12:00:00Z'), '2026-11-02'); assert.equal(weekOf('2026-11-08T23:00:00Z'), '2026-11-02'); assert.equal(weekOf('2026-11-09T00:00:00Z'), '2026-11-09');
  const e3 = fakeEnv(); const pend = [];
  await onRequestGet({ request: new Request('https://a-to-mind.com/api/treasury'), env: e3, waitUntil: (p) => pend.push(p) });
  await Promise.all(pend);
  assert.equal(e3.DB.raw.prepare("SELECT COUNT(*) n FROM void_treasury WHERE kind = 'review'").get().n, 1, 'the first read of the week reviews');
  const again2 = await weeklyReview(e3, policy);
  assert.match(again2.reason, /already ran/);
  assert.equal(e3.DB.raw.prepare("SELECT COUNT(*) n FROM void_treasury WHERE kind = 'review'").get().n, 1, 'once a week');
}
console.log('treasury weekly: ok');
