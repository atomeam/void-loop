// field-fluid-orbs: F-321, agent-fluid memory orbs (lib/field-fluid-orbs.js), the law with numbers: orientation leans the flow, a density
// peak becomes an orb, a sealed orb loads back to the same SHA-256, the orbs and the card's chrome follow the field, and the mind never
// gets worse. Run: node --test tools/field-fluid-orbs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../void-live-deploy/lib/field-fluid-orbs.js';
import skill from '../void-live-deploy/skills/agent-fluid-memory-orbs.js';
import fam from '../void-live-deploy/skills/mind-field.js';
import { modeAsk } from '../void-live-deploy/lib/mind-field-modes.js';

const circle = (i) => { const a = i / 30; return { over: true, down: i % 40 < 6, x: 0.5 + 0.3 * Math.cos(a), y: 0.5 + 0.3 * Math.sin(a) }; };
const run = (seed, n = 200, input = circle) => { const s = F.create(seed); for (let i = 0; i < n; i++) F.step(s, 1 / 60, input(i)); return s; };
const meanU = (s) => s.u.reduce((a, b) => a + b, 0) / s.u.length, meanV = (s) => s.v.reduce((a, b) => a + b, 0) / s.v.length;

test('seeded, bounded and fast: the same seed makes the same field, every metric stays in 0..1, a step is a small part of a frame', () => {
  const a = run(3), b = run(3);
  assert.deepEqual(Array.from(a.d), Array.from(b.d)); assert.deepEqual(F.metrics(a), F.metrics(b));
  assert.notDeepEqual(Array.from(run(4).d), Array.from(a.d), 'another seed, another field');
  const m = F.metrics(a); for (const k of ['entropy', 'activity', 'consensus', 'cx', 'cy', 'vorticity', 'peak']) assert.ok(m[k] >= 0 && m[k] <= 1, k + ' ' + m[k]);
  for (const v of a.d) assert.ok(v >= 0 && v <= F.DMAX);
  assert.ok(m.vorticity > 0.1 && m.entropy > 0.2, 'a swirling field, not a flat sheet: ' + JSON.stringify(m));
  const s = F.create(1), t0 = performance.now(); for (let i = 0; i < 400; i++) F.step(s, 1 / 60, circle(i)); assert.ok((performance.now() - t0) / 400 < 4, 'under 4 ms a step');
});

test('orientation biases the force: tilt leans the whole flow its way, and no tilt leaves no drift', () => {
  const still = run(5, 60, () => ({})), right = run(5, 60, () => ({ tiltX: 1 })), down = run(5, 60, () => ({ tiltY: 1 })), left = run(5, 60, () => ({ tiltX: -0.5 }));
  assert.ok(Math.abs(meanU(still)) < 0.01 && Math.abs(meanV(still)) < 0.01, 'no tilt, no drift');
  assert.ok(meanU(right) > 0.3 && Math.abs(meanV(right)) < 0.05, 'tilted right, the flow goes right: ' + meanU(right));
  assert.ok(meanV(down) > 0.3, 'tilted toward you, the flow goes down'); assert.ok(meanU(left) < -0.15, 'half left, half the push');
  const s = F.create(5); F.policy(s, 0, 1, -1); assert.equal(s.inp[7], 1); assert.equal(s.inp[8], -1); // the agents feel the tilt too
  const moved = run(5, 30, () => ({ tiltX: 1 })), stay = run(5, 30, () => ({}));
  assert.notDeepEqual(Array.from(moved.ax), Array.from(stay.ax), 'the agents ride the tilted flow');
});

