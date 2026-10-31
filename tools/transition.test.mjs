// The video transitions of /converter/ Add Transition to Video (void-live-deploy/lib/transition.js): the 58 transitions of onlineconverter.com,
// each drawn picture by picture. The pictures were also held against a reference video renderer, 10 steps of each transition (see the PR).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSITIONS, KINDS, blend } from '../void-live-deploy/lib/transition.js';

const W = 48, H = 27, N = W * H * 4;
// two pictures with detail in both directions, so a move or a mix shows
const pic = (f) => { const b = new Uint8Array(N); for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) { const [r, g, c] = f(x, y); b[i] = r; b[i + 1] = g; b[i + 2] = c; b[i + 3] = 255; } return b; };
const A = pic((x, y) => [(x * 37) & 255, (y * 53) & 255, 40]), B = pic((x, y) => [200, (x * 11 + y * 7) & 255, (y * 29) & 255]);
const share = (o, from) => { let n = 0; for (let i = 0; i < N; i += 4) if (o[i] === from[i] && o[i + 1] === from[i + 1] && o[i + 2] === from[i + 2]) n++; return n / (W * H); };

test('58 transitions, each with a unique id and the name the target lists', () => {
  assert.equal(TRANSITIONS.length, 58); assert.equal(new Set(KINDS).size, 58);
  for (const [id, name] of TRANSITIONS) { assert.match(id, /^[a-z]+$/); assert.ok(name.length > 3, id); }
  assert.deepEqual(TRANSITIONS.slice(0, 2), [['fade', 'Fade'], ['wipeleft', 'Wipe Left']]); assert.deepEqual(TRANSITIONS[57], ['revealdown', 'Reveal Down']);
  assert.throws(() => blend('spin', A, B, new Uint8Array(N), W, H, 0.5), /no transition called spin/);
});

test('every transition: the first picture at p 1, the second at p 0, solid alpha, the same output twice, and a picture between them halfway', () => {
  for (const k of KINDS) {
    const o = new Uint8Array(N);
    assert.deepEqual(blend(k, A, B, o, W, H, 1), A, k + ' at 1'); assert.deepEqual(blend(k, A, B, o, W, H, 0), B, k + ' at 0');
    const m = Uint8Array.from(blend(k, A, B, o, W, H, 0.5)), again = blend(k, A, B, new Uint8Array(N), W, H, 0.5);
    assert.deepEqual(again, m, k + ' is the same each time');
    for (let i = 3; i < N; i += 4) assert.equal(m[i], 255, k + ' alpha');
    assert.notDeepEqual(m, A, k + ' halfway is not the first picture'); assert.notDeepEqual(m, B, k + ' halfway is not the second picture');
  }
});

test('a wipe shows more of the second picture as p goes down, and the share of each picture follows p', () => {
  const o = new Uint8Array(N); let prev = -1;
  for (const p of [0.9, 0.7, 0.5, 0.3, 0.1]) { const s = share(blend('wipeleft', A, B, o, W, H, p), B); assert.ok(s > prev, 'more of b at ' + p); assert.ok(Math.abs(s - (1 - p)) < 0.05, 'b share ' + s.toFixed(2) + ' at p ' + p); prev = s; }
  // the dissolve: each pixel is a or b, and about 1 - p of them are b
  const d = blend('dissolve', A, B, o, W, H, 0.25); assert.ok(Math.abs(share(d, A) + share(d, B) - 1) < 1e-9); assert.ok(share(d, B) > 0.5);
});

test('a fade is a mix of the two pictures by p; fade black and fade white go through black and white', () => {
  const o = new Uint8Array(N); blend('fade', A, B, o, W, H, 0.25);
  for (let i = 0; i < N; i += 4) for (let c = 0; c < 3; c++) assert.ok(Math.abs(o[i + c] - (A[i + c] * 0.25 + B[i + c] * 0.75)) <= 1, 'pixel ' + i);
  // fade black and fade white: darker (lighter) than a plain fade in the middle
  const sum = (b) => { let t = 0; for (let i = 0; i < N; i += 4) t += b[i] + b[i + 1] + b[i + 2]; return t; }, mid = sum(blend('fade', A, B, new Uint8Array(N), W, H, 0.5));
  assert.ok(sum(blend('fadeblack', A, B, new Uint8Array(N), W, H, 0.5)) < mid * 0.6); assert.ok(sum(blend('fadewhite', A, B, new Uint8Array(N), W, H, 0.5)) > mid * 1.3);
});

test('blend takes Uint8ClampedArray pixels (canvas ImageData) as well as Uint8Array', () => {
  const o = new Uint8ClampedArray(N); blend('circleopen', new Uint8ClampedArray(A), new Uint8ClampedArray(B), o, W, H, 0.4);
  // the same picture, but for rounding: canvas pixels round a mix, plain bytes cut it, so a channel can be 1 apart
  const u = blend('circleopen', A, B, new Uint8Array(N), W, H, 0.4); for (let i = 0; i < N; i++) assert.ok(Math.abs(o[i] - u[i]) <= 1, 'byte ' + i);
});
