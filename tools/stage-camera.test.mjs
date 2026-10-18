// The stage camera's maths (void-live-deploy/lib/stage-camera.js): a view over the stage that never moves a thing.
// Run: node --test tools/stage-camera.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME, MIN_Z, MAX_Z, SPEED, camera, toStage, toScreen, zoomAt, pan, heading, fly, ease, atHome, transformOf, wheelFactor, toStored, fromStored } from '../void-live-deploy/lib/stage-camera.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('zooming at a screen point keeps the stage point under it still, within the zoom limits', () => {
  const cam = camera(40, -20, 1.5), under = toStage(cam, 300, 200);
  const z = zoomAt(cam, 1.25, 300, 200), after = toStage(z, 300, 200);
  assert.ok(near(z.z, 1.875) && near(under.x, after.x) && near(under.y, after.y), JSON.stringify({ under, after, z }));
  const back = toScreen(z, under.x, under.y);
  assert.ok(near(back.x, 300) && near(back.y, 200), 'the same point is drawn at the same screen pixel');
  assert.equal(zoomAt(camera(0, 0, 3.9), 2, 0, 0).z, MAX_Z, 'never past the far limit');
  assert.equal(zoomAt(camera(0, 0, 0.3), 0.1, 0, 0).z, MIN_Z, 'never past the near limit');
  assert.deepEqual(camera('a', null, Infinity), { x: 0, y: 0, z: 1 }, 'bad parts are home');
});

test('panning slides the view by screen pixels and leaves the zoom alone', () => {
  assert.deepEqual(pan(camera(10, 10, 2), 5, -7), { x: 15, y: 3, z: 2 });
});

test('held keys fly the eye: D moves the view right (the stage passes leftwards), speed eases in and out, diagonals are no faster', () => {
  assert.deepEqual(heading({ d: true }), { x: 1, y: 0 });
  assert.deepEqual(heading({ arrowup: true, a: true }), { x: -1, y: -1 });
  assert.deepEqual(heading({}), { x: 0, y: 0 });
  let cam = camera(), vel = { x: 0, y: 0 };
  for (let i = 0; i < 60; i++) ({ cam, vel } = fly(cam, vel, { d: true }, 1 / 60));
  assert.ok(cam.x < -100 && vel.x > 0.9 * SPEED, 'after a second of D the view has slid left and is near full speed: ' + JSON.stringify({ cam, vel }));
  const first = fly(camera(), { x: 0, y: 0 }, { d: true }, 1 / 60);
  assert.ok(first.vel.x > 0 && first.vel.x < SPEED / 4, 'the first frame is a gentle start, not full speed: ' + first.vel.x);
  const diag = fly(camera(), { x: 0, y: 0 }, { d: true, s: true }, 1 / 60, { still: true });
  assert.ok(near(Math.hypot(diag.vel.x, diag.vel.y), SPEED), 'a diagonal is the same speed as a straight line');
  for (let i = 0; i < 120; i++) ({ cam, vel } = fly(cam, vel, {}, 1 / 60));
  assert.deepEqual(vel, { x: 0, y: 0 }, 'two seconds after letting go it has come to rest');
  const stillStep = fly(camera(), { x: 0, y: 0 }, { w: true }, 1 / 60, { still: true });
  assert.ok(near(stillStep.vel.y, -SPEED) && near(stillStep.cam.y, SPEED / 60), 'reduced motion: full speed at once, no easing');
  const asleep = fly(camera(), { x: 0, y: 0 }, { d: true }, 5, { still: true });
  assert.ok(asleep.cam.x >= -SPEED * 0.25 - 1e-6, 'a frame that slept for seconds moves a quarter second at most');
});

test('landing eases home and snaps there under reduced motion; the transform is empty at home', () => {
  let cam = camera(300, -120, 2.2);
  const one = ease(cam, HOME, 1 / 60);
  assert.ok(one.x < 300 && one.x > 0 && one.z < 2.2 && one.z > 1, 'one frame moves part of the way: ' + JSON.stringify(one));
  for (let i = 0; i < 180; i++) cam = ease(cam, HOME, 1 / 60);
  assert.ok(atHome(cam) && transformOf(cam) === '', 'three seconds later it is exactly home: ' + JSON.stringify(cam));
  assert.deepEqual(ease(camera(300, -120, 2.2), HOME, 1 / 60, { still: true }), { x: 0, y: 0, z: 1 });
  assert.equal(transformOf(camera(12.345, -6, 0.5)), 'translate(12.35px, -6px) scale(0.5)');
});

test('the wheel zooms in small steps either way, and what is kept comes back validated', () => {
  assert.ok(wheelFactor(-100) > 1 && wheelFactor(100) < 1 && near(wheelFactor(0), 1));
  assert.ok(wheelFactor(-5000) < 1.4, 'a huge delta is capped to a step');
  assert.ok(wheelFactor(-3, 1) > wheelFactor(-3, 0), 'a line-mode wheel counts lines, not pixels');
  const kept = toStored(camera(10.004, 2, 1.23456), true);
  assert.deepEqual(fromStored(kept), { cam: { x: 10, y: 2, z: 1.235 }, flying: true });
  assert.deepEqual(fromStored('{"x":1,"y":"no","z":1}'), { cam: { ...HOME }, flying: false });
  assert.deepEqual(fromStored('nonsense'), { cam: { ...HOME }, flying: false });
  assert.deepEqual(fromStored(null), { cam: { ...HOME }, flying: false });
});
