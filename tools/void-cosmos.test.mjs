// Unit tests for the deterministic cosmic map: real catalog integrity, RA/Dec -> 3D projection, scale/persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../void-live-deploy/lib/sky-catalog.js';
import * as M from '../void-live-deploy/lib/void-cosmos.js';

test('catalog rows are finite, in range, and real values are preserved', () => {
  for (const s of C.STARS) { assert.equal(s.length, 6); const [n, ra, dec, pc, bv] = s; assert.ok(typeof n === 'string' && n.length > 1, n); assert.ok(ra >= 0 && ra < 24, n + ' RA'); assert.ok(dec >= -90 && dec <= 90, n + ' Dec'); assert.ok(pc > 0 && Number.isFinite(pc), n + ' distance'); assert.ok(Number.isFinite(bv) && bv > -1 && bv < 3, n + ' B-V'); }
  for (const L of C.LANDMARKS) { assert.ok(L[1] >= 0 && L[1] < 24 && L[2] >= -90 && L[2] <= 90 && L[3] > 0, L[0]); assert.ok(L[5] && /^tell me about/.test(L[5]), L[0] + ' ask'); }
  const sirius = C.STARS.find((s) => s[0] === 'Sirius'); assert.ok(Math.abs(sirius[1] - 6.752481) < 1e-6 && Math.abs(sirius[3] - 2.6371) < 1e-6);
  assert.ok(C.STARS.some((s) => s[0] === 'Proxima Centauri')); assert.equal(C.LANDMARKS.length, 7);
});

test('projection is exact-in-direction, logarithmic-in-distance and invertible', () => {
  for (const s of C.STARS.concat(C.LANDMARKS.map((l) => [l[0], l[1], l[2], l[3] / 3.26156]))) {
    const p = C.project(s[1], s[2], s[3] * 3.26156), back = C.raDecOf(...p);
    assert.ok(Math.abs(back.ra - s[1]) < 1e-4, s[0] + ' RA roundtrip'); assert.ok(Math.abs(back.dec - s[2]) < 1e-4, s[0] + ' Dec roundtrip');
    assert.ok(Math.abs(back.ly - s[3] * 3.26156) < 0.05, s[0] + ' distance roundtrip');
  }
  assert.ok(C.radiusOf(1e6) > C.radiusOf(1e3) && C.radiusOf(1e3) > C.radiusOf(1));
  assert.ok(C.radiusOf(1e6) / C.radiusOf(1e3) < 3, 'log scale compresses the enormous distance range');
  for (const k of [C.hms(5.5879), C.dms(-5.3897), C.fmtLy(1267)]) assert.ok(typeof k === 'string' && k.length > 2);
});

test('seeded universe is deterministic and B-V drives the O..M palette', () => {
  const a = M.buildUniverse(1200), b = M.buildUniverse(1200); assert.equal(a.count, 1200);
  assert.deepEqual(Array.from(a.pos), Array.from(b.pos)); assert.deepEqual(Array.from(a.col), Array.from(b.col));
  assert.ok(a.pos.every(Number.isFinite) && a.col.every(Number.isFinite));
  const blue = C.bvColor(-0.3), red = C.bvColor(1.8); assert.ok(blue[2] > blue[0] && red[0] > red[2]);
});

test('scale controller: floating origin stays small, zoom is logarithmic', () => {
  assert.ok(M.LOG_MIN < -9 && M.LOG_MAX > 5);
  assert.equal(M.zoomOf(M.LOG_MIN), 1); assert.ok(M.zoomOf(M.LOG_MAX) > 10 && M.zoomOf(M.LOG_MAX) < 100);
  const near = M.viewPoint(M.HOME, [100, 20, 300]), far = M.viewPoint({ ...M.HOME, scaleLog: M.LOG_MAX }, [100, 20, 300]);
  assert.ok(far[0] > near[0] * 10, 'logarithmic zoom grows the world');
  const shifted = M.viewPoint({ ...M.HOME, x: 99 }, [100, 20, 300]); assert.ok(Math.abs(shifted[0]) < Math.abs(near[0]), 'camera origin is subtracted first');
  const moved = M.stepKeys(M.HOME, { w: true, Shift: true }, 1); assert.ok(moved.scaleLog > M.HOME.scaleLog && moved.x === 0);
  const s = M.screenOf(M.HOME, C.project(5.587911, -5.389667, 1267), 1280, 800); assert.ok(s.every(Number.isFinite));
});

test('camera persistence, hash roundtrip, visited cap and telemetry', () => {
  const store = new Map(), mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const cam = M.clampCam({ x: 142.8, y: -39.1, z: 880.4, yaw: 1.2, pitch: -0.3, scaleLog: 4 });
  const h = M.encodeHash(cam), back = M.decodeHash(h); assert.ok(h.startsWith('#pos=142.8,-39.1,880.4')); assert.deepEqual(back, cam);
  M.saveState(cam, mem); assert.deepEqual(M.loadState(mem, ''), cam); assert.deepEqual(M.loadState(mem, h), cam);
  assert.deepEqual(M.decodeHash('#nothing'), null); const empty = { getItem: () => null, setItem: () => {} }; assert.deepEqual(M.loadState(empty, '#pos=x,y,z'), M.HOME);
  let seen = []; for (let i = 0; i < 40; i++) seen = M.addVisited(seen, 'L' + i); assert.equal(seen.length, M.VISIT_CAP);
  seen = M.addVisited(seen, 'L39'); assert.equal(seen[seen.length - 1], 'L39');
  const t = M.telemetry({ ...cam, scaleLog: 6.1 }); assert.match(t, /^RA \d+h \d+m · Dec [+−]\d+°/);
  assert.match(M.telemetry(M.HOME), /km$/);
});
