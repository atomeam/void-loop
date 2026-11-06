// brain-strokes: the Hopfield drafts (atomeam/a-to-mind.com drafts/: F463, F545, F556, F559, F597) are a real organ of Verse Brain, not a
// separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). The drafts stored patterns and recalled
// them from a part, but nothing measured whether the recall was right. Here the brain keeps the visitor's own strokes in a dense Hopfield
// memory and, from the first half of a stroke, recalls the rest; each stroke is scored before it is stored, against three ways that need no
// memory (hold, carry on, carry on and turn) and against the drafts' rule as written.
// Measured (3 visitors, 300 strokes, the last 50 scored): 3 shapes drawn in turn, the recall missed 27 to 62 times less than the best
// no-memory way, and 25 to 57 times less than the drafts' rule; 6 shapes, 7.7 to 27 times less; wandering strokes that never repeat, 0.32
// to 0.45: it loses there, and stays quiet.
// Run: node --test tools/brain-strokes.test.mjs
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as K from '../void-live-deploy/lib/brain-strokes.js';
import { par, ptest, test } from './brain-par.mjs';

const r3 = (v) => Math.round(v * 1000) / 1000;
/** a seeded generator (xorshift), so every visitor is the same each run */
const gen = (seed) => { let s = (seed * 7919 + 1) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const SHAPES = {
  circle: (u) => [Math.cos(2 * Math.PI * u) - 1, Math.sin(2 * Math.PI * u)],
  zigzag: (u) => { const k = u * 4, f = k - Math.floor(k); return [u * 2, (Math.floor(k) % 2 ? 1 - f : f) - 0.5]; },
  eight: (u) => [Math.sin(2 * Math.PI * u), Math.sin(4 * Math.PI * u) / 2],
  corner: (u) => (u < 0.5 ? [u * 2, 0] : [1, (u - 0.5) * 2]),
  wave: (u) => [u * 2, Math.sin(6 * Math.PI * u) * 0.3],
  spiral: (u) => [u * Math.cos(5 * u), u * Math.sin(5 * u)]
};
/** a visitor's pointer, one frame a tick: `n` strokes, each a shape from `names` at a random place and size with a shaky hand (or, with
 *  no names, a wandering stroke that never repeats), then the pointer rests 3 ticks, and now and then it leaves */
export function visitor(seed, names, n) {
  const rnd = gen(seed), out = [];
  for (let k = 0; k < n; k++) {
    const T = 20 + Math.floor(rnd() * 6); let last;
    if (names.length) {
      const f = SHAPES[names[Math.floor(rnd() * names.length)]], sz = 0.08 + 0.04 * rnd(), cx = 0.2 + 0.6 * rnd(), cy = 0.2 + 0.6 * rnd();
      for (let i = 0; i < T; i++) { const [x, y] = f(i / (T - 1)); last = { x: cx + sz * x + (rnd() - 0.5) * 0.004, y: cy + sz * y + (rnd() - 0.5) * 0.004, over: true }; out.push(last); }
    } else {
      let x = 0.2 + 0.6 * rnd(), y = 0.2 + 0.6 * rnd(), a = rnd() * 6.28, w = 0; const v = 0.008 + 0.006 * rnd();
      for (let i = 0; i < T; i++) { w = 0.8 * w + (rnd() - 0.5) * 0.5; a += w; x += v * Math.cos(a); y += v * Math.sin(a); last = { x, y, over: true }; out.push(last); }
    }
    for (let i = 0; i < 3; i++) out.push({ ...last });
    if (rnd() < 0.3) out.push({ over: false });
  }
  return out;
}
/** the stroke memory alone fed one visitor, its queue scored at every tick (as the organ does when it runs) */
const feed = (frames) => { const S = K.makeStrokes(); for (const f of frames) { K.sampleStroke(S, f); while (S.queue.length) K.scoreAndStore(S, S.queue.shift()); } return S; };

test('a stroke is the pointer moving: still, leaving, a jump or a press ends it, and each L samples are one pattern from the stroke\'s start', () => {
  const S = K.makeStrokes(), line = (x0, n, dx = 0.01) => Array.from({ length: n }, (_, i) => ({ x: x0 + dx * i, y: 0.5, over: true }));
  for (const f of line(0.1, 10)) K.sampleStroke(S, f);
  assert.equal(S.cur.length, 10);
  K.sampleStroke(S, { x: 0.19, y: 0.5, over: true }); K.sampleStroke(S, { x: 0.19, y: 0.5, over: true });
  assert.equal(S.cur.length, 0, 'still for STILL_TICKS ticks ends the stroke');
  for (const f of line(0.2, 5)) K.sampleStroke(S, f); K.sampleStroke(S, { x: 0.6, y: 0.5, over: true });
  assert.deepEqual(S.cur, [[0.6, 0.5]], 'a jump starts a new stroke where the pointer landed');
  K.sampleStroke(S, { over: false }); assert.equal(S.cur.length, 0, 'leaving ends it');
  for (const f of line(0.1, 4)) K.sampleStroke(S, f); K.sampleStroke(S, { x: 0.15, y: 0.5, over: true, down: true });
  assert.equal(S.cur.length, 1, 'a press starts a new stroke');
  K.sampleStroke(S, { over: false });
  for (const f of line(0.1, K.L + 3)) K.sampleStroke(S, f);
  assert.equal(S.queue.length, 1); assert.equal(S.strokes, 1); assert.equal(S.cur.length, 3, 'a long stroke gives one pattern for each L samples');
  const p = S.queue[0]; assert.equal(p.length, K.D); assert.deepEqual(p.slice(0, 2), [0, 0]); assert.ok(Math.abs(p[K.D - 2] - 0.01 * (K.L - 1)) < 1e-9, 'each sample from the stroke\'s start');
});

test('the dense recall settles on the stored pattern whose first half the cue matches; the rivals carry the cue on', () => {
  const a = Array.from({ length: K.D }, (_, i) => (i % 2 ? 0 : 0.01 * (i >> 1))), b = Array.from({ length: K.D }, (_, i) => (i % 2 ? 0.01 * (i >> 1) : 0));
  const near = (u, v) => u.every((x, i) => Math.abs(x - v[i]) < 1e-6);
  assert.ok(near(K.dense([a, b], a.slice(0, K.KN), 1e4), a.slice(K.KN)), 'from a\'s first half, a\'s second half');
  assert.ok(near(K.dense([a, b], b.slice(0, K.KN), 1e4), b.slice(K.KN)), 'from b\'s first half, b\'s second half');
  const c = K.carryOn(a.slice(0, K.KN));
  assert.ok(near(c.vel, a.slice(K.KN)), 'a straight stroke is carried on exactly at its speed');
  assert.ok(c.hold.every((v, i) => v === (i % 2 ? 0 : a[K.KN - 2])), 'hold stays at the last place');
});

/** one visitor's numbers, for 3 shapes, 6 shapes and wandering strokes that never repeat (a worker runs each) */
export function strokesRow(seed) {
  const g = (names) => { const S = feed(visitor(seed, names, 300)); return { gain: K.gainOf(S), drafts: K.draftsGainOf(S), scored: S.scored }; };
  const three = g(['circle', 'zigzag', 'eight']), six = g(Object.keys(SHAPES)), wander = g([]);
  return { three: three.gain, six: six.gain, wander: wander.gain, threeDrafts: three.drafts, wanderDrafts: wander.drafts, scored: three.scored };
}

test('on a visitor whose strokes repeat, the recall lands far closer than carrying the stroke on and than the drafts\' rule; on strokes that never repeat it loses and stays quiet', async () => {
  const rows = await par(import.meta.url, 'strokesRow', [[1], [2], [3]]); // the 3 visitors at once
  const say = JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r3(v)]))));
  assert.ok(rows.every((r) => r.scored > 250), 'every stroke after the first two is scored ' + say);
  assert.ok(rows.every((r) => r.three > 20), '3 shapes: over 20 times closer than the best no-memory way ' + say);
  assert.ok(rows.every((r) => r.six > 5), '6 shapes: over 5 times closer ' + say);
  assert.ok(rows.every((r) => r.threeDrafts > 10), '3 shapes: over 10 times closer than the drafts\' rule as written ' + say);
  // the control: strokes that never repeat give a memory nothing to recall, so it must lose to carrying on, and the organ stays quiet
  assert.ok(rows.every((r) => r.wander < 1), 'wandering strokes: it does not beat carrying on ' + say);
  assert.ok(rows.every((r) => r.three > 10 * r.wander && r.six > 5 * r.wander), 'the gain comes from repeats ' + say);
});

