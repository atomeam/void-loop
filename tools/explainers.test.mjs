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

// ---------------- moon phases ----------------
import * as M from '../void-live-deploy/skills/moon-phases-rules.js';

const moonAt = (deg) => M.create({ orbitAngleDegrees: deg });
// the Earth-view disc, sampled: how much of the near side the view shows lit
const sampledFraction = (s) => { let lit = 0, all = 0; const n = 160; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = (i + 0.5) / n * 2 - 1, y = (j + 0.5) / n * 2 - 1; if (x * x + y * y > 1) continue; all++; if (M.litInEarthView(s, x, y)) lit++; } return lit / all; };

test('explainer.moon-phases/0-new-0-percent', () => {
  const s = moonAt(0);
  assert.ok(near(M.illuminatedFraction(s), 0)); assert.equal(M.phaseName(s), 'new-moon');
  assert.ok(sampledFraction(s) < 0.01, 'the Earth view shows no lit part');
});

test('explainer.moon-phases/90-first-quarter-50-percent', () => {
  const s = moonAt(90);
  assert.ok(near(M.illuminatedFraction(s), 0.5)); assert.equal(M.phaseName(s), 'first-quarter');
  assert.ok(Math.abs(sampledFraction(s) - 0.5) < 0.02);
});

test('explainer.moon-phases/180-full-100-percent', () => {
  const s = moonAt(180);
  assert.ok(near(M.illuminatedFraction(s), 1)); assert.equal(M.phaseName(s), 'full-moon');
  assert.ok(sampledFraction(s) > 0.99);
});

test('explainer.moon-phases/270-last-quarter-50-percent', () => {
  const s = moonAt(270);
  assert.ok(near(M.illuminatedFraction(s), 0.5)); assert.equal(M.phaseName(s), 'last-quarter');
  assert.ok(Math.abs(sampledFraction(s) - 0.5) < 0.02);
  // the same fraction as first quarter, the other limb: waxing and waning come from the position, not the fraction
  assert.notEqual(M.waxingOrWaning(s), M.waxingOrWaning(moonAt(90)));
});

test('explainer.moon-phases/lit-side-faces-light', () => {
  // wherever the Moon is in its orbit, its lit hemisphere faces the Sun (a fixed direction), never the Earth
  for (const a of [0, 33, 90, 145, 180, 222, 270, 333]) {
    const s = moonAt(a), n = M.litHemisphereNormal(s), sun = M.SUN_DIRECTION;
    assert.ok(near(n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2], 1), 'lit side faces the light at ' + a);
  }
  // and the view's fraction is the formula for every position
  for (const a of [10, 45, 120, 200, 300]) assert.ok(Math.abs(sampledFraction(moonAt(a)) - (1 - Math.cos(a * Math.PI / 180)) / 2) < 0.02, 'fraction at ' + a);
});

test('explainer.moon-phases/overview-camera-does-not-change-earth-view', () => {
  const s = moonAt(123);
  const a = M.earthView(s, { azimuth: 0, elevation: 30 }), b = M.earthView(s, { azimuth: 170, elevation: 80 });
  assert.deepEqual(a, b); // the Earth view comes from the state alone, never from where the overview camera is
});

test('explainer.moon-phases/wrap-360-to-0-no-jump', () => {
  const s = M.turnMoon(moonAt(359.9), 0.2);
  assert.ok(near(M.orbitAngle(s), 0.1, 1e-9), 'normalized to 0.1, got ' + M.orbitAngle(s));
  assert.ok(Math.abs(M.illuminatedFraction(s) - M.illuminatedFraction(moonAt(359.9))) < 1e-4, 'no jump in the lit fraction');
  assert.equal(M.phaseName(s), 'new-moon'); assert.equal(M.phaseName(moonAt(359.9)), 'new-moon');
  assert.ok(near(M.orbitAngle(M.turnMoon(moonAt(10), -20)), 350), 'and back the other way');
});

test('explainer.moon-phases/explanation-never-cites-earth-shadow', () => {
  for (let a = 0; a < 360; a += 15) {
    const e = M.explanation(moonAt(a));
    assert.doesNotMatch(e, /shadow/i, 'at ' + a + ': ' + e);
    assert.match(e, /sun/i);
  }
});

test('explainer.moon-phases/waxing-lit-limb-right', () => {
  for (const a of [20, 60, 90, 140]) { const s = moonAt(a); assert.equal(M.earthView(s).litLimb, 'right'); assert.ok(M.litInEarthView(s, 0.98, 0), 'right limb lit at ' + a); assert.ok(!M.litInEarthView(s, -0.98, 0), 'left limb dark at ' + a); }
  for (const a of [220, 270, 320]) { const s = moonAt(a); assert.equal(M.earthView(s).litLimb, 'left'); assert.ok(M.litInEarthView(s, -0.98, 0)); }
  assert.match(M.SCENE_NOTE, /Right limb lit while waxing \(northern-hemisphere view\)/);
  assert.equal(M.CONVENTIONS.waxingLitLimb, 'right');
});

