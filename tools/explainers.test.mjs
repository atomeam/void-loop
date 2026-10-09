// node tools/explainers.test.mjs: the required tests for Void's explainer cards (domains/void.explainers.md), one per
// acceptance example, named explainer.<kind>/<case>. Written before the geometry: the rules modules must pass these
// before any 3D is built on them. The observation contract itself is checked by lib/observations.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../void-live-deploy/skills/gear-pair-rules.js';
import { validateObservations } from '../void-live-deploy/lib/observations.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const item = (obs, id) => obs.items.find((x) => x.id === id);

// ---------------- gear pair ----------------

test('explainer.gear-pair/equal-teeth-equal-travel-opposite-direction', () => {
  const s = G.turnDriver(G.create({ driverTeeth: 24, drivenTeeth: 24 }), 90);
  // equal teeth: the driven gear travels the same angle, the other way
  assert.ok(near(G.drivenTravel(s), -90), 'driven travel ' + G.drivenTravel(s));
  assert.equal(G.ratio(s), 1);
  assert.equal(G.direction(s), 'opposite');
});

test('explainer.gear-pair/16-driving-32-half-turn-backward', () => {
  const s = G.turnDriver(G.create({ driverTeeth: 16, drivenTeeth: 32 }), 360); // one driver turn
  assert.ok(near(G.drivenTravel(s), -180), 'half a turn backward, got ' + G.drivenTravel(s));
  assert.equal(G.ratio(s), 0.5); // driven turns per driver turn, a positive magnitude
  assert.equal(G.signedRatio(s), -0.5);
  // both labelled quantities, never a bare "2:1"
  const e = G.explanation(s);
  assert.match(e, /16-tooth gear makes two turns while the 32-tooth gear makes one turn in the opposite direction/);
  assert.doesNotMatch(e, /\b\d+\s*:\s*\d+\b/);
});

test('explainer.gear-pair/drag-driven-applies-inverse', () => {
  const s0 = G.create({ driverTeeth: 16, drivenTeeth: 32 });
  // dragging the driven gear 90° turns the driver by the inverse ratio, the other way
  const s = G.setDrivenTravel(s0, 90);
  assert.ok(near(G.driverTravel(s), -180), 'driver travel ' + G.driverTravel(s));
  assert.ok(near(G.drivenTravel(s), 90));
});

test('explainer.gear-pair/tooth-change-rebuilds-geometry-center-distance', () => {
  const s = G.turnDriver(G.create({ driverTeeth: 16, drivenTeeth: 32 }), 37);
  const t = G.setTeeth(s, { drivenTeeth: 24 });
  const g = G.geometry(t), p = G.PITCH_DIAMETER_PER_TOOTH;
  assert.ok(near(g.driverPitchRadius, 16 * p / 2) && near(g.drivenPitchRadius, 24 * p / 2));
  assert.ok(near(g.centerDistance, g.driverPitchRadius + g.drivenPitchRadius), 'centerDistance = sum of pitch radii');
  assert.ok(near(g.centerDistance, (16 + 24) * p / 2));
  // still meshed after the change: at the contact point a driver tooth always meets a driven gap
  for (const a of [0, 7.5, 37, 123.4, -250]) assert.ok(G.meshed(G.turnDriver(t, a)), 'meshed at ' + a);
  // the driver keeps its angle; only the geometry is rebuilt
  assert.ok(near(G.driverTravel(t), 37));
  // out of range is explained, never a broken scene
  const bad = G.check({ driverTeeth: 11, drivenTeeth: 32 });
  assert.equal(bad.ok, false); assert.match(bad.why, /12.*48/);
  assert.equal(G.check({ driverTeeth: 16.5, drivenTeeth: 32 }).ok, false);
});