ptest(import.meta.url, 'it runs in the brain as one of twenty-six organs: your strokes feed it, it recalls where a stroke ends, it is kept, and the self says so', () => {
  const b = B.createBrain(7); B.tell(b, 'river stone light');
  for (const f of visitor(4, ['circle', 'zigzag', 'eight'], 90)) B.stepBrain(b, f);
  assert.ok(B.ORGAN_IDS.includes('strokes') && B.ORGAN_IDS.length === 26);
  const S = b.strokes;
  assert.ok(S.strokes >= 80 && S.scored >= 60 && b.runs.strokes > 60, 'strokes ' + S.strokes + ' scored ' + S.scored + ' runs ' + b.runs.strokes);
  assert.ok(K.gainOf(S) > 5, 'gain ' + K.gainOf(S));
  assert.ok(S.fed > 20, 'the recall left a memory where it said strokes would end ' + S.fed);
  // the orb shows where the live stroke ends, while the gain is over 1
  const half = visitor(9, ['circle'], 1).slice(0, K.HALF + 2); let orb = null;
  for (const f of half) { B.stepBrain(b, f); orb = B.embodiment(b).find((o) => o.key === 'strokes') || orb; }
  assert.ok(orb && orb.label === 'your stroke ends here', JSON.stringify(b.board.strokes));
  const self = B.selfSays(b).find((l) => /^Strokes:/.test(l)) || '';
  assert.match(self, /^Strokes: \d+ strokes of yours, the last 32 kept in an associative memory \(the Hopfield drafts\) that recalls the rest of a stroke from its first half; it lands \d+\.\d times closer than carrying the stroke on as it was going, and \d+\.\d times closer than the drafts' rule as written\.$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('strokes'));
  assert.deepEqual(K.strokeMemoryOf(fresh.strokes).X, K.strokeMemoryOf(b.strokes).X);
  assert.equal(fresh.strokes.scored, 0, 'the scores start again: they are measured, not kept');
});

test('the orb shows only while the recall beats carrying the stroke on, and only while a stroke is live', () => {
  const b = B.createBrain(5); for (let t = 0; t < 30; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (gain, live = true) => { b.board.strokes = { x: 0.5, y: 0.5, live, gain, tick: b.ticks }; return B.embodiment(b).some((o) => o.key === 'strokes'); };
  assert.equal(orb(3), true);
  assert.equal(orb(0.6), false);
  assert.equal(orb(null), false);
  assert.equal(orb(3, false), false);
});

test('kept strokes of the wrong shape or range are refused and change nothing', () => {
  const a = feed(visitor(3, ['circle', 'eight'], 40)), k = JSON.parse(JSON.stringify(K.strokeMemoryOf(a))), c = feed(visitor(4, ['wave'], 10)), before = JSON.stringify(K.strokeMemoryOf(c));
  const bad = [null, {}, { ...k, X: k.X.concat(k.X) }, { ...k, X: [k.X[0].slice(1)] }, { ...k, X: [k.X[0].map(() => 5)] }, { ...k, X: [k.X[0].map(() => 'x')] }, { ...k, X: [k.X[0].map(() => null)] },
    { ...k, beta: 9 }, { ...k, beta: 1.5 }, { ...k, strokes: -1 }, { ...k, strokes: 1 }, { X: k.X }];
  for (const v of bad) assert.equal(K.loadStrokeMemory(c, v), false, JSON.stringify(v).slice(0, 80));
  assert.equal(JSON.stringify(K.strokeMemoryOf(c)), before);
  assert.equal(K.loadStrokeMemory(c, k), true);
  assert.deepEqual(K.strokeMemoryOf(c), k);
});
