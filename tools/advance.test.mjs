// A world that keeps living while you are away (domains/void.frontier.md item 4): advance(things, ms) in skills/scripts.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, awayText, CONDITIONS, AWAY_MAX_MS } from '../void-live-deploy/skills/scripts.js';

const HOUR = 36e5;
// a cloud with a flower beneath it (rain lands on what is within 70px sideways and 260px below), a block of ice apart
const stage = () => [
  { id: 'c1', kindOf: 'cloud', x: 100, y: 100, seed: 11 },
  { id: 'f1', kindOf: 'flower', x: 110, y: 250, seed: 22 },
  { id: 'i1', kindOf: 'ice', x: 700, y: 400, seed: 33 },
];
const byId = (r, id) => r.things.find((t) => t.id === id);

test('advance: three natures change visibly over one simulated hour', () => {
  const r = advance(stage(), HOUR);
  assert.ok(r.changes.some((c) => c.id === 'c1' && c.what === 'rained'), 'the cloud rained');
  assert.ok(byId(r, 'f1').nature.grow > 0.5, 'the flower under the rain grew: ' + byId(r, 'f1').nature.grow);
  assert.equal(byId(r, 'i1').nature.gone, true, 'ice above freezing melted away in an hour');
  assert.deepEqual(r.changes.map((c) => c.what).sort(), ['grew', 'melted away', 'rained']);
});

test('advance: a flower with no rain over it does not grow', () => {
  const r = advance([{ id: 'f', kindOf: 'flower', x: 0, y: 0, seed: 1 }, { id: 'c', kindOf: 'cloud', x: 600, y: 100, seed: 2 }], HOUR);
  assert.equal(byId(r, 'f').nature.grow, 0);
  assert.ok(!r.changes.some((c) => c.id === 'f'));
});

test('advance: zero ms (or under no time at all) changes nothing', () => {
  const things = stage();
  const r = advance(things, 0);
  assert.deepEqual(r.things, things);
  assert.deepEqual(r.changes, []);
  assert.equal(r.note, '');
  assert.deepEqual(advance(things, -5).things, things, 'negative time is no time');
  assert.equal(advance(things, NaN).note, '');
  assert.equal(things[0].nature, undefined, 'the input is never touched');
});

test('advance: the note names what changed, and nothing else', () => {
  const r = advance(stage(), HOUR);
  assert.match(r.note, /^While you were away \(1 hour\): /);
  assert.match(r.note, /the cloud rained/);
  assert.match(r.note, /the flower grew/);
  assert.match(r.note, /the ice melted away/);
  assert.ok(r.note.endsWith('.'));
  assert.equal(r.note.split('\n').length, 1, 'one line');
  assert.equal(advance([{ id: 'f', kindOf: 'flower', x: 0, y: 0 }], HOUR).note, '', 'a quiet flower leaves no note');
  assert.equal(advance([{ id: 'z', kindOf: 'zombie', x: 0, y: 0 }], HOUR).note, '', 'things without conditions are left as they were');
  assert.match(advance([{ id: 'a', kindOf: 'ice', x: 0, y: 0 }, { id: 'b', kindOf: 'ice', x: 900, y: 0 }], HOUR).note, /2 ices melted away/);
});

test('advance: the same things and ms give identical results twice, and a different seed only changes the pace', () => {
  const a = advance(stage(), HOUR), b = advance(stage(), HOUR);
  assert.deepEqual(a, b);
  const part = advance([{ id: 'i', kindOf: 'ice', x: 0, y: 0, seed: 1 }], 20 * 1000).things[0].nature.melt;
  const part2 = advance([{ id: 'i', kindOf: 'ice', x: 0, y: 0, seed: 987654 }], 20 * 1000).things[0].nature.melt;
  assert.notEqual(part, part2, 'a seed gives each thing its own pace');
  assert.ok(Math.abs(part - part2) / Math.max(part, part2) < 0.25, 'but only a slight one: ' + part + ' vs ' + part2);
});

test('advance: it continues a thing from the state it was left in, and splits into the same story', () => {
  const half = advance(stage(), HOUR / 2);
  const rest = advance(half.things, HOUR / 2);
  const whole = advance(stage(), HOUR);
  assert.equal(byId(rest, 'i1').nature.gone, byId(whole, 'i1').nature.gone);
  assert.equal(byId(rest, 'f1').nature.grow, 1, 'two half-hours grow the flower as one hour does');
  assert.equal(byId(whole, 'f1').nature.grow, 1);
});

test('advance: time is capped at a day and short absences are named in minutes', () => {
  const day = advance(stage(), AWAY_MAX_MS), year = advance(stage(), 365 * 24 * HOUR);
  assert.deepEqual(day, year);
  assert.equal(awayText(5 * 6e4), '5 min');
  assert.equal(awayText(HOUR), '1 hour');
  assert.equal(awayText(3 * HOUR), '3 hours');
  assert.equal(awayText(72 * HOUR), '3 days');
  assert.ok(CONDITIONS.cloud && CONDITIONS.flower && CONDITIONS.ice);
});
