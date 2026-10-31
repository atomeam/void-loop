// brain-gardener: F215's codec retina gardener (atomeam/a-to-mind.com drafts/F215) is a real organ of Verse Brain, not a separate demo
// (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). F215 watched 16 patches of a Gray-Scott world with a
// video encoder each and tended them toward the edge of chaos. Here the encoder is a small coder that runs anywhere: it predicts each
// patch from the last one (9 shifts), LZ78-codes what it got wrong, and calls the bits its surprise. The band between a still patch and
// a noise patch is the edge of chaos; the gardener seeds or steers a patch's feed and kill toward regimes measured on this tissue, and
// learns per patch which act brought a patch back into the band.
// It tends the whole garden first: a steer eases back each blink unless it keeps paying, and when the whole tissue is nearly dead or
// nearly full every steer is halved (and the quietest patches seeded), so tending patches never costs the field its life or variety.
// Measured (16 patches, second half of each run, the same brain watching but not acting as the baseline): 8 brains over 3000 ticks,
// 9.2 patches in the band with it against 3.8 (every brain better, 7.5 to 10.5 against 2.9 to 5.9); 6 new brains over 1500 ticks,
// 9.0 against 3.9 (every brain better). The field's lowest entropy after warm-up, 8 brains over 1800 ticks: 0.50 with it against
// 0.38 without (mean 0.611 against 0.596). Run:
// node --test tools/brain-gardener.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as G from '../void-live-deploy/lib/brain-gardener.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';

const W = 64, H = 48;
// the coder reads the activity layer as 8 levels a cell (as blink() does)
const field = (fill) => { const a = new Uint8Array(W * H); for (let i = 0; i < a.length; i++) a[i] = Math.max(0, Math.min(G.LEVELS - 1, Math.round(fill(i % W, Math.floor(i / W))))); return a; };

test('the coder: a still patch costs few bits, a noise patch many, a patch that only moved costs little, and the band lies between', () => {
  const still = field(() => 2), r = rng(7), noise = field(() => r() * 8 - 0.5), noise2 = field(() => r() * 8 - 0.5);
  const blob = (cx) => field((x, y) => 7 - Math.hypot(x - cx, y - 6) * 1.2);
  const s = G.patchBits(still, still, 0).bits, n = G.patchBits(noise2, noise, 0).bits, moved = G.patchBits(blob(9), blob(8), 0);
  assert.ok(s < G.BAND[0], 'still ' + s); assert.ok(n > G.BAND[1], 'noise ' + n);
  assert.ok(moved.bits < n && moved.moved > 0, JSON.stringify(moved));
  assert.ok(G.BAND[0] < G.BAND[1]);
});

test('kept gardening comes back, and a record of the wrong shape or range is refused and changes nothing', () => {
  const a = G.makeGardener(3); a.df[2] = 0.004; a.dk[5] = -0.002; a.q[1][0][2] = 0.3; a.prior[0][1] = 0.2;
  const k = JSON.parse(JSON.stringify(G.gardenOf(a))), b = G.makeGardener(4);
  assert.equal(G.loadGarden(b, k), true);
  assert.deepEqual(G.gardenOf(b), G.gardenOf(a));
  const c = G.makeGardener(5), before = JSON.stringify(G.gardenOf(c));
  for (const bad of [null, {}, { ...k, df: k.df.slice(1) }, { ...k, dk: k.dk.map(() => 9) }, { ...k, q: k.q.slice(2) }, { ...k, prior: [[1]] }]) assert.equal(G.loadGarden(c, bad), false);
  assert.equal(JSON.stringify(G.gardenOf(c)), before);
});

/** one brain for T ticks with the gardener acting or only watching: patches in the band, averaged over the second half */
function run(seed, on, T) {
  const b = B.createBrain(seed); b.gardener.on = on; B.tell(b, ['river stone light', 'dragons and maps', 'a quiet garden'][seed % 3]);
  let sum = 0, n = 0;
  for (let t = 0; t < T; t++) {
    const a = t * 0.03 + seed; B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.5 + 0.3 * Math.sin(a * 1.3), over: (t % 900) < 500 });
    if (t >= T / 2 && t % 20 === 0) { sum += b.gardener.inBand; n++; }
  }
  return { inBand: sum / n, b };
}

// The lowest variety a tissue reaches is chaotic: one more organ in the brain moves it a lot on a single brain. Measured on 8 brains
// (seeds 1-8, 1800 ticks, no visitor), before and after organ 18: while it gardens the tissue never collapsed (lowest entropy under 0.12)
// on any brain, while only watching it collapsed on 2 (then 1) of them; the mean entropy with and without gardening stayed within 0.04.
// Seed 3 is a brain that collapses when only watched, so it is the one this check uses.
test('it never costs the field: while it gardens the tissue does not collapse, on a brain that collapses when only watched', () => {
  const low = (seed, on) => { const b = B.createBrain(seed); b.gardener.on = on; let m = 1;
    for (let t = 0; t < 1800; t++) { B.stepBrain(b, {}); if (t > 300 && t % 10 === 0) m = Math.min(m, b.metrics.entropy); }
    return { m, b }; };
  const seeds = [2, 3], on = seeds.map((s) => low(s, true)), off = low(3, false);
  on.forEach((r, i) => { assert.ok(r.m > 0.12, 'seed ' + seeds[i] + ' lowest entropy ' + r.m); assert.ok(r.b.gardener.thoughts > 0); });
  assert.ok(off.m < 0.12, 'seed 3 only watching should collapse: lowest entropy ' + off.m);
});

test('in the brain it keeps more patches at the edge of chaos than the same brain only watching, on every brain tried', () => {
  const seeds = [21, 22, 23], on = seeds.map((s) => run(s, true, 1200)), off = seeds.map((s) => run(s, false, 1200));
  const mean = (r) => r.reduce((a, x) => a + x.inBand, 0) / r.length;
  seeds.forEach((s, i) => assert.ok(on[i].inBand > off[i].inBand, 'seed ' + s + ': ' + on[i].inBand + ' vs ' + off[i].inBand));
  assert.ok(mean(on) > mean(off) + 3, mean(on) + ' vs ' + mean(off));
  const b = on[0].b, self = B.selfSays(b).find((l) => /^Gardener:/.test(l)) || '';
  assert.ok(B.ORGAN_IDS.includes('gardener') && B.ORGAN_IDS.length === 23);
  assert.ok(b.runs.gardener > 100, 'runs ' + b.runs.gardener);
  assert.match(self, /^Gardener: \d+ of 16 patches at the edge of chaos \(\d+ too still, \d+ too wild\); it tended them \d+ times?\./);
  assert.ok(b.gardener.thoughts > 0 && Object.values(G.gardenerOf(b.gardener).acts).reduce((a, v) => a + v, 0) > 0);
  const k = B.knowledgeOf ? B.knowledgeOf(b) : null;
  if (k) { const fresh = B.createBrain(99); assert.ok(B.loadKnowledge(fresh, JSON.parse(JSON.stringify(k))).includes('gardener')); }
});
