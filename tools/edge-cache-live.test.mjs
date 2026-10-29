import test from 'node:test';
import assert from 'node:assert/strict';
import { stableAsk, plan, judge } from './edge-cache-live.mjs';

const row = (name, mark, extra = {}) => ({ name, status: 200, mark, timing: 'verse-cache;desc="' + mark + '";dur=3', fields: ['answer', 'sources'], ...extra });

test('one stable, non-personal ask a day', () => {
  const a = stableAsk(new Date('2026-10-29T01:00:00Z')), b = stableAsk(new Date('2026-10-29T23:00:00Z'));
  assert.equal(a, b);
  assert.match(a, /^what is the atomic number of [a-z]+$/);
  assert.doesNotMatch(a, /\b(my|me|our|us)\b/i);
  assert.equal(plan(a).length, 5);
});

test('a cached repeat and closed doors pass', () => {
  const r = judge([row('first', 'MISS'), row('repeat', 'HIT'), row('personal', 'BYPASS'), row('signed', 'BYPASS'), row('fresh', 'REFRESH')]);
  assert.equal(r.ok, true, r.lines.join('\n'));
});

test('a personal or signed ask served from the cache fails', () => {
  assert.equal(judge([row('first', 'HIT'), row('repeat', 'HIT'), row('personal', 'HIT'), row('signed', 'BYPASS'), row('fresh', 'REFRESH')]).ok, false);
  assert.equal(judge([row('first', 'HIT'), row('repeat', 'HIT'), row('personal', 'BYPASS'), row('signed', 'HIT'), row('fresh', 'REFRESH')]).ok, false);
});

test('a repeat that misses fails, unless the answer is not storable', () => {
  assert.equal(judge([row('first', 'MISS'), row('repeat', 'MISS'), row('personal', 'BYPASS'), row('signed', 'BYPASS'), row('fresh', 'REFRESH')]).ok, false);
  const r = judge([row('first', 'MISS', { fields: ['answer', 'note'] }), row('repeat', 'MISS'), row('personal', 'BYPASS'), row('signed', 'BYPASS'), row('fresh', 'REFRESH')]);
  assert.equal(r.ok, true);
  assert.match(r.lines.at(-1), /not one the edge may store/);
});

test('no mark at all fails', () => {
  assert.equal(judge([row('first', null), row('repeat', 'HIT'), row('personal', 'BYPASS'), row('signed', 'BYPASS'), row('fresh', 'REFRESH')]).ok, false);
});
