import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, seedOf, pick, clamp, feedOf, versionOf, changesFor, saveOf, loadOf, forgetOf, SAVE_PREFIX } from '../void-live-deploy/lib/game-kit.js';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, m }; };

test('the same seed gives the same sequence, always in [0, 1), and different seeds differ', () => {
  const a = rng(42), b = rng(42), c = rng(43); const A = [], B = [], C = [];
  for (let i = 0; i < 50; i++) { A.push(a()); B.push(b()); C.push(c()); }
  assert.deepEqual(A, B); assert.notDeepEqual(A, C);
  assert.ok(A.every((x) => x >= 0 && x < 1));
  const mean = A.reduce((x, y) => x + y, 0) / A.length; assert.ok(mean > 0.3 && mean < 0.7, 'mean ' + mean);
});

test('seedOf is stable per text and differs between texts; pick and clamp stay inside their bounds', () => {
  assert.equal(seedOf('verse'), seedOf('verse')); assert.notEqual(seedOf('verse'), seedOf('void')); assert.equal(seedOf(null), seedOf(''));
  const r = rng(1); for (let i = 0; i < 100; i++) assert.ok(['a', 'b', 'c'].includes(pick(r, ['a', 'b', 'c'])));
  assert.equal(clamp(5, 0, 3), 3); assert.equal(clamp(-1, 0, 3), 0); assert.equal(clamp(2, 0, 3), 2);
});

test('feedOf turns the live files into names and numbers, newest first, with a safe default for anything missing or malformed', () => {
  const empty = feedOf(); assert.deepEqual(empty, { incidents: [], growth: [], families: [], live: false });
  for (const bad of [null, {}, { incidents: 5, growth: 'x', families: [] }, { incidents: { incidents: [null, {}, { checks: [] }] } }]) { const f = feedOf(bad); assert.equal(f.live, false); assert.deepEqual(f.incidents, []); }
  const live = feedOf({
    incidents: { incidents: [{ at: '2026-10-17T10:00', sha: 'aaaaaaaa11', checks: ['one'] }, { at: '2026-10-19T10:00', sha: 'bbbbbbbb22', checks: ['two  words', 'three'] }] },
    growth: [{ at: '2026-10-17', what: 'older' }, { at: '2026-10-19', what: 'newer   line' }, { at: 'x' }],
    families: { families: [{ id: 'make', name: 'Making things', skills: [{}, {}], count: { proven: 4 } }, { name: '' }, null] },
  });
  assert.equal(live.live, true);
  assert.deepEqual(live.incidents.map((i) => i.sha), ['bbbbbbbb', 'aaaaaaaa']); assert.deepEqual(live.incidents[0].checks, ['two words', 'three']);
  assert.deepEqual(live.growth.map((g) => g.what), ['newer line', 'older']);
  assert.deepEqual(live.families, [{ id: 'make', name: 'Making things', skills: 2, proven: 4 }]);
  const long = feedOf({ growth: [{ at: 'a', what: 'x'.repeat(500) }] }); assert.equal(long.growth[0].what.length, 160);
});

test('versionOf is the build id\'s first seven characters, or dev when there is none', () => {
  assert.equal(versionOf({ id: 'abcdef1234567890' }), 'abcdef1'); assert.equal(versionOf('abcdef1234'), 'abcdef1');
  for (const none of [null, {}, 'nope', { id: 'zzzzzzzz' }, '']) assert.equal(versionOf(none), 'dev');
});

test('changesFor finds the newest ledger lines that name a game, any case, at most n, and none for no name', () => {
  const g = [{ at: '2026-10-19T01:00', what: 'Deploy Trail got a river' }, { at: '2026-10-18T01:00', what: 'something else' }, { at: '2026-10-17T01:00', what: 'deploy trail: new events' }, { at: '2026-10-16', what: 'DEPLOY TRAIL begins' }];
  assert.deepEqual(changesFor(g, ['deploy trail'], 2).map((c) => c.at), ['2026-10-19', '2026-10-17']);
  assert.equal(changesFor(g, 'deploy-trail').length, 0, 'the hyphenated id is a different word: pass every name a game goes by');
  assert.deepEqual(changesFor(g, []), []); assert.deepEqual(changesFor(g, ['ab']), [], 'a name under three characters matches nothing'); assert.deepEqual(changesFor(null, ['deploy trail']), []);
});

test('a save is kept per game and version; another version, junk or a missing store gives a fresh start, never a half-loaded game', () => {
  const s = store();
  assert.equal(saveOf(s, 'trail', { day: 3 }, 1), true); assert.ok(s.m.has(SAVE_PREFIX + 'trail.v1'));
  assert.deepEqual(loadOf(s, 'trail', 1), { day: 3 }); assert.equal(loadOf(s, 'trail', 2), null); assert.equal(loadOf(s, 'other', 1), null);
  s.setItem(SAVE_PREFIX + 'trail.v1', 'not json'); assert.equal(loadOf(s, 'trail', 1), null);
  s.setItem(SAVE_PREFIX + 'trail.v1', JSON.stringify({ v: 1, state: 'a string' })); assert.equal(loadOf(s, 'trail', 1), null);
  saveOf(s, 'trail', { day: 4 }, 1); forgetOf(s, 'trail'); assert.equal(loadOf(s, 'trail', 1), null);
  const broken = { setItem() { throw new Error('quota'); }, getItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  assert.equal(saveOf(broken, 'trail', {}, 1), false); assert.equal(loadOf(broken, 'trail', 1), null); forgetOf(broken, 'trail');
  assert.equal(saveOf(null, 'trail', {}, 1), false); assert.equal(loadOf(null, 'trail', 1), null);
});
