// node --test tools/error-garden-incidents.test.mjs: the site's red checks grow in the error garden (asked by Void, 2026-10-18: "any new red
// browser check automatically generates a summary card in the error-garden"). Pure parts only: plantIncidents over a made-up incidents.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import garden, { plantIncidents, checkSummary, gardenIntent, stageOf, plant, plantMany, INCIDENT_BATCH } from '../void-live-deploy/skills/error-garden.js';
import { failurePlants } from '../void-live-deploy/lib/autopsy.js';

const C1 = 'living arrows: "connect the timer to the note" says the note gets it when the timer ends', C2 = 'printedmotor: "can you 3d print a motor" shows three dated steps';
const inc = (sha, at, checks) => ({ at, sha, run: 'https://example.test/r', suite: 'browser suite on main', checks });
const FILE = { note: 'x', incidents: [inc('e819d8d7adc8ec1b9c69347c29d877ef78ca25a2', '2026-10-18T07:03:59Z', [C1, C2, 'suite ran to the end']), inc('d139d79e5b5ffee950b2ea79c49e5aaa', '2026-10-18T06:50:42Z', [C1, 'suite ran to the end'])] };

test('first contact: only the newest incident is planted (the suite\'s own last line is not a check) and every sha is remembered', () => {
  const r = plantIncidents([], FILE, [], Date.parse('2026-10-18T08:00:00Z'));
  assert.equal(r.planted, 2); assert.equal(r.weeds, 0);
  assert.deepEqual(r.plants.map((p) => p.text), ['living arrows', 'printedmotor']);
  assert.deepEqual(r.plants.map((p) => [p.from, p.sha, stageOf(p)]), [['incident', 'e819d8d', 'sprout'], ['incident', 'e819d8d', 'sprout']]);
  assert.equal(r.plants[0].ref, C1); assert.equal(r.plants[0].last, Date.parse('2026-10-18T07:03:59Z'), 'planted at the incident\'s own time');
  assert.deepEqual(r.seen, ['e819d8d7adc8ec1b9c69347c29d877ef78ca25a2', 'd139d79e5b5ffee950b2ea79c49e5aaa']);
  assert.deepEqual(plantIncidents(r.plants, FILE, r.seen), { plants: r.plants, seen: r.seen, planted: 0, weeds: 0 }, 'read again: nothing new');
});

test('a later incident: a check that fails again is the same plant grown into a weed, a new check a sprout; a person\'s own mistakes stay as they were', () => {
  const first = plantIncidents(plant([], 'I sent the email before checking it').plants, FILE, []);
  const later = { incidents: [inc('0123456789abcdef', '2026-10-19T09:00:00Z', [C1, 'sky card: the Right now row names the moon', 'suite ran to the end']), ...FILE.incidents] };
  const r = plantIncidents(first.plants, later, first.seen);
  assert.equal(r.planted, 1); assert.equal(r.weeds, 1);
  const arrows = r.plants.find((p) => p.text === 'living arrows');
  assert.equal(stageOf(arrows), 'weed'); assert.equal(arrows.count, 2); assert.equal(arrows.sha, '0123456', 'the newest failure\'s commit');
  assert.equal(r.plants.find((p) => p.text === 'sky card').sha, '0123456');
  const mine = r.plants.find((p) => p.text === 'I sent the email before checking it'); assert.ok(mine && !mine.from && mine.count === 1);
  assert.ok(r.seen.includes('0123456789abcdef'));
});

test('a batch is capped, bad entries are skipped, and the summary is the check\'s title', () => {
  const names = 'arrows motor sky clock timer weather chess poker forge garden heart moon lock gears vase rocket table boat tree house snowman teapot lighthouse bottle calendar counter list savings tip stopwatch'.split(' ');
  const many = { incidents: [inc('abcdef1234567', '2026-10-18T07:00:00Z', names.map((n) => n + ' card: something about the ' + n))] };
  const r = plantIncidents([], many, []);
  assert.equal(r.planted, INCIDENT_BATCH);
  const near = plantIncidents([], { incidents: [inc('abcdef1234567', '2026-10-18T07:00:00Z', ['chess rules: perft matches', 'checkers rules: 7 opening moves'])] }, []);
  assert.equal(near.planted, 2, 'two checks whose titles share most words are two plants');
  assert.equal(plantIncidents([], { incidents: [{ sha: 'not a sha', at: 'x', checks: ['a: b'] }, 'junk', null] }, []).planted, 0);
  assert.equal(plantIncidents([], null, []).planted, 0);
  assert.equal(checkSummary('printedmotor: "can you 3d print a motor" shows three steps'), 'printedmotor');
  assert.equal(checkSummary('a check with no colon at all in its words'), 'a check with no', 'no colon: its first four words');
});

test('the automatic growth and "plant my test failures" grow one plant per check, never two', () => {
  const auto = plantIncidents([], FILE, []);
  const both = plantMany(auto.plants, failurePlants(FILE));
  assert.deepEqual(both.map((p) => p.text).sort(), ['living arrows', 'printedmotor'], 'the same titles, once each; the suite\'s own last line is not a check in either path');
  assert.ok(both.every((p) => p.from === 'incident'), 'the header counts them all as red checks');
  const theirs = plantMany([], failurePlants(FILE)), mine = plantIncidents(theirs, { incidents: [inc('0123456789abcdef', '2026-10-19T09:00:00Z', [C1]), ...FILE.incidents] }, FILE.incidents.map((i) => i.sha));
  assert.equal(mine.plants.length, 2, 'a check planted by the ask first is the plant the automatic growth finds');
  assert.equal(mine.plants.find((p) => p.text === 'living arrows').sha, '0123456');
  for (const a of ['plant the red checks in my error garden', 'plant my test failures']) assert.deepEqual(gardenIntent(a), { act: 'failures' }, a);
  for (const a of ['what broke lately', 'check the red light', 'plant red tomatoes']) assert.equal(gardenIntent(a), null, a);
  for (const e of garden.examples) assert.ok(garden.match(e.toLowerCase(), e), e);
  for (const e of garden.nearMisses) assert.ok(!garden.match(e.toLowerCase(), e), e);
});
