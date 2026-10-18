import assert from 'node:assert/strict';
import { allocate, learn, readVoice, readWishlist, withWishlist, toApproval, payoff, score, RESERVE } from '../void-live-deploy/lib/reinvest.js';
import { confirmLine, isGated } from '../void-live-deploy/lib/approval-core.js';
import { voiceAnswer, planMd } from './reinvest.mjs';

const C = [
  { id: 'cheap', item: 'cheap', kind: 'revenue', cost_cents: 1000, impact: 0.8, confidence: 1, account: 'cloudflare' },
  { id: 'dear', item: 'dear', kind: 'quality', cost_cents: 5000, impact: 0.8, confidence: 1 },
  { id: 'free', item: 'free one', kind: 'revenue', cost_cents: 0, impact: 0.1, confidence: 1 },
  { id: 'pathfirst', item: 'paid', kind: 'speed', cost_cents: 100, impact: 1, confidence: 1, free_path: 'do the free thing', free_done: false },
  { id: 'urgent', item: 'urgent', kind: 'speed', cost_cents: 500, monthly: true, impact: 0.5, confidence: 1, free_path: 'x', urgent: true },
];
// reserve kept: at least 20% of income, never spent, whatever the candidates
for (const inc of [0, 1, 999, 10000, 123457]) {
  const a = allocate(inc, C);
  assert.ok(a.reserve_cents >= Math.ceil(inc * RESERVE), 'reserve kept on ' + inc);
  const spent = a.funded.reduce((n, f) => n + f.cost_cents, 0) + (a.saving ? a.saving.have_cents : 0) + a.held_cents;
  assert.equal(spent + a.reserve_cents, inc, 'every cent accounted for on ' + inc);
}
assert.equal(allocate(10000, C, { reserve: 0.05 }).reserve_cents, 2000, 'a lower asked reserve never goes below the 20% floor');
assert.equal(allocate(10000, C, { reserve: 0.4 }).reserve_cents, 4000, "Verse's higher reserve is kept");
// free first: free items and unused free paths come before anything paid; a paid item waits for its free path unless urgent
const a = allocate(10000, C, { owned: ['cloudflare'] });
assert.deepEqual(a.free.map((f) => f.id), ['free', 'pathfirst', 'urgent'], 'free items and every unused free path (even an urgent one), $0');
assert.ok(!a.funded.some((f) => f.id === 'pathfirst'), 'not bought while its free path is unused');
assert.ok(a.funded.some((f) => f.id === 'urgent' && f.cost_cents === 1500), 'urgent monthly item funded 3 months ahead');
// ROI ranking: per dollar, so the cheap item beats the dear one at the same impact
assert.ok(score(C[0]) > score(C[1]));
assert.deepEqual(a.funded.map((f) => f.id), ['cheap', 'urgent', 'dear'], 'best return per dollar first');
assert.equal(a.funded.find((f) => f.id === 'cheap').status, 'ready', 'bought through an account Adam already has: ready');
assert.equal(a.funded.find((f) => f.id === 'dear').status, 'queued', 'no account: queued for Adam');
const small = allocate(2500, C);
assert.ok(small.saving && small.saving.id === 'cheap' || small.funded.length, 'saves toward the best item that does not fit');
assert.equal(allocate(1000, C).saving.id, 'cheap'); assert.equal(allocate(1000, C).saving.have_cents, 800);
// learning: a spend that worked lifts its kind, one that did not lowers it, and the ranking follows
const up = learn({}, { kind: 'quality', before: 10, after: 30 }), down = learn({}, { kind: 'revenue', before: 10, after: 2 });
assert.ok(up.quality > 1 && down.revenue < 1);
assert.deepEqual(learn({ revenue: 1 }, { kind: 'revenue', before: 0, after: 5 }), { revenue: 1 }, 'no baseline: no update');
let L = {};
for (let i = 0; i < 3; i++) { L = learn(L, { kind: 'quality', before: 10, after: 30 }); L = learn(L, { kind: 'revenue', before: 10, after: 2 }); }
const roi = (r, id) => r.ranked.find((x) => x.id === id).roi;
const r0 = allocate(6000, C), r1 = allocate(6000, C, { learned: L });
assert.ok(roi(r0, 'cheap') > roi(r0, 'dear') && roi(r1, 'dear') > roi(r1, 'cheap'), 'measured outcomes re-rank: quality spending worked, revenue spending did not');
// Verse's voice
const v = readVoice('1. **Build a tiny emergency buffer** – Put $20 aside.\n\n2. **Buy fractional shares or a diversified ETF** – $50.\n\n3. **Invest in yourself** – Spend $15 on a course.\n\n4. **Test a micro-business idea** – Reserve $15 for a product test.');
assert.equal(v.reserve, 0.2); assert.equal(v.unmapped.length, 1); assert.ok(v.voice.reserve > v.voice.speed && v.voice.quality > v.voice.speed);
assert.equal(voiceAnswer('<!-- ask-void:x -->\n**Asked:** If you earned your first $100, how would you reinvest it?\n\n> keep $20\n> more'), 'keep $20\nmore');
// wishlist and public totals
const w = readWishlist('| # | Item | Free | Paid | Value | Why | From |\n| --- |\n| 6 | Workers Paid | a | b | high: lifts caps | c | d |');
assert.deepEqual(w, [{ rank: 6, item: 'Workers Paid', value: 'high' }]);
assert.equal(withWishlist([{ id: 'w', item: 'Workers Paid', wishlist: 6, impact: 0.1 }], w)[0].impact, 0.9);
// spend proposals go to the confirm line with cost, expected payback, check date and the payoff test's baseline
const ap = toApproval({ id: 'cheap', item: 'Workers Paid', cost_cents: 1500, expected: 'no capped answers', why: 'w', metric: 'misses', status: 'ready', account: 'cloudflare' }, { baseline: 12, now: Date.parse('2026-10-15T00:00:00Z') });
assert.ok(isGated(ap.toolName)); assert.equal(ap.args.cost.amount, 15); assert.equal(ap.args.by, '2026-11-14'); assert.deepEqual(ap.args.test, { metric: 'misses', baseline: 12, check_by: '2026-11-14' });
assert.equal(confirmLine(ap.toolName, ap.args), 'Buy Workers Paid for $15? Expected payback: no capped answers, checked by 2026-11-14.');
assert.equal(confirmLine('order.place', { item: 'x', cost: { amount: 3, currency: 'USD' } }), 'Buy x for $3?', 'other orders read as before');
// honest payoff test: only after the check date, only against the recorded baseline; misses count a fall as success
assert.equal(payoff(ap.args.test, 4, '2026-11-01'), null, 'not due yet: nothing learned');
assert.equal(payoff({ metric: 'sales', check_by: '2026-11-14' }, 9, '2026-11-20'), null, 'no baseline: nothing learned');
assert.equal(payoff(ap.args.test, null, '2026-11-20'), null, 'unmeasured: nothing learned');
const pm = payoff(ap.args.test, 4, '2026-11-20'); assert.ok(learn({}, { kind: 'speed', ...pm }).speed > 1, 'misses fell: that kind rises');
const ps = payoff({ metric: 'sales', baseline: 10, check_by: '2026-11-14' }, 5, '2026-11-14'); assert.ok(learn({}, { kind: 'revenue', ...ps }).revenue < 1, 'sales fell: that kind drops');
assert.match(planMd({ at: '2026-10-15T00:00:00Z', learned: { revenue: 1 }, first_100: a }, { weight: 0.3, shares: {}, reserve: 0.2, unmapped: [] }), /first \$100/);
console.log('reinvest: ok (reserve kept, free first, ROI ranking, learning update, voice, wishlist, confirm line, payoff test)');
