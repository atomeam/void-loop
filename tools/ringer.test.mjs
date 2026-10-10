// Ringer (frontier build-order step 5): the behaviour module alone (skills/ringer-rules.js, no DOM), the seeded looks
// (skills/figures.js marbleLook) and the routing (skills/ringer.js). The 3D ring runs the miniature contract in
// tools/test_3d.mjs. Run: node --test tools/ringer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/skills/ringer-rules.js';
import { marbleLook } from '../void-live-deploy/skills/figures.js';
import ringer, { ringerOf } from '../void-live-deploy/skills/ringer.js';

const targets = (s) => s.marbles.filter((m) => !m.shooter);
const momentum = (ms) => ms.reduce((p, m) => [p[0] + m.r ** 3 * m.vx, p[1] + m.r ** 3 * m.vy], [0, 0]);
const energy = (ms) => ms.reduce((e, m) => e + m.r ** 3 * (m.vx ** 2 + m.vy ** 2), 0);
const shoot = (s, power, at) => R.settle(R.flick(R.setPower(at ? R.aimAt(s, ...at) : s, power)));

test('a new game: 13 marbles in a cross inside the ring, the shooter at the edge facing the middle, nothing moving', () => {
  const s = R.create(42);
  assert.equal(targets(s).length, R.COUNT);
  assert.ok(targets(s).every(R.inRing), 'all 13 start inside the chalk line');
  assert.ok(targets(s).every((m) => m.x === 0 || m.y === 0), 'a cross');
  const sh = s.marbles[0];
  assert.ok(sh.shooter && !R.inRing(sh) && Math.abs(Math.hypot(sh.x, sh.y) - (R.RING + sh.r)) < 1e-12, 'the shooter knuckles down at the edge');
  assert.ok(Math.abs(s.angle - Math.atan2(-sh.y, -sh.x)) < 1e-12, 'aimed at the middle');
  assert.equal(R.moving(s), false); assert.equal(s.phase, 'aim'); assert.equal(s.shots, 0);
  assert.deepEqual(R.create(42), s, 'the same seed, the same game');
});

test('aim and power: aimAt points the shooter at the spot, power is clamped, neither works mid-roll or after the game', () => {
  const s = R.create(1), sh = s.marbles[0];
  assert.ok(Math.abs(R.aimAt(s, sh.x + 1, sh.y).angle) < 1e-12);
  assert.equal(R.setPower(s, 7).power, 1); assert.equal(R.setPower(s, -2).power, 0);
  const rolling = R.flick(s);
  assert.equal(rolling.phase, 'rolling'); assert.equal(rolling.shots, 1);
  assert.equal(R.aim(rolling, 1), rolling); assert.equal(R.setPower(rolling, 0.1), rolling); assert.equal(R.flick(rolling), rolling);
  assert.ok(Math.abs(Math.hypot(rolling.marbles[0].vx, rolling.marbles[0].vy) - R.speedFor(s.power)) < 1e-12);
});

test('a head-on hit between equal marbles hands the motion across; every collision keeps momentum and never makes energy', () => {
  const s = R.create(1);
  const two = { ...s, phase: 'rolling', marbles: [{ id: 0, r: R.MARBLE, x: -0.05, y: 0, vx: 1, vy: 0, out: false, shooter: true }, { id: 1, r: R.MARBLE, x: 0, y: 0, vx: 0, vy: 0, out: false, shooter: false }] };
  let n = two, p0 = momentum(two.marbles), e0 = energy(two.marbles), hit = false;
  for (let i = 0; i < 40 && !hit; i++) { const before = n; n = R.step(n, 1 / 240); hit = n.marbles[1].vx > 0; if (hit) { // compare across the collision step only (rolling friction is separate)
    const a = momentum(before.marbles), b = momentum(n.marbles), lost = R.DECEL / 240 * (R.MARBLE ** 3) * 2;
    assert.ok(Math.abs(a[0] - b[0]) <= lost + 1e-12, 'momentum kept through the hit');
  } }
  assert.ok(hit, 'they met');
  assert.ok(n.marbles[1].vx > n.marbles[0].vx * 5, 'the struck marble takes nearly all the speed (restitution ' + R.RESTITUTION + ')');
  assert.ok(energy(n.marbles) < e0, 'energy only goes down');
  assert.ok(Math.abs(momentum(n.marbles)[1]) < 1e-15 && p0[0] > 0);
});

