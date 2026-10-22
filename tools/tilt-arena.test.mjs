// Tilt Arena (skills/tilt-arena.js, owner 2026-10-21: "always combine anything that can be without taking away"): four modes in one
// family, plain words open each one, the law is seeded, bounded and learns (the weakest copies the leader), and the GPU shader's network is
// the same one forwardAll computes on the processor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/tilt-arena.js';
import * as T from '../void-live-deploy/lib/tilt-arena.js';
import { targetOf } from '../void-live-deploy/lib/tilt-arena-idea.js';
import { MODES, modeAsk, listAsk, saveAsk } from '../void-live-deploy/lib/tilt-arena-modes.js';

test('plain words open Tilt Arena and each of its four modes', () => {
  const want = { 'tilt arena': 'tilt-mode', 'genome arena': 'tilt-mode', 'gaze chase': 'gaze-chase', 'look to steer': 'gaze-chase', 'gpu swarm': 'gpu-swarm', 'hand arena': 'hand-arena', 'steer with my hand': 'hand-arena',
    'tilt arena modes': 'tilt-arena-mode', 'tilt arena gaze': 'tilt-arena-mode', 'tilt arena in hand mode': 'tilt-arena-mode', 'gaze arena': 'gaze-chase', 'save the arena': 'tilt-arena-mode', 'show me an arena': 'tilt-arena-mode' };
  for (const [a, p] of Object.entries(want)) assert.equal(fam.part(a.toLowerCase(), a), p, a);
  for (const m of MODES) { assert.ok(fam.match(m.ask.toLowerCase(), m.ask), m.ask); assert.equal(modeAsk('tilt arena ' + m.name.toLowerCase()).id, m.id); assert.ok(fam.stageKinds[m.id], m.id); }
  assert.ok(listAsk('what modes does tilt arena have')); assert.ok(saveAsk('save this arena'));
  for (const a of [...fam.nearMisses, 'swarm', 'tilt', 'arena', 'gpu prices']) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  assert.deepEqual(fam.parts, ['tilt-arena-mode', 'tilt-mode', 'gaze-chase', 'gpu-swarm', 'hand-arena']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('tilt-arena')); for (const n of fam.parts) assert.ok(!index.includes(n), n);
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/1401-tilt-arena', import.meta.url)));
});
test('the arena is seeded, stays in bounds, learns, and is fast enough for 256 agents', () => {
  const a = T.create(7, 12), b = T.create(7, 12); assert.deepEqual(Array.from(a.W), Array.from(b.W));
  for (let i = 0; i < 1200; i++) { T.step(a, 1 / 60, { x: 0.7, y: 0.3 }); }
  assert.ok(a.gen >= 7, 'the weakest copied the leader each round'); for (const g of a.agents) { assert.ok(g.x >= 0 && g.x <= 1 && g.y >= 0 && g.y <= 1); }
  assert.ok(T.ranked(a)[0].fit > 0.6, 'the leader got close'); assert.equal(T.params(a).genome.length, T.GENES);
  assert.ok(!JSON.stringify(T.params(a)).includes('target'), 'Seal keeps numbers of the genome, never where you steered');
  const big = T.create(3, 256), t0 = performance.now(); for (let i = 0; i < 120; i++) T.step(big, 1 / 60, { x: 0.5, y: 0.5 }); assert.ok((performance.now() - t0) / 120 < 4, 'under 4 ms a step');
});
test('the steering falls back: VR first, then tilt, then the pointer, then a wandering lure', () => {
  const s = T.create(1, 4); s.t = 10;
  assert.deepEqual(targetOf({ ...s, ext: { x: 0.2, y: 0.3, t: 9.8 } }, {}), { x: 0.2, y: 0.3, t: 9.8 });
  assert.deepEqual(targetOf(s, { tilting: true, tiltX: 1, tiltY: 0 }), { x: 0.95, y: 0.5 });
  assert.deepEqual(targetOf(s, { over: true, x: 0.1, y: 0.9 }), { x: 0.1, y: 0.9 });
  const w = targetOf({ ...s, ext: { x: 0, y: 0, t: 1 } }, {}); assert.ok(w.x > 0 && w.x < 1);
});
test('the GPU shader runs the same 3-6-2 network as forwardAll', () => {
  assert.match(T.WGSL, /@compute @workgroup_size\(64\)/); assert.match(T.WGSL, new RegExp('a \\* ' + T.GENES + 'u')); assert.match(T.WGSL, /tanh/);
  const s = T.create(2, 3), out = T.forwardAll(s.W, T.inputs(s), 3); assert.equal(out.length, 6); for (const v of out) assert.ok(v > -1 && v < 1);
});