test('explainer.moon-phases/waxing-or-waning-not-assessed-at-new-or-full', () => {
  const item = (s) => M.observations(s).items.find((x) => x.id === 'waxingOrWaning');
  for (const a of [0, 180]) assert.equal(item(moonAt(a)).assessment.enabled, false, 'not assessed at ' + a);
  assert.equal(item(moonAt(45)).assessment.answerId, 'waxing'); assert.equal(item(moonAt(45)).assessment.enabled, true);
  assert.equal(item(moonAt(225)).assessment.answerId, 'waning');
  // the phase-name and fraction questions stay available at the turning points
  for (const a of [0, 180]) { const o = M.observations(moonAt(a)); assert.equal(o.items.find((x) => x.id === 'phaseName').assessment.enabled, true); assert.equal(o.items.find((x) => x.id === 'illuminatedFraction').assessment.enabled, true); }
});

test('explainer.moon-phases/observations-schema-valid', () => {
  const o = M.observations(moonAt(120));
  const v = validateObservations(o); assert.ok(v.ok, v.errors.join('; '));
  const f = o.items.find((x) => x.id === 'illuminatedFraction');
  assert.equal(f.unit, 'fraction'); assert.equal(f.assessment.tolerance, 0.02);
  assert.match(f.assessment.prompt, /captured orbital position of 120°/);
  const p = o.items.find((x) => x.id === 'phaseName');
  assert.deepEqual(p.assessment.options.map((x) => x.id), ['new-moon', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full-moon', 'waning-gibbous', 'last-quarter', 'waning-crescent']);
  assert.equal(p.assessment.answerId, 'waxing-gibbous');
  const input = o.items.find((x) => x.id === 'orbitAngleDegrees');
  assert.ok(input && !(input.assessment && input.assessment.enabled), 'the input is listed, not assessed');
});

test('explainer.moon-phases/discovery-hides-readouts-keeps-observations-and-inputs', () => {
  const s = moonAt(200), d = M.setPresentation(s, 'discovery');
  const vn = M.view(s), vd = M.view(d);
  assert.ok(vn.explanation && vn.readouts.length >= 2);
  assert.equal(vd.explanation, null); assert.equal(vd.readouts.length, 0);
  // the answer is hidden (phase, fraction, waxing or waning); the schematic note, which names the convention, stays
  assert.doesNotMatch(JSON.stringify({ ...vd, notes: [] }), /gibbous|crescent|full moon|waning|waxing|\d\s*%/i);
  assert.deepEqual(vd.notes, vn.notes);
  assert.deepEqual(vd.inputs, vn.inputs); assert.ok(vd.controls.includes('reveal-rule'));
  assert.deepEqual(M.observations(d), M.observations(s));
});

// the moon card (skills/moon.js): its drawings come from the rules, so they cannot disagree with them
test('moon card: the Earth-view drawing is exactly the region the rules call lit', async () => {
  const { litPath } = await import('../void-live-deploy/skills/moon.js');
  const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (const a of [10, 45, 90, 135, 170, 190, 225, 270, 315, 350]) {
    const s = moonAt(a), pts = litPath(s, undefined, 1, 400).slice(1, -1).split('L').map((p) => p.split(' ').map(Number));
    let wrong = 0;
    for (let x = -0.95; x <= 0.95; x += 0.1) for (let y = -0.85; y <= 0.85; y += 0.1) if (Math.abs(x - Math.cos(a * Math.PI / 180) * Math.sqrt(1 - y * y)) > 0.03 && Math.abs(x + Math.cos(a * Math.PI / 180) * Math.sqrt(1 - y * y)) > 0.03 && x * x + y * y < 0.97 && inside(pts, x, y) !== M.litInEarthView(s, x, y)) wrong++;
    assert.equal(wrong, 0, 'drawing and rules disagree at ' + a + '°');
  }
});

test('moon card: "Tonight" agrees with the moon-phase answer Void already gives', async () => {
  const { tonightAngle } = await import('../void-live-deploy/skills/moon.js');
  const { moonPhase } = await import('../void-live-deploy/skills/util.js');
  for (const d of [new Date('2026-10-09T19:00:00Z'), new Date('2026-01-03T10:00:00Z'), new Date('2025-06-11T07:44:00Z')]) {
    const m = moonPhase(d), a = tonightAngle(d.getTime() / 1000);
    assert.equal(M.PHASES.find((x) => x.id === M.phaseName(moonAt(a))).label, m.name, d.toISOString());
  }
});
