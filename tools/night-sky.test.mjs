// The sky world (void-live-deploy/skills/night-sky.js): its asks, its rough place, its projection and colours.
// Run: node --test tools/night-sky.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { nightSkyOf, placeFromZone, project, skyColor, starRadius } from '../void-live-deploy/skills/night-sky.js';

test('night sky: opened and closed by the asks people type, not by look-alikes', () => {
  for (const a of ['show me the sky', 'Show the night sky', "what's in the sky tonight", 'what is in the sky right now', 'night sky', 'sky tonight', 'what does the sky look like tonight', 'stargazing'])
    assert.deepEqual(nightSkyOf(a), { show: true }, a);
  for (const a of ['hide the sky', 'close the night sky', 'back to the void']) assert.deepEqual(nightSkyOf(a), { hide: true }, a);
  for (const a of ['why is the sky blue', 'sky news', 'skyrim', 'the sky is the limit', 'moon phase tonight', 'show me the stars of the show']) assert.equal(nightSkyOf(a), null, a);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const e of skill.nearMisses) assert.ok(!skill.match(e.toLowerCase(), e), e);
  assert.equal(typeof skill.world.mount, 'function', 'it brings a world, not a card');
});

test('night sky: with no location, the place comes from the time zone and says it is rough', () => {
  assert.deepEqual(placeFromZone('Europe/London', 0), { lat: 45, lonE: 0, rough: true });
  assert.deepEqual(placeFromZone('America/New_York', 240), { lat: 45, lonE: -60, rough: true });
  assert.deepEqual(placeFromZone('Australia/Sydney', -600), { lat: -34, lonE: 150, rough: true });
  assert.equal(placeFromZone('America/Sao_Paulo', 180).lat, -34);
});

test('night sky: the panorama puts the horizon low, the zenith high, and the facing direction in the middle', () => {
  const W = 1000, H = 800;
  const south = project(0, 180, W, H, 180), zen = project(90, 180, W, H, 180), east = project(30, 90, W, H, 180), north = project(10, 0, W, H, 180);
  assert.equal(south.x, 500); assert.equal(south.y, 640); assert.ok(zen.y < 60, 'the zenith is at the top');
  assert.equal(east.x, 50); assert.ok(east.visible); assert.equal(north.visible, false, 'behind you is off the panorama');
  assert.equal(project(-10, 180, W, H, 180).visible, false, 'below the horizon is not drawn');
});

test('night sky: day is blue with no stars, night is dark with every star, twilight in between', () => {
  const day = skyColor(40), dusk = skyColor(-9), night = skyColor(-30);
  assert.match(day.top, /^rgb\(52,112,196\)$/); assert.equal(day.stars, 0);
  assert.equal(night.stars, 1); assert.match(night.top, /^rgb\(2,4,12\)$/);
  assert.ok(dusk.stars > 0 && dusk.stars < 1);
  assert.ok(starRadius(-1.46) > starRadius(1.98), 'Sirius is drawn bigger than Polaris');
});
