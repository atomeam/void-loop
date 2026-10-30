// brain-grower: F453's L-system spatial evo mind (atomeam/a-to-mind.com drafts/F453) is a real organ of Verse Brain, not a separate demo
// (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). F453 rewrote an L-system's rules on each click. Here the
// grammar is grown toward the brain's attention and scored on the light its tips reach, less a cost for each stem, on the brain's own
// states. Measured on real brain states (8 brains, 60 runs each, then 8 held states never used to choose): evolution beat random search
// with the same number of scorings on 8 of 8 brains, mean held score difference +0.87 (for example 1.21 against 0.26). The bend gene
// pays: on 6 brains after 1600 ticks the champion scored 1.40 bent toward the focus, -0.80 with no bend, and -0.35 bent toward the wrong
// place. It costs about 1.7 ms a run, one run every 20 ticks. Run:
// node --test tools/brain-grower.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as G from '../void-live-deploy/lib/brain-grower.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';

/** real brain states: a visitor's pointer circles and words are told; one state every GROW_EVERY ticks */
function brainStates(seed, n) {
  const b = B.createBrain(seed); B.tell(b, ['river stone light', 'dragons and maps', 'a quiet garden', 'flip a coin'][seed % 4]); const out = [];
  for (let t = 0; t < n * G.GROW_EVERY; t++) {
    const a = t * (0.01 + 0.004 * (seed % 5)); B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: t % 400 < 300 });
    if (t % G.GROW_EVERY === 0) out.push(G.envOf(b));
  }
  return out;
}

test('every grammar it makes is valid, a child differs from its parent, and growth stays inside the stem limit', () => {
  const r = rng(5);
  for (let k = 0; k < 200; k++) {
    const g = G.fresh(r), c = G.mutate(g, r), x = G.cross(g, G.fresh(r), r);
    assert.ok(G.valid(g) && G.valid(c) && G.valid(x), G.text(g) + ' / ' + G.text(c));
    assert.notEqual(JSON.stringify(c), JSON.stringify(g));
    const d = G.draw(c, 0.5, 0.3); assert.ok(d.segs.length <= G.MAXS * 4 && d.segs.length % 4 === 0);
  }
});

test('evolution beats random search with the same number of scorings, on states it never saw', () => {
  const RUNS = 40, diffs = [];
  for (const seed of [1, 2, 3, 4]) {
    const all = brainStates(seed, RUNS + 6), seq = all.slice(0, RUNS), held = all.slice(RUNS);
    const S = G.makeGrower(seed);
    for (const e of seq) { S.envs.push(e); if (S.envs.length > G.ENVS) S.envs.shift(); G.evolve(S); }
    const r = rng(seed * 99 + 3), envs = []; let best = null, fit = -Infinity, evals = 0;
    for (const e of seq) {
      envs.push(e); if (envs.length > G.ENVS) envs.shift();
      if (best) { fit = G.judge(best, envs).score; evals++; }
      for (let k = 0; k < 3; k++) { const g = G.fresh(r), s = G.judge(g, envs).score; evals++; if (s > fit) { fit = s; best = g; } }
    }
    assert.ok(Math.abs(evals - S.evals) <= 1, 'the same scorings: ' + evals + ' vs ' + S.evals);
    diffs.push(G.judge(S.pop[S.champ], held).score - G.judge(best, held).score);
  }
  assert.ok(diffs.filter((d) => d > 0).length >= 3, 'wins ' + diffs.map((d) => d.toFixed(3)).join(' '));
  assert.ok(diffs.reduce((a, d) => a + d, 0) / diffs.length > 0.2, 'mean ' + diffs.map((d) => d.toFixed(3)).join(' '));
});

test('it runs in the brain as one of twenty organs: the plant bends toward attention, feeds the tissue, is kept, and the self says so', () => {
  const b = B.createBrain(7); B.tell(b, 'river stone light'); const held = [];
  for (let t = 0; t < 1400; t++) {
    const a = t * 0.013; B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: true });
    if (t >= 1200 && t % 20 === 0) held.push(G.envOf(b));
  }
  assert.ok(B.ORGAN_IDS.includes('grower') && B.ORGAN_IDS.length === 20);
  assert.ok(b.grower.gen > 30 && b.runs.grower > 30, 'gen ' + b.grower.gen + ' runs ' + b.runs.grower);
  assert.ok(b.grower.fed > 0, 'its tips fed the tissue');
  assert.ok(b.board.grow && b.board.grow.segs.length > 0 && b.board.grow.segs.every((v) => v > -1 && v < 2));
  const c = b.grower.pop[b.grower.champ], bent = G.judge(c, held).score, flat = G.judge({ ...c, bend: 0 }, held).score;
  const wrong = G.judge(c, held.map((e) => ({ ...e, fx: 1 - e.fx, fy: 1 - e.fy }))).score;
  assert.ok(bent > flat && bent > wrong, 'bent ' + bent + ' flat ' + flat + ' wrong ' + wrong);
  const self = B.selfSays(b).find((l) => /^Grower:/.test(l)) || '';
  assert.match(self, /^Grower: its plant grows from a grammar it rewrote \d+ times?, now .+; \d+ stems bend toward the focus and reach \d+% of the brightest light/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('grower'));
  assert.deepEqual(G.grammarsOf(fresh.grower), G.grammarsOf(b.grower));
});

test('kept grammars of the wrong shape or range are refused and change nothing', () => {
  const a = G.makeGrower(3), k = JSON.parse(JSON.stringify(G.grammarsOf(a))), c = G.makeGrower(4), before = JSON.stringify(G.grammarsOf(c));
  const bad = [null, {}, { ...k, pop: k.pop.slice(1) }, { ...k, champ: 9 }, { ...k, gen: -1 }, { ...k, pop: k.pop.map((g) => ({ ...g, ang: 400 })) }, { ...k, pop: k.pop.map((g) => ({ ...g, x: [9, 9] })) }];
  for (const v of bad) assert.equal(G.loadGrammars(c, v), false, JSON.stringify(v).slice(0, 80));
  assert.equal(JSON.stringify(G.grammarsOf(c)), before);
  assert.equal(G.loadGrammars(c, k), true);
});
