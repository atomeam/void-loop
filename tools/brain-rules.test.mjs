// brain-rules: the decision-tree drafts (atomeam/a-to-mind.com drafts/: F296, F528, F595, F596) are a real organ of Verse Brain, not a
// separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). The drafts grew a tree on pointer features
// and sealed it, but nothing measured whether it guessed right. Here a tree learns, from the visitor's own strokes, which way the next
// stroke goes from how the last one went and where it ended; each stroke is a test before it is learned, against three rules that need no
// tree: the way the visitor goes most, the same way as the last stroke, and the way that most often came after the last stroke's way.
// Measured (3 visitors, 300 strokes each, the last 50 scored):
//   place (the next way hangs on the quarter of the screen where the last stroke ended): the tree guessed right 82 to 98% of the time,
//     2.0 to 3.1 times as often as the best rule without a tree; its first split is on where the last stroke ended down.
//   cycle (right, down, left, up, over and over): the tree and the table of what follows what both guessed right every time (gain 1).
//   any way: the tree guessed right 14 to 32% of the time, 0.35 to 1.14 times the best rule. Over 10 visitors of each kind, the orb would
//     have shown for 0 to 5% of the strokes of visitors who go any way, and for 95 to 100% of those whose way hangs on place.
// In the brain the tree learns each piece as the stroke memory cuts it, and asks for a run only to act, while it is sure: a tree that
// is not sure takes no tick from the other organs.
// Run: node --test tools/brain-rules.test.mjs
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as S from '../void-live-deploy/lib/brain-strokes.js';
import * as K from '../void-live-deploy/lib/brain-rules.js';
import { par, ptest, test } from './brain-par.mjs';

