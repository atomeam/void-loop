// skills/splat-core.js: the .splat reader, the Gaussian's covariance and its projection (checked against sampled points through a real perspective
// projection), the camera, the depth order and the demo scene.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSplat, covariance, perspective, lookAt, viewOf, toCamera, project, ellipse, depthOrder, fit, demoSplat, ROW, MAX_SPLATS } from '../void-live-deploy/skills/splat-core.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' ' + a + ' vs ' + b);
const oneSplat = ({ p = [0, 0, 0], s = [1, 1, 1], rgba = [10, 20, 30, 40], q = [255, 128, 128, 128] } = {}) => {
  const b = new ArrayBuffer(ROW), dv = new DataView(b), u = new Uint8Array(b); p.forEach((v, i) => dv.setFloat32(4 * i, v, true)); s.forEach((v, i) => dv.setFloat32(12 + 4 * i, v, true)); u.set(rgba, 24); u.set(q, 28); return b;
};

test('splat: a .splat file is read field by field, and the covariance follows the rotation and the scale', () => {
  const r = parseSplat(oneSplat({ p: [1, -2, 3], s: [1, 2, 3], rgba: [200, 100, 50, 255] }));
  assert.deepEqual([r.count, r.total, r.step], [1, 1, 1]);
  assert.deepEqual(Array.from(r.center), [1, -2, 3]); assert.deepEqual(Array.from(r.color), [200, 100, 50, 255]);
  Array.from(r.sigma).forEach((v, i) => near(v, [1, 0, 0, 4, 0, 9][i], 0.02, 'sigma[' + i + ']'));
  const c = Math.SQRT1_2; // a quarter turn about z swaps the x and y scales
  covariance(c, 0, 0, c, 1, 2, 3).forEach((v, i) => near(v, [4, 0, 0, 1, 0, 9][i], 1e-9, 'quarter turn ' + i));
  covariance(1, 0, 0, 0, 0.5, 0.5, 0.5).forEach((v, i) => near(v, [0.25, 0, 0, 0.25, 0, 0.25][i], 1e-9, 'sphere ' + i));
});

test('splat: files that are not splats are refused with the reason, bad splats are dropped, and a big scan is thinned', () => {
  assert.match(parseSplat(new ArrayBuffer(0)).error, /does not look like a \.splat/);
  assert.match(parseSplat(new ArrayBuffer(33)).error, /whole number of 32-byte/);
  assert.match(parseSplat(new TextEncoder().encode('ply\nformat binary_little_endian 1.0\n' + ' '.repeat(64)).buffer).error, /\.ply/);
  assert.match(parseSplat('text').error, /not a file/);
  assert.match(parseSplat(new ArrayBuffer(49 * 1024 * 1024)).error, /larger than/);
  const two = new Uint8Array(2 * ROW); two.set(new Uint8Array(oneSplat({ p: [NaN, 0, 0] })), 0); two.set(new Uint8Array(oneSplat({ p: [1, 1, 1] })), ROW);
  const r = parseSplat(two.buffer); assert.equal(r.count, 1); assert.deepEqual(Array.from(r.center), [1, 1, 1]);
  const huge = new Uint8Array(oneSplat({ s: [Infinity, 1, 1] })); assert.equal(parseSplat(huge.buffer).count, 0, 'an infinite scale is dropped');
  const big = parseSplat(new ArrayBuffer((MAX_SPLATS * 2 + 10) * ROW)); assert.equal(big.step, 3); assert.ok(big.count <= MAX_SPLATS && big.count > MAX_SPLATS * 0.6 && big.total === MAX_SPLATS * 2 + 10);
});

test('splat: the 2D covariance matches the covariance of points sampled from the Gaussian and put through a real perspective projection', () => {
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s + 1) / 4294967297; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  const view = lookAt([2, 1.5, 6], [0.2, 0, 0]), fx = 700, fy = 700;
  const rot = [0.9, 0.2, -0.3, 0.1], len = Math.hypot(...rot), [w, x, y, z] = rot.map((v) => v / len), sc = [0.08, 0.03, 0.05];
  const sigma = covariance(w, x, y, z, ...sc), centre = [0.3, 0.1, -0.2], c = toCamera(view, centre);
  const R = [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
  const pix = []; // true perspective: u = fx · x / depth, v = fy · y / depth
  for (let i = 0; i < 60000; i++) {
    const l = [gauss() * sc[0], gauss() * sc[1], gauss() * sc[2]], p = [0, 1, 2].map((k) => centre[k] + R[3 * k] * l[0] + R[3 * k + 1] * l[1] + R[3 * k + 2] * l[2]), q = toCamera(view, p);
    pix.push([(fx * q[0]) / -q[2], (fy * q[1]) / -q[2]]);
  }
  const mean = [0, 1].map((k) => pix.reduce((a, p) => a + p[k], 0) / pix.length), cov = (a, b) => pix.reduce((t, p) => t + (p[a] - mean[a]) * (p[b] - mean[b]), 0) / pix.length;
  const got = project(sigma, view, c, fx, fy), want = { a: cov(0, 0), b: cov(0, 1), c: cov(1, 1) };
  near(got.a - 0.3, want.a, want.a * 0.05, 'xx'); near(got.c - 0.3, want.c, want.c * 0.05, 'yy'); near(got.b, want.b, Math.hypot(want.a, want.c) * 0.05, 'xy');
  near(got.depth, -c[2], 1e-9);
  const iso = project([0.01, 0, 0, 0.01, 0, 0.01], lookAt([0, 0, 0], [0, 0, -1]), [0, 0, -5], 500, 500); // σ = 0.1 at depth 5: (500 · 0.1 / 5)² = 100 px²
  near(iso.a, 100.3, 1e-6); near(iso.c, 100.3, 1e-6); near(iso.b, 0, 1e-9);
  assert.equal(project(sigma, view, [0, 0, 1], fx, fy), null, 'behind the camera');
});

