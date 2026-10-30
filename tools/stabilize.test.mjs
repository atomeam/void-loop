// Stabilize Video (void-live-deploy/lib/stabilize.js): the motion found between two pictures of a scene moved by a known amount, and the plan
// that takes a known shake out of a path. The pictures are drawn here from a smooth scene of random blobs, so the true move is exact.
// A real shaky video, stabilized in a browser and measured against ffmpeg's vidstab, is in the PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { motion, plan, fixAt, compose, invert, apply, params, fromParams, zoomFor, workSize, IDENT, LEVELS } from '../void-live-deploy/lib/stabilize.js';

// a scene: 90 Gaussian blobs of random place, size and brightness on gray (a fixed seed, so every run is the same)
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const blobs = Array.from({ length: 90 }, () => [rnd() * 400 - 200, rnd() * 260 - 130, 4 + rnd() * 14, (rnd() - 0.5) * 220]);
const scene = (x, y) => { let v = 128; for (const [cx, cy, r, k] of blobs) v += k * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r)); return Math.max(0, Math.min(255, v)); };
// the picture a camera c (a transform from the scene to the picture) sees, w x h
const W = 256, H = 144;
const shot = (c) => { const inv = invert(c), g = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [u, v] = apply(inv, x + 0.5 - W / 2, y + 0.5 - H / 2); g[y * W + x] = scene(u, v); } return g; };
const deg = Math.PI / 180;

test('motion finds a move of the whole picture to a fiftieth of a pixel', () => {
  const a = shot(IDENT), b = shot({ a: 1, b: 0, tx: 3.4, ty: -2.7 }), r = motion(a, b, W, H);
  assert.ok(r.blocks >= 20, r.blocks + ' blocks');
  const [turn, ls, tx, ty] = params(r.m);
  assert.ok(Math.abs(tx - 3.4) < 0.02 && Math.abs(ty + 2.7) < 0.02, 'move ' + tx.toFixed(3) + ', ' + ty.toFixed(3));
  assert.ok(Math.abs(turn) < 0.03 * deg && Math.abs(ls) < 0.002, 'no turn, no size change');
});

test('motion finds a turn and a move together, and a move larger than the block search (the coarse step)', () => {
  const c = fromParams([1.2 * deg, 0, -6.3, 4.1]), r = motion(shot(IDENT), shot(c), W, H), [turn, ls, tx, ty] = params(r.m);
  assert.ok(Math.abs(turn - 1.2 * deg) < 0.01 * deg, 'turn ' + (turn / deg).toFixed(3) + ' degrees');
  assert.ok(Math.abs(tx + 6.3) < 0.02 && Math.abs(ty - 4.1) < 0.02, 'move ' + tx.toFixed(3) + ', ' + ty.toFixed(3));
  assert.ok(Math.abs(ls) < 0.003, 'size');
  const far = params(motion(shot(IDENT), shot({ a: 1, b: 0, tx: 17.5, ty: 9 }), W, H).m);
  assert.ok(Math.abs(far[2] - 17.5) < 0.02 && Math.abs(far[3] - 9) < 0.02, 'far move ' + far[2].toFixed(3) + ', ' + far[3].toFixed(3));
});

test('a picture with nothing to match (a plain colour) gives no move', () => {
  const flat = new Float32Array(W * H).fill(90), r = motion(flat, flat, W, H);
  assert.equal(r.blocks, 0); assert.deepEqual([r.m.a, r.m.b, r.m.tx, r.m.ty], [1, 0, 0, 0]);
});