const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (v) => v.reduce((a, x) => a + x, 0) / v.length;
/** a seeded generator (xorshift), so every visitor is the same each run */
const gen = (seed) => { let s = (seed * 7919 + 1) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/** a visitor's pointer, one frame a tick: `n` straight strokes with a shaky hand, each from a random place, of a random length, the way
 *  `mode` says: 'place' (top left: right; top right: down; bottom right: left; bottom left: up, by where the last stroke ended), 'cycle'
 *  (right, down, left, up, over and over) or 'any'; then the pointer rests 3 ticks, and now and then it leaves */
export function visitor(seed, mode, n) {
  const rnd = gen(seed), out = []; let end = [0.5, 0.5];
  for (let k = 0; k < n; k++) {
    const w = mode === 'place' ? (end[1] < 0.5 ? (end[0] < 0.5 ? 0 : 1) : (end[0] < 0.5 ? 3 : 2)) : mode === 'cycle' ? k % 4 : Math.floor(rnd() * 4);
    const T = 20 + Math.floor(rnd() * 6), len = 0.15 + 0.1 * rnd(), x0 = 0.15 + 0.7 * rnd(), y0 = 0.15 + 0.7 * rnd(); let last;
    for (let i = 0; i < T; i++) { const u = i / (T - 1); last = { x: x0 + len * u * STEPS[w][0] + (rnd() - 0.5) * 0.004, y: y0 + len * u * STEPS[w][1] + (rnd() - 0.5) * 0.004, over: true }; out.push(last); }
    end = [last.x, last.y];
    for (let i = 0; i < 3; i++) out.push({ ...last });
    if (rnd() < 0.3) out.push({ over: false });
  }
  return out;
}
/** the rules alone fed one visitor's pieces, as the stroke memory cuts them (each is learned as it comes, as in the brain) */
const feed = (frames, onPiece) => {
  const st = S.makeStrokes(), R = K.makeRules();
  for (const f of frames) { S.sampleStroke(st, f); while (st.cut.length) { K.takePiece(R, st.cut.shift()); if (onPiece) onPiece(R); } }
  return R;
};

test('a piece\'s features and way; a tree splits where the way changes and cuts back a split that does not help', () => {
  const line = (x0, y0, dx, dy) => Array.from({ length: S.L }, (_, i) => [x0 + dx * i / (S.L - 1), y0 + dy * i / (S.L - 1)]);
  const f = K.featuresOf(line(0.2, 0.3, 0.2, 0.05));
  assert.deepEqual(f.slice(0, 4).map(r3), [0.4, 0.35, 0.2, 0.05]); assert.ok(Math.abs(f[4]) < 1e-9, 'a straight piece does not turn'); assert.ok(Math.abs(f[5] - Math.hypot(0.2, 0.05)) < 1e-9);
  assert.deepEqual([[0.2, 0.05], [0.05, 0.2], [-0.2, 0.05], [0.05, -0.2]].map(([dx, dy]) => K.wayOf(K.featuresOf(line(0.5, 0.5, dx, dy)))), [0, 1, 2, 3]);
  const rows = Array.from({ length: 40 }, (_, i) => [[i / 40, 0.5, 0, 0, 0, 0], i < 20 ? 0 : 2, 0]);
  const t = K.grow(rows);
  assert.ok(Array.isArray(t) && t[0] === 0 && Math.abs(t[1] - 0.5) < 0.03, 'one split on where it ended across ' + JSON.stringify(t));
  assert.deepEqual([K.guess(t, [0.1, 0, 0, 0, 0, 0]), K.guess(t, [0.9, 0, 0, 0, 0, 0])], [0, 2]);
  const noisy = rows.map((r, i) => [r[0], i === 3 || i === 30 ? 1 : 0, 0]); // all one way but two: a split would win back fewer than MIN_GAIN guesses
  assert.equal(K.grow(noisy), 0, 'a split that does not help is cut back');
});

/** one visitor's numbers, for each kind of visitor (a worker runs each) */
export function rulesRow(seed) {
  const g = (mode) => { const R = feed(visitor(seed, mode, 300)); return { gain: K.gainOf(R), right: mean(R.hits.tree), after: mean(R.hits.after), sure: K.sureOf(R), root: K.rulesOf(R).root, scored: R.scored }; };
  const place = g('place'), cycle = g('cycle'), any = g('any');
  return { place: place.gain, placeRight: place.right, placeSure: place.sure, placeRoot: place.root, cycle: cycle.gain, cycleRight: cycle.right, cycleAfter: cycle.after, cycleSure: cycle.sure, any: any.gain, anySure: any.sure, scored: place.scored };
}
/** how often the orb would show, over the strokes of 10 visitors of one kind */
export function showsRow(mode) {
  const out = [];
  for (let seed = 1; seed <= 10; seed++) { let n = 0, on = 0; feed(visitor(seed, mode, 300), (R) => { if (R.scored >= K.MIN_SCORED) { n++; on += K.sureOf(R) ? 1 : 0; } }); out.push(on / n); }
  return out;
}

test('where the next way hangs on where the last stroke ended, the tree guesses it far more often than the best rule without a tree; on a cycle it matches the table of what follows what; on strokes that go any way it stays quiet', async () => {
  const [rows, shows] = await Promise.all([par(import.meta.url, 'rulesRow', [[1], [2], [3]]), par(import.meta.url, 'showsRow', [['place'], ['any']])]);
  const say = JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? r3(v) : v])))) + ' shows ' + JSON.stringify(shows.map((s) => s.map(r3)));
  assert.ok(rows.every((r) => r.scored > 250), 'every stroke after the first few is scored ' + say);
  assert.ok(rows.every((r) => r.place > 1.8 && r.placeRight > 0.75 && r.placeSure), 'place: right over 75% of the time, 1.8 times the best rule, and sure ' + say);
  assert.ok(rows.every((r) => /where it ended/.test(r.placeRoot)), 'place: its first split is on where the last stroke ended ' + say);
  assert.ok(rows.every((r) => r.cycleRight > 0.95 && r.cycleAfter > 0.95 && !r.cycleSure), 'a cycle: the tree and the table both know it, and the tree claims nothing over it ' + say);
  // the control: strokes that go any way give the tree nothing to learn, so it must not be sure, and the orb stays almost always quiet
  assert.ok(rows.every((r) => r.any < 1.3 && !r.anySure), 'any way: no clear gain ' + say);
  assert.ok(Math.max(...shows[1]) <= 0.12 && mean(shows[1]) < 0.05, 'any way: the orb shows for few strokes ' + say);
  assert.ok(Math.min(...shows[0]) >= 0.9, 'place: the orb shows for nearly every stroke ' + say);
});

