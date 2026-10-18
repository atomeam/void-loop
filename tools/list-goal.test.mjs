// A goal on a list and its density bar (lib/list-goal.js, drawn by skills/list.js; asked by Verse, 2026-10-18: "Create a
// 'density-indicator' for the lists that count, showing at a glance how close a list is to a specific threshold or goal").
// Run: node --test tools/list-goal.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalOf, density } from '../void-live-deploy/lib/list-goal.js';
import list from '../void-live-deploy/skills/list.js';

test('list goal: the asks that set one, the one that clears it', () => {
  assert.deepEqual(goalOf('set a goal of 10 on the list'), { goal: 10 });
  assert.deepEqual(goalOf('Set a goal of 10 items for my shopping list.'), { goal: 10 });
  assert.deepEqual(goalOf('set the list goal to 12'), { goal: 12 });
  assert.deepEqual(goalOf('goal: 10 items'), { goal: 10 });
  assert.deepEqual(goalOf('goal: 4'), { goal: 4 });
  assert.deepEqual(goalOf('aim for 5 on my shopping list'), { goal: 5 });
  assert.deepEqual(goalOf('the list is full at 8'), { goal: 8 });
  assert.deepEqual(goalOf('my packing list is full at 20 items'), { goal: 20 });
  assert.deepEqual(goalOf('list threshold: 6'), { goal: 6 });
  assert.deepEqual(goalOf('the list goal is 3'), { goal: 3 });
  for (const a of ['clear the goal', 'remove the goal from the list', "clear the list's goal", 'no goal', 'forget the threshold']) assert.deepEqual(goalOf(a), { clear: true }, a);
  assert.equal(goalOf('set a goal of 0 on the list'), null, 'a goal of nothing is no goal');
});

test('list goal: near misses keep their own route', () => {
  for (const a of ['set a goal to run 5k', 'my goals', 'set a 10 minute timer', 'add 10 items to the list', 'give me a challenge with this', 'list: eggs, milk',
    'make a list', 'check off milk', 'goal', 'the goal of the project is 10 users', 'set a goal', '']) assert.equal(goalOf(a), null, a);
});

test('list goal: the skill claims the goal asks and leaves the near misses', () => {
  for (const a of ['set a goal of 10 on the list', 'goal: 10 items', 'aim for 5 on my shopping list', 'the list is full at 8', 'clear the goal']) assert.ok(list.match(a, a), a);
  for (const a of ['set a goal to run 5k', 'my goals', 'set a 10 minute timer', 'add 10 items to the list']) assert.ok(!list.match(a, a), a);
});

test('density: under, near (within one), met (at or past), the label, and nothing without a goal', () => {
  assert.deepEqual(density(0, 3), { ratio: 0, state: 'under', label: '0 of 3' });
  assert.deepEqual(density(7, 10), { ratio: 0.7, state: 'under', label: '7 of 10' });
  assert.deepEqual(density(2, 3), { ratio: 2 / 3, state: 'near', label: '2 of 3' });
  assert.deepEqual(density(9, 10), { ratio: 0.9, state: 'near', label: '9 of 10' });
  assert.deepEqual(density(3, 3), { ratio: 1, state: 'met', label: '3 of 3' });
  assert.deepEqual(density(12, 10), { ratio: 1, state: 'met', label: '12 of 10' }, 'past the goal still fills to the end');
  assert.equal(density(5, 0), null);
  assert.equal(density(5, undefined), null);
  assert.equal(density(-2, 4).label, '0 of 4');
});

test('list goal: the skill keeps the goal on the list thing and takes it off again', () => {
  const things = {};
  let selected = null;
  const api = { things: () => things, selected: () => selected, select: (id) => { selected = id; }, save() {}, render() {}, say() {}, targetKind: () => '', stage: { clientWidth: 800, clientHeight: 600 } };
  const ask = list.stageKinds.list.ask;
  assert.equal(ask('set a goal of 3 on the list', 'set a goal of 3 on the list', api), 'list-goal');
  const l = Object.values(things).find((t) => t.kind === 'list');
  assert.ok(l && l.goal === 3, 'a new list carries the goal');
  assert.equal(ask('add eggs', 'add eggs', api), 'list-item-added');
  assert.equal(ask('goal: 5 items', 'goal: 5 items', api), 'list-goal');
  assert.equal(l.goal, 5);
  assert.equal(ask('clear the goal', 'clear the goal', api), 'list-goal-cleared');
  assert.equal(l.goal, undefined);
  assert.equal(ask('add 10 items to the list', 'add 10 items to the list', api), 'list-item-added', 'an item that holds a number is still an item');
  assert.equal(l.goal, undefined);
});
