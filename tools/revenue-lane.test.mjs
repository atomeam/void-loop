// The revenue lane (tools/revenue-lane.mjs): honest copy only, from the sourced playbook; winners kept, losers cut, a broken
// checkout undone at once. Run: node --test tools/revenue-lane.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { honestCopy, fill, without, judge, tally, lap, RULES } from './revenue-lane.mjs';
import { openPath } from '../void-live-deploy/lib/page-pass.js';
import { checkoutFor, SRC } from '../void-live-deploy/functions/api/buy.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const playbook = read('void-live-deploy/offers/playbook.json'), offers = read('void-live-deploy/offers/offers.json');
const monthly = { id: 'void-monthly', name: 'Verse Monthly', kind: 'membership', blurb: 'MultiVerse: every pro skill, films, code review, priority.', price: '$49 a month', cents: 4900, buy: 'https://x', trial: 'first week free' };
const board = { id: 'big-board', name: 'The Big Board', kind: 'membership', blurb: 'Real jobs that pay real money.', price: '$25 a month', cents: 2500, buy: 'https://x' };
const DAY = 864e5, t0 = Date.parse('2026-11-20T00:00:00Z');

test('every playbook pattern names a source and fills into honest copy', () => {
  for (const p of playbook.patterns) {
    assert.ok(p.sources.length && p.sources.every((u) => /^https:\/\//.test(u)), p.id);
    const v = fill(p, monthly, { free: true }); assert.ok(v || p.kinds, p.id); if (v) assert.equal(honestCopy(v.text, monthly), null, v.text);
  }
  assert.equal(fill(playbook.patterns.find((p) => p.id === 'honest-trial'), board), null, 'no trial claimed where checkout has none');
});
test('dark patterns and invented prices are refused', () => {
  for (const t of ['Only 3 left, $49 a month', 'Hurry: ends tonight', '1,200 people bought it', 'Rated 4.9 stars', 'Now $19 a month', 'Limited-time offer', 'Guaranteed results']) assert.ok(honestCopy(t, monthly), t);
  assert.equal(honestCopy('Verse Monthly adds code review, for $49 a month.', monthly), null);
});
test('a challenger has to beat the control on real counts; too few showings keeps the control', () => {
  const run = { exp: 'e1', started: new Date(t0).toISOString(), days: 7, variants: [{ v: 'a', pattern: 'p1' }, { v: 'b', pattern: 'p2' }] };
  const rows = [{ kind: 'seen', src: 's.e1.a', n: 50 }, { kind: 'click', src: 's.e1.a', n: 1 }, { kind: 'seen', src: 's.e1.b', n: 50 }, { kind: 'click', src: 's.e1.b', n: 6 }];
  assert.equal(judge(run, tally('s', run, rows), t0 + 3 * DAY).done, false, 'inside the window');
  assert.equal(judge(run, tally('s', run, rows), t0 + 8 * DAY).winner.v, 'b');
  const thin = judge(run, tally('s', run, rows.map((r) => ({ ...r, n: 2 }))), t0 + 8 * DAY); assert.equal(thin.done, false, 'waits for showings');
  const late = judge(run, tally('s', run, rows.map((r) => ({ ...r, n: 2 }))), t0 + (RULES.maxDays + 1) * DAY); assert.equal(late.winner.v, 'a');
});
test('a lap starts parallel experiments, scores the playbook, copies a winner and undoes a broken checkout', () => {
  const one = lap({ offers, playbook, catalog: [monthly, board], rows: [], broken: [], now: t0 });
  const running = Object.values(one.offers.slots).filter((s) => s.running);
  assert.ok(running.length >= 2, 'several experiments at once');
  for (const s of running) { assert.ok(s.running.variants.length >= 2); assert.equal(new Set(s.running.variants.map((v) => v.pattern)).size, s.running.variants.length); }
  const team = one.offers.slots.blub.running, rows = team.variants.flatMap((v, i) => [{ kind: 'seen', src: 'blub.' + team.exp + '.' + v.v, n: 60 }, { kind: 'click', src: 'blub.' + team.exp + '.' + v.v, n: i === 1 ? 9 : 1 }]);
  const two = lap({ offers: one.offers, playbook: one.playbook, catalog: [monthly, board], rows, broken: [], now: t0 + 8 * DAY });
  assert.equal(two.offers.slots.blub.champion.pattern, team.variants[1].pattern);
  assert.equal(two.playbook.patterns.find((p) => p.id === team.variants[1].pattern).results.wins, 1);
  assert.ok(two.offers.slots.blub.running, 'a new experiment starts with the champion as control');
  assert.equal(two.offers.slots.blub.running.variants[0].pattern, team.variants[1].pattern);
  const three = lap({ offers: two.offers, playbook: two.playbook, catalog: [monthly, board], rows: [], broken: ['void-monthly', 'big-board'], now: t0 + 9 * DAY });
  assert.ok(Object.values(three.offers.slots).every((s) => !s.running), 'every offer here sells void-monthly, which is down');
  assert.ok(three.changes.some((c) => /undid/.test(c)));
});
test('the click route only ever sends a buyer to the catalog\'s own checkout', () => {
  assert.match(checkoutFor('void-monthly', 'team.e1.a'), /^https:\/\/moonbeam846\.gumroad\.com\/l\/yinmj\?.*utm_content=team\.e1\.a$/);
  assert.match(checkoutFor('void-monthly', 'team.e1.a', true), /&wanted=true$/);
  for (const id of ['', 'nope', 'voidquest-minis', 'chess-set-glb']) assert.equal(checkoutFor(id, 'x'), null, id);
  assert.ok(!SRC.test('https://evil.example') && !SRC.test('a'.repeat(80)) && SRC.test('team.e261120tea.b'));
});

test('only pages anyone can open carry a card, and the gate is its own measured slot', () => {
  const o = JSON.parse(JSON.stringify(offers));
  for (const [slot, s] of Object.entries(o.slots)) if (s.kind !== 'gate') assert.equal(openPath(s.page), true, slot + ' sits on ' + s.page);
  assert.equal(o.slots.gate.kind, 'gate'); assert.deepEqual(o.slots.gate.products, ['universe']);
  o.slots.team = { page: '/team/', products: ['void-monthly'], running: null, champion: null };
  const out = lap({ offers: o, playbook, catalog: [monthly], rows: [], broken: [], now: t0 });
  assert.equal(out.offers.slots.team, undefined, 'a slot on a page behind the UniVerse gate is retired');
  assert.ok(out.changes.some((c) => /^team: retired/.test(c)) && out.offers.history.some((h) => h.slot === 'team' && /behind the UniVerse gate/.test(h.result)));
  assert.ok(out.offers.slots.gate && !out.offers.slots.gate.running, 'the gate slot is kept and starts no experiment');
});
test('the card says only what is true: "this page is free" only on a free page, and never that the plan adds what the page gives away', () => {
  const free = playbook.patterns.find((p) => p.id === 'free-core-paid-plus');
  assert.equal(fill(free, monthly, {}), null, 'no free claim on a page that is not marked free');
  const v = fill(free, monthly, { free: true, free_items: ['films'] });
  assert.match(v.text, /^This page is free\. Verse Monthly adds every pro skill, code review, priority, for \$49 a month\.$/);
  assert.equal(/films/i.test(v.text), false);
  assert.equal(without('every pro skill, films, code review, priority', ['films']), 'every pro skill, code review, priority');
  assert.equal(JSON.stringify(playbook).includes('Everything here is free'), false);
  for (const [slot, s] of Object.entries(offers.slots)) for (const x of (s.running && s.running.variants) || []) {
    assert.equal(/free/i.test(x.text) && !/week free|free week/i.test(x.text) && !s.free, false, slot + ' says free on a page that is not free: ' + x.text);
    for (const w of s.free_items || []) assert.equal(new RegExp('\\b' + w + '\\b', 'i').test(x.text), false, slot + ' mentions ' + w);
  }
});
