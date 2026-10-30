// brain-grains: F456's granular contact gene transfer (atomeam/a-to-mind.com drafts/F456) is a real organ of Verse Brain, not a separate
// demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). Grains in a spring and dashpot bed with Coulomb
// friction carry two genes (bounce and grip) and pass them on where they touch, from the grain whose recent lives landed nearer the aim.
// Measured on 12 real brains' focus paths (1500 lives, mean distance from the aim over the last 300): fit-gated passing landed 0.172
// from the aim, passing in a random direction 0.245, no passing 0.231; fit beat random on 10 of 12 and beat no passing on 11 of 12.
// On the 3 brains this test runs: fit 0.163 0.113 0.151, random 0.187 0.248 0.265, none 0.209 0.206 0.252, organ gain 1.40 1.98 1.92.
// Run: node --test tools/brain-grains.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as K from '../void-live-deploy/lib/brain-grains.js';

/** the real brain's focus x, one frame each time the organ runs, while a visitor's pointer circles and words are told */
function frames(seed, ticks) {
  const b = B.createBrain(seed); B.tell(b, ['river stone light', 'dragons and maps', 'a quiet garden', 'flip a coin'][seed % 4]); const out = [];
  for (let t = 0; t < ticks; t++) {
    const a = t * (0.01 + 0.004 * (seed % 5)); B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: t % 400 < 300 });
    if (t >= 200 && t % K.EVERY === 0) out.push(b.focus.x);
  }
  return out;
}
const mean = (v) => v.reduce((a, x) => a + x, 0) / v.length;
const r3 = (v) => Math.round(v * 1000) / 1000;

test('the bed is physics: with no bounce, more grip stops a thrown grain sooner, and grains settle on the floor inside the walls', () => {
  const reach = (mu) => { const Bd = K.makeBed(4, 'none'); Bd.g.forEach((p) => { p.e = 0; p.mu = mu; }); const xs = []; while (Bd.lives < 60) for (const l of K.stepBed(Bd, 0.05, 0.95)) xs.push(l.x); return mean(xs) - 0.05; };
  const lo = reach(0.25), mid = reach(0.5), hi = reach(0.75);
  assert.ok(lo > mid && mid > hi, 'reach by grip ' + [lo, mid, hi].map(r3));
  const Bd = K.makeBed(5, 'none'), ends = []; while (Bd.lives < 80) for (const l of K.stepBed(Bd, 0.95, 0.05)) ends.push(l.x);
  assert.ok(ends.every((x) => x > 0 && x < 1), 'inside the walls');
});

test('grains that take the gene from the nearer lander land nearer the aim than grains that pass it at random or not at all', () => {
  const rows = [];
  for (const seed of [1, 2, 3]) {
    const fr = frames(seed, 1400);
    const run = (mode) => { const Bd = K.makeBed(seed, mode), A = { aim: 0.5 }, errs = []; let n = 0; while (Bd.lives < 1500) { const pour = K.steer(A, fr[n++ % fr.length]); for (let k = 0; k < K.SUB; k++) for (const l of K.stepBed(Bd, pour, A.aim)) errs.push(l.err); } return { err: mean(errs.slice(-300)), transfers: Bd.transfers }; };
    const S = K.makeGrains(seed); let n = 0; while (S.bed.lives < 1500) { const pour = K.steer(S, fr[n++ % fr.length]); for (let k = 0; k < K.SUB; k++) { K.stepBed(S.ctl, pour, S.aim); K.stepBed(S.bed, pour, S.aim); } }
    const f = run('fit'), r = run('random'), z = run('none');
    rows.push({ fit: f.err, random: r.err, none: z.err, gain: K.gainOf(S), passed: f.transfers, still: z.transfers });
  }
  const say = JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r3(v)]))));
  assert.ok(rows.every((r) => r.fit < r.random), 'fit over random passing ' + say);
  assert.ok(rows.every((r) => r.fit < r.none), 'fit over no passing ' + say);
  assert.ok(rows.every((r) => r.gain > 1), 'the organ lands nearer than its control ' + say);
  assert.ok(rows.every((r) => r.passed > 0 && r.still === 0), 'genes pass only where the mode says ' + say);
});

test('it runs in the brain as one of twenty-two organs: its aim follows the focus, it is kept, and the self says so', () => {
  const b = B.createBrain(7); B.tell(b, 'river stone light');
  for (let t = 0; t < 3000; t++) { const a = t * 0.013; B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: true }); }
  assert.ok(B.ORGAN_IDS.includes('grains') && B.ORGAN_IDS.length === 22);
  assert.ok(b.grains.bed.lives >= 20 && b.runs.grains > 200, 'lives ' + b.grains.bed.lives + ' runs ' + b.runs.grains);
  assert.ok(b.board.grains && b.board.grains.lives === b.grains.bed.lives, JSON.stringify(b.board.grains));
  const self = B.selfSays(b).find((l) => /^Grains:/.test(l)) || '';
  assert.match(self, /^Grains: \d+ lives? of grains thrown toward where the focus has been, that pass their bounce and grip on where they touch, from the grain that lands nearer; (not yet enough lives to compare with grains that pass them at random\.|they land \d+\.\d times nearer than grains that pass them at random\.|they do not yet land nearer than grains that pass them at random\.)$/);
  // the aim follows the focus: held at the right, it moves right; held at the left, it moves left
  const S = K.makeGrains(3); for (let i = 0; i < 500; i++) K.steer(S, 0.9); const right = S.aim; for (let i = 0; i < 1000; i++) K.steer(S, 0.1);
  assert.ok(right > 0.6 && S.aim < right - 0.2, 'aim ' + right + ' then ' + S.aim);
  assert.equal(K.steer({ aim: 0.2 }, 0.2), 0.95, 'poured from the wall farther from the aim');
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('grains'));
  assert.deepEqual(K.genesOf(fresh.grains), K.genesOf(b.grains));
});

test('the orb shows only while the organ lands nearer than its control', () => {
  const b = B.createBrain(5); for (let t = 0; t < 60; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (gain) => { b.board.grains = { x: 0.5, y: 0.5, gain, lives: 200, tick: b.ticks }; return B.embodiment(b).some((o) => o.key === 'grains'); };
  assert.equal(orb(1.4), true);
  assert.equal(orb(0.9), false);
  assert.equal(orb(null), false);
});

test('kept genes of the wrong shape or range are refused and change nothing', () => {
  const a = K.makeGrains(3), k = JSON.parse(JSON.stringify(K.genesOf(a))), c = K.makeGrains(4), before = JSON.stringify(K.genesOf(c));
  const bad = [null, {}, { ...k, e: k.e.slice(1) }, { ...k, mu: k.mu.slice(1) }, { ...k, e: k.e.map(() => 0.95) }, { ...k, mu: k.mu.map(() => 1.5) },
    { ...k, mu: k.mu.map(() => -0.1) }, { ...k, e: k.e.map(() => 'x') }, { ...k, mu: k.mu.map(() => null) }, { ...k, lives: -1 }, { ...k, lives: 1.5 }];
  for (const v of bad) assert.equal(K.loadGenes(c, v), false, JSON.stringify(v).slice(0, 80));
  assert.equal(JSON.stringify(K.genesOf(c)), before);
  assert.equal(K.loadGenes(c, k), true);
  assert.deepEqual(K.genesOf(c).e, k.e);
});
