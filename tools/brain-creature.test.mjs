// brain-creature: F304's Lenia creature (atomeam/a-to-mind.com drafts/F304-lenia-gait-evolver) is a real organ of Verse Brain, not a
// separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). It walks to a target that moves, it gets
// better at it by evolving its own physics while it lives, it runs in the brain's scheduler toward the attention's focus, it writes where
// it is into the one workspace, and its evolved genome is kept between visits. Run: node --test tools/brain-creature.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as L from '../void-live-deploy/lib/brain-creature.js';

const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
/** how well a genome follows a target that jumps, on seeds it never learned on: mean score and how many stayed alive */
const judge = (g, seeds, T) => { const f = seeds.map((s) => L.follow(g, s, T, 100)); return { mean: avg(f), alive: f.filter((v) => v > -0.5).length }; };
const UNSEEN = Array.from({ length: 16 }, (_, i) => 501 + i);

test('it really walks where it is sent: the starting genome follows a moving target, random physics die', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => 601 + i), start = judge(L.START, seeds, 300);
  assert.ok(start.alive >= 9, `START stays alive on ${start.alive} of 12`);
  assert.ok(start.mean > 0.8, `START comes closer to the target (${start.mean.toFixed(2)} cells per 10 steps)`);
  const r = L.stream(77);
  for (let i = 0; i < 3; i++) { const g = Array.from({ length: L.GENES }, () => r()), rand = judge(g, seeds, 300); assert.ok(rand.mean < 0 && rand.alive <= 2, `random genome ${i}: ${rand.mean.toFixed(2)}, ${rand.alive} alive`); }
});

test('it learns while it lives: 20 generations of online evolution make it follow better on seeds it never saw', () => {
  const before = judge(L.START, UNSEEN, 600);
  for (const seed of [1, 2]) {
    const C = L.makeCreature(seed, L.START), r = L.stream(seed + 100); let tx = 32, ty = 24;
    while (C.gens < 20) { if (C.steps % 100 === 0) { tx = r() * B.GW; ty = r() * B.GH; } L.live(C, tx, ty, 1); }
    assert.ok(C.updates > 5, `seed ${seed}: the mean moved ${C.updates} times`);
    assert.notDeepEqual(C.mean, L.START, 'the genome changed');
    const after = judge(C.mean, UNSEEN, 600);
    assert.ok(after.mean > before.mean + 0.2, `seed ${seed}: ${before.mean.toFixed(2)} before, ${after.mean.toFixed(2)} after`);
    assert.ok(after.alive >= before.alive, `seed ${seed}: ${after.alive} alive after, ${before.alive} before`);
  }
});

test('it is an organ of the one brain: it walks toward the focus, writes into the shared input layer, and has a body on the card', () => {
  assert.ok(B.ORGAN_IDS.includes('creature'));
  const b = B.createBrain(11); B.ask(b, 'lighthouse harbor fog');
  for (let t = 0; t < 300; t++) B.stepBrain(b, { x: 0.3 + 0.001 * t, y: 0.6, over: t < 150 });
  assert.ok(b.runs.creature > 0, 'the scheduler ran it');
  const k = b.ws.organs.indexOf('creature');
  assert.ok(k >= 0 && b.ws.writes[k] > 0, 'it wrote into the workspace under its own name');
  assert.ok(b.board.creature && Number.isFinite(b.board.creature.x) && Number.isFinite(b.board.creature.gen));
  assert.ok(b.creature.steps > 0 && b.creature.w.body.m > 0, 'it has a living body');
  assert.ok(B.selfSays(b).some((l) => /^Creature: generation \d+, /.test(l)), 'it says what it is doing');
  const orb = B.embodiment(b).find((e) => e.key === 'creature'); assert.ok(orb && orb.organ === 'creature', 'it has a body on the card');
  // drag it to the corner across from where the brain attends, so it lands far from the focus whatever region won the attention
  const tx = b.focus.x < 0.5 ? 0.85 : 0.15, ty = b.focus.y < 0.5 ? 0.8 : 0.2;
  B.dragTo(b, orb, tx, ty);
  assert.ok(L.distTo(b.creature.x, b.creature.y, tx * B.GW, ty * B.GH) < 1.5, 'the body goes where it is dragged');
  assert.ok(b.creature.w.body.m > 0, 'and it is still alive there');
  const d = () => L.distTo(b.creature.x, b.creature.y, b.focus.x * B.GW, b.focus.y * B.GH), far = d();
  for (let t = 0; t < 400; t++) B.stepBrain(b, {});
  assert.ok(far > 20 && d() < 3, `dragged ${far.toFixed(1)} cells from the focus, it walked back to ${d().toFixed(1)}`);
});

test('what it evolved is kept between visits, and a bad record leaves it as it is', () => {
  const a = B.createBrain(4); a.creature.mean = [0.4, 0.5, 0.6, 0.7, 0.3, 0.2];
  const kept = structuredClone(B.knowledgeOf(a));
  assert.ok(Array.isArray(kept.creature) && kept.creature.length === L.GENES && kept.creature.every(Number.isFinite), 'kept as numbers only');
  const b = B.createBrain(5); assert.ok(B.loadKnowledge(b, kept).includes('creature'));
  assert.deepEqual(b.creature.mean, a.creature.mean);
  const c = B.createBrain(6), before = c.creature.mean.slice();
  for (const bad of [[1, 2], kept.creature.map(() => 9), kept.creature.map(() => -1), kept.creature.map(() => 'x')]) {
    assert.ok(!B.loadKnowledge(c, { ...kept, creature: bad }).includes('creature')); assert.deepEqual(c.creature.mean, before);
  }
});
