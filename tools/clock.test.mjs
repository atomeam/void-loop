// The clock's words (skills/clock.js, moved out of void.html in cleanup step 6): making one, its own alters, removing,
// and the plain asks the skill takes before the page. Run: node --test tools/clock.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wantsCreate, wantsRemove, plainClock, alter, faceText } from '../void-live-deploy/skills/clock.js';

test('clock: making one, with a colour or size in the same words, and removing it', () => {
  for (const a of ['clock', 'make a clock', 'i want a clock', 'a big red clock', 'blue clock', 'clock on the stage']) assert.ok(wantsCreate(a), a);
  for (const a of ['remove the clock', 'hide the clock', 'what time is it']) assert.ok(!wantsCreate(a), a);
  assert.ok(wantsRemove('remove the clock') && wantsRemove('the clock, gone') && wantsRemove('remove it') && !wantsRemove('make a clock'));
});

test('clock: its own words (sizes, 12/24 hour, the date, seconds, bold) and how the time shows', () => {
  const c = { size: 56, format: '12h', seconds: true, bold: false };
  assert.ok(alter(c, 'make it bigger')); assert.equal(c.size, 72);
  assert.ok(alter(c, '24 hour')); assert.equal(c.format, '24h');
  assert.ok(alter(c, 'hide seconds') && alter(c, 'bold')); assert.equal(c.seconds, false); assert.equal(c.bold, true);
  assert.ok(!alter(c, 'make it blue'), 'a colour is the shared targeting\'s, not the clock\'s own');
  assert.match(faceText({ format: '24h', seconds: false }, new Date(2026, 9, 12, 7, 5, 9)), /^07:05$/);
});

test('clock: the skill takes only a clock by itself before the page', () => {
  for (const a of ['clock', 'make a clock', 'give me a clock', 'show the clock']) assert.ok(plainClock(a), a);
  for (const a of ['world clock', 'a big red clock', 'clock in tokyo', 'remove the clock']) assert.ok(!plainClock(a), a);
});
