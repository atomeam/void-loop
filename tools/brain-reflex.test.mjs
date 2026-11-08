// brain-reflex: the tiny MLP drafts (atomeam/a-to-mind.com drafts/: 32 drafts whose own name says MLP, perceptron or neural kernel) are a
// real organ of Verse Brain, not a separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). The drafts
// put a small random network between the pointer and a few bodies and showed the bodies move; none of them learned, and nothing measured
// whether the network followed better than a spring. Here a network of 92 numbers pushes three bodies after the pointer and learns, by
// backprop through the bodies' own motion, from what each push did. Every tick it is scored against 18 springs (3 pulls, 3 dampings,
// with and without the pointer's speed), against no push at all, and against the same network before it learned.
// Measured (4 visitors, 3 seeds, 4000 ticks, the last 200 scored; mean distance from the pointer, the network and the best spring):
//   wander (a slow random walk): the network 0.0022 to 0.0026, the best spring 0.0033 to 0.0035, gain 1.3 to 1.5.
//   tilted (the pointer jumps every 150 ticks, and the device tilts, so gravity pulls the bodies aside): gain 1.04 to 1.18.
//   jumps (the same jumps, no tilt): gain 0.97 to 1.0, the best spring about as close.
//   circles (a steady circle): gain 0.85 to 0.93, the best spring (pull 0.15, damping 0.6, with the pointer's speed) is closer.
//   The network before it learned and no push at all are 0.2 to 0.9 from the pointer: 9 to 370 times further than after learning.
//   In the brain, on the slow walk, the gain grows as it learns: 0.74 after 500 ticks, about 1.0 after 1000, 1.45 after 4000.
// So the organ shows its bodies (the orb "following you") only while it is closer than the best spring; on a circle a spring is enough,
// and it stays quiet.
// Run: node --test tools/brain-reflex.test.mjs
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as X from '../void-live-deploy/lib/brain-reflex.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';
import { par, ptest, test } from './brain-par.mjs';

const TICKS = 4000;
/** the visitors' pointers, one frame a tick; each call makes a fresh visitor with its own state */
const VISITORS = {
  wander: () => { let p = [0.5, 0.5], v = [0, 0]; return (t, r) => { v = [v[0] * 0.95 + (r() - 0.5) * 0.004, v[1] * 0.95 + (r() - 0.5) * 0.004]; p = [Math.min(0.95, Math.max(0.05, p[0] + v[0])), Math.min(0.95, Math.max(0.05, p[1] + v[1]))]; return { x: p[0], y: p[1] }; }; },
  tilted: () => { let at = [0.5, 0.5]; return (t, r) => { if (t % 150 === 0) at = [0.2 + 0.6 * r(), 0.2 + 0.6 * r()]; return { x: at[0], y: at[1], tiltX: 0.6, tiltY: -0.4 }; }; },
  jumps: () => { let at = [0.5, 0.5]; return (t, r) => { if (t % 150 === 0) at = [0.2 + 0.6 * r(), 0.2 + 0.6 * r()]; return { x: at[0], y: at[1] }; }; },
  circles: () => (t) => ({ x: 0.5 + 0.25 * Math.cos(t * 0.03), y: 0.5 + 0.25 * Math.sin(t * 0.03) }),
};
/** one visitor, one seed, run alone: what the organ measured */
export function run(name, seed, ticks = TICKS) {
  const R = X.makeReflex(seed), r = rng(seed * 77), f = VISITORS[name]();
  for (let t = 0; t < ticks; t++) X.reflexTick(R, { over: true, ...f(t, r) });
  return X.reflexOf(R);
}

ptest(import.meta.url, 'the network learns to follow: closer than the best of 18 springs where a spring is not enough, and quiet where it is', async () => {
  const rows = await par(import.meta.url, 'run', Object.keys(VISITORS).flatMap((n) => [1, 2, 3].map((s) => [n, s])));
  const by = (n) => rows.filter((_, i) => Object.keys(VISITORS)[Math.floor(i / 3)] === n), say = JSON.stringify(rows.map((r) => [r.net, r.spring, r.gain]));
  for (const r of rows) {
    assert.ok(r.unlearned > 5 * r.net && r.none > 5 * r.net, 'learning is what makes it follow: the same network before it learned, and no push, are far behind ' + say);
    assert.ok(r.steps >= TICKS - 1 && r.ticks === TICKS, 'it learns from every push ' + r.steps);
  }
  assert.ok(by('wander').every((r) => r.gain > 1.2), 'a slow walk: clearly closer than any spring ' + say);
  assert.ok(by('tilted').every((r) => r.gain > 1.0), 'jumps under a tilt: it learns the pull of gravity a spring cannot see ' + say);
  assert.ok(by('jumps').every((r) => r.gain > 0.9 && r.gain < 1.1), 'plain jumps: about the same as the best spring ' + say);
  assert.ok(by('circles').every((r) => r.gain < 1 && r.lead), 'a circle: a spring that knows the pointer\'s speed is closer, so it must not claim a gain ' + say);
});

