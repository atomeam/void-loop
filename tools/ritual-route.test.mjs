// 2026-11-06, a-to-mind.com: "make me a morning routine starting at 6:30" opened a recipe timer titled "Me a morning routine
// starting at 6" with one 30:00 step, because the recipe stack read the colon in 6:30 as the colon before its steps.
// The recipe stack now skips a colon between digits, and a preset routine with its start time is a ritual.
//   node --test tools/ritual-route.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ritualAsk } from '../void-live-deploy/lib/ritual.js';
import { parseRecipe } from '../void-live-deploy/skills/recipe-stack.js';

test('a clock time is not the colon that starts a recipe, and real recipes still parse', () => {
  assert.equal(parseRecipe('make me a morning routine starting at 6:30'), null);
  assert.equal(parseRecipe('make breakfast at 7:15'), null);
  const r = parseRecipe('cook pasta: boil 10 min then rest 2');
  assert.equal(r.title, 'Pasta'); assert.equal(r.steps.length, 2);
  assert.equal(parseRecipe('make rice: simmer 15 min then rest 5 min').steps.length, 2);
});

test('a preset routine with a start time is a ritual from that time', () => {
  assert.deepEqual(ritualAsk('make me a morning routine starting at 6:30').start, [6, 30]);
  assert.equal(ritualAsk('make me a morning routine starting at 6:30').name, 'morning');
  assert.deepEqual(ritualAsk('evening routine at 9pm').start, [21, 0]);
  assert.deepEqual(ritualAsk('plan a workout routine starting at 7am').start, [7, 0]);
  assert.deepEqual(ritualAsk('morning routine as calendar events').start, [6, 30]);
  assert.deepEqual(ritualAsk('workout routine to my calendar at 7am').start, [7, 0]);
});

test('a routine with no start time and no calendar is still not a ritual', () => {
  for (const q of ['my morning', 'morning routine ideas', 'what is a morning routine', 'call this my morning']) assert.equal(ritualAsk(q), null, q);
});
