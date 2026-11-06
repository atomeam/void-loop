// The owner's private life-arbitrage scan (void-live-deploy/lib/life-arb.js, functions/api/life-arb.js): every value is one a source
// states, a source that fails invents nothing, the ranking puts deadlines first and then cash per hour, Verse's own jobs are queued a
// few at a time and never twice, and nobody without the owner key reads an opportunity.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { money, devpostDeadline, textDeadline, gpDate, giveawayOpps, hackathonOpps, settlementOpps, foundOpps, dedupe, rank, verseJobs, scan, opp } from '../void-live-deploy/lib/life-arb.js';
import { onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/life-arb.js';

const NOW = Date.parse('2026-11-06T05:00:00Z');

// parsers
assert.deepEqual(money('$19.99'), { cents: 1999, currency: 'USD' });
assert.deepEqual(money('$<span>2.5</span>k'), { cents: 250000, currency: 'USD' });
assert.equal(money('N/A'), null);
assert.equal(devpostDeadline('Oct 01 - Nov 12, 2026'), '2026-11-12T23:59:00.000Z');
assert.equal(devpostDeadline('Nov 02 - 15, 2026'), '2026-11-15T23:59:00.000Z');
assert.equal(devpostDeadline('soon'), null);
assert.equal(textDeadline('<p>The claim form deadline is Dec. 15, 2026.</p>'), '2026-12-15T23:59:00.000Z');
assert.equal(textDeadline('Claim Form Deadline: 01/09/2027'), '2027-01-09T23:59:00.000Z');
assert.equal(textDeadline('no date here'), null);
assert.equal(gpDate('2026-11-13 23:59:00'), '2026-11-13T23:59:00.000Z');
assert.equal(gpDate('N/A'), null);

// giveaways: only active games and DLC, the stated worth as retail value (not cash), an ended one dropped
const gp = [
  { title: 'Space Game', worth: '$24.99', type: 'Game', platforms: 'PC, Epic Games Store', end_date: '2026-11-13 15:00:00', status: 'Active', open_giveaway_url: 'https://www.gamerpower.com/open/space-game' },
  { title: 'Old Game', worth: '$9.99', type: 'Game', platforms: 'PC, Steam', end_date: '2026-11-01 00:00:00', status: 'Active', open_giveaway_url: 'https://www.gamerpower.com/open/old' },
  { title: 'Beta key', worth: 'N/A', type: 'Other', platforms: 'PC', end_date: 'N/A', status: 'Active', open_giveaway_url: 'https://www.gamerpower.com/open/beta' },
  { title: 'Skin pack', worth: 'N/A', type: 'DLC', platforms: 'PC', end_date: 'N/A', status: 'Active', open_giveaway_url: 'https://www.gamerpower.com/open/skin' },
];
const g = giveawayOpps(gp, { now: NOW });
assert.deepEqual(g.map((o) => o.title), ['Space Game (PC, Epic Games Store)', 'Skin pack (PC)']);
assert.equal(g[0].value_cents, 2499);
assert.equal(g[0].value_kind, 'retail value');
assert.equal(g[1].value_cents, null, 'no stated worth: no number');
assert.equal(g[1].value_kind, 'unknown');
assert.ok(g[0].minutes_estimated && g[0].minutes_basis);
assert.ok(g[0].asks.some((a) => /terms/.test(a)), 'accepting a store\'s terms is an ask, never done for him');

// hackathons: the pool is an upper bound, never a per-hour figure; online and open only; Verse drafts, Atom submits
const dp = [
  { id: 1, title: 'AI Jam', url: 'https://aijam.devpost.com/', open_state: 'open', invite_only: false, displayed_location: { location: 'Online' }, prize_amount: '$<span data-currency-value>50,000</span>', submission_period_dates: 'Oct 01 - Nov 12, 2026', time_left_to_submission: '6 days left', registrations_count: 4000 },
  { id: 2, title: 'In person', url: 'https://x.devpost.com/', open_state: 'open', invite_only: false, displayed_location: { location: 'Berlin' }, prize_amount: '$1,000', submission_period_dates: 'Oct 01 - Nov 30, 2026' },
];
const h = hackathonOpps(dp, { now: NOW });
assert.equal(h.length, 1);
assert.equal(h[0].value_cents, 5000000);
assert.equal(h[0].value_kind, 'prize pool (upper bound)');
assert.equal(h[0].per_hour_cents, null, 'a pool shared by winners is not a per-hour value');
assert.equal(h[0].deadline, '2026-11-12T23:59:00.000Z');
assert.equal(h[0].who, 'both');
assert.match(h[0].verse_job, /draft a hackathon entry/);

// settlements: the claim deadline the post states, the per-claim cap only when the post says it, the class warning always
const rss = `<rss><channel><item><title>Acme Data Breach $5M Class Action Settlement</title><link>https://topclassactions.com/acme/</link>
<content:encoded><![CDATA[<p>Class members can receive up to $100 in cash. The claim form deadline is Dec. 15, 2026.</p>]]></content:encoded></item>
<item><title>Closed One Settlement</title><link>https://topclassactions.com/closed/</link><description>Deadline: 10/01/2026</description></item></channel></rss>`;
const s = settlementOpps(rss, { now: NOW });
assert.equal(s.length, 1, 'a passed deadline is dropped');
assert.equal(s[0].value_cents, 10000);
assert.equal(s[0].value_kind, 'cash');
assert.equal(s[0].deadline, '2026-12-15T23:59:00.000Z');
assert.match(s[0].risk_why, /fraud/);
assert.equal(s[0].per_hour_cents, 60000, '$100 for an estimated 10 minutes');

// found money: claimable and Verse's own; a source not reached is never an opportunity
const found = { as_of: '2026-11-05T20:00:00Z', finds: [
  { category: 'startup credit programs', title: 'Cloud credits', source: 'https://cloud.example/credits', value_cents: 100000, value_note: 'up to $1,000 in credits', status: 'ready to claim', needs: 'Atom applies' },
  { category: 'hackathon prizes', title: 'AI Jam (Oct 01 - Nov 12, 2026, 6 days left)', source: 'https://aijam.devpost.com/', value_cents: null, prize_pool_cents: 5000000, status: 'ready to claim' },
  { category: 'missed upsells', title: 'People open /color/', source: 'https://a-to-mind.com/color/', status: 'Verse does it', next_step: 'Add the paid-Verse offer to the page.' },
  { category: 'duplicate or unused subscriptions', title: 'Nope', source: 'https://x.example', status: 'source not reached' },
] };
const f = foundOpps(found, { now: NOW });
assert.equal(f.length, 3);
assert.equal(f[0].value_kind, 'credits');
assert.equal(f.find((o) => o.kind === 'verse').who, 'verse');
assert.ok(!f.some((o) => o.title === 'Nope'));
assert.equal(dedupe([...f, ...h]).filter((o) => /aijam/.test(o.url)).length, 1, 'the same hackathon twice is kept once');
assert.equal(dedupe([...f, ...h]).find((o) => /aijam/.test(o.url)).source_id, 'devpost', 'the live copy wins');

// ranking: closing within 7 days first (soonest first), then cash before retail before credits before an upper bound, then per hour
const r = rank(dedupe([...g, ...h, ...s, ...f]), { now: NOW });
assert.equal(r[0].source_id, 'devpost', 'the hackathon closing Nov 12 is the only one inside 7 days');
assert.equal(r[0].urgent, true);
assert.equal(r[1].urgent, false, 'the giveaway ends Nov 13 15:00, more than 7 days out');
assert.equal(r[1].value_kind, 'cash', 'after the urgent ones, cash first');
assert.equal(r[2].value_kind, 'retail value', 'then the retail value of a free item');
assert.deepEqual(rank(g, { now: Date.parse('2026-11-10T00:00:00Z') }).map((o) => o.urgent), [true, false], 'four days later the giveaway is closing soon');
assert.ok(r.every((o, i) => o.rank === i + 1));
const a = opp({ source_id: 'x', kind: 'other', title: 'a', url: 'https://a', value_cents: 1000, value_kind: 'cash' });
const b = opp({ source_id: 'x', kind: 'other', title: 'b', url: 'https://b', value_cents: 5000, value_kind: 'cash' });
assert.deepEqual(rank([a, b], { now: NOW }).map((o) => o.title), ['b', 'a'], 'more cash for the same minutes ranks higher');

// Verse's jobs: only its own or shared ones, never one already queued, at most max
const jobs = verseJobs(r, { max: 5 });
assert.ok(jobs.length >= 2 && jobs.every((j) => j.target.startsWith('lifearb:') && j.ask.length <= 200));
assert.equal(verseJobs(r, { max: 5, have: new Set(jobs.map((j) => j.target)) }).length, 0);
assert.equal(verseJobs(r, { max: 1 }).length, 1);

// the whole scan: each source reports its own state; a failed source invents nothing
const fake = (map) => async (url) => { for (const [k, v] of Object.entries(map)) if (url.includes(k)) return v === 500 ? new Response('no', { status: 500 }) : new Response(typeof v === 'string' ? v : JSON.stringify(v)); return new Response('no', { status: 404 }); };
const assets = async () => new Response(JSON.stringify(found));
const sc = await scan({ fetchImpl: fake({ gamerpower: gp, devpost: { hackathons: dp }, topclassactions: 500 }), assets, now: NOW });
assert.equal(sc.sources.topclassactions.state, 'not reached (500)');
assert.equal(sc.sources.topclassactions.count, 0);
assert.equal(sc.sources.gamerpower.state, 'read');
assert.ok(!sc.opportunities.some((o) => o.source_id === 'topclassactions'));
assert.ok(sc.gaps.length >= 1);

// the route: owner only for anything that names an opportunity
function fakeEnv() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const x = db.prepare(sql).run(...a); return { meta: { changes: Number(x.changes) } }; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const x = db.prepare(sql).get(...a) || null; return col ? (x ? x[col] : null) : x; } });
  return { DB: { prepare: (sql) => stmt(sql), batch: async (l) => Promise.all(l.map((x) => x.run())) }, ASSETS: { fetch: assets }, READ_TOKEN: 'owner-secret', raw: db };
}
const realFetch = globalThis.fetch;
globalThis.fetch = fake({ gamerpower: gp, devpost: { hackathons: dp }, topclassactions: rss });
try {
  const env = fakeEnv();
  const owner = { authorization: 'Bearer owner-secret', 'content-type': 'application/json' };
  let res = await onRequestGet({ request: new Request('https://a-to-mind.com/api/life-arb'), env });
  assert.equal(res.status, 401, 'no key, no list');
  // a keyless scan (the scheduled workflow): runs, answers counts only
  res = await onRequestPost({ request: new Request('https://a-to-mind.com/api/life-arb', { method: 'POST', body: JSON.stringify({ action: 'scan' }) }), env });
  let j = await res.json();
  assert.equal(j.ran, true);
  assert.ok(j.count > 0);
  assert.equal(j.opportunities, undefined, 'a keyless scan never answers with an opportunity');
  assert.ok(!JSON.stringify(j).includes('Space Game'));
  // again right away: refused, nothing run
  j = await (await onRequestPost({ request: new Request('https://a-to-mind.com/api/life-arb', { method: 'POST', body: JSON.stringify({ action: 'scan' }) }), env })).json();
  assert.equal(j.ran, false);
  // Verse's queue got its jobs, at most three open at once
  const q = env.raw.prepare("SELECT target, state FROM void_queue WHERE target LIKE 'lifearb:%'").all();
  assert.ok(q.length >= 1 && q.length <= 3);
  // the owner reads the ranked list, marks one done
  j = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/life-arb', { headers: owner }), env })).json();
  assert.ok(j.opportunities.length > 0 && j.opportunities[0].rank === 1);
  const id = j.opportunities[0].id;
  res = await onRequestPost({ request: new Request('https://a-to-mind.com/api/life-arb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'mark', id, status: 'done' }) }), env });
  assert.equal(res.status, 401, 'only the owner marks');
  res = await onRequestPost({ request: new Request('https://a-to-mind.com/api/life-arb', { method: 'POST', headers: owner, body: JSON.stringify({ action: 'mark', id, status: 'done' }) }), env });
  assert.equal(res.status, 200);
  j = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/life-arb', { headers: owner }), env })).json();
  assert.equal(j.opportunities.find((o) => o.id === id).mark.status, 'done');
} finally { globalThis.fetch = realFetch; }

console.log('life-arb: all passed');