// a path: a slow pan of 40 pixels over 4 s, with a shake of 4 to 6 pixels and 0.6 degrees at 5 to 9 per second, at 30 pictures a second
const times = Array.from({ length: 120 }, (_, i) => i / 30);
const cam = times.map((t) => fromParams([0.6 * deg * Math.sin(2 * Math.PI * 5 * t), 0, -10 * t + 4 * Math.sin(2 * Math.PI * 7 * t), 6 * Math.sin(2 * Math.PI * 9 * t + 1)]));
const moves = cam.map((c, i) => (i ? compose(c, invert(cam[i - 1])) : IDENT));
const shake = (ms) => { const p = ms.map(params); let s = 0; for (let i = 1; i < p.length - 1; i++) for (const k of [2, 3]) s += (p[i + 1][k] - 2 * p[i][k] + p[i - 1][k]) ** 2; return Math.sqrt(s / (p.length - 2)); };

test('plan: the corrected path keeps the pan and loses the shake, and the zoom covers every picture', () => {
  const r = plan(times, moves, W, H, 3), seen = r.fix.map((f, i) => compose(f, r.path[i]));
  assert.equal(r.fix.length, 120); assert.ok(r.zoom >= 1 && r.zoom <= LEVELS[3].zoom + 1e-9, 'zoom ' + r.zoom);
  // the shake: how much the move changes from one picture to the next (the second difference); 30 times less after
  const before = shake(r.path), after = shake(seen);
  assert.ok(after < before / 30, 'shake ' + before.toFixed(3) + ' to ' + after.toFixed(4));
  // the turn is gone
  for (const m of seen) assert.ok(Math.abs(params(m)[0]) < 0.1 * deg);
  // every corrected picture, zoomed, covers the output
  for (const f of r.fix) assert.ok(zoomFor(f, W, H, r.zoom + 1e-6) <= r.zoom + 1e-6);
  // a longer window takes out more: level 1 keeps more of the slow wobble than level 5
  const one = plan(times, moves, W, H, 1), five = plan(times, moves, W, H, 5);
  assert.ok(shake(five.fix.map((f, i) => compose(f, five.path[i]))) <= shake(one.fix.map((f, i) => compose(f, one.path[i]))) + 1e-9);
});

test('plan: a shake too large for the zoom gets a smaller correction, and the edges stay hidden', () => {
  const big = times.map((t) => fromParams([0, 0, 40 * Math.sin(2 * Math.PI * 0.5 * t), 0]));
  const r = plan(times, big.map((c, i) => (i ? compose(c, invert(big[i - 1])) : IDENT)), W, H, 1);
  assert.ok(r.cut > 0, r.cut + ' pictures with a smaller correction'); assert.ok(r.zoom <= LEVELS[1].zoom + 1e-9);
  for (const f of r.fix) assert.ok(zoomFor(f, W, H, r.zoom + 1e-6) < Infinity);
});

test('fixAt takes the nearer picture; workSize keeps the shape', () => {
  const fix = [{ ...IDENT, tx: 1 }, { ...IDENT, tx: 2 }, { ...IDENT, tx: 3 }];
  assert.equal(fixAt([0, 0.1, 0.2], fix, 0.04).tx, 1); assert.equal(fixAt([0, 0.1, 0.2], fix, 0.06).tx, 2); assert.equal(fixAt([0, 0.1, 0.2], fix, 9).tx, 3);
  assert.deepEqual(workSize(1920, 1080), [256, 144]); assert.deepEqual(workSize(1080, 1920), [144, 256]); assert.deepEqual(workSize(100, 50), [100, 50]);
});

test('plan keeps a steady pan to the last picture: the path is mirrored past its ends, not pulled flat', () => {
  const pan = times.map((t) => fromParams([0, 0, -10 * t, 2 * t])), r = plan(times, pan.map((c, i) => (i ? compose(c, invert(pan[i - 1])) : IDENT)), W, H, 5);
  for (const f of r.fix) { const [turn, ls, tx, ty] = params(f); assert.ok(Math.abs(tx) < 1e-6 && Math.abs(ty) < 1e-6 && Math.abs(turn) < 1e-9 && Math.abs(ls) < 1e-9, 'a steady pan needs no correction'); }
  assert.equal(r.zoom, 1); assert.equal(r.cut, 0);
});
