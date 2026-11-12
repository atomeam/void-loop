// Timer halves (lists run 21, the timer half of closed PR #2414): "2 and a half minutes", "a minute and a half" and "an hour and a half"
// read as the whole length, where they read as 30 seconds, 1 minute and 1 hour before. "add ..." keeps adding to the running timer.
// Run: node --test tools/timer-halves.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, isDurationRequest, wantsCreate, addMs, halves } from '../void-live-deploy/skills/timer.js';

test('a half after a number or a unit adds half of that unit', () => {
  const want = { '2 and a half minutes': 150e3, 'timer for 2 and a half minutes': 150e3, 'a minute and a half': 90e3, 'set a timer for a minute and a half': 90e3,
    'an hour and a half': 5400e3, 'two and a half hours': 9000e3, '10 and a half seconds': 10.5e3, 'one minute and a half': 90e3 };
  for (const [a, ms] of Object.entries(want)) assert.equal(parseDuration(a), ms, a);
  assert.equal(addMs('add a minute and a half'), 90e3);
});
test('the lengths that already worked are unchanged', () => {
  const want = { '1 minute 30 seconds': 90e3, 'half an hour': 1800e3, '5 minutes': 300e3, '1 hour 30 minutes': 5400e3, 'timer for 90 seconds': 90e3 };
  for (const [a, ms] of Object.entries(want)) assert.equal(parseDuration(a), ms, a);
  assert.equal(addMs('add 30 seconds'), 30e3);
  assert.equal(halves('half a pizza and a half'), 'half a pizza and a half', 'no unit, nothing changes');
});
test('the halves start a timer', () => {
  for (const a of ['2 and a half minutes', 'a minute and a half', 'an hour and a half']) assert.ok(isDurationRequest(a) && wantsCreate(a), a);
  assert.ok(wantsCreate('timer for 2 and a half minutes'));
});
