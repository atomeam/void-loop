// The streak promotion (asked by Verse): node --test tools/streaks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bump, promote, streaksOf, STREAK_PROMOTE } from './streaks.mjs';
import { ratingOf } from './families.mjs';

test('a pass adds one, a failure is the error trace and resets, the same day twice counts once', () => {
  let s = bump(null, { names: ['a', 'b'], failing: {}, at: '2026-10-16' });
  assert.deepEqual(s.streaks, { a: 1, b: 1 });
  s = bump(s, { names: ['a', 'b'], failing: { b: ['x'] }, at: '2026-10-17' });
  assert.deepEqual(s.streaks, { a: 2, b: 0 });
  assert.deepEqual(bump(s, { names: ['a', 'b'], failing: {}, at: '2026-10-17' }).streaks, { a: 2, b: 0 }, 'a rerun the same day');
  assert.deepEqual(bump(s, { names: ['a', 'c'], failing: {}, at: '2026-10-18' }).streaks, { a: 3, c: 1 }, 'a new skill starts at one');
});
test('fifty in a row lifts tested to checked, and nothing else moves', () => {
  assert.equal(STREAK_PROMOTE, 50);
  assert.equal(promote('tested', 49), 'tested'); assert.equal(promote('tested', 50), 'checked');
  assert.equal(promote('experiment', 99), 'experiment'); assert.equal(promote('checked', 99), 'checked'); assert.equal(promote('proven', 99), 'proven');
  const r = ratingOf({ suite: true, browser: 0, bench: 0, streak: 50 });
  assert.equal(r.tier, 'checked'); assert.match(r.why, /50 clean daily runs in a row/);
  assert.equal(ratingOf({ suite: true, browser: 0, bench: 0, streak: 49 }).tier, 'tested');
  assert.equal(ratingOf({ suite: false, browser: 0, bench: 0, streak: 80 }).tier, 'experiment', 'no evidence at all: a streak alone proves nothing');
});
test('a missing or broken file reads as no streaks', () => {
  assert.deepEqual(streaksOf(() => { throw new Error('x'); }), {}); assert.deepEqual(streaksOf(() => 'nope'), {});
  assert.deepEqual(streaksOf(() => '{"streaks":{"a":3}}'), { a: 3 });
});
