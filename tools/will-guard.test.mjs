// The guard on Verse's own build loop (lib/will-guard.js): a want whose jobs a builder keeps not taking, or that failed, waits instead of being queued every hour.
// Run: node --test tools/will-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug, targetOf, triesOf, pickWant, skippedNote, sinceOf, MAX_TRIES, WINDOW_DAYS } from '../void-live-deploy/lib/will-guard.js';

const row = (title, state) => ({ target: targetOf(title), state });

test('the target of a want is will: and its slug, the same one the queue holds (40 characters at most, no stray dashes)', () => {
  assert.equal(slug('Answer tide questions!'), 'answer-tide-questions');
  assert.equal(targetOf('  Add milk  '), 'will:add-milk');
  assert.ok(slug('x'.repeat(80)).length <= 40);
  assert.equal(slug('---a b---'), 'a-b');
});

test('tries count a want\'s earlier jobs that were set aside or failed; a queued, building or done one is not a failed try', () => {
  const rows = [row('Tides', 'set aside'), row('Tides', 'failed'), row('Tides', 'done'), row('Tides', 'queued'), row('Moons', 'set aside'), { target: 'other:x', state: 'failed' }, null];
  assert.equal(triesOf(rows, 'Tides'), 2);
  assert.equal(triesOf(rows, 'Moons'), 1);
  assert.equal(triesOf(rows, 'Never asked'), 0);
  assert.equal(triesOf(null, 'Tides'), 0);
});

test('the first want that has tries left is picked; wants above it are named as skipped; when every want waits, none is picked', () => {
  const wants = [{ title: 'Tides' }, { title: 'Moons' }, { title: 'Comets' }];
  assert.deepEqual(pickWant(wants, []), { want: wants[0], skipped: [] });
  assert.equal(MAX_TRIES, 2);
  const one = [row('Tides', 'set aside')], two = [row('Tides', 'set aside'), row('Tides', 'failed')];
  assert.deepEqual(pickWant(wants, one), { want: wants[0], skipped: [] }, 'one set-aside job is below the cap');
  assert.deepEqual(pickWant(wants, two), { want: wants[1], skipped: [{ title: 'Tides', tries: 2 }] });
  const all = [...two, row('Moons', 'set aside'), row('Moons', 'set aside'), row('Comets', 'failed'), row('Comets', 'failed')];
  assert.deepEqual(pickWant(wants, all), { want: null, skipped: [{ title: 'Tides', tries: 2 }, { title: 'Moons', tries: 2 }, { title: 'Comets', tries: 2 }] });
  assert.deepEqual(pickWant([], two), { want: null, skipped: [] });
  assert.deepEqual(pickWant(undefined, two), { want: null, skipped: [] });
});

test('the note says how many wants waited and why; the window is 14 days back from now', () => {
  assert.equal(skippedNote([]), '');
  assert.match(skippedNote([{ title: 'a', tries: 2 }]), / · 1 want above it waits: its jobs were set aside or failed 2 times in 14 days$/);
  assert.match(skippedNote([{ title: 'a' }, { title: 'b' }]), /2 wants above it waits/);
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.equal(WINDOW_DAYS, 14);
  assert.equal(sinceOf(now), '2026-10-04T12:00:00.000Z');
});
