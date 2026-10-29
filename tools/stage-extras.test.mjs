// the pulse, friction, collision, bench, success pulse and shared-state pieces (asked by Verse, 2026-10-16). node --test tools/stage-extras.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import * as P from '../void-live-deploy/lib/pulse.js';
import { frictionOf, factorOf } from '../void-live-deploy/skills/friction.js';
import { collideOf, overlaps, pairsOf, sayPairs } from '../void-live-deploy/skills/collide.js';
import { benchOf, countOf } from '../void-live-deploy/skills/bench.js';
import { buildAlarms } from './bench-alarms.mjs';
import { recovered } from '../void-live-deploy/lib/success-pulse.js';
import { clean, cleanData } from '../void-live-deploy/lib/share.js';

const T0 = 1_000_000, steady = () => { let l = []; for (let i = 0; i < 6; i++) l = P.add(l, T0 + i * 5000, 'timer', 'note'); return l; };
test('pulse: steady, stalled, bursting; too few say nothing', () => {
  const l = steady();
  assert.equal(P.irregular(l, T0 + 26000), null);
  assert.equal(P.irregular(l, T0 + 90000).kind, 'stall');
  let b = l; for (const d of [30100, 30200, 30300, 30400]) b = P.add(b, T0 + d);
  assert.equal(P.irregular(b, T0 + 31000).kind, 'burst');
  assert.equal(P.irregular(l.slice(0, 3), T0 + 90000), null);
  assert.equal(P.bars(l, T0 + 26000).reduce((a, x) => a + x, 0), 6);
  assert.equal(P.add(Array(300).fill({ at: 1 }), 5).length, P.KEEP);
});
test('pulse: the report is an incident draft the incident skill can hold', () => {
  const r = P.reportOf(P.irregular(steady(), T0 + 90000), steady(), T0 + 90000);
  assert.match(r.title, /^Irregular pulse on the stage: stall/); assert.equal(r.status, 'investigating'); assert.ok(r.timeline.length >= 2 && r.next.length >= 1);
});
test('friction: the words and the factor', () => {
  assert.deepEqual(frictionOf('add a friction slider'), { set: null }); assert.deepEqual(frictionOf('set the friction to 80'), { set: 80 }); assert.deepEqual(frictionOf('set the friction to 900'), { set: 100 });
  for (const n of ['what is friction', 'friction in physics', 'friction factor of a car tyre']) assert.equal(frictionOf(n), null, n);
  assert.equal(factorOf(5), 0.995); assert.equal(factorOf(100), 0.9); assert.equal(factorOf(0), 1); assert.equal(factorOf('x'), 0.995);
});
test('collide: overlap is shared area; pairs once; the line', () => {
  assert.ok(collideOf('any collisions') && collideOf('are things overlapping') && !collideOf('collision course'));
  const boxes = { a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 5, y: 5, w: 10, h: 10 }, c: { x: 10, y: 0, w: 5, h: 5 }, d: { x: 90, y: 90, w: 1, h: 1 } };
  assert.ok(!overlaps(boxes.a, boxes.c)); assert.deepEqual(pairsOf(boxes), [['a', 'b']]);
  assert.equal(sayPairs([['a', 'b']], { a: { kind: 'clock' }, b: { kind: 'sticky' } }), 'the clock and the sticky overlap');
});
test('bench: the count is the checked false alarms, nothing else', () => {
  const j = buildAlarms([{ file: 'a.js', line: 3, verdict: 'false', why: 'w' }, { file: 'b.js', line: 1, verdict: 'real' }, { file: 'c.js', line: 2 }], { score: 10, total: 12, misses: ['x', 'y'], at: 'now' });
  assert.equal(j.falseAlarms, 1); assert.equal(j.real, 1); assert.equal(j.unread, 1); assert.equal(j.bench.missed, 2);
  assert.equal(countOf(j).n, 1); assert.equal(countOf(null), null); assert.ok(benchOf('show the bench') && !benchOf('bench press'));
});
test('success pulse: only what failed before and was looked at and is fine now', () => {
  assert.deepEqual(recovered(['skill:a', 'source:b', 'skill:c'], ['source:b'], ['skill:a', 'source:b']), ['skill:a']);
  assert.deepEqual(recovered(null, [], []), []);
});
test('share: a drop and a sync pass small and well formed; nothing else rides along', () => {
  assert.deepEqual(clean(JSON.stringify({ t: 'drop', key: 'abc.0' })), { t: 'drop', key: 'abc.0' });
  assert.equal(clean(JSON.stringify({ t: 'drop', key: 'not a key' })), null);
  assert.deepEqual(clean(JSON.stringify({ t: 'sync', key: 'abc.1', data: { items: [['milk', 1], ['eggs', 0]], html: '<b>' } })), { t: 'sync', key: 'abc.1', data: { items: [['milk', 1], ['eggs', 0]] } });
  assert.deepEqual(cleanData({ timer: { run: true, left: 99999999999 } }), { timer: { run: 1, left: 86400000 } });
  assert.deepEqual(cleanData({ value: 4.4 }), { value: 4 });
  for (const bad of [null, [], { x: 1 }, { items: 'no' }, { timer: { left: 'a' } }, { value: 'a' }]) assert.equal(cleanData(bad), null, JSON.stringify(bad));
  assert.equal(cleanData({ items: Array(20).fill(['a', 0]) }).items.length, 8);
  assert.ok(JSON.stringify({ t: 'sync', key: 'abcdefghijkl.19', data: { items: Array(8).fill(['x'.repeat(40), 1]) } }).length < 600, 'the largest sync fits one message');
});