test('a soft flick stops short of the cross and the shooter goes back to the edge; a hard one knocks marbles out', () => {
  const soft = shoot(R.create(3), 0.1);
  assert.equal(soft.phase, 'aim'); assert.equal(soft.out, 0); assert.equal(R.moving(soft), false);
  assert.ok(Math.abs(Math.hypot(soft.marbles[0].x, soft.marbles[0].y) - (R.RING + R.SHOOTER)) < 1e-9, 'a shot that got nothing goes back to the edge');
  const hard = shoot(R.create(3), 1);
  assert.ok(hard.out >= 1 && hard.shotOut === hard.out, 'knocked ' + hard.out + ' out');
  assert.ok(targets(hard).filter((m) => m.out).every((m) => Math.hypot(m.x, m.y) > R.RING + m.r), 'out means wholly over the line');
  assert.ok(R.inRing(hard.marbles[0]), 'it stayed in and got one: it shoots again from where it stopped');
  assert.match(R.summary(hard), /shoot again from where it stopped/);
});

test('the same shot always plays out the same (deterministic), and a game can be cleared', () => {
  assert.deepEqual(shoot(R.create(9), 0.85), shoot(R.create(9), 0.85));
  let s = R.create(5);
  for (let n = 0; n < 60 && !s.over; n++) { const m = targets(s).find((x) => !x.out); s = shoot(s, 1, [m.x, m.y]); }
  assert.ok(s.over && s.out === R.COUNT, 'cleared in ' + s.shots + ' shots');
  assert.match(R.summary(s), new RegExp('Ring cleared: all 13 marbles in ' + s.shots + ' shots'));
  assert.equal(R.flick(s), s, 'nothing to flick once the ring is clear');
});

test('step is pure: the state it was given never changes', () => {
  const s = R.flick(R.setPower(R.create(2), 1)), copy = JSON.parse(JSON.stringify(s));
  R.step(s, 0.05); R.settle(s);
  assert.deepEqual(s, copy);
});

test('looks: every marble is an individual from the game seed, the same seed gives the same marbles, the shooter is a worn agate', () => {
  const a = Array.from({ length: 14 }, (_, i) => marbleLook(11, i)), b = Array.from({ length: 14 }, (_, i) => marbleLook(11, i)), c = Array.from({ length: 14 }, (_, i) => marbleLook(12, i));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(new Set(a.map((x) => JSON.stringify(x))).size === 14, 'no two alike');
  assert.equal(a[0].kind, 'agate'); assert.ok(a[0].clarity < 0.3 && a[0].wear >= 0.35);
  for (const l of a.slice(1)) {
    assert.ok(['cats-eye', 'swirl', 'clearie'].includes(l.kind));
    assert.equal(l.vanes.length, { 'cats-eye': 3, swirl: 2, clearie: 0 }[l.kind]);
    assert.ok(l.clarity > 0.5 && l.clarity <= 1 && l.wear >= 0 && l.wear < 0.3);
  }
});

test('routing: "play marbles", "marbles", "shoot marbles", "ringer" open Ringer; star marbles stays with Aggravation; idioms and materials stay out', () => {
  for (const t of ringer.examples) assert.ok(ringerOf(t), t);
  for (const t of ringer.nearMisses) assert.equal(ringerOf(t), null, t);
  for (const t of ['Play marbles!', 'shoot some marbles', "let's play ringer", 'play marbles with me']) assert.ok(ringerOf(t), t);
});

test('drag to flick: the shot goes opposite the pull, power grows with the pull up to PULL_MAX, and nothing moves until the flick', () => {
  const s = R.create(4), sh = s.marbles[0];
  const back = R.pull(s, sh.x, sh.y - R.PULL_MAX / 2); // pulled straight back, away from the middle
  assert.ok(Math.abs(back.angle - Math.PI / 2) < 1e-12, 'aimed at the middle, opposite the pull');
  assert.ok(Math.abs(back.power - 0.5) < 1e-12);
  assert.equal(R.pull(s, sh.x - 1, sh.y).power, 1, 'a long pull is full power, not more');
  assert.ok(Math.abs(R.pull(s, sh.x + 0.01, sh.y).angle - Math.PI) < 1e-12, 'pulled to the right shoots left');
  assert.equal(R.pull(s, sh.x, sh.y), s, 'no pull, no change');
  assert.equal(back.phase, 'aim'); assert.equal(R.moving(back), false);
  assert.ok(R.pullLength(s, sh.x, sh.y - 0.005) < R.PULL_MIN, 'a tiny pull is under the threshold');
  const shot = R.settle(R.flick(R.pull(s, sh.x, sh.y - R.PULL_MAX)));
  assert.equal(shot.shots, 1); assert.ok(shot.out >= 1, 'a full pull straight back breaks the cross');
  assert.equal(R.pull(R.flick(s), 0, 0).phase, 'rolling', 'no pulling mid-roll');
});
