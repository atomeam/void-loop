// The stage camera's maths (void-live-deploy/lib/stage-camera.js): a view over the stage that never moves a thing.
// Run: node --test tools/stage-camera.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME, MIN_Z, MAX_Z, SPEED, WARP, THROTTLE, camera, toStage, toScreen, zoomAt, pan, heading, fly, ease, atHome, transformOf, wheelFactor, toStored, fromStored } from '../void-live-deploy/lib/stage-camera.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('zooming at a screen point keeps the stage point under it still, within the zoom limits', () => {
  const cam = camera(40, -20, 1.5), under = toStage(cam, 300, 200);
  const z = zoomAt(cam, 1.25, 300, 200), after = toStage(z, 300, 200);
  assert.ok(near(z.z, 1.875) && near(under.x, after.x) && near(under.y, after.y), JSON.stringify({ under, after, z }));
  const back = toScreen(z, under.x, under.y);
  assert.ok(near(back.x, 300) && near(back.y, 200), 'the same point is drawn at the same screen pixel');
  assert.equal(zoomAt(camera(0, 0, 3.9), 2, 0, 0).z, MAX_Z, 'never past the far limit');
  assert.equal(zoomAt(camera(0, 0, 0.3), 0.1, 0, 0).z, MIN_Z, 'never past the near limit');
  assert.deepEqual(camera('a', null, Infinity), { x: 0, y: 0, z: 1, rot: 0 }, 'bad parts are home');
});

test('panning slides the view by screen pixels and leaves the zoom alone', () => {
  assert.deepEqual(pan(camera(10, 10, 2), 5, -7), { x: 15, y: 3, z: 2, rot: 0 });
});

test('held keys move the view; Shift warp is faster; mouse look turns', () => {
  assert.deepEqual(heading({ d: true }), { x: 1, y: 0 });
  assert.deepEqual(heading({ w: true }), { x: 0, y: -1 });
  assert.deepEqual(heading({}), { x: 0, y: 0 });
  let cam = camera(), vel = { x: 0, y: 0 };
  for (let i = 0; i < 60; i++) ({ cam, vel } = fly(cam, vel, { d: true }, 1 / 60));
  assert.ok(cam.x < -100 && vel.x > 0.9 * SPEED, 'a second of D slides the view left near full speed');
  const warp = fly(camera(), { x: 0, y: 0 }, { w: true }, 1, { still: true, warp: true });
  const normal = fly(camera(), { x: 0, y: 0 }, { w: true }, 1, { still: true });
  assert.ok(Math.abs(warp.vel.y) > Math.abs(normal.vel.y) * 4, 'warp is much faster than normal');
  const look = fly(camera(), { x: 0, y: 0 }, {}, 1, { look: 1 });
  assert.ok(look.cam.rot > 20, 'mouse look turns the view: ' + look.cam.rot);
});

test('landing eases home and snaps there under reduced motion; the transform is empty at home', () => {
  let cam = camera(300, -120, 2.2);
  const one = ease(cam, HOME, 1 / 60);
  assert.ok(one.x < 300 && one.x > 0 && one.z < 2.2 && one.z > 1, 'one frame moves part of the way: ' + JSON.stringify(one));
  for (let i = 0; i < 180; i++) cam = ease(cam, HOME, 1 / 60);
  assert.ok(atHome(cam) && transformOf(cam) === '', 'three seconds later it is exactly home: ' + JSON.stringify(cam));
  assert.deepEqual(ease(camera(300, -120, 2.2), HOME, 1 / 60, { still: true }), { x: 0, y: 0, z: 1, rot: 0 });
  assert.equal(transformOf(camera(12.345, -6, 0.5)), 'translate(12.35px, -6px) scale(0.5)');
  assert.ok(transformOf(camera(0, 0, 1, 45)).includes('rotate(45'), 'rotation appears in the transform');
});

test('the wheel zooms in small steps either way, and what is kept comes back validated', () => {
  assert.ok(wheelFactor(-100) > 1 && wheelFactor(100) < 1 && near(wheelFactor(0), 1));
  assert.ok(wheelFactor(-5000) < 1.4, 'a huge delta is capped to a step');
  assert.ok(wheelFactor(-3, 1) > wheelFactor(-3, 0), 'a line-mode wheel counts lines, not pixels');
  const kept = toStored(camera(10.004, 2, 1.23456), true);
  assert.deepEqual(fromStored(kept), { cam: { x: 10, y: 2, z: 1.235, rot: 0 }, flying: true });
  assert.deepEqual(fromStored('{"x":1,"y":"no","z":1}'), { cam: { ...HOME }, flying: false });
  assert.deepEqual(fromStored('nonsense'), { cam: { ...HOME }, flying: false });
  assert.deepEqual(fromStored(null), { cam: { ...HOME }, flying: false });
});

test('dynamic scale (asked by Verse): a picture swells to 8% at the screen centre, eases off with distance, and is plain far away', async () => {
  const { nearness, nearLook, NEAR_SCALE } = await import('../void-live-deploy/lib/stage-camera.js');
  assert.equal(nearness(500, 400, 1000, 800), 1);
  assert.equal(nearness(0, 0, 1000, 800), 0);
  const a = nearness(560, 400, 1000, 800), b = nearness(700, 400, 1000, 800);
  assert.ok(a < 1 && b < a && b > 0, 'falls off smoothly');
  assert.deepEqual(nearLook(0), { scale: 1, shadow: '' });
  assert.equal(nearLook(1).scale, NEAR_SCALE); assert.equal(NEAR_SCALE, 1.08);
  assert.ok(nearLook(1).scale > nearLook(0.5).scale && nearLook(0.5).scale > 1);
  assert.match(nearLook(0.5).shadow, /^drop-shadow\(0 \d+px \d+px rgba\(0,0,0,0\.\d\d\)\)$/);
  assert.equal(nearLook(7).scale, NEAR_SCALE); assert.equal(nearLook('x').scale, 1);
});

test('warp and forward throttle are more extreme than normal flight or the scroll', () => {
  const normal = fly(camera(), { x: 0, y: 0 }, { w: true }, 1, { still: true });
  const warp = fly(camera(), { x: 0, y: 0 }, { w: true }, 1, { still: true, warp: true });
  assert.ok(Math.abs(normal.vel.y) > SPEED * 0.9, 'forward throttle is stronger than base speed');
  assert.ok(Math.abs(warp.vel.y) > Math.abs(normal.vel.y) * (WARP * 0.9), 'warp is far faster than normal forward: ' + Math.abs(warp.vel.y));
  const scroll = Math.abs(1 - wheelFactor(120));
  assert.ok(Math.abs(warp.vel.y) > scroll * 1000, 'warp forward is more extreme than a full scroll tick');
});
