// brain-growth: the DLA evolution draft (atomeam/a-to-mind.com drafts/F603-webgpu-dla-evo-growth-mind) is a real organ of Verse Brain, not
// a separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). The draft grew a diffusion-limited
// aggregate from the pointer and evolved its genome (diffusion, stick probability, noise), but it measured nothing against a fixed rule.
// Here random walkers diffuse on a 32 x 32 lattice and stick next to the aggregate with an evolved probability. A (1+1) evolutionary
// strategy evolves the genome [stick, drift, launch]. Its fitness is the share of the visitor's trail that the aggregate covers after 40
// walkers. Each round also grows one of 8 fixed rules on the same trail with the same walkers, the classic DLA rule among them.
// Measured (4 visitors, 3 seeds, 3000 ticks; the evolved rule's mean cover over its last 20 rounds, the best fixed rule's over its last 8):
//   wander (a slow random walk): evolved 0.43 to 0.80, best fixed 0.42 to 0.83, gain 0.70 to 1.03; classic DLA 0.15 to 0.32.
//   circles (a steady circle): evolved 0.16 to 0.18, best fixed 0.16 to 0.20, gain 0.84 to 1.17; classic DLA 0.10 to 0.13.
//   line (a line swept again and again): evolved 0.43 to 0.49, best fixed 0.46 to 0.53, gain 0.80 to 1.06; classic DLA 0.19 to 0.20.
//   still (the pointer on one cell): every rule covers it, gain 1.0, and the search keeps no mutant.
//   So the evolved rule covers 1.4 to 2.8 times as much as classic DLA, but it is only about even with the best of the 8 fixed rules:
//   the best fixed rules (stick 1, launch 1) sit at a corner, and the search finds the same level, not a better one.
//   In the brain, on one slow walk (seed 7, 3000 ticks), the gain was 1.50 and the orb showed.
//   A tick costs at most 600 walker steps: 3000 ticks take about 100 ms alone.
// So the organ shows its aggregate (the orb "growing where you point") only while the evolved rule beats the best fixed rule, and on most
// of these runs it stays quiet.
// Run: node --test tools/brain-growth.test.mjs
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as X from '../void-live-deploy/lib/brain-growth.js';
import { growth } from '../void-live-deploy/lib/brain-growth.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';
import { par, ptest, test } from './brain-par.mjs';

const TICKS = 3000;
/** the visitors' pointers, one frame a tick; each call makes a fresh visitor with its own state */
const VISITORS = {
  wander: () => { let p = [0.5, 0.5], v = [0, 0]; return (t, r) => { v = [v[0] * 0.95 + (r() - 0.5) * 0.004, v[1] * 0.95 + (r() - 0.5) * 0.004]; p = [Math.min(0.95, Math.max(0.05, p[0] + v[0])), Math.min(0.95, Math.max(0.05, p[1] + v[1]))]; return { x: p[0], y: p[1] }; }; },
  circles: () => (t) => ({ x: 0.5 + 0.25 * Math.cos(t * 0.03), y: 0.5 + 0.25 * Math.sin(t * 0.03) }),
  line: () => (t) => ({ x: 0.1 + 0.8 * ((t % 200) / 200), y: 0.3 }),
  still: () => () => ({ x: 0.6, y: 0.4 }),
};
/** one visitor, one seed, run alone: what the organ measured */
export function run(name, seed, ticks = TICKS) {
  const G = X.makeGrowth(seed), r = rng(seed * 77), f = VISITORS[name]();
  for (let t = 0; t < ticks; t++) X.growthTick(G, { over: true, ...f(t, r) });
  return X.growthOf(G);
}

ptest(import.meta.url, 'the evolved rule covers far more of the trail than classic DLA, and is only about even with the best fixed rule', async () => {
  const names = Object.keys(VISITORS), rows = await par(import.meta.url, 'run', names.flatMap((n) => [1, 2, 3].map((s) => [n, s])));
  const by = (n) => rows.filter((_, i) => names[Math.floor(i / 3)] === n), say = JSON.stringify(rows.map((r) => [r.elite, r.fixed, r.classic, r.gain]));
  for (const n of ['wander', 'circles', 'line']) for (const r of by(n)) {
    assert.ok(r.rounds > 100 && r.ticks === TICKS, 'it grows and compares many rounds ' + r.rounds);
    assert.ok(r.elite > 1.3 * r.classic, 'the evolved rule beats classic DLA ' + say);
    assert.ok(r.gain > 0.6 && r.gain < 1.3, 'about even with the best of 8 fixed rules, not clearly better: it must not claim more ' + say);
    assert.ok(r.genome.every((v) => v >= 0 && v <= 1) && r.genome[0] >= 0.05, 'the genome stays in range ' + r.genome);
  }
  for (const n of ['wander', 'line']) assert.ok(by(n).every((r) => r.elite > 2 * r.classic), n + ': more than twice the cover of classic DLA ' + say);
  for (const r of by('still')) { assert.equal(r.gain, 1, 'one cell: every rule covers it'); assert.equal(r.kept, 0, 'nothing to improve, so no mutant is kept'); }
});

