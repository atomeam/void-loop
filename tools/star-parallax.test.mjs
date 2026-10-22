// The stars follow the flying eye (void-live-deploy/lib/star-parallax.js; owner, 2026-10-18: "you cant tell you are flying rhe
// stars dont move"): each star layer slides a fraction of the camera's travel, wraps like a tile, and the near stars streak.
// Run: node --test tools/star-parallax.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAR, NEAR, DRIFT, STREAK_MAX, layerView, placeAxis, streakOf } from '../void-live-deploy/lib/star-parallax.js';
import { HOME, zoomAt, fly } from '../void-live-deploy/lib/stage-camera.js';

const W = 1280, H = 800;

test('home is exactly rest, for both layers and under reduced motion', () => {
  for (const d of [FAR, NEAR]) for (const still of [false, true]) assert.deepEqual(layerView(HOME, d, W, H, { still }), { ox: 0, oy: 0, s: 1 });
  assert.deepEqual(layerView(null, NEAR, W, H), { ox: 0, oy: 0, s: 1 }, 'no camera is rest');
});

test('flying right slides both layers left, the near one more than the far one (0.4 and 0.15 of the travel)', () => {
  const cam = { x: -500, y: 120, z: 1 }; // the stage slid 500 px left and 120 down: the eye went right and up
  const far = layerView(cam, FAR, W, H), near = layerView(cam, NEAR, W, H);
  assert.equal(far.ox, -75); assert.equal(near.ox, -200); assert.equal(far.oy, 18); assert.equal(near.oy, 48);
  assert.ok(Math.abs(near.ox) > Math.abs(far.ox) && far.s === 1 && near.s === 1);
  // held D (right; the original controls came back in cc841604) for half a second through the real flight maths: both layers moved, the near one further
  let c = { ...HOME }, v = { x: 0, y: 0 }; for (let i = 0; i < 30; i++) ({ cam: c, vel: v } = fly(c, v, { d: true }, 1 / 60));
  const f2 = layerView(c, FAR, W, H), n2 = layerView(c, NEAR, W, H);
  assert.ok(n2.ox < f2.ox && f2.ox < 0, JSON.stringify({ c, f2, n2 }));
});

test('zooming at the middle swells the layers (the far one less) without sliding them; zooming out shrinks them', () => {
  const panned = { x: -300, y: 40, z: 1 }, before = layerView(panned, NEAR, W, H);
  const zin = zoomAt(panned, 3, W / 2, H / 2), n = layerView(zin, NEAR, W, H), f = layerView(zin, FAR, W, H);
  assert.ok(Math.abs(n.ox - before.ox) < 1e-6 && Math.abs(n.oy - before.oy) < 1e-6, JSON.stringify({ before, n }));
  assert.ok(n.s > f.s && f.s > 1 && n.s < 1.3, JSON.stringify({ n, f }));
  const out = layerView(zoomAt(HOME, 0.25, W / 2, H / 2), NEAR, W, H);
  assert.ok(out.s < 1 && out.s > 0.7 && out.ox === 0 && out.oy === 0, JSON.stringify(out));
});

test('reduced motion: the layers drift a few pixels at most and never swell', () => {
  const far = { x: -90000, y: 70000, z: 4 };
  for (const d of [FAR, NEAR]) {
    const v = layerView(far, d, W, H, { still: true });
    assert.ok(Math.abs(v.ox) <= DRIFT && Math.abs(v.oy) <= DRIFT && v.s === 1, JSON.stringify(v));
  }
  assert.ok(layerView({ x: -40, y: 0, z: 1 }, NEAR, W, H, { still: true }).ox < 0, 'it still leans the right way');
});

test('a layer wraps like a tile: every star shows somewhere, and no edge is ever empty, slid or shrunk', () => {
  // slid by any amount, a star lands on screen exactly once (the copy rule) and inside it
  for (const o of [0, -200, 5000, -12345.5, 640]) for (const v of [0, 1, 639, 1279.9]) {
    const ps = placeAxis(v, o, 1, W);
    assert.equal(ps.length, 1, JSON.stringify({ o, v, ps })); assert.ok(ps[0] >= 0 && ps[0] < W);
  }
  // shrunk to the smallest swell (zoomed all the way out) the copies still cover both edges: sample the axis densely
  const s = layerView(zoomAt(HOME, 0.25, W / 2, H / 2), NEAR, W, H).s, all = [];
  for (let v = 0; v < W; v += 8) all.push(...placeAxis(v, -333, s, W));
  const bins = new Array(16).fill(0); for (const p of all) bins[Math.min(15, Math.floor(p / (W / 16)))]++;
  assert.ok(bins.every((b) => b > 0), 'every sixteenth of the screen has stars: ' + bins.join(','));
  // a margin lets a star that straddles the edge show on both sides
  assert.equal(placeAxis(1, 0, 1, W, 4).length, 2);
  assert.deepEqual(placeAxis(5, 0, 1, 0), [], 'no screen, no stars');
});

test('the near stars streak only when moving fast, pointing back where they came from, capped; a fast zoom in warps; none under reduced motion', () => {
  assert.deepEqual(streakOf(10, 0), { dx: 0, dy: 0, warp: 0 }, 'a slow drift is a dot');
  const s = streakOf(-360, 0); // the near layer sliding left at full flight speed
  assert.ok(s.dx > 10 && s.dx <= STREAK_MAX && s.dy === 0, JSON.stringify(s));
  const fast = streakOf(-9000, 9000); assert.ok(Math.abs(Math.hypot(fast.dx, fast.dy) - STREAK_MAX) < 0.02, 'capped');
  assert.equal(streakOf(0, 0, 0.3).warp, 0); assert.ok(streakOf(0, 0, 3).warp > 0 && streakOf(0, 0, 300).warp <= 0.22);
  assert.equal(streakOf(0, 0, -5).warp, 0, 'zooming out is no warp');
  assert.deepEqual(streakOf(-9000, 0, 9, { still: true }), { dx: 0, dy: 0, warp: 0 });
});
