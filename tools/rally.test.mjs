import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/lib/rally-rules.js';
import * as D from '../void-live-deploy/lib/card-deck.js';
import skill from '../void-live-deploy/skills/rally.js';

const A = (t, b, src = 0) => R.cardFrom({ t, b, src });
const deck = (tag) => Array.from({ length: 12 }, (_, i) => A(tag + ' ' + i, 'the moon and the city and 12 numbers 3 4 5 '.repeat(1 + (i % 4)), i % 3));
test('a card is earned from its answer and always the same', () => {
  const c = A('What is the speed of light?', 'Light travels at 299,792 km per second in a vacuum. The sun is 8 light minutes away.', 2);
  assert.deepEqual(c, A('What is the speed of light?', 'Light travels at 299,792 km per second in a vacuum. The sun is 8 light minutes away.', 2));
  assert.equal(c.type, 'sky'); assert.equal(c.ability, 'backed'); assert.ok(c.power >= 1 && c.power <= 10);
  assert.equal(A('pancakes', 'flour, egg, milk; cook the pancakes').type, 'life');
});
test('the wheel goes round: each type beats exactly one other', () => { for (const t of R.TYPES) assert.equal(R.TYPES.filter((u) => R.beats(t, u)).length, 1); });
test('a match ends in at most three rounds at every level, Verse never makes an illegal move', () => {
  for (const level of [1, 2, 3, 4]) for (let seed = 1; seed < 6; seed++) {
    let s = R.newMatch(deck('a'), deck('b'), seed, level), steps = 0;
    while (!s.over && steps++ < 200) { const m = s.turn === 'verse' ? R.verseMove(s) : (R.score(s.row.you) <= R.score(s.row.verse) && s.hand.you.length ? { type: 'play', id: s.hand.you[0].id } : { type: 'pass' }); s = R.apply(s, m); }
    assert.ok(s.over, 'level ' + level + ' seed ' + seed); assert.ok(s.round <= 3);
  }
});
test('the daily seed is the same all day', () => assert.equal(R.dailySeed('2026-10-22T01:00'), R.dailySeed('2026-10-22T23:00')));
test('the binder: loading cards are not noted, saved cards are never dropped, search and kind filter', () => {
  assert.equal(D.recordOf({ t: 'thinking…', b: '…' }), null);
  let list = []; const s = D.recordOf({ t: 'Keep me', b: 'saved', saved: true }, 1); list = D.noteIn(list, s);
  for (let i = 0; i < D.MAX_SEEN + 5; i++) list = D.noteIn(list, D.recordOf({ t: 'card ' + i, b: 'x' }, i + 2));
  assert.ok(list.some((x) => x.t === 'Keep me')); assert.equal(list.filter((x) => !x.saved).length, D.MAX_SEEN);
  list = D.noteIn(list, D.recordOf({ t: 'Harbor Row deed', b: 'rent 50', kind: 'board', game: 'VoidQuest' }, 9999));
  assert.equal(D.view(list, { kind: 'board' })[0].game, 'VoidQuest'); assert.equal(D.view(list, { q: 'keep' }).length, 1);
});
test('plain asks open it, look-alikes do not', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
