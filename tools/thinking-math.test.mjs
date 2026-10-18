// Four thinking-math stage skills (owner, 2026-10-18): eigenwork, homotopy-edit, plan-stability, anneal-ambition. Pure logic only.
// Run: node --test tools/thinking-math.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import eigen, { parseGoal, parseSteps, modeProgress, canFinish } from '../void-live-deploy/skills/eigenwork.js';
import homo, { isEditAsk, parseClaims, parsePaths, pathConnects, checkEdit } from '../void-live-deploy/skills/homotopy-edit.js';
import stab, { isStabilityAsk, parsePlan, stability, prng } from '../void-live-deploy/skills/plan-stability.js';
import anneal, { parseAnneal, phaseOf, canPropose, canDelete, daysSince } from '../void-live-deploy/skills/anneal-ambition.js';

import { escHtml, localDay } from '../void-live-deploy/lib/stage-pack.js';

const skills = [eigen, homo, stab, anneal];

test('shared stage-pack bits the four cards lean on', () => {
  assert.equal(escHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  assert.match(localDay(new Date(2026, 9, 5)), /^2026-10-05$/);
});

test('each skill takes its examples and none of the near misses (its own or the others)', () => {
  for (const s of skills) {
    for (const e of s.examples) assert.ok(s.match(e.toLowerCase(), e), s.name + ' takes ' + e);
    for (const o of skills) for (const n of o.nearMisses) assert.ok(!s.match(n.toLowerCase(), n), s.name + ' leaves "' + n + '"');
    for (const o of skills) if (o !== s) for (const e of o.examples) assert.ok(!s.match(e.toLowerCase(), e), s.name + ' leaves ' + e);
  }
});

test('eigenwork: goal parse, steps by mode, per-mode progress', () => {
  assert.equal(parseGoal('factor my goal launch a podcast'), 'launch a podcast');
  assert.equal(parseGoal('Factor my goal: learn spanish'), 'learn spanish');
  assert.equal(parseGoal('factor my goal'), '');
  assert.equal(parseGoal('factor 144 into primes'), null);
  const steps = parseSteps('research: read papers | 40\nresearch: interview two people | 20%\ncraft: draft | 0\nnonsense: skip | 50\nsocial: tell friends');
  assert.equal(steps.length, 4);
  const p = modeProgress(steps);
  assert.deepEqual(p, { research: 30, decision: 0, craft: 0, social: 0 });
});

test('eigenwork: done is refused until every required mode has non-zero progress', () => {
  const steps = parseSteps('research: a | 50\ndecision: b | 0\ncraft: c | 10');
  const all = ['research', 'decision', 'craft', 'social'];
  let c = canFinish(steps, all);
  assert.equal(c.ok, false);
  assert.deepEqual(c.missing, ['decision', 'social']);
  assert.equal(canFinish(steps, ['research', 'craft']).ok, true);
  assert.equal(canFinish(parseSteps('research: a | 50\ndecision: b | 5\ncraft: c | 10\nsocial: d | 1'), all).ok, true);
  assert.equal(canFinish(steps, []).ok, false, 'no required mode is not done');
  assert.equal(canFinish(steps, ['decision']).ok, false, 'a mode with steps at 0% has no progress');
});

test('homotopy-edit: asks it takes and leaves', () => {
  for (const a of ['check my edit', 'Check my edits', 'please check my argument edit']) assert.ok(isEditAsk(a), a);
  for (const a of ['check my spelling', 'edit my photo', 'check my edit history on github']) assert.ok(!isEditAsk(a), a);
});

test('homotopy-edit: a changed-premise claim with no path is a tear; a valid path joins it', () => {
  const oldV = '1: a\n2: b\n3: c\n4: so ship <- 1,2,3';
  const newV = '1: a\n2: b\n3: c\n4: so ship <- 3\n5: new claim <- 1';
  const r = checkEdit(oldV, newV, '');
  assert.deepEqual(r.tears.map((t) => t.id), [4]);
  assert.deepEqual(r.added, [5]);
  const good = checkEdit(oldV, newV, '4: 1,2,3 > 2,3 > 3');
  assert.equal(good.tears.length, 0);
  assert.equal(good.changes[0].path, 'path');
  const skip = checkEdit(oldV, newV, '4: 1,2,3 > 3'); // jumps two at once
  assert.equal(skip.tears.length, 1);
  assert.equal(skip.changes[0].path, 'bad path');
  const wrongEnd = checkEdit(oldV, newV, '4: 1,2,3 > 1,2 > 1');
  assert.equal(wrongEnd.tears.length, 1);
});

test('homotopy-edit: one premise moving is a single step, unchanged claims are quiet', () => {
  const r = checkEdit('1: a\n2: b <- 1', '1: a\n2: b <- 1,3\n3: c', '');
  assert.equal(r.changes.length, 1);
  assert.equal(r.tears.length, 0);
  assert.equal(r.changes[0].path, 'one step');
  assert.equal(checkEdit('1: a\n2: b <- 1', '1: a\n2: b <- 1', '').changes.length, 0);
  assert.deepEqual(parseClaims('3: so x <- 1, 2'), { 3: { text: 'so x', prem: [1, 2] } });
  assert.deepEqual(parsePaths('3: 1,2 > 1'), { 3: [[1, 2], [1]] });
  assert.equal(pathConnects([[1], [1, 2]], [1], [1, 2]), true);
  assert.equal(pathConnects([[1]], [1], [1]), false);
});

test('plan-stability: asks and plan parsing', () => {
  for (const a of ['is my plan stable', 'Is my plan stable?', 'is my plan brittle']) assert.ok(isStabilityAsk(a), a);
  for (const a of ['is my house stable', 'what is stable diffusion', 'is my plan to move worth it']) assert.ok(!isStabilityAsk(a), a);
  const p = parsePlan('start 100\n20 x1.1 +-5%\n0 x0.9; 5 x1.2 ±10%');
  assert.equal(p.start, 100);
  assert.deepEqual(p.steps, [{ input: 20, mult: 1.1, unc: 0.05 }, { input: 0, mult: 0.9, unc: 0 }, { input: 5, mult: 1.2, unc: 0.1 }]);
});

test('plan-stability: seeded, so the same plan always gives the same number; growth is brittle, contraction stable', () => {
  const a = prng(7), b = prng(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  const grow = parsePlan('start 100\n10 x1.5 +-5%\n10 x1.5 +-5%\n10 x1.5 +-5%\n10 x1.5 +-5%');
  const r1 = stability(grow), r2 = stability(grow);
  assert.deepEqual(r1, r2);
  assert.ok(r1.exponent > 0 && r1.state === 'brittle', JSON.stringify(r1));
  const shrink = parsePlan('start 100\n10 x0.5 +-5%\n10 x0.5 +-5%\n10 x0.5 +-5%\n10 x0.5 +-5%');
  const s = stability(shrink);
  assert.ok(s.exponent < 0 && s.state === 'stable', JSON.stringify(s));
  assert.equal(stability({ start: 1, steps: [] }).state, 'empty');
  assert.ok(stability(grow, 2).exponent > 0, 'a different seed agrees on the sign');
});

test('anneal-ambition: parse, phase by date, cooling refuses proposals until cut', () => {
  assert.deepEqual(parseAnneal('set my ambition temperature for the podcast'), { project: 'podcast', hotDays: 7, coolDays: 14, keep: 3 });
  assert.deepEqual(parseAnneal('set my ambition temperature for the book, hot 5 days, cool 10 days, keep 2'), { project: 'book', hotDays: 5, coolDays: 10, keep: 2 });
  for (const n of ['set my room temperature', 'what is simulated annealing', 'set my ambition']) assert.equal(parseAnneal(n), null, n);
  const th = { start: '2026-10-01', hotDays: 7, coolDays: 14, keep: 3, rate: 0.85, items: ['a', 'b', 'c', 'd'] };
  assert.equal(daysSince('2026-10-01', '2026-10-08'), 7);
  assert.equal(phaseOf(th, '2026-10-03').phase, 'hot');
  assert.equal(phaseOf(th, '2026-10-03').temp, 1);
  assert.equal(canPropose(th, '2026-10-03').ok, true, 'hot proposes freely');
  const c1 = phaseOf(th, '2026-10-08'), c2 = phaseOf(th, '2026-10-12');
  assert.equal(c1.phase, 'cooling');
  assert.ok(c2.temp < c1.temp && c1.temp < 1, 'the temperature falls each day');
  assert.equal(canPropose(th, '2026-10-12').ok, false, 'four items on a list kept to three: refused');
  th.items.length = 2;
  assert.equal(canPropose(th, '2026-10-12').ok, true);
  th.items.push('c');
  assert.equal(canPropose(th, '2026-10-12').ok, false, 'at the kept size: refused');
  assert.equal(phaseOf(th, '2026-10-22').phase, 'cold');
  assert.equal(canPropose(th, '2026-10-30').ok, false);
  assert.equal(canDelete(th, '2026-10-12'), true);
  assert.equal(canDelete(th, '2026-10-30'), false);
});