test('a density peak spawns an orb where it is, one per peak, none near an orb already there, and it fades when the peak is gone', () => {
  const s = F.create(9); s.d.fill(0);
  F.splat(s, 12, 20, 0, 0, 3, 2); F.splat(s, 13, 21, 0, 0, 0.5, 1); // one peak (a bump beside it is not a second one)
  const born = F.spawnOrbs(s); assert.equal(born.length, 1); assert.equal(born[0].x, 12); assert.equal(born[0].y, 20);
  assert.equal(F.spawnOrbs(s).length, 0, 'the same peak does not make a second orb');
  F.splat(s, 36, 8, 0, 0, 2.5, 2); const two = F.spawnOrbs(s); assert.equal(two.length, 1); assert.deepEqual([two[0].x, two[0].y], [36, 8]);
  F.splat(s, 4, 4, 0, 0, 0.5, 2); assert.equal(F.spawnOrbs(s).length, 0, 'below the orb line, no orb');
  const t = F.create(9); t.d.fill(0); F.splat(t, 24, 18, 0, 0, 3, 2); F.step(t, 1 / 60, {}); assert.ok(t.orbs.length >= 1, 'step spawns them on its own');
  t.d.fill(0); for (let i = 0; i < F.ORB_LIFE + 20; i++) F.stepOrbs(t, 1); assert.equal(t.orbs.length, 0, 'the peak gone, the orb goes');
  const many = run(3, 200); assert.ok(many.orbs.length >= 1 && many.orbs.length <= F.MAX_ORBS, 'a live field keeps between one and ' + F.MAX_ORBS + ' orbs: ' + many.orbs.length);
});

test('left alone, the agents pool the fluid themselves: orbs are born with no pointer, and an orb outlives its peak long enough to tap', () => {
  for (let seed = 1; seed <= 6; seed++) { const s = F.create(seed); let first = -1; for (let i = 0; i < 1800 && first < 0; i++) { F.step(s, 1 / 60, {}); if (s.orbs.length) first = i; } assert.ok(first >= 0, 'seed ' + seed + ': an orb within 30 s untouched'); }
  let o = F.evolveOrbs({ seed: 5 }); for (let g = 0; g < 6; g++) o = F.evolveOrbs({ pop: o.pop, seed: 5, gen: o.gen });
  const s = F.create(3, o.best); let n = 0; for (let i = 0; i < 2400; i++) { F.step(s, 1 / 60, {}); if (i >= 600) n += s.orbs.length; }
  assert.ok(n / 1800 >= 2, 'an evolved mind keeps orbs going untouched: ' + (n / 1800).toFixed(1));
  assert.ok(F.ORB_LIFE / 60 >= 2.5, 'an orb lingers about 3 s after its peak goes, time enough to tap it');
});

test('seal then load gives the same SHA-256: the snapshot stamps back into a fresh field and seals to the same hash', async () => {
  const s = run(3, 200), o = s.orbs[0]; assert.ok(o, 'an orb to seal');
  const a = F.sealOrbSync(s, o); assert.match(a.hash, /^[0-9a-f]{64}$/); assert.equal(a.snap.bytes.length, 64);
  assert.equal((await F.sealOrb(s, o)).hash, a.hash, 'crypto.subtle and the pure SHA-256 agree');
  assert.ok(F.verifySnap(a.snap, a.hash));
  const kept = JSON.parse(JSON.stringify({ hash: a.hash, orb: a.snap })); // what IndexedDB gives back
  const fresh = F.create(77), back = F.loadOrb(fresh, kept.orb, kept.hash);
  assert.deepEqual(F.params(fresh).genome, F.params(s).genome, 'the seal\'s genome is the mind\'s seed again');
  assert.equal(back.sealed, a.hash); assert.equal(F.sealOrbSync(fresh, back).hash, a.hash, 'loaded, it seals to the same hash');
  assert.ok(fresh.orbs.includes(back));
  const bad = { ...kept.orb, bytes: kept.orb.bytes.map((b, i) => (i === 9 ? (b + 1) % 256 : b)) }; assert.equal(F.verifySnap(bad, a.hash), false, 'one byte off, not the same memory');
  assert.ok(!/"x"|"y"|px|py|path/.test(F.orbText(a.snap)) && !/px|py/.test(JSON.stringify(F.params(s))), 'a seal keeps the field, never the pointer');
});

