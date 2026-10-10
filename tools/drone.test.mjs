// Sound (void-live-deploy/skills/drone.js): a pure mapping from the sky and the cursor, and the Web Audio side against a fake context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { droneFor, createDrone } from '../void-live-deploy/skills/drone.js';

test('drone: night is low and dark, day is higher and brighter, the cursor opens the filter, and it is always quiet', () => {
  const night = droneFor({ daylight: 0 }, { x: 0.5, y: 0.5 }), day = droneFor({ daylight: 1 }, { x: 0.5, y: 0.5 });
  assert.ok(Math.abs(night.root - 55) < 0.01 && Math.abs(day.root - 82.4) < 0.01, night.root + ' ' + day.root);
  assert.ok(day.cutoff > night.cutoff);
  assert.ok(droneFor({ daylight: 0.5 }, { x: 1, y: 0.5 }).cutoff > droneFor({ daylight: 0.5 }, { x: 0, y: 0.5 }).cutoff, 'right of the screen is brighter than left');
  assert.ok(droneFor({ daylight: 0 }, { x: 0.5, y: 1 }).voices[3].detune !== droneFor({ daylight: 0 }, { x: 0.5, y: 0 }).voices[3].detune, 'height detunes the upper voice');
  for (const s of [night, day, droneFor({ daylight: 1, season: { k: 1 } }, { x: 1, y: 1 })]) assert.ok(s.gain <= 0.06 && s.voices.every((v) => v.gain <= 1.1));
  assert.deepEqual(droneFor(null, null).voices.length, 4); assert.ok(Number.isFinite(droneFor({ daylight: NaN }, { x: 'a' }).cutoff));
  assert.deepEqual(droneFor({ daylight: 0.3 }, { x: 0.2, y: 0.7 }), droneFor({ daylight: 0.3 }, { x: 0.2, y: 0.7 }), 'same sky, same sound');
});

function fakeContext() {
  const log = [];
  const param = (name) => ({ value: 0, setTargetAtTime(v, t, s) { log.push([name, v]); this.value = v; } });
  const node = (kind) => ({ kind, connect() {}, start() { log.push([kind, 'start']); }, stop() { log.push([kind, 'stop']); }, gain: param(kind + '.gain'), frequency: param(kind + '.freq'), detune: param(kind + '.detune'), Q: { value: 0 }, type: '' });
  return { log, currentTime: 0, destination: {}, createGain: (() => { let n = 0; return () => node(n++ === 0 ? 'master' : 'voice'); })(), createBiquadFilter: () => node('filter'), createOscillator: () => node('osc'), close() { log.push(['ctx', 'close']); } };
}

test('drone: it starts audible at the capped volume, mutes to silence, unmutes, and follows the sky only through gliding parameters', () => {
  const ctx = fakeContext(), d = createDrone(ctx);
  assert.equal(ctx.log.filter((e) => e[0] === 'osc' && e[1] === 'start').length, 4, 'four voices');
  assert.ok(ctx.log.some((e) => e[0] === 'master.gain' && e[1] === 0.05), 'audible at 0.05');
  d.mute(); assert.equal(d.muted, true); assert.equal(ctx.log.filter((e) => e[0] === 'master.gain').pop()[1], 0, 'muted is silence');
  d.update({ daylight: 1 }, { x: 1, y: 0 }); assert.equal(ctx.log.filter((e) => e[0] === 'master.gain').pop()[1] === 0, true, 'an update does not unmute a muted drone');
  d.unmute(); assert.equal(d.muted, false); assert.equal(ctx.log.filter((e) => e[0] === 'master.gain').pop()[1], 0.05);
  const before = ctx.log.length; d.update({ daylight: 0 }, { x: 0, y: 0 }); assert.ok(ctx.log.length > before);
});
