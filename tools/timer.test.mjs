// The timer's parsing (skills/timer.js, moved out of void.html in cleanup step 6): lengths, alarms, and the plain asks
// the skill takes before the page. Run: node --test tools/timer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, alarmMs, isDurationRequest, wantsCreate, plainTimer } from '../void-live-deploy/skills/timer.js';

test('timer: lengths in words and numbers, together, and a bare number of minutes', () => {
  assert.equal(parseDuration('set a timer for 5 minutes'), 300000);
  assert.equal(parseDuration('1 hour 30 minutes'), 5400000);
  assert.equal(parseDuration('half an hour'), 1800000);
  assert.equal(parseDuration('ten seconds'), 10000);
  assert.equal(parseDuration('timer 12'), 720000);
  assert.equal(parseDuration('make a timer'), 0);
});

test('timer: an alarm rings at the next such time, and a length alone is a timer ask', () => {
  const now = new Date(2026, 9, 12, 6, 0, 0);
  assert.equal(alarmMs('set an alarm for 7am', now), 3600000);
  assert.equal(alarmMs('wake me up at 6:30', now), 1800000);
  assert.equal(alarmMs('set an alarm for 25am', now), 0);
  assert.ok(isDurationRequest('5 minutes') && isDurationRequest('start 1 hour 30 min') && !isDurationRequest('5 minutes ago i ate'));
  assert.ok(wantsCreate('remind me to stretch in 20 minutes') && !wantsCreate('pause the timer') && !wantsCreate('remove the timer'));
});

test('timer: the skill takes only plain timer asks before the page (alarms, reminders and pausing go on as before)', () => {
  for (const a of ['timer', 'set a timer for 5 minutes', 'a 2 second timer', 'start a 10 minute countdown', 'give me a timer']) assert.ok(plainTimer(a), a);
  for (const a of ['set an alarm for 7am', 'remind me to stretch in 20 minutes', 'pause the timer', 'connect the timer to the note', 'how many days until christmas']) assert.ok(!plainTimer(a), a);
});