ptest(import.meta.url, 'it runs in the brain as one of twenty-seven organs: your pointer seeds it, it shows only while it wins, it is kept, and the self says so', () => {
  const b = B.createBrain(7), r = rng(3), f = VISITORS.wander(); B.tell(b, 'river stone light');
  for (let t = 0; t < TICKS; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  assert.ok(B.ORGAN_IDS.includes('growth') && B.ORGAN_IDS.length === 27);
  const s = X.growthOf(b.growth);
  assert.ok(s.rounds > 100 && s.gain > 1, 'on this slow walk the evolved rule beats the best fixed rule: gain ' + s.gain + ' elite ' + s.elite + ' fixed ' + s.fixed);
  assert.ok(b.runs.growth > 0 && b.growth.fed > 0, 'it took runs and left a little life where its aggregate is ' + b.runs.growth + ' ' + b.growth.fed);
  const orb = B.embodiment(b).find((o) => o.key === 'growth');
  assert.ok(orb && orb.label === 'growing where you point', JSON.stringify(b.board.growth));
  const self = B.selfSays(b).find((l) => /^Growth:/.test(l)) || '';
  assert.match(self, /^Growth: \d+ rounds of diffusion-limited aggregation \(the DLA drafts\) that grows where you point, with a rule of stick [\d.]+, drift [\d.]+ and launch [\d.]+ that an evolutionary search kept \d+ times; it covers \d+\.\d\d times as much of where you pointed as the best of 8 fixed rules, and \d+\.\d times as much as classic DLA\.$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('growth'));
  assert.deepEqual(X.genomeOf(fresh.growth).g, X.genomeOf(b.growth).g);
  assert.equal(fresh.growth.rounds, 0, 'the scores start again: they are measured, not kept');
  assert.equal(Object.keys(k.growth).sort().join(), 'g,rounds', 'only the genome is kept, never the trail');
});

test('with nobody pointing it rests: no trail, no walkers, no round', () => {
  const b = B.createBrain(5), r = rng(9), f = VISITORS.wander();
  for (let t = 0; t < 400; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  const before = JSON.stringify([b.growth.ticks, b.growth.rounds, b.growth.trail]);
  for (let t = 0; t < 40; t++) B.stepBrain(b, { over: false });
  assert.equal(JSON.stringify([b.growth.ticks, b.growth.rounds, b.growth.trail]), before);
  assert.equal(growth.rests(b), true);
});

test('the orb shows only while the evolved rule beats the best fixed rule, and a rule that loses takes no run', () => {
  const b = B.createBrain(5); for (let t = 0; t < 30; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (live) => { b.board.growth = { x: 0.5, y: 0.5, live, gain: live ? 1.2 : 0.9, tick: b.ticks, cells: 10 }; return B.embodiment(b).some((o) => o.key === 'growth'); };
  assert.equal(orb(true), true);
  assert.equal(orb(false), false);
  const G = X.makeGrowth(3); G.rounds = 20; G.posted = 19; G.last = new Uint8Array(X.N * X.N);
  G.scores.elite = [0.5]; G.scores.fixed = X.FIXED_RULES.map(() => [0.6]);
  assert.equal(growth.rests({ growth: G }), true, 'a fixed rule wins: it rests');
  G.scores.fixed = X.FIXED_RULES.map(() => [0.4]);
  assert.equal(growth.rests({ growth: G }), false, 'it wins and there is a new round: it asks for a run');
});

test('a kept genome of the wrong shape or range is refused and changes nothing', () => {
  const G = X.makeGrowth(4), before = JSON.stringify(X.genomeOf(G));
  const bad = [null, {}, { g: [0.5, 0.5] }, { g: [0.5, 0.5, 'x'] }, { g: [0.5, 0.5, 2] }, { g: [0.5, NaN, 0.5] }, { g: [-0.1, 0.5, 0.5] }, { g: 'g' }];
  for (const v of bad) assert.equal(X.loadGenome(G, v), false, JSON.stringify(v));
  assert.equal(JSON.stringify(X.genomeOf(G)), before);
  assert.equal(X.loadGenome(G, { g: [0.9, 0.2, 0.7], rounds: 50 }), true);
  assert.deepEqual(X.genomeOf(G).g, [0.9, 0.2, 0.7]);
});

test('the fixed rules it is scored against are the 8 corners it says, the classic DLA rule among them', () => {
  assert.equal(X.FIXED_RULES.length, 8);
  assert.deepEqual([...new Set(X.FIXED_RULES.map((s) => s[0]))], [0.25, 1]);
  assert.deepEqual([...new Set(X.FIXED_RULES.map((s) => s[1]))], [0, 0.5]);
  assert.deepEqual([...new Set(X.FIXED_RULES.map((s) => s[2]))], [0, 1]);
  assert.deepEqual(X.FIXED_RULES[X.CLASSIC_RULE], [1, 0, 0]);
});

test('a walker sticks only next to the aggregate, and a tick spends at most its step budget', () => {
  const cells = [5 * X.N + 5], J = { who: 'elite', g: [1, 0, 0], grid: new Uint8Array(X.N * X.N), launched: 0, walker: null, stuck: 1 };
  J.grid[cells[0]] = 1;
  const spent = X.growSteps(J, cells, rng(11), 1e9);
  assert.ok(spent <= X.K * X.WALK, 'each walker walks at most WALK steps ' + spent);
  const N4 = (i) => { const x = i % X.N, y = (i / X.N) | 0; return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([u, v]) => u >= 0 && v >= 0 && u < X.N && v < X.N && J.grid[v * X.N + u]); };
  let n = 0; for (let i = 0; i < X.N * X.N; i++) if (J.grid[i]) { n++; if (i !== cells[0]) assert.ok(N4(i), 'every stuck cell touches the aggregate'); }
  assert.equal(n, J.stuck);
  assert.equal(X.growSteps({ ...J, launched: 0, walker: null }, cells, rng(12), 50), 50, 'the budget is a hard stop');
  assert.equal(X.coverOf(J.grid, cells), 1);
});
