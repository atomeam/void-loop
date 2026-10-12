// The list's words (skills/list.js, moved out of void.html in cleanup step 6, the last built-in): making one with seeds,
// adding, ticking, taking an item off, clearing and removing, and the plain asks the skill takes before the page.
// Run: node --test tools/list.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, normalizeItems, seedsOf, wantsCreate, addOf, checkOf, removeOf, wantsRemove, wantsClear, plainList } from '../void-live-deploy/skills/list.js';

test('list: making one, and the items it starts with', () => {
  for (const a of ['list', 'todo list', 'make a list', 'list: eggs, milk', 'a shopping list with eggs, milk and bread', 'grocery list', 'list groceries', 'start a new todo list']) assert.ok(wantsCreate(a.toLowerCase(), a), a);
  for (const a of ['clear the list', 'remove the list', 'check off milk', 'add item eggs']) assert.ok(!wantsCreate(a, a), a);
  assert.deepEqual(seedsOf('list: eggs, milk ,'), ['eggs', 'milk']);
  assert.deepEqual(seedsOf('a shopping list with eggs, milk and bread'), ['eggs', 'milk', 'bread']);
  assert.deepEqual(seedsOf('make a list'), []);
});

test('list: adding (and what a bare "add" leaves to the stage), ticking and taking off', () => {
  assert.equal(addOf('add peanut butter to the list'), 'peanut butter');
  assert.equal(addOf('put eggs on my shopping list.'), 'eggs');
  assert.equal(addOf('add item rice'), 'rice');
  assert.equal(addOf('make a list and add tea'), 'tea');
  assert.equal(addOf('add milk'), 'milk');
  for (const a of ['add a clock', 'add stars', 'add the timer', 'add 5 and 6']) assert.equal(addOf(a), '', a);
  assert.equal(addOf('add glitter', (w) => w === 'glitter'), '', 'words that name a stage thing are not an item');
  assert.equal(checkOf('check off milk'), 'milk');
  assert.equal(checkOf('cross off eggs on the shopping list'), 'eggs');
  assert.equal(checkOf('mark bread as bought'), 'bread');
  assert.equal(removeOf('remove bread from the list'), 'bread');
  assert.equal(removeOf('remove the list'), '');
  assert.ok(wantsRemove('remove the list') && wantsRemove('delete list') && !wantsRemove('remove bread from the list'));
  assert.ok(wantsClear('clear the list') && wantsClear('empty list') && !wantsClear('clear the stage'));
});

test('list: stored items come back clean, and the skill takes only a list by itself before the page', () => {
  const items = normalizeItems(['  eggs, ', { id: 'i1', text: 'milk!', done: 1 }, { text: '' }, null]);
  assert.deepEqual(items.map((i) => [i.text, i.done]), [['eggs', false], ['milk', true]]);
  assert.equal(items[1].id, 'i1'); assert.match(items[0].id, /^item_/);
  assert.equal(cleanText(': rice.'), 'rice');
  for (const a of ['list', 'make a list', 'todo list', 'create a new list', 'open list please']) assert.ok(plainList(a), a);
  for (const a of ['list my routines', 'list: eggs', 'a shopping list with eggs', 'what is a linked list', 'add milk to the list']) assert.ok(!plainList(a), a);
});
