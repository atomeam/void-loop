import test from 'node:test';
import assert from 'node:assert/strict';
import { failureLines, addedFailures } from './skills-delta.mjs';

test('a clean run has no failure lines, and a failing run keeps each line', () => {
  assert.deepEqual(failureLines('all 3 skills clean\n', 0), []);
  assert.deepEqual(failureLines('riddle: "a riddle" -> joke\n', 1), ['riddle: "a riddle" -> joke']);
});

test('only a failure the pull request added is new', () => {
  const base = ['riddle: "a riddle" -> joke', 'palindrome: missing from the index'];
  const head = ['riddle: "a riddle" -> joke', 'palindrome: missing from the index', 'mine: "play mine" -> null'];
  assert.deepEqual(addedFailures(head, base), ['mine: "play mine" -> null']);
  assert.deepEqual(addedFailures(base, base), []);
  assert.deepEqual(addedFailures([], base), []);
});