test('morph follows the metrics: an orb grows with the density under it, turns with the swirl, fades as its peak goes; the chrome follows entropy and vorticity', () => {
  const base = { mass: 1, vort: 0.05, low: 0 }, M = F.orbMorph;
  assert.ok(M({ ...base, mass: 3 }).scale > M(base).scale && M({ ...base, mass: 3 }).opacity >= M(base).opacity, 'denser, bigger and brighter');
  assert.notEqual(M({ ...base, vort: 0.4 }).hue, M(base).hue, 'more swirl, another hue');
  assert.ok(M({ ...base, low: 60 }).opacity < M(base).opacity, 'fading');
  for (const o of [base, { mass: 9, vort: -5, low: 999 }, {}]) { const m = M(o); assert.ok(m.scale >= 0.6 && m.scale <= 2.2 && m.opacity >= 0 && m.opacity <= 1 && m.hue >= 0 && m.hue < 360, JSON.stringify(m)); }
  const lo = F.chromeOf({ entropy: 0.1, vorticity: 0.1 }), hi = F.chromeOf({ entropy: 0.9, vorticity: 0.9 });
  assert.ok(+hi['--fo-hue'] > +lo['--fo-hue'] && +hi['--fo-edge'] > +lo['--fo-edge'] && +hi['--fo-vorticity'] > +lo['--fo-vorticity'] && +hi['--fo-entropy'] > +lo['--fo-entropy']);
  const s = run(3, 200); for (const o of s.orbs) { const m = M(o); assert.ok(m.scale > 0.6, 'a live orb sits on density'); }
});

test('the hand-off: an orb hands its own colour to the colour page, the last sealed orb first, then the densest, and none with no orb', () => {
  assert.equal(F.orbHex({ sealed: 'a' }), '#f5be3d', 'a sealed orb is gold, hsl(42, 90%, 60%)');
  assert.equal(F.orbHex({ mass: 2, vort: 0.2 }), '#b83df5', 'hue 280 from its swirl'); assert.match(F.orbHex({}), /^#[0-9a-f]{6}$/);
  const s = F.create(3); s.orbs = [{ id: 1, mass: 1 }, { id: 2, mass: 3, vort: 0.4 }];
  assert.equal(F.handOrb(s).id, 2, 'no seal: the densest'); assert.equal(F.orbColorLink(s), '/color/?c=' + F.orbHex(s.orbs[1]).slice(1));
  s.orbs.push({ id: 3, mass: 0.5, sealed: 'x', sealedAt: 5 }, { id: 4, mass: 0.2, sealed: 'y', sealedAt: 9 });
  assert.equal(F.handOrb(s).id, 4, 'the last sealed, however faint'); assert.equal(F.orbColorLink(s), '/color/?c=f5be3d');
  assert.equal(F.orbColorLink(F.create(1)), null); assert.equal(F.orbColorLink({}), null);
  const live = run(3, 200); assert.match(F.orbColorLink(live), /^\/color\/\?c=[0-9a-f]{6}$/, 'a live field hands a colour');
});

test('the mind: one generation is seeded, keeps its best, and its best never gets worse', () => {
  const a = F.evolveOrbs({ seed: 3 }), b = F.evolveOrbs({ seed: 3 });
  assert.deepEqual(a.best, b.best); assert.equal(a.pop.length, F.POP); assert.equal(Object.keys(a.best).length, F.GENES); assert.equal(a.gen, 1);
  let o = a; for (let g = 0; g < 3; g++) { const n = F.evolveOrbs({ pop: o.pop, seed: 3, gen: o.gen }); assert.ok(n.fitness >= o.fitness - 1e-9, 'never worse'); o = n; }
  const s = F.create(3, o.best); assert.deepEqual(F.genomeOf(s), Object.fromEntries(Object.entries(o.best).map(([k, v]) => [k, Math.round(Math.max(-2, Math.min(2, v)) * 1e4) / 1e4])));
  assert.ok(o.fitness > 0 && o.fitness <= 1);
});


test('the skill: its asks open the memory orbs card, look-alikes do not, and it is a Mind Field mode', () => {
  for (const a of [...skill.examples, 'Show me the memory orbs!', 'open agent fluid memory orbs']) { assert.ok(skill.match(a.toLowerCase(), a), a); assert.equal(fam.part(a.toLowerCase(), a), a.startsWith('mind field') ? 'mind-field-mode' : 'agent-fluid-memory-orbs', a); }
  for (const a of [...skill.nearMisses, 'memory', 'fluid', 'crystal ball']) assert.equal(skill.match(a.toLowerCase(), a), false, a);
  assert.equal(modeAsk('mind field orbs').id, 'agent-fluid-memory-orbs');
  assert.ok(skill.stageKinds['agent-fluid-memory-orbs'] && fam.stageKinds['agent-fluid-memory-orbs']);
});