test('splat: the ellipse, the camera and the depth order', () => {
  const e = ellipse(4, 0, 1); near(e.r1, 2, 1e-9); near(e.r2, 1, 1e-9); near(e.angle, 0, 1e-9);
  near(ellipse(1, 0, 4).angle, Math.PI / 2, 1e-9); near(ellipse(2, 1, 2).angle, Math.PI / 4, 1e-9);
  const v = viewOf({ yaw: 0, pitch: 0, dist: 5 }); toCamera(v, [0, 0, 0]).forEach((k, i) => near(k, [0, 0, -5][i], 1e-9));
  const side = viewOf({ yaw: Math.PI / 2, pitch: 0, dist: 5 }); toCamera(side, [0, 0, 0]).forEach((k, i) => near(k, [0, 0, -5][i], 1e-9)); toCamera(side, [-5, 0, 0]).forEach((k, i) => near(k, [0, 0, -10][i], 1e-9)); // the far side of the origin, on the view axis
  const p = perspective(Math.PI / 2, 1, 0.1, 100); near(p[0], 1, 1e-9); near(p[5], 1, 1e-9); assert.equal(p[11], -1);
  const centers = new Float32Array([0, 0, -3, 0, 0, 0, 0, 0, 3]); // eye at z = 5: depths 8, 5, 2
  assert.deepEqual(Array.from(depthOrder(lookAt([0, 0, 5], [0, 0, 0]), centers)), [0, 1, 2], 'far first');
  assert.deepEqual(Array.from(depthOrder(lookAt([0, 0, -5], [0, 0, 0]), centers)), [2, 1, 0], 'from the other side');
  assert.equal(depthOrder(lookAt([0, 0, 5], [0, 0, 0]), new Float32Array(0)).length, 0);
  const many = new Float32Array(3000); for (let i = 0; i < 1000; i++) many.set([Math.sin(i), Math.cos(i * 3), i / 100 - 5], 3 * i);
  const ord = depthOrder(lookAt([0, 0, 9], [0, 0, 0]), many), ds = Array.from(ord).map((i) => -toCamera(lookAt([0, 0, 9], [0, 0, 0]), [many[3 * i], many[3 * i + 1], many[3 * i + 2]])[2]);
  assert.ok(ds.every((d, i) => i === 0 || ds[i - 1] >= d - 1e-3), 'a thousand points come out far to near');
});

test('splat: fit centres a cloud and ignores a stray splat; the demo scene is deterministic and goes through the reader', () => {
  const cloud = new Float32Array(3 * 500); for (let i = 0; i < 499; i++) cloud.set([10 + Math.sin(i), 5 + Math.cos(i), -3 + Math.sin(i * 7)], 3 * i); cloud.set([5000, 0, 0], 3 * 499);
  const f = fit(cloud); assert.ok(f.dist < 20, 'one stray splat 5000 away does not set the distance: ' + f.dist); near(f.target[1], 5, 0.2); assert.deepEqual(fit(new Float32Array(0)), { target: [0, 0, 0], dist: 4 });
  const a = demoSplat(), b = demoSplat(); assert.deepEqual(new Uint8Array(a), new Uint8Array(b)); assert.notDeepEqual(new Uint8Array(a), new Uint8Array(demoSplat(6000, 8)));
  const r = parseSplat(a); assert.deepEqual([r.count, r.step], [6000, 1]); assert.ok(Array.from(r.center).every(Number.isFinite) && Array.from(r.sigma).every((v) => v >= 0));
  const g = fit(r.center); assert.ok(g.dist > 1 && g.dist < 12, 'the galaxy fits in view: ' + g.dist);
});
