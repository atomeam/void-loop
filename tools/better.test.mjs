import test from 'node:test';
import assert from 'node:assert/strict';
import { askTime, asksOf, measure, parts, rowOf, withRow, compare, betterHtml, PARTS } from '../void-live-deploy/lib/better.js';
import { today, lines } from './better.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0); // 2026-10-16T12:00Z
const iso = (daysAgo) => new Date(NOW - daysAgo * 864e5).toISOString();

const MD = `# Verse's voice\n\n## Verse's current asks\n\n_Read from /api/reflect on 2026-10-15._\n\n- Implement the WebMCP origin trial. (daily, 2026-10-15) \`ask-20261015-2116-1\`\n- Create a probe-success-rate card. *(small)* (after a build, 2026-10-15) \`ask-20261015-2045-1\`\n- Not an ask line\n\n## Decisions on Verse's asks\n\n- \`ask-20261015-2116-1\` queued\n`;

test('ask ids carry their time; the asks section parses to id, words and small', () => {
  assert.equal(askTime('ask-20261015-2116-1'), Date.UTC(2026, 9, 15, 21, 16));
  assert.equal(askTime('nope'), null);
  assert.deepEqual(asksOf(MD), [
    { id: 'ask-20261015-2116-1', words: 'Implement the WebMCP origin trial.', small: false },
    { id: 'ask-20261015-2045-1', words: 'Create a probe-success-rate card.', small: true },
  ]);
  assert.deepEqual(asksOf(''), []);
});

const ledger = [
  { at: iso(1), kind: 'fix', what: 'the showcase rebuilt (owner, 2026-10-16)' },
  { at: iso(2), kind: 'grow', what: 'a probe-success-rate card', asked: 'ask-20261015-2045-1' },
  { at: iso(3), kind: 'fix', what: 'the timer matcher, from a probe: miss' },
  { at: iso(4), kind: 'grow', what: 'a book' },
  { at: iso(20), kind: 'grow', what: 'old, from the owner' },
  { at: 'bad', kind: 'grow', what: 'undated (owner)' },
];
const families = { families: [{ name: 'A', skills: [{ name: 'x', tier: 'proven' }, { name: 'y', tier: 'tested' }, { name: 'z', tier: 'checked', failing: ['an ask'] }, { name: 'w', tier: 'experiment' }] }] };

test('the facts: owner share, ask lag and open asks, friction, bench, probe fixes', () => {
  const f = measure({ ledger, families, asks: asksOf(MD), decisions: {}, bench: { score: 95, total: 100 }, now: NOW });
  assert.equal(f.week, 4); assert.equal(f.owner, 1); assert.equal(f.probeFixes, 1);
  assert.equal(f.askedBuilt, 1); assert.equal(f.medianLagDays, 0); // built (10-14 12:00) before the ask's id time (10-15 20:45): the lag floors at 0
  assert.equal(f.open, 1); assert.ok(f.oldestOpenDays > 0.5 && f.oldestOpenDays < 1);
  assert.equal(f.skills, 4); assert.equal(f.failing, 1); assert.equal(f.unsure, 2);
  assert.equal(f.benchScore, 95); assert.equal(f.benchTotal, 100);
});

test('a built ask is not open; a decision marked built closes it too', () => {
  const asks = asksOf(MD);
  const a = measure({ ledger: [{ at: iso(0.1), kind: 'grow', what: 'x', asked: 'ask-20261015-2116-1' }], asks, now: NOW });
  assert.equal(a.open, 1); assert.equal(a.askedBuilt, 1); assert.equal(a.medianLagDays, 0.5);
  const b = measure({ ledger: [], asks, decisions: { decisions: { 'ask-20261015-2116-1': { decision: 'built' }, 'ask-20261015-2045-1': { decision: 'built' } } }, now: NOW });
  assert.equal(b.open, 0); assert.equal(b.oldestOpenDays, 0);
});

test('parts are 0 to 100 each, null without evidence; the score is their mean', () => {
  const p = parts({ week: 10, owner: 2, askedBuilt: 2, medianLagDays: 2, open: 1, oldestOpenDays: 5, skills: 10, failing: 1, unsure: 2, benchScore: 90, benchTotal: 100, probeFixes: 3 });
  assert.deepEqual([p.self, p.asks, p.friction, p.bench, p.probes], [80, 30, 80, 90, 30]);
  assert.equal(p.score, 62);
  const none = parts({ week: 0, owner: 0, askedBuilt: 0, medianLagDays: null, open: 0, oldestOpenDays: 0, skills: 0, failing: 0, unsure: 0, benchScore: null, benchTotal: null, probeFixes: 0 });
  assert.deepEqual(PARTS.map((k) => none[k]), [null, null, null, null, null]); assert.equal(none.score, null);
  const worst = parts({ week: 5, owner: 5, askedBuilt: 1, medianLagDays: 30, open: 3, oldestOpenDays: 30, skills: 2, failing: 2, unsure: 0, benchScore: 0, benchTotal: 10, probeFixes: 0 });
  assert.deepEqual(PARTS.map((k) => worst[k]), [0, 0, 0, 0, 0]);
});

