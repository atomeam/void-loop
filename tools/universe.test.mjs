// The Tower beyond websites: lib/universe.js, tools/universe.mjs and the data (the names, the scan and the card: tools/universe-card.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KINDS, CHECK, SIDES, checksOf, readChecks, closeness, beaten, sidesOf, gapsOf, climbOrder, categories, protectedNames, scrubNames, stalled, jobsOf, kindOf } from '../void-live-deploy/lib/universe.js';
import { SEEDS } from '../void-live-deploy/lib/universe-seeds.js';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';
import { mergeTargets, markOf, step, aimOf, empty, serialize, rowsOf } from './universe.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const all = (t, verse, best = 90) => ({ ...t, marks: Object.fromEntries(checksOf(t).map((c) => [c.id, { verse, best }])) });
const game = SEEDS.find((t) => t.kind === 'game'), snail = SEEDS.find((t) => t.id === 'snail');

test('every kind carries graphics, and the three sides: correctness and the plus are never left out', () => {
  for (const [k, v] of Object.entries(KINDS)) {
    const sides = new Set(v.checks.map((id) => CHECK[id].side));
    assert.ok(v.checks.includes('graphics'), k + ' has the graphics check');
    assert.ok(sides.has('correct') && sides.has('plus') && sides.has('beauty'), k + ' has beauty, correctness and the plus');
    assert.ok(v.checks.includes('performance'), k + ' must run at 60 fps with no errors');
  }
  for (const id of ['rules', 'softlock', 'controls', 'fair', 'performance']) assert.ok(KINDS.game.checks.includes(id), 'game ' + id);
  for (const id of ['accuracy', 'behavior', 'facts', 'insight', 'interactivity']) assert.ok(KINDS.creature.checks.includes(id), 'real thing ' + id);
  assert.deepEqual(Object.keys(SIDES), ['beauty', 'correct', 'plus']);
  assert.ok(checksOf({ kind: 'a kind nobody listed' }).length > 5, 'an unlisted kind still gets checks: the universe has no end');
});
test('Verse beats a target only when it outscores the best on every check of every side', () => {
  assert.equal(beaten(all(game, 91, 90)), true);
  assert.equal(beaten(all(game, 90, 90)), false, 'a tie is not a win');
  const lostCorrect = all(game, 99), m = { ...lostCorrect.marks, rules: { verse: 50, best: 90 } };
  assert.equal(beaten({ ...lostCorrect, marks: m }), false, 'beautiful and wrong does not beat it');
  const noPlus = { ...lostCorrect.marks, insight: { verse: 10, best: 90 } };
  assert.equal(beaten({ ...lostCorrect, marks: noPlus }), false, 'faithful but nothing beyond reality does not beat it');
  const open = { ...lostCorrect.marks }; delete open.graphics;
  assert.equal(beaten({ ...lostCorrect, marks: open }), false, 'an unmeasured check is not a win');
  assert.deepEqual(sidesOf(all(snail, 99)).map((s) => s.won === s.of), [true, true, true]);
});
test('closeness counts the share of the best reached; open counts zero; gaps list correctness first', () => {
  assert.equal(closeness(game), 0);
  assert.equal(closeness(all(game, 45, 90)), 50);
  const t = { ...all(game, 99), marks: { ...all(game, 99).marks, graphics: { verse: 10, best: 90 }, rules: { verse: 20, best: 90 } } };
  const g = gapsOf(t);
  assert.equal(g[0].side, 'correct'); assert.equal(g[g.length - 1].id, 'graphics');
});
test('the climb is closest first, and categories take turns inside a band', () => {
  const o = climbOrder([{ id: 'a', kind: 'game', assim: 60 }, { id: 'b', kind: 'game', assim: 59 }, { id: 'c', kind: 'creature', assim: 58 }, { id: 'd', kind: 'website', assim: 94 }, { id: 'e', kind: 'game', assim: 10 }, { id: 'x', kind: 'game', assim: 99, beaten: true }]);
  assert.deepEqual(o.map((x) => x.id), ['d', 'a', 'c', 'b', 'e']);
});
test('seeds: unique, broad, original (no copying) and every kind is a real kind', () => {
  assert.equal(new Set(SEEDS.map((t) => t.id)).size, SEEDS.length);
  const kinds = new Set(SEEDS.map((t) => t.kind));
  for (const k of ['game', 'video', 'music', 'art', 'app', 'assistant', 'writing', 'creature', 'nature', 'object', 'place', 'science', 'idea']) assert.ok(kinds.has(k), k);
  assert.ok(SEEDS.filter((t) => t.kind === 'game').length >= 4, 'GTA-class, indie, browser and puzzle targets');
  assert.ok(SEEDS.find((t) => t.id === 'indie-action-game').entry.game && SEEDS.find((t) => t.id === 'puzzle-game').entry.game, 'Arcade and Studio games are entries');
  assert.ok(SEEDS.every((t) => t.bar >= 80 && t.best.why));
});
test('the stall rule: no progress for 3 days and the target gives way, its gaps go to the build list, it rests 14 days', () => {
  let u = mergeTargets(empty(), [snail, game]);
  u = markOf(u, 'snail', 'graphics', 40, { judge: 'test' });
  u = step(u, '2026-11-10');
  const early = step(u, '2026-11-11'); assert.ok(!early.rest.snail, 'a day later it is still the floor');
  const later = step(early, '2026-11-14'); assert.equal(later.rest.snail, '2026-11-14');
  assert.ok(later.background.some((b) => b.id === 'snail' && b.aspect === 'facts'), 'its open checks reached the build list');
  assert.ok(rowsOf(later, '2026-11-20').find((r) => r.id === 'snail').resting);
  assert.ok(!rowsOf(later, '2026-12-05').find((r) => r.id === 'snail').resting, 'after the rest it is back');
  assert.equal(stalled({ n: 1, assim: 10, progressAt: '2026-11-10' }, { n: 2, assim: 10 }, '2026-11-14').stalled, false, 'one more check won is progress');
});
test('marks: a measured number is clamped and keeps its judge; an unknown check throws', () => {
  const u = markOf(mergeTargets(empty(), [snail]), 'snail', 'facts', 140, { judge: 'sources', at: '2026-11-19' });
  assert.equal(u.targets[0].marks.facts.verse, 100); assert.equal(u.targets[0].marks.facts.judge, 'sources');
  assert.throws(() => markOf(u, 'snail', 'nope', 1));
  assert.equal(mergeTargets(u, [snail]).targets[0].marks.facts.verse, 100, 'seeding again keeps what was earned');
});
test('the lane aim is plain words and never a target\'s name', () => {
  const u = mergeTargets(empty(), SEEDS), aim = aimOf(u);
  assert.ok(aim.games['debris-field'] && aim.things.snail);
  assert.ok(!JSON.stringify(aim).match(new RegExp(protectedNames(SEEDS).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')));
});
test('the data file: owner-only, one line per target, seeds present, no visitor page for any target', () => {
  assert.ok(ownerOnlyPath('/tower.universe.json') && ownerOnlyPath('/lib/universe.js') && ownerOnlyPath('/lib/universe-seeds.js') && ownerOnlyPath('/versus/universe.js'));
  const routes = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/_routes.json', import.meta.url), 'utf8')).include;
  for (const p of ['/lib/universe.js', '/lib/universe-seeds.js', '/versus/universe.js', '/tower.*']) assert.ok(routes.includes(p), p + ' goes through the middleware');
  const raw = fs.readFileSync(new URL('../void-live-deploy/tower.universe.json', import.meta.url), 'utf8'), d = JSON.parse(raw);
  for (const s of SEEDS) assert.ok(d.targets.some((t) => t.id === s.id), s.id);
  assert.ok(serialize(d).split('\n').length < d.targets.length + 400);
  assert.ok(d.targets.every((t) => !t.entry || !t.entry.url), 'a target has no visitor page of its own');
});
