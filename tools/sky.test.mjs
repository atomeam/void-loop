// The sky over the empty stage (frontier #21): skills/sky-rules.js maps a moment and a place to the sun's altitude, the season and a tint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sunPosition, seasonOf, skyOf, guessPlace } from '../void-live-deploy/skills/sky-rules.js';

const LONDON = { lat: 51.5, lon: 0 }, rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const at = (iso, place = LONDON) => skyOf(new Date(iso), place);

test('sky: the sun stands where astronomy says: a solstice noon, a midwinter noon, a summer midnight, an equinox at the equator', () => {
  const near = (got, want, tol = 1) => assert.ok(Math.abs(got - want) <= tol, got + ' vs ' + want);
  near(sunPosition(new Date('2026-06-21T12:00:00Z'), 51.5, 0).altitude, 90 - 51.5 + 23.44); // 61.9
  near(sunPosition(new Date('2026-12-21T12:00:00Z'), 51.5, 0).altitude, 90 - 51.5 - 23.44); // 15.1
  near(sunPosition(new Date('2026-06-21T00:00:00Z'), 51.5, 0).altitude, -(90 - 51.5 - 23.44)); // -15.1
  near(sunPosition(new Date('2026-03-20T12:00:00Z'), 0, 0).altitude, 90, 3);
  near(sunPosition(new Date('2026-06-21T12:00:00Z'), -33, 0).altitude, 90 - 33 - 23.44 + 0, 1); // the southern midwinter noon, 33.6
});

test('sky: noon, dusk, night and dawn each look like themselves', () => {
  const noon = at('2026-06-21T12:00:00Z'), night = at('2026-06-21T00:00:00Z'), dawn = at('2026-03-20T06:00:00Z'), dusk = at('2026-03-20T18:00:00Z');
  assert.deepEqual([noon.phase, night.phase, dawn.phase, dusk.phase], ['day', 'night', 'dawn', 'dusk']);
  assert.equal(noon.daylight, 1); assert.equal(night.daylight, 0);
  assert.ok(dawn.daylight > 0 && dawn.daylight < 0.6 && dusk.daylight > 0 && dusk.daylight < 0.6, 'the horizon is half-lit: ' + dawn.daylight + ', ' + dusk.daylight);
  const [nr, , nb] = rgb(night.glow), [dr, , db] = rgb(dusk.glow), [yr, , yb] = rgb(noon.glow);
  assert.ok(nb > nr, 'night is indigo: ' + night.glow);
  assert.ok(dr > db && rgb(dawn.glow)[0] > rgb(dawn.glow)[2], 'the horizon is warm (the long path through air scatters the blue away): ' + dusk.glow + ' ' + dawn.glow);
  assert.ok(yb > yr + 20, 'day is blue: ' + noon.glow);
  assert.notEqual(noon.glow, night.glow); assert.notEqual(dusk.glow, night.glow); assert.notEqual(dusk.glow, noon.glow);
  for (const s of [noon, night, dawn, dusk]) for (const c of [...rgb(s.glow), ...rgb(s.bg)]) assert.ok(c < 80, 'still a void, not a sky: ' + s.glow + ' ' + s.bg);
});

test('sky: a solstice is the season at both ends of the Earth, the same day in opposite seasons', () => {
  const north = at('2026-06-21T12:00:00Z', { lat: 51.5, lon: 0 }), south = at('2026-06-21T12:00:00Z', { lat: -33, lon: 0 });
  assert.equal(north.season.name, 'summer'); assert.equal(south.season.name, 'winter');
  const dec = at('2026-12-21T12:00:00Z');
  assert.equal(dec.season.name, 'winter'); assert.equal(at('2026-03-20T12:00:00Z').season.name, 'equinox');
  assert.ok(north.season.k > 0.95 && south.season.k < -0.95 && dec.season.k < -0.95);
  assert.ok(north.altitude > dec.altitude + 40, 'the summer sun stands far higher than the winter one');
  // summer tints a little brighter than winter under a sun just as high
  const sum = at('2026-06-21T12:00:00Z', { lat: 10, lon: 0 }), win = at('2026-12-21T12:00:00Z', { lat: 10, lon: 0 });
  assert.ok(sum.altitude > 35 && win.altitude > 35 && sum.season.k > 0.9 && win.season.k < -0.9);
  assert.ok(rgb(sum.glow)[1] > rgb(win.glow)[1], 'summer noon is brighter than a winter noon under a high sun: ' + sum.glow + ' vs ' + win.glow);
});

test('sky: the same moment gives the same sky; a place is guessed from the clock with no prompt; bad input never throws', () => {
  assert.deepEqual(at('2026-10-10T15:00:00Z'), at('2026-10-10T15:00:00Z'));
  assert.deepEqual(guessPlace('Europe/London', 0), { lat: 40, lon: 0 });
  assert.deepEqual(guessPlace('Australia/Sydney', -600), { lat: -33, lon: 150 });
  assert.deepEqual(guessPlace('America/New_York', 240), { lat: 40, lon: -60 });
  assert.doesNotThrow(() => skyOf(new Date(0), null)); assert.doesNotThrow(() => guessPlace(undefined, undefined));
  assert.equal(seasonOf(0, 10).name, 'equinox');
});
