// The sky and app skills had no test (tools/untested.mjs): what each one takes, what it leaves for others, and its pure math.
// node --test tools/sky-app-skills.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eclipseAsk, greatCircleKm } from '../void-live-deploy/skills/eclipse.js';
import moon, { moonAsk } from '../void-live-deploy/skills/moontonight.js';
import app, { wantsApp } from '../void-live-deploy/skills/app.js';
import { rng, cloudPlan, cloudShade } from '../void-live-deploy/skills/sky3d.js';
import { pulse, ringCanvas } from '../void-live-deploy/skills/void-ring.js';
import tri, { parseTriangulate } from '../void-live-deploy/skills/triangulate.js';

test('eclipse: takes eclipse asks and names the kind; a clock ask is not one; the great circle is right', () => {
  assert.equal(eclipseAsk('next solar eclipse').which, 'solar');
  assert.equal(eclipseAsk('make a clock'), null);
  assert.ok(Math.abs(greatCircleKm(0, 0, 0, 1) - 111.19) < 0.1, 'one degree of longitude on the equator is about 111 km');
  assert.equal(Math.round(greatCircleKm(10, 20, 10, 20)), 0);
});

test('moontonight: every example is a moon ask, a clock ask is not', () => {
  for (const ex of moon.examples) assert.ok(moonAsk(ex), ex);
  assert.equal(moonAsk('make a clock'), null);
  assert.equal(moonAsk('moon tonight').kind, 'tonight');
});

test('app: takes "get the app" and its examples, leaves apple pie alone', () => {
  for (const ex of app.examples) assert.ok(wantsApp(ex.toLowerCase()), ex);
  assert.equal(wantsApp('apple pie'), false);
  assert.equal(app.match('get the app'), true);
});

test('sky3d: the seeded random repeats, clouds have lobes, and rain darkens the shade', () => {
  const a = rng(7), b = rng(7);
  assert.equal(a(), b()); assert.equal(a(), b());
  const plan = cloudPlan(3);
  assert.ok(Array.isArray(plan) && plan.length > 0 && plan.every((l) => l.length === 4 && l.every(Number.isFinite)));
  assert.deepEqual(cloudPlan(3), plan, 'the same seed draws the same cloud');
  assert.equal(cloudShade(0), '#f4f6f8'); assert.equal(cloudShade(1), '#565d68');
});

test('void-ring: loads without a page and exports its two calls', () => {
  assert.equal(typeof pulse, 'function'); assert.equal(typeof ringCanvas, 'function');
});

test('triangulate: its examples are taken and parse to a question', () => {
  for (const ex of tri.examples) assert.ok(tri.match(ex.toLowerCase(), ex), ex);
  assert.ok(parseTriangulate('triangulate: should I open source Verse'));
});
