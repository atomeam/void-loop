// The guard on Verse's own build loop (lib/will-guard.js): a want whose jobs a builder keeps not taking, or that failed, waits instead of being queued every hour.
// Run: node --test tools/will-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug, targetOf, triesOf, pickWant, skippedNote, sinceOf, MAX_TRIES, WINDOW_DAYS, TERMINAL, outcomeOf } from '../void-live-deploy/lib/will-guard.js';
import { coveredByBuilt } from '../void-live-deploy/lib/will-guard.js';

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
  assert.match(skippedNote([{ title: 'a', tries: 2 }]), / · 1 want above it waits: its jobs ended without shipping 2 times in 14 days$/);
  assert.match(skippedNote([{ title: 'a' }, { title: 'b' }]), /2 wants above it waits/);
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.equal(WINDOW_DAYS, 14);
  assert.equal(sinceOf(now), '2026-10-04T12:00:00.000Z');
});

test('the will never shows a local path, and a want a live skill answers is dropped (2026-10-19: an old writer put back zorbleflux and a private folder)', async () => {
  const { noPaths, coveredByName, WILL_SCHEMA } = await import('../void-live-deploy/lib/will-guard.js');
  assert.equal(noPaths('Aether / a2m dispatcher + bridge (projects\\aether: apps\\back did this: ran multi-step jobs'), 'Aether / a2m dispatcher + bridge did this: ran multi-step jobs');
  assert.equal(noPaths('see C:\\Users\\adam\\x.txt for it'), 'see for it');
  assert.equal(noPaths('kept in /home/user/notes.md today'), 'kept in today');
  assert.equal(noPaths('a plain sentence, with a comma (and parens).'), 'a plain sentence, with a comma (and parens).');
  const names = new Set(['zorbleflux', 'null-sweep']);
  assert.equal(coveredByName('learn to handle "zorbleflux"', names), true);
  assert.equal(coveredByName('learn to handle "null sweep"', names), true);
  assert.equal(coveredByName('learn to handle "deep ocean floor inquiries"', names), false);
  assert.equal(coveredByName('learn to handle "zorbleflux"', new Set()), false, 'no index read: nothing is dropped');
  assert.equal(WILL_SCHEMA, 2);
  const py = (await import('node:fs')).readFileSync(new URL('./will.py', import.meta.url), 'utf8');
  assert.match(py, new RegExp('WILL_SCHEMA = ' + WILL_SCHEMA + '\\b'), 'tools/will.py sends the same schema the endpoint wants');
  assert.match(py, /"schema": WILL_SCHEMA/);
});

test('coveredByBuilt: a want for an ask already linked as built is dropped; one quoting something unbuilt, or one word, stays (owner, 2026-10-19)', () => {
  const built = ["Fix the router to ensure 'open the self card' correctly triggers the look skill instead of defaulting to a text answer."];
  assert.equal(coveredByBuilt('teach my look skill "open the self card"', built), true);
  assert.equal(coveredByBuilt('learn to handle "deep ocean floor"', built), false);
  assert.equal(coveredByBuilt('learn to handle "self"', built), false);
  assert.equal(coveredByBuilt('teach my look skill "open the self card"', []), false);
  assert.equal(coveredByBuilt('Absorb and connect every repo', built), false);
});

test('an ended pull request is a state the guard counts, and one pull request is one try (owner, 2026-10-30)', () => {
  assert.deepEqual(TERMINAL, ['set aside', 'failed', 'declined', 'deferred']);
  // the outcome hook writes these two; the guard must count both, or an abandoned PR comes back on top for ever
  assert.equal(outcomeOf({ merged: true }), 'live');
  assert.equal(outcomeOf({ merged: false, closed: true }), 'declined');
  assert.equal(outcomeOf({ merged: false, closed: false }), null, 'an open pull request has not ended');
  assert.equal(outcomeOf({}), null);
  const rows = [{ target: targetOf('Tides'), state: 'declined' }, { target: targetOf('Tides'), state: 'deferred' }];
  assert.equal(triesOf(rows, 'Tides'), 2, 'both endings count');
  // one row is one job: a PR that failed and was then closed moved the same row, so it is one try, not two
  const one = [{ target: targetOf('Tides'), state: 'declined' }];
  assert.equal(triesOf(one, 'Tides'), 1);
  assert.deepEqual(pickWant([{ title: 'Tides' }, { title: 'Moons' }], [...one, ...one]),
    { want: { title: 'Moons' }, skipped: [{ title: 'Tides', tries: 2 }] });
});
