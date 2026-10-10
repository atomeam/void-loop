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

// ---- reactions over time: the NATURES that are reactions play out between the things that are there ----
const at = (r, id) => byId(r, id).at;
const near = (p, q, d = 30) => Math.hypot(p.x - q.x, p.y - q.y) <= d;

test('advance: a zombie walks to a brain and eats it, and the note says so', () => {
  const r = advance([{ id: 'z', kindOf: 'zombie', x: 100, y: 300, seed: 5 }, { id: 'b', kindOf: 'brain', x: 700, y: 320, seed: 6 }], HOUR);
  assert.equal(byId(r, 'b').gone, true, 'the brain was eaten');
  assert.ok(near(at(r, 'z'), { x: 700, y: 320 }, 2), 'the zombie stands where the brain was: ' + JSON.stringify(at(r, 'z')));
  assert.ok(!byId(r, 'z').gone);
  assert.deepEqual(r.changes, [{ id: 'z', kind: 'zombie', what: 'found', with: 'brain' }]);
  assert.equal(r.note, 'While you were away (1 hour): the zombie found the brain.');
});

test('advance: it takes the time it takes: a slow zombie is partway after a minute, there after ten', () => {
  const zb = (z, b) => [{ id: 'z', kindOf: 'zombie', x: z, y: 300, seed: 5 }, { id: 'b', kindOf: 'brain', x: b, y: 300, seed: 6 }];
  const minute = advance(zb(100, 1100), 60e3);
  assert.notEqual(byId(minute, 'b').gone, true, 'a minute is not enough for a thousand pixels at a zombie\'s pace');
  const x1 = at(minute, 'z').x;
  assert.ok(x1 > 100 && x1 < 1100, 'it is on its way: ' + x1);
  assert.equal(minute.note, '', 'nothing happened yet to tell');
  assert.equal(byId(advance(zb(100, 1100), 10 * 60e3), 'b').gone, true);
});

test('advance: a dog goes for a bone, a cat for a fish, a mouse for cheese', () => {
  for (const [a, b, id] of [['dog', 'bone', 'd'], ['cat', 'fish', 'c'], ['mouse', 'cheese', 'm'], ['rabbit', 'carrot', 'r'], ['monkey', 'banana', 'k']]) {
    const r = advance([{ id, kindOf: a, x: 50, y: 50, seed: 2 }, { id: 'f', kindOf: b, x: 500, y: 400, seed: 3 }], HOUR);
    assert.equal(byId(r, 'f').gone, true, a + ' ate the ' + b);
    assert.equal(r.note, 'While you were away (1 hour): the ' + a + ' found the ' + b + '.', a);
  }
});

test('advance: a cat catches a mouse that runs from it; neither is lost', () => {
  const r = advance([{ id: 'c', kindOf: 'cat', x: 100, y: 100, seed: 1 }, { id: 'm', kindOf: 'mouse', x: 500, y: 300, seed: 2 }], HOUR);
  assert.ok(!byId(r, 'c').gone && !byId(r, 'm').gone, 'a chase is not a meal');
  assert.equal(r.note, 'While you were away (1 hour): the cat caught the mouse.');
  assert.ok(near(at(r, 'c'), at(r, 'm'), 60), 'the cat ended beside the mouse: ' + JSON.stringify([at(r, 'c'), at(r, 'm')]));
  for (const t of r.things) assert.ok(t.at.x >= 0 && t.at.x <= 1200 && t.at.y >= 0 && t.at.y <= 700, 'on the stage: ' + JSON.stringify(t.at));
});

test('advance: a cat runs from a dog, and the dog gets the cat', () => {
  const r = advance([{ id: 'c', kindOf: 'cat', x: 300, y: 300, seed: 1 }, { id: 'd', kindOf: 'dog', x: 600, y: 300, seed: 2 }], HOUR);
  assert.equal(r.note, 'While you were away (1 hour): the dog caught the cat.');
});

test('advance: with nothing to go for, a creature stays where it was left, and a thing is never its own goal', () => {
  const r = advance([{ id: 'z', kindOf: 'zombie', x: 100, y: 300, seed: 5 }, { id: 'c', kindOf: 'cat', x: 400, y: 100, seed: 5 }], HOUR);
  assert.deepEqual(r.changes, []);
  assert.equal(r.note, '');
  assert.equal(at(r, 'z'), undefined, 'it did not move, so no new place is claimed');
});

test('advance: last place: a figure that wandered is taken from where it was, not from its card', () => {
  const stay = advance([{ id: 'z', kindOf: 'zombie', x: 0, y: 0, at: { x: 800, y: 320 }, seed: 5 }, { id: 'b', kindOf: 'brain', x: 0, y: 0, at: { x: 810, y: 320 }, seed: 6 }], 10 * 60e3);
  assert.equal(byId(stay, 'b').gone, true, 'they were side by side where they stood, so it was found at once');
  assert.ok(near(at(stay, 'z'), { x: 810, y: 320 }, 2));
  // from the card positions alone (a thousand pixels apart) the same ten minutes would not have been enough for a zombie
  const far = advance([{ id: 'z', kindOf: 'zombie', x: 0, y: 0, seed: 5 }, { id: 'b', kindOf: 'brain', x: 1190, y: 690, seed: 6 }], 60e3);
  assert.notEqual(byId(far, 'b').gone, true);
});

test('advance: reactions are deterministic and the day cap holds', () => {
  const s = () => [{ id: 'c', kindOf: 'cat', x: 100, y: 100, seed: 1 }, { id: 'm', kindOf: 'mouse', x: 500, y: 300, seed: 2 }, { id: 'z', kindOf: 'zombie', x: 20, y: 20, seed: 9 }, { id: 'b', kindOf: 'brain', x: 900, y: 600, seed: 8 }];
  assert.deepEqual(advance(s(), HOUR), advance(s(), HOUR));
  assert.deepEqual(advance(s(), AWAY_MAX_MS), advance(s(), 400 * 24 * HOUR));
  assert.deepEqual(advance(s(), 0).things, s());
  const withStage = advance([{ id: 'z', kindOf: 'zombie', x: 10, y: 10, seed: 5 }, { id: 'b', kindOf: 'brain', x: 390, y: 10, seed: 6 }], HOUR, { bounds: { w: 400, h: 200 } });
  assert.equal(byId(withStage, 'b').gone, true);
});