ptest(import.meta.url, 'it runs in the brain as one of twenty-eight organs: the stroke memory\'s pieces feed it, it guesses where the next stroke goes, it is kept, and the self says so', () => {
  const b = B.createBrain(7); B.tell(b, 'river stone light');
  for (const f of visitor(4, 'place', 120)) B.stepBrain(b, f);
  assert.ok(B.ORGAN_IDS.includes('rules') && B.ORGAN_IDS.length === 28);
  const R = b.rules;
  assert.ok(R.pieces >= 110 && R.scored >= 90 && b.runs.rules === R.fed, 'pieces ' + R.pieces + ' scored ' + R.scored + ' runs ' + b.runs.rules);
  assert.ok(K.sureOf(R) && K.gainOf(R) > 1.5, 'gain ' + K.gainOf(R) + ' ahead ' + K.aheadOf(R));
  assert.ok(R.fed > 20, 'the tree left a memory where it said the next stroke goes ' + R.fed);
  const orb = B.embodiment(b).find((o) => o.key === 'rules');
  assert.ok(orb && /^your next stroke goes (right|down|left|up)$/.test(orb.label), JSON.stringify(b.board.rules));
  const self = B.selfSays(b).find((l) => /^Rules:/.test(l)) || '';
  assert.match(self, /^Rules: \d+ strokes of yours, and a decision tree of \d+ leaves, split first on where it ended (across|down), \(the decision-tree drafts\) that guesses which way your next stroke goes from how the last one went and where it ended; it guesses right \d+% of the time, \d+\.\d times as often as the best rule that needs no tree\.$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('rules'));
  assert.deepEqual(K.treeOf(fresh.rules), K.treeOf(b.rules));
  assert.equal(fresh.rules.scored, 0, 'the scores start again: they are measured, not kept');
});

test('the orb shows only while the tree is sure', () => {
  const b = B.createBrain(5); for (let t = 0; t < 30; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (sure) => { b.board.rules = { x: 0.5, y: 0.5, way: 'right', gain: 2, sure, tick: b.ticks }; return B.embodiment(b).some((o) => o.key === 'rules'); };
  assert.equal(orb(true), true);
  assert.equal(orb(false), false);
  assert.equal(orb(undefined), false);
});

test('a kept tree of the wrong shape or range is refused and changes nothing', () => {
  const a = feed(visitor(3, 'place', 80)), k = JSON.parse(JSON.stringify(K.treeOf(a))), c = feed(visitor(4, 'any', 20)), before = JSON.stringify(K.treeOf(c));
  assert.ok(Array.isArray(k.tree), 'a tree that splits ' + JSON.stringify(k));
  const deep = [0, 0.5, [0, 0.5, [0, 0.5, [0, 0.5, 0, 1], 1], 1], 1];
  const bad = [null, {}, { ...k, tree: deep }, { ...k, tree: [9, 0.5, 0, 1] }, { ...k, tree: [0, 5, 0, 1] }, { ...k, tree: [0, 'x', 0, 1] }, { ...k, tree: [0, 0.5, 4, 1] }, { ...k, tree: [0, 0.5, 0] },
    { ...k, tree: 1.5 }, { ...k, tree: null }, { ...k, pieces: -1 }, { ...k, pieces: 1.5 }, { tree: k.tree }];
  for (const v of bad) assert.equal(K.loadTree(c, v), false, JSON.stringify(v).slice(0, 80));
  assert.equal(JSON.stringify(K.treeOf(c)), before);
  assert.equal(K.loadTree(c, k), true);
  assert.deepEqual(K.treeOf(c), k);
});
