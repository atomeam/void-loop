import { test } from 'node:test';
import assert from 'node:assert';
import roman from '../void-live-deploy/skills/roman.js';

test('roman skill matches and converts', () => {
  assert.ok(roman.match('convert 42 to roman', 'convert 42 to roman'));
  assert.ok(roman.match('what is xiv in numbers', 'what is XIV in numbers'));
  assert.ok(!roman.match('roman history', 'roman history'));
});