ptest(import.meta.url, 'it runs in the brain as one of twenty-nine organs: your pointer moves its bodies, it shows only while it wins, it is kept, and the self says so', () => {
  const b = B.createBrain(7), r = rng(3), f = VISITORS.wander(); B.tell(b, 'river stone light');
  for (let t = 0; t < TICKS; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  assert.ok(B.ORGAN_IDS.includes('reflex') && B.ORGAN_IDS.length === 29);
  const s = X.reflexOf(b.reflex);
  assert.ok(s.steps >= TICKS - 1 && s.gain > 1.2, 'gain ' + s.gain + ' net ' + s.net + ' spring ' + s.spring);
  assert.ok(b.runs.reflex > 0 && b.reflex.fed > 0, 'it took runs and left a memory where its bodies are ' + b.runs.reflex + ' ' + b.reflex.fed);
  const orb = B.embodiment(b).find((o) => o.key === 'reflex');
  assert.ok(orb && orb.label === 'following you', JSON.stringify(b.board.reflex));
  const self = B.selfSays(b).find((l) => /^Reflex:/.test(l)) || '';
  assert.match(self, /^Reflex: a network of 92 numbers \(the tiny MLP drafts\) that pushes three bodies after your pointer and has learned from \d+ pushes; its bodies stay \d+\.\d\d times closer to you than the best of 18 springs, and \d+ times closer than the same network before it learned\.$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('reflex'));
  assert.deepEqual(X.netOf(fresh.reflex).w, X.netOf(b.reflex).w);
  assert.equal(fresh.reflex.ticks, 0, 'the scores start again: they are measured, not kept');
  assert.equal(Object.keys(k.reflex).sort().join(), 'steps,w', 'only the weights are kept, never the pointer');
});

test('with nobody pointing it rests, and its orb goes', () => {
  const b = B.createBrain(5), r = rng(9), f = VISITORS.wander();
  for (let t = 0; t < 400; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  const ticks = b.reflex.ticks;
  for (let t = 0; t < 40; t++) B.stepBrain(b, { over: false });
  assert.equal(b.reflex.ticks, ticks, 'no pointer: no push, no learning, no score');
  assert.equal(b.reflex.at, null);
  assert.ok(!B.embodiment(b).some((o) => o.key === 'reflex'), 'the orb goes when the pointer leaves');
});

test('the orb shows only while the network is closer than the best spring', () => {
  const b = B.createBrain(5); for (let t = 0; t < 30; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (live) => { b.board.reflex = { x: 0.5, y: 0.5, live, gain: live ? 1.3 : 0.9, tick: b.ticks, bodies: [] }; return B.embodiment(b).some((o) => o.key === 'reflex'); };
  assert.equal(orb(true), true);
  assert.equal(orb(false), false);
});

test('a kept network of the wrong shape or range is refused and changes nothing', () => {
  const R = X.makeReflex(4), before = JSON.stringify(X.netOf(R)), good = X.netOf(X.makeReflex(8));
  const bad = [null, {}, { w: good.w.slice(1) }, { w: [...good.w.slice(1), 'x'] }, { w: [...good.w.slice(1), 1e9] }, { w: [...good.w.slice(1), NaN] }, { w: 'w' }];
  for (const v of bad) assert.equal(X.loadNet(R, v), false, JSON.stringify(v).slice(0, 60));
  assert.equal(JSON.stringify(X.netOf(R)), before);
  assert.equal(X.loadNet(R, JSON.parse(JSON.stringify(good))), true);
  assert.deepEqual(X.netOf(R).w, good.w);
});

test('the springs it is scored against are the grid it says: 3 pulls, 3 dampings, with and without the pointer\'s speed', () => {
  assert.equal(X.SPRINGS.length, 18);
  assert.deepEqual([...new Set(X.SPRINGS.map((s) => s[0]))], [0.05, 0.15, 0.4]);
  assert.deepEqual([...new Set(X.SPRINGS.map((s) => s[1]))], [0.1, 0.3, 0.6]);
  assert.equal(X.GENES, 92);
});
