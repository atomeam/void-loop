// node --test tools/showcase.test.mjs: the walkthrough behind "look what I made" (skills/showcase.js).
// The carousel (2026-10-22) replaced the engine this file used to test, so these are the rules that survived it:
// only what Verse actually built, newest first, one preview per ask, and the published phrases route here while near misses keep their skill.
import test from 'node:test';
import assert from 'node:assert/strict';
import showcase, { filterRecentWork, buildRecentTour, stepFromLedgerEntry, countUnseenRecent } from '../void-live-deploy/skills/showcase.js';

const e = (at, kind, what, extra = {}) => ({ at, kind, what, ...extra });

test('only what Verse built walks: grow, build and fix; never an idea, a finding or a retire', () => {
  const led = [e('2026-10-22T10:00:00Z', 'grow', 'a calmer ask bar'), e('2026-10-22T09:00:00Z', 'idea', 'x'),
    e('2026-10-22T08:00:00Z', 'finding', 'y'), e('2026-10-22T07:00:00Z', 'retire', 'z'),
    e('2026-10-22T06:00:00Z', 'build', 'b'), e('2026-10-22T05:00:00Z', 'fix', 'f')];
  assert.deepEqual(filterRecentWork(led, '').map((x) => x.what), ['a calmer ask bar', 'b', 'f']);
});

test('nothing older than the last visit walks, and an empty ledger walks nothing', () => {
  const led = [e('2026-10-22T10:00:00Z', 'grow', 'newer'), e('2026-10-20T10:00:00Z', 'grow', 'older')];
  assert.deepEqual(filterRecentWork(led, '2026-10-21T00:00:00Z').map((x) => x.what), ['newer']);
  assert.deepEqual(filterRecentWork([], ''), []);
  assert.deepEqual(filterRecentWork(null, ''), []);
});

test('newest first: the ledger is append-only, so the walk does not depend on the file order', () => {
  const led = [e('2026-10-22T05:00:00Z', 'grow', 'oldest'), e('2026-10-22T12:00:00Z', 'grow', 'newest')];
  assert.deepEqual(filterRecentWork(led, '').map((x) => x.what), ['newest', 'oldest']);
});

test('a step carries the ask that made it, its plain words and the time', () => {
  const s = stepFromLedgerEntry(e('2026-10-22T10:00:00Z', 'grow', 'a calmer ask bar', { ask: '  make the ask bar calmer  ' }));
  assert.equal(s.ask, 'make the ask bar calmer');
  assert.equal(s.label, 'a calmer ask bar');
  assert.equal(s.at, '2026-10-22T10:00:00Z');
});

test('the tour starts at the newest entry and is null when nothing is new', () => {
  const led = [e('2026-10-22T05:00:00Z', 'grow', 'older', { ask: 'b' }), e('2026-10-22T12:00:00Z', 'grow', 'newest', { ask: 'a' })];
  const t = buildRecentTour(led, '');
  assert.deepEqual(t.steps.map((s) => s.ask), ['a', 'b']);
  assert.equal(t.newestIso, '2026-10-22T12:00:00Z');
  assert.equal(buildRecentTour([], ''), null);
  assert.equal(countUnseenRecent(led, ''), 2);
});

test('the published phrases route here, and a near miss keeps its own skill', () => {
  for (const ask of showcase.examples) assert.ok(showcase.match(ask.toLowerCase(), ask), ask);
  for (const ask of showcase.nearMisses) assert.equal(showcase.match(ask.toLowerCase(), ask), false, ask);
});