test('explainer.gear-pair/pause-stops-autoplay-manual-remains', () => {
  let s = G.play(G.create({ driverSpeedDegreesPerSecond: 30 }), 0);
  assert.ok(near(G.driverTravel(s, 2), 60), 'autoplay turns the driver from authoritative time');
  s = G.pause(s, 2);
  assert.ok(near(G.driverTravel(s, 100), 60), 'paused: time no longer turns it');
  s = G.turnDriver(s, 15); // manual turning still works while paused
  assert.ok(near(G.driverTravel(s, 200), 75));
  assert.equal(G.isPlaying(s), false);
});

test('explainer.gear-pair/long-run-no-ratio-drift', () => {
  const s = G.play(G.create({ driverTeeth: 17, drivenTeeth: 43, driverSpeedDegreesPerSecond: 333.3 }), 0);
  for (const t of [1, 3600, 86400 * 30, 1e7]) {
    const d = G.driverTravel(s, t), n = G.drivenTravel(s, t);
    assert.ok(near(n, -d * 17 / 43, 1e-12), 'driven derived from the driver at t=' + t);
  }
  // the scene's pose is derived the same way (never accumulated per frame)
  const pose = G.pose(s, 1e7);
  assert.ok(near(pose.drivenAngleDegrees - G.geometry(s).drivenPhaseDegrees, G.drivenTravel(s, 1e7), 1e-12));
});

test('explainer.gear-pair/observations-schema-valid', () => {
  const s = G.turnDriver(G.create({ driverTeeth: 12, drivenTeeth: 36 }), 45);
  const o = G.observations(s);
  const v = validateObservations(o);
  assert.ok(v.ok, v.errors.join('; '));
  assert.equal(o.schema, 'void.observations.v1');
  // assessed: the ratio (number, turns-per-turn, tolerance 0.01) and the direction (choice)
  const r = item(o, 'drivenTurnsPerDriverTurn');
  assert.equal(r.unit, 'turns-per-turn'); assert.equal(r.assessment.enabled, true); assert.equal(r.assessment.tolerance, 0.01);
  assert.ok(near(r.value, 12 / 36));
  assert.match(r.assessment.prompt, /12-tooth driver and a 36-tooth driven gear/); // the snapshot, not "now"
  const d = item(o, 'rotationDirection');
  assert.equal(d.assessment.answerId, 'opposite'); assert.deepEqual(d.assessment.options.map((x) => x.id), ['same', 'opposite']);
  // not assessed: the inputs, the centre distance, the signed ratio
  for (const id of ['driverTeeth', 'drivenTeeth', 'centerDistance', 'drivenTurnsPerDriverTurnSigned']) {
    assert.ok(item(o, id), id + ' present'); assert.ok(!item(o, id).assessment || !item(o, id).assessment.enabled, id + ' not assessed');
  }
  assert.ok(near(item(o, 'drivenTurnsPerDriverTurnSigned').value, -12 / 36));
  // a malformed payload is rejected with reasons
  assert.equal(validateObservations({ schema: 'void.observations.v1', items: [{ id: 'x', valueType: 'number', value: 'NaN' }] }).ok, false);
});

test('explainer.gear-pair/discovery-hides-readouts-keeps-observations-and-inputs', () => {
  const s = G.turnDriver(G.create({ driverTeeth: 16, drivenTeeth: 32 }), 200);
  const disc = G.setPresentation(s, 'discovery');
  const vn = G.view(s), vd = G.view(disc);
  // normal shows the explanation and both ratio readouts; discovery hides them and their accessible text
  assert.ok(vn.explanation && vn.readouts.length >= 2);
  assert.equal(vd.explanation, null); assert.equal(vd.readouts.length, 0);
  assert.doesNotMatch(JSON.stringify(vd), /0\.5|two turns|half/);
  // the inputs, controls, motion and Reveal stay
  assert.deepEqual(vd.inputs, vn.inputs);
  assert.ok(vd.controls.includes('reveal-rule'));
  // presentation changes nothing a taker receives
  assert.deepEqual(G.observations(disc), G.observations(s));
  assert.equal(G.explanation(disc), G.explanation(s));
  assert.equal(G.check({ presentation: 'loud' }).ok, false);
});