test('one row a day, newest replaces the same day, KEEP at most; the trend reads yesterday and a week back', () => {
  const mk = (daysAgo, score) => ({ at: iso(daysAgo), score, parts: { self: score, asks: score - 10, friction: 50, bench: 90, probes: 20 }, facts: { failing: 2, unsure: 3 } });
  let rows = [];
  for (const [d, s] of [[8, 60], [7, 62], [1, 70], [0.5, 71]]) rows = withRow(rows, mk(d, s));
  assert.deepEqual(rows.map((r) => r.score), [60, 62, 70, 71]);
  rows = withRow(rows, { ...mk(0.4, 75), facts: { failing: 1, unsure: 2 } }); // the same day: replaced
  assert.deepEqual(rows.map((r) => r.score), [60, 62, 70, 75]);
  const c = compare(rows);
  assert.equal(c.score, 75); assert.equal(c.day, 5); assert.equal(c.week, 13); assert.equal(c.weakest, 'probes'); assert.equal(c.frictionWeek, 2);
  assert.equal(compare([]), null);
  assert.deepEqual(compare([mk(0, 50)]), { score: 50, day: null, week: null, weakest: 'probes', at: iso(0), frictionWeek: null });
  let many = []; for (let i = 500; i >= 0; i--) many = withRow(many, mk(i, 50)); assert.equal(many.length, 400);
});

test('the growth card line: the score, the trend, the facts and the weakest part, every value escaped', () => {
  assert.equal(betterHtml(esc, []), '');
  const facts = measure({ ledger, families, asks: asksOf(MD), bench: { score: 95, total: 100 }, now: NOW });
  const rows = withRow([rowOf({ ...facts, failing: 3 }, iso(8))], rowOf(facts, iso(0)));
  const h = betterHtml(esc, rows);
  assert.match(h, /data-better="\d+"/); assert.match(h, /data-better-trend="(up|down|flat)"/); assert.match(h, /data-weakest="(self|asks|friction|bench|probes)"/);
  assert.match(h, /on the week/); assert.match(h, /I drove 75% of this week's 4 changes myself/); assert.match(h, /1 skill failing and 2 barely checked of 4, 2 fewer than a week ago/);
  assert.match(h, /the bench answers 95%/); assert.match(h, /1 fix this week came from my own probes/); assert.match(h, /Weakest: /);
  const first = betterHtml(esc, [rowOf(facts, iso(0))]);
  assert.match(first, /first measure/); assert.match(first, /data-better-trend="first"/);
  const bad = betterHtml(esc, [{ at: iso(0), score: '<script>', parts: { self: 1 }, facts: { week: 1, owner: 0, probeFixes: 0, skills: 0 } }]);
  assert.equal(bad, ''); // a row without a number is no row
  const odd = betterHtml(esc, [{ at: iso(0), score: 7, parts: { self: 7 }, facts: { week: '<b>', owner: 0, probeFixes: 0, skills: 0 } }]);
  assert.doesNotMatch(odd, /<b>'s/); assert.match(odd, /&lt;b&gt;/);
});

test('the tool measures the real repo: every part present, a row shaped for the file, lines that read', () => {
  const t = today();
  for (const k of PARTS) assert.ok(t.row.parts[k] === null || (t.row.parts[k] >= 0 && t.row.parts[k] <= 100), k);
  assert.ok(t.row.score >= 0 && t.row.score <= 100);
  assert.ok(t.rows.length >= 1 && t.rows[t.rows.length - 1] === t.row);
  const out = lines(t);
  assert.equal(out.length, 6); assert.match(out[0], /^better: \d+ of 100/);
  assert.ok(!JSON.stringify(t.row).includes('"what"'), 'a row carries counts, never ledger text');
});

import { interval } from '../void-live-deploy/lib/better.js';
test('the score has an interval: wide on one lucky run, narrow on a thousand checks, and always around the score', () => {
  const small = { week: 3, owner: 0, askedBuilt: 1, medianLagDays: 0, open: 0, oldestOpenDays: 0, skills: 3, failing: 0, unsure: 0, benchScore: 5, benchTotal: 5, probeFixes: 1 };
  const big = { ...small, week: 450, owner: 0, skills: 160, benchScore: 2400, benchTotal: 2400 };
  const a = interval(small), b = interval(big), s = parts(small).score;
  assert.ok(a.lo <= s && s <= a.hi && b.lo <= parts(big).score && parts(big).score <= b.hi);
  assert.ok(a.hi - a.lo > b.hi - b.lo, 'a few checks leave a wider range than hundreds: ' + JSON.stringify([a, b]));
  assert.equal(b.n, 450 + 160 + 2400); assert.equal(interval({ week: 0, skills: 0, benchTotal: 0 }), null);
  const html = betterHtml((x) => String(x), [{ at: '2026-10-16T00:00:00Z', ...rowOf(big), score: parts(big).score }]);
  assert.match(html, /Sure to within \d+–\d+, from 3010 checks\./);
});
