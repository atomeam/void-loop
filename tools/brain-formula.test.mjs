// brain-formula: F451's expression-tree spatial evo mind (atomeam/a-to-mind.com drafts/F451) is a real organ of Verse Brain, not a separate
// demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). F451 mutated a formula tree on each click. Here the
// formula says how the brain's own tissue will change, and it is judged on each change before it sees it. Measured on 16 real brains (80
// changes each, mean tested skill over the last 40): skill above "nothing changes" on 16 of 16 brains, mean 0.10; evolution beat random
// search with the same number of scorings on 11 of 16, mean +0.03. This test runs 4 of those brains. Run:
// node --test tools/brain-formula.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as F from '../void-live-deploy/lib/brain-formula.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';

/** real changes of a brain's tissue: a visitor's pointer circles and words are told; one change every GAP ticks after 200 ticks */
function changes(seed, n) {
  const b = B.createBrain(seed); B.tell(b, ['river stone light', 'dragons and maps', 'a quiet garden', 'flip a coin'][seed % 4]); const out = []; let prev = null;
  for (let t = 0; t < (n + 1) * F.GAP + 200; t++) {
    const a = t * (0.01 + 0.004 * (seed % 5)); B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: t % 400 < 300 });
    if (t >= 200 && t % F.GAP === 0) { const s = F.seeOf(b); if (prev) out.push(F.changeOf(prev, s)); prev = s; }
  }
  return out;
}

test('every formula it makes is valid, a child differs from its parent, and many() is value() at every place', () => {
  const r = rng(5), X = new Float32Array(F.SX * F.SY * F.NV).map(() => r() * 2 - 0.5);
  for (let k = 0; k < 300; k++) {
    const t = F.fresh(r), c = F.mutate(t, r), x = F.cross(t, F.fresh(r), r);
    assert.ok(F.valid(t) && F.valid(c) && F.valid(x), F.text(t) + ' / ' + F.text(c));
    assert.notEqual(JSON.stringify(c), JSON.stringify(t));
    const V = F.many(c, X);
    for (let p = 0; p < F.SX * F.SY; p += 13) { const v = F.value(c, X.subarray(p * F.NV, p * F.NV + F.NV)); assert.ok(Math.abs((Number.isFinite(v) ? v : 0) - V[p]) < 1e-6, F.text(c)); }
  }
  assert.equal(F.valid({ o: 0, a: { v: 0 } }), false);
  assert.equal(F.valid({ c: 99 }), false);
});

test('on changes it had not seen it beats "nothing changes", and evolution beats random search with the same scorings', () => {
  const RUNS = 80, LAST = 40, diffs = [], skills = [];
  const mean = (v) => v.reduce((a, x) => a + x, 0) / v.length;
  for (const seed of [1, 2, 3, 4]) {
    const all = changes(seed, RUNS), S = F.makeFormula(seed), C = F.makeFormula(seed, true), sa = [], ca = [];
    all.forEach((ch, k) => { F.step(S, ch); if (k >= RUNS - LAST && S.last) sa.push(S.last.skill); });
    all.forEach((ch, k) => { F.step(C, ch); if (k >= RUNS - LAST && C.last) ca.push(C.last.skill); });
    assert.equal(S.evals, C.evals, 'the same scorings');
    skills.push(mean(sa)); diffs.push(mean(sa) - mean(ca));
  }
  assert.ok(skills.every((s) => s > 0), 'skill ' + skills.map((d) => d.toFixed(3)).join(' '));
  assert.ok(diffs.filter((d) => d > 0).length >= 3, 'wins ' + diffs.map((d) => d.toFixed(3)).join(' '));
  assert.ok(mean(diffs) > 0, 'mean ' + diffs.map((d) => d.toFixed(3)).join(' '));
});

test('it runs in the brain as one of twenty-two organs: it evolves, feeds the tissue, is kept, and the self says so', () => {
  const b = B.createBrain(7); B.tell(b, 'river stone light');
  for (let t = 0; t < 1400; t++) { const a = t * 0.013; B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: true }); }
  assert.ok(B.ORGAN_IDS.includes('formula') && B.ORGAN_IDS.length === 22);
  assert.ok(b.formula.gen > 30 && b.runs.formula > 30, 'gen ' + b.formula.gen + ' runs ' + b.runs.formula);
  assert.ok(b.formula.fed > 0, 'it fed the tissue where it expected new life');
  assert.ok(b.board.formula && /^life next = life now [+-] /.test(b.board.formula.text), JSON.stringify(b.board.formula));
  const self = B.selfSays(b).find((l) => /^Formula:/.test(l)) || '';
  assert.match(self, /^Formula: it evolved \d+ generations? of formulas for how its own tissue changes, now life next = life now .+; on changes it had not seen it (beat "nothing changes" by \d+%|did not yet beat "nothing changes")\.$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('formula'));
  assert.deepEqual(F.formulasOf(fresh.formula), F.formulasOf(b.formula));
});

test('kept formulas of the wrong shape or range are refused and change nothing', () => {
  const a = F.makeFormula(3), k = JSON.parse(JSON.stringify(F.formulasOf(a))), c = F.makeFormula(4), before = JSON.stringify(F.formulasOf(c));
  const deep = { o: 5, a: { o: 5, a: { o: 5, a: { o: 5, a: { o: 5, a: { o: 5, a: { v: 0 } } } } } } };
  const bad = [null, {}, { ...k, pop: k.pop.slice(1) }, { ...k, champ: 99 }, { ...k, gen: -1 }, { ...k, pop: k.pop.map(() => ({ c: 40 })) }, { ...k, pop: k.pop.map(() => ({ v: 9 })) }, { ...k, pop: k.pop.map(() => deep) }, { ...k, pop: k.pop.map(() => ({ o: 9, a: { v: 0 }, b: { v: 1 } })) }];
  for (const v of bad) assert.equal(F.loadFormulas(c, v), false, JSON.stringify(v).slice(0, 80));
  assert.equal(JSON.stringify(F.formulasOf(c)), before);
  assert.equal(F.loadFormulas(c, k), true);
});
