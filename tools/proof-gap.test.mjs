// What a checked or tested skill lacks to be proven (lib/proof-gap.js, asked by Verse: "Provide a list of the 17 checked and 6 tested skills
// that can be promoted to proven status"), the families.json `needs` field and the family-health card that lists them.
// Run: node --test tools/proof-gap.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProven, waysToProven, needsWords, evidenceOfWhy, promotable } from '../void-live-deploy/lib/proof-gap.js';
import { ratingOf, build } from './families.mjs';
import fh, { asksPromote, promoteHtml } from '../void-live-deploy/skills/family-health.js';

const today = '2026-11-06';
test('proof-gap: the proven rule is the one tools/families.mjs rates with, on every mix of evidence', () => {
  for (const suite of [false, true]) for (const browser of [0, 1, 3]) for (const bench of [0, 1, 2, 3, 5]) for (const live of [0, 1]) for (const liveAt of ['2026-11-05', '2026-10-01']) {
    const ev = { suite, browser, bench, live, liveAt };
    const fresh = live > 0 && liveAt === '2026-11-05';
    assert.equal(isProven({ ...ev, liveFresh: fresh }), ratingOf(ev, today).tier === 'proven', JSON.stringify(ev));
  }
});

test('proof-gap: every way it names makes the skill proven, and nothing smaller would', () => {
  for (const ev of [{ suite: true }, { suite: true, bench: 2 }, { suite: true, browser: 2 }, { bench: 3 }, { browser: 2 }, {}, { bench: 1 }]) {
    const ways = waysToProven(ev);
    assert.ok(ways.length >= 1 && ways.length <= 3, JSON.stringify(ev));
    for (const w of ways) assert.ok(isProven({ suite: ev.suite || w.add.suite, browser: (ev.browser || 0) + w.add.browser, bench: (ev.bench || 0) + w.add.bench }), JSON.stringify([ev, w]));
    assert.ok(ways.every((w, i) => !i || ways[i - 1].cost <= w.cost), 'cheapest first');
  }
  assert.deepEqual(waysToProven({ suite: true, browser: 1, bench: 1 }), [], 'a proven skill lacks nothing');
  assert.equal(needsWords({ suite: true, bench: 2 }), '1 more real ask in the benchmark that routes to it, or a browser-suite check named after it');
  assert.equal(needsWords({ suite: true, browser: 2 }), 'a real ask in the benchmark that routes to it');
  assert.equal(needsWords({ suite: true }), 'a browser-suite check named after it and a real ask in the benchmark that routes to it, or 3 real asks in the benchmark that route to it');
  assert.match(needsWords({ bench: 2, smoke: ['near miss taken'] }), /its self-test passing again/);
  assert.deepEqual(evidenceOfWhy('a self-test, 2 browser-suite mentions, 1 real ask in the benchmark'), { suite: true, browser: 2, bench: 1, live: 0 });
});

test('proof-gap: families.json carries `needs` for each skill short of proven, and none for a proven one', () => {
  const b = build(['vat', 'calc'], { vat: { suite: true, browser: 0, bench: 2 }, calc: { suite: true, browser: 2, bench: 9 } }, { today });
  const rows = b.families.flatMap((f) => f.skills);
  assert.equal(rows.find((s) => s.name === 'vat').needs, '1 more real ask in the benchmark that routes to it, or a browser-suite check named after it');
  assert.equal(rows.find((s) => s.name === 'calc').needs, undefined);
});

test('proof-gap: the list is every checked and tested skill, weakest family first, checked before tested', () => {
  const fam = { families: [
    { id: 'a', name: 'Strong', skills: [{ name: 'p', tier: 'proven' }, { name: 'q', tier: 'proven' }, { name: 't', tier: 'tested', why: 'a self-test' }] },
    { id: 'b', name: 'Weak', skills: [{ name: 'z', tier: 'tested', why: 'a self-test' }, { name: 'c', tier: 'checked', why: 'a self-test, 2 real asks in the benchmark', needs: 'one more ask' }, { name: 'p2', tier: 'proven' }] },
    { id: 'c', name: 'Done', skills: [{ name: 'x', tier: 'proven' }] },
  ] };
  const P = promotable(fam);
  assert.deepEqual(P.families.map((f) => f.id), ['b', 'a']);
  assert.deepEqual(P.families[0].skills.map((s) => [s.name, s.needs]), [['c', 'one more ask'], ['z', needsWords({ suite: true })]]);
  assert.equal(P.checked, 1); assert.equal(P.tested, 2);
});

test('proof-gap: the family-health skill takes the ask word for word, and its card escapes what it shows', () => {
  for (const a of ['Provide a list of the 17 checked and 6 tested skills that can be promoted to proven status', 'Provide a list of the 16 checked and 5 tested skills that can be promoted to proven status',
    'which skills can be promoted to proven', 'list the checked and tested skills', 'what do your skills need to be proven', 'promotable skills']) assert.ok(asksPromote(a) && fh.match(a.toLowerCase(), a), a);
  for (const a of ['promote my post', 'tested skills for a resume', 'proven ways to learn new skills', 'family tree']) assert.ok(!fh.match(a.toLowerCase(), a), a);
  const P = promotable({ families: [{ id: 'n', name: 'Numbers <b>', skills: [{ name: 'vat', tier: 'tested', why: 'a self-test' }, { name: 'calc', tier: 'proven' }] }] });
  const h = promoteHtml((s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]), P);
  assert.ok(h.includes('Numbers &lt;b&gt;') && h.includes('1 of 2 proven') && h.includes('data-skill="vat" data-tier="tested"') && h.includes('needs a browser-suite check'));
  assert.ok(h.includes('0 checked and 1 tested skills'));
});
