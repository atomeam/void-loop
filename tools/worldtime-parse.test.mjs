// How skills/worldtime.js reads a time asked between two places, in the orders people type it.
// Run: node --test tools/worldtime-parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorldTime } from '../void-live-deploy/skills/worldtime.js';

const conv = (a) => { const q = parseWorldTime(a); return q && q.kind === 'convert' ? [q.time, q.from, q.to].join(' | ') : JSON.stringify(q); };

test('worldtime: a time between two places, in the orders people type it', () => {
  assert.equal(conv('what time is 9am london in new york'), '9am | london | new york');
  assert.equal(conv('noon in paris is what time in chicago'), 'noon | paris | chicago');
  assert.equal(conv('3pm london is what time in tokyo'), '3pm | london | tokyo');
  assert.equal(conv('meeting at 2pm london what time in san francisco'), '2pm | london | san francisco');
  assert.equal(conv('my call is at 10am in new york, what time is that in berlin'), '10am | new york | berlin');
  assert.equal(conv('is sydney ahead of los angeles'), 'now | los angeles | sydney');
  assert.equal(conv('is tokyo behind london'), 'now | london | tokyo');
  // the older forms still read the same
  assert.equal(conv("when it's 6pm in berlin what time is it in dubai"), '6pm | berlin | dubai');
  assert.equal(conv('3pm london to tokyo'), '3pm | london | tokyo');
});

test('worldtime: GMT and UTC now, and look-alikes left alone', () => {
  for (const a of ['what is gmt now', 'gmt now', 'utc time', "what's utc right now"]) {
    const q = parseWorldTime(a); assert.ok(q && q.kind === 'now', a);
  }
  for (const a of ['is the meeting at 2pm', 'is sydney ahead', 'meeting at 2pm tomorrow', 'is it ahead of schedule'])
    assert.ok(!parseWorldTime(a) || parseWorldTime(a).kind !== 'convert', a);
});
