import test from 'node:test';
import assert from 'node:assert/strict';
import * as Z from '../void-live-deploy/lib/zorbleflux.js';
import game from '../void-live-deploy/skills/zorbleflux.js';

const play = (seed, opts, pick, frames = 5000) => { const s = Z.create(seed, opts); for (let i = 0; i < frames && !s.over; i++) Z.step(s, 0.016, pick(s, i)); return s; };
const chase = (s) => ({ x: s.motes[0].x, y: s.motes[0].y });
const snap = (s) => JSON.stringify({ z: s.zorb, m: s.motes, b: s.bleeds, sc: s.score, t: s.t });

test('the same seed and the same moves give the same round; another seed differs', () => {
  assert.equal(snap(play(11, {}, chase)), snap(play(11, {}, chase)));
  assert.notEqual(snap(play(11, {}, chase)), snap(play(12, {}, chase)));
  assert.deepEqual(Z.curl(3, 50, 60, 1), Z.curl(3, 50, 60, 1));
});

test('motes, bleeds and the zorb stay in bounds all round, slow or not', () => {
  for (const slow of [false, true]) {
    const s = Z.create(5, { slow });
    for (let i = 0; i < 3000 && !s.over; i++) {
      Z.step(s, 0.016, { x: (i * 37) % Z.W, y: (i * 91) % Z.H });
      for (const m of s.motes) assert.ok(m.x >= 0 && m.x <= Z.W && m.y >= 0 && m.y <= Z.H, 'mote ' + m.x + ',' + m.y);
      for (const b of s.bleeds) assert.ok(b.x >= b.r - 1e-6 && b.x <= Z.W - b.r + 1e-6 && b.y >= b.r - 1e-6 && b.y <= Z.H - b.r + 1e-6);
      assert.ok(s.zorb.x >= s.zorb.r - 1e-6 && s.zorb.x <= Z.W - s.zorb.r + 1e-6 && s.zorb.y >= s.zorb.r - 1e-6 && s.zorb.y <= Z.H - s.zorb.r + 1e-6);
    }
  }
});

test('collecting a mote grows the zorb, raises the multiplier and scores', () => {
  const s = Z.create(2); s.bleeds.length = 0; s.motes[0] = { x: s.zorb.x, y: s.zorb.y }; const r0 = s.zorb.r;
  Z.step(s, 0.016, {});
  assert.equal(s.collected, 1); assert.equal(s.score, 10); assert.ok(s.zorb.r > r0); assert.equal(s.mult, 1 + Z.MULT_STEP); assert.equal(s.motes.length, Z.MOTES);
  s.motes[0] = { x: s.zorb.x, y: s.zorb.y }; Z.step(s, 0.016, {});
  assert.equal(s.score, 10 + Z.worth(1 + Z.MULT_STEP)); // the second mote is worth more
  const big = Z.create(2); big.bleeds.length = 0; big.zorb.r = Z.R_MAX; big.motes[0] = { x: big.zorb.x, y: big.zorb.y }; Z.step(big, 0.016, {}); assert.equal(big.zorb.r, Z.R_MAX);
});

test('a bleed shrinks the zorb, drops the multiplier, then leaves it safe for a moment', () => {
  const s = Z.create(2); s.motes.length = 0; s.mult = 3; s.zorb.r = 15; s.bleeds = [{ x: s.zorb.x, y: s.zorb.y, vx: 0, vy: 0, r: 30 }];
  Z.step(s, 0.016, {});
  assert.equal(s.hits, 1); assert.equal(s.zorb.r, 15 - Z.SHRINK); assert.equal(s.mult, 2); assert.ok(s.hurt > 0);
  Z.step(s, 0.016, {}); assert.equal(s.hits, 1, 'no second hit while safe');
  s.zorb.r = Z.R_MIN; s.hurt = 0; Z.step(s, 0.016, {}); assert.equal(s.zorb.r, Z.R_MIN, 'never below the floor'); assert.equal(s.mult, 1);
});

test('the round ends at 45 seconds of game time, not before, and a frame never jumps', () => {
  const s = Z.create(9);
  Z.step(s, 100, {}); assert.ok(s.t <= 0.05 + 1e-9, 'one frame is capped at 50 ms'); assert.equal(s.over, false);
  let frames = 0; while (!s.over && frames < 100000) { Z.step(s, 0.05, {}); frames++; }
  assert.equal(s.over, true); assert.equal(s.t, Z.ROUND); assert.equal(Z.ROUND, 45);
  const sc = s.score; Z.step(s, 0.05, { x: 1, y: 1 }); assert.equal(s.score, sc); assert.equal(s.t, Z.ROUND);
});

test('score math: a chasing player scores, standing still scores nothing, keys steer too', () => {
  const chaser = play(7, {}, chase), still = play(7, {}, () => ({}));
  assert.ok(chaser.score > still.score);
  const k = Z.create(1); const x0 = k.zorb.x; Z.step(k, 0.016, { dx: 1, dy: 0 }); assert.ok(k.zorb.x > x0);
  assert.equal(Z.worth(1), 10); assert.equal(Z.worth(5), 50);
});

test('reduced motion: the bleeds drift slower', () => {
  const a = Z.create(4, { slow: false }), b = Z.create(4, { slow: true }), a0 = Z.create(4);
  for (let i = 0; i < 50; i++) { Z.step(a, 0.016, {}); Z.step(b, 0.016, {}); }
  const d = (s) => Math.hypot(s.bleeds[0].x - a0.bleeds[0].x, s.bleeds[0].y - a0.bleeds[0].y);
  assert.ok(d(a) > d(b) * 1.5, d(a) + ' vs ' + d(b));
});

test('best score: only a higher whole score replaces it, junk storage is safe', () => {
  assert.deepEqual(Z.bestOf(0, 120), { best: 120, isNew: true });
  assert.deepEqual(Z.bestOf('120', 90), { best: 120, isNew: false });
  assert.deepEqual(Z.bestOf(120, 120), { best: 120, isNew: false });
  assert.deepEqual(Z.bestOf(null, 0), { best: 0, isNew: false });
  for (const junk of [undefined, 'abc', -5, NaN, '9e99']) assert.equal(Z.parseBest(junk), 0);
  assert.equal(Z.parseBest('77'), 77);
});

test('the asks route to the game; zorb, flux capacitor and what is flux do not', () => {
  for (const a of ['zorbleflux', 'play zorbleflux', 'a zorbleflux game', 'what is a zorbleflux', 'tell me about zorbleflux', "what's a zorbleflux?"]) assert.ok(game.match(a.toLowerCase(), a), a);
  assert.equal(game.zorbleOf('what is a zorbleflux').kind, 'about'); for (const q of ['do you know zorbleflux', 'Do you know what a zorbleflux is?', 'have you heard of zorbleflux', 'are you familiar with zorbleflux', 'who is zorbleflux']) assert.equal(game.zorbleOf(q).kind, 'about', q); for (const q of ['do you know the flux capacitor', 'do you know zorb', 'do you know chess']) assert.equal(game.zorbleOf(q), null, q); assert.equal(game.zorbleOf('play zorbleflux').kind, 'game');
  for (const a of ['zorb', 'flux capacitor', 'what is flux', 'play chess', 'zorbleflux recipe']) assert.ok(!game.match(a.toLowerCase(), a), a);
  assert.match(Z.ABOUT, /154 times/);
});
