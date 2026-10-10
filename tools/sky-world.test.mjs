// The sky world's projection (pure) and the choices it makes at a place and time: where to look first, and that the zenith, horizon and compass
// land where the geometry says. The drawing itself is looked at in tools/test_sky.mjs (a real browser, 375 px and keyboard only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject, viewBasis, initialView } from '../void-live-deploy/skills/sky-world.js';

const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} vs ${want}`);
const VIEW = { w: 800, h: 600, az0: 180, alt0: 40, fov: 100 };

test('the centre of the view is the middle of the canvas, and unprojecting a pixel returns the direction', () => {
  const c = project(VIEW.alt0, VIEW.az0, VIEW); near(c.x, 400, 1e-6, 'x'); near(c.y, 300, 1e-6, 'y'); assert.ok(c.ok);
  for (const [alt, az] of [[10, 150], [60, 200], [0, 180], [75, 90], [-5, 250], [30, 40]]) {
    const p = project(alt, az, VIEW); if (!p.ok) continue;
    const q = unproject(p.x, p.y, VIEW); near(q.alt, alt, 1e-6, `alt ${alt}/${az}`); near(Math.min(Math.abs(q.az - az), 360 - Math.abs(q.az - az)), 0, 1e-6, `az ${alt}/${az}`);
  }
});

test('up is up on the screen; facing north east is to the right, facing south west is to the right', () => {
  const north = { ...VIEW, az0: 0, alt0: 30 };
  assert.ok(project(30, 20, north).x > 400, 'a bit east of north is to the right when facing north');
  assert.ok(project(50, 0, north).y < 300, 'higher is up the screen');
  const south = { ...VIEW, az0: 180, alt0: 30 };
  assert.ok(project(30, 200, south).x > 400, 'west of south is to the right when facing south');
  assert.ok(project(30, 160, south).x < 400);
});

test('the zenith is the centre when looking straight up, and the horizon is a circle around it', () => {
  const up = { w: 800, h: 800, az0: 0, alt0: 90, fov: 120 }, b = viewBasis(up), z = project(90, 123, up, b); near(z.x, 400, 1e-6, 'zenith x'); near(z.y, 400, 1e-6, 'zenith y');
  const r = (az) => Math.hypot(project(0, az, up, b).x - 400, project(0, az, up, b).y - 400);
  for (const az of [0, 90, 180, 270, 45]) near(r(az), r(0), 1e-6, 'horizon radius');
  near(project(0, 180, up, b).y, 400 - r(0), 1e-6, 'looking straight up with the view turned to the north, the top of the screen is south (tilt your head back: the top of your view is behind you)');
  near(project(0, 0, up, b).y, 400 + r(0), 1e-6, 'and north is at the bottom');
});

test('the field of view is the angle across the canvas; the far side of the sky is not drawn', () => {
  const v = { w: 1000, h: 400, az0: 90, alt0: 0, fov: 90 };
  near(project(0, 90 + 45, v).x, 1000, 1e-6, 'half the field of view to the right lands on the right edge');
  near(project(0, 90 - 45, v).x, 0, 1e-6, 'and to the left on the left edge');
  assert.equal(project(0, 270, v).ok, false, 'the point behind you is not on screen');
  assert.equal(project(0, 270.5, v).ok, false, 'nor is anything within about 14 degrees of it, where the projection blows up');
  assert.equal(project(0, 90 + 150, v).ok, true, 'but 150 degrees round is drawn, far off the canvas');
});

test('where to look first: by day with the sun left of the middle (clear of the card), at night toward the middle of the sky on the stars\' side', () => {
  const day = initialView(59, 170, 51.5);
  near(day.az0, 170 + 26 / Math.cos(59 * Math.PI / 180), 1e-9, 'az0'); assert.equal(day.alt0, 40); assert.equal(day.fov, 100);
  assert.equal(initialView(2, 250, 51.5).alt0, 10, 'a low sun: look no lower than 10 degrees');
  near(initialView(2, 250, 51.5).az0, 250 + 26 / Math.cos(2 * Math.PI / 180), 1e-9, 'az0 low sun');
  assert.deepEqual(initialView(-30, 10, 51.5), { az0: 180, alt0: 30, fov: 100 });
  assert.deepEqual(initialView(-30, 10, -33.9), { az0: 0, alt0: 30, fov: 100 }, 'in the south the high sky is to the north');
  for (const alt of [59, 30, 5]) { const v = { w: 1280, h: 800, ...initialView(alt, 170, 51.5) }, p = project(alt, 170, v); assert.ok(p.ok && p.x < 360 && p.y > 0 && p.y < 520, `the sun at ${alt}° lands left of a 560 px card, not below the middle by much: ` + JSON.stringify(p)); }
});
