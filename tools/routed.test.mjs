import test from 'node:test';
import assert from 'node:assert/strict';
import { isRouted } from './routed.mjs';

test('a plain want is the ability, whichever code answered: the page parser or the skill it moved out to', () => {
  assert.ok(isRouted('timer', 'timer'));
  assert.ok(isRouted('timer', 'skill:timer'), 'the timer skill answering is the timer answering');
  assert.ok(isRouted('list', 'skill:list'));
  assert.ok(isRouted('calc', 'skill:calc'));
  assert.ok(isRouted('shape', 'skill:shape'));
  assert.ok(isRouted('timer|skill:timer', 'skill:timer'));
});

test('a skill want names that skill; another skill, the encyclopedia or a miss is not it', () => {
  assert.ok(isRouted('skill:weather', 'skill:weather'));
  assert.ok(!isRouted('skill:weather', 'skill:timer'));
  assert.ok(!isRouted('timer', 'skill:clock'));
  assert.ok(!isRouted('timer', 'article'));
  assert.ok(!isRouted('timer', 'miss:timer'));
  assert.ok(!isRouted('timer', ''));
  assert.ok(!isRouted('', 'timer'));
  assert.ok(!isRouted('skill:timer', 'timer'), 'a want that names the skill is not met by the old parser');
});
