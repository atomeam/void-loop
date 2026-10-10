// The aurora index (void-live-deploy/skills/aurora.js, lib/aurora-feed.js): parse a recorded NOAA feed, place the oval, tint only after dark.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseKp, auroraStrength, tintWithAurora } from '../void-live-deploy/skills/aurora.js';
import { readKp } from '../void-live-deploy/lib/aurora-feed.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/aurora-kp.json', import.meta.url), 'utf8'));

test('aurora: the newest reading of a recorded feed wins; the header row, junk and the object shape are handled', () => {
  assert.deepEqual(parseKp(fixture), { kp: 6.33, at: '2026-10-10T09:00:00.000Z' });
  assert.deepEqual(parseKp([{ time_tag: '2026-10-10T03:00:00', Kp: 4 }, { time_tag: '2026-10-10T06:00:00', kp_index: 2 }]), { kp: 2, at: '2026-10-10T06:00:00.000Z' });
  for (const bad of [null, {}, [], 'x', [['time_tag', 'Kp']], [['2026-10-10 00:00:00.000', '12']], [['not a time', '3']]]) assert.equal(parseKp(bad), null, JSON.stringify(bad));
});

test('aurora: the oval comes down with Kp; a quiet night at a mid latitude shows nothing, a great storm does', () => {
  assert.equal(auroraStrength(2, 40), 0); assert.equal(auroraStrength(5, 40), 0);
  assert.ok(auroraStrength(9, 40) > 0 && auroraStrength(9, 40) < 1);
  assert.equal(auroraStrength(5, 65), 1); assert.equal(auroraStrength(5, -65), 1, 'south counts the same');
  assert.ok(auroraStrength(6, 55) > auroraStrength(4, 55));
  assert.equal(auroraStrength(NaN, 60), 0); assert.equal(auroraStrength(5, undefined), 0);
});

test('aurora: it leans green only in the dark, never past a third of the way, and leaves a bad tint alone', () => {
  const night = tintWithAurora('#0a0a30', 1, 0), day = tintWithAurora('#0a0a30', 1, 1);
  assert.equal(day, '#0a0a30', 'no aurora in daylight');
  const g = (h) => parseInt(h.slice(3, 5), 16);
  assert.ok(g(night) > g('#0a0a30'), 'greener at night: ' + night);
  assert.ok(g(night) < 0x46, 'a lean, not the whole colour');
  assert.equal(tintWithAurora('#0a0a30', 0, 0), '#0a0a30'); assert.equal(tintWithAurora('red', 1, 0), 'red');
  assert.ok(g(tintWithAurora('#0a0a30', 1, 0.5)) < g(night), 'twilight is in between');
});

test('aurora: the route reads the feed once, answers { kp: null } on any failure, and sends no caller input upstream', async () => {
  const seen = [];
  const ok = await readKp(async (url, o) => { seen.push(url); return new Response(JSON.stringify(fixture)); });
  assert.deepEqual(ok, { kp: 6.33, at: '2026-10-10T09:00:00.000Z' });
  assert.deepEqual(seen, ['https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json']);
  assert.deepEqual(await readKp(async () => new Response('nope', { status: 500 })), { kp: null });
  assert.deepEqual(await readKp(async () => { throw new Error('offline'); }), { kp: null });
  assert.deepEqual(await readKp(async () => new Response('x'.repeat(300000))), { kp: null });
  assert.deepEqual(await readKp(async () => new Response('<html>not json</html>')), { kp: null });
});
