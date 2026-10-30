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
test('dealing is balanced across types and abilities, never repeats a card', () => {
  const pool = []; for (const [t, b] of [['moon', 'the sky and stars'], ['paris', 'a city on a river'], ['bread', 'food recipe flour'], ['hamlet', 'a book by an author'], ['sum', 'math 1 2 3 4 5']]) for (let i = 0; i < 20; i++) pool.push(A(t + ' ' + i, b + ' ' + 'x '.repeat(i * 15) + (i % 2 ? '\n- a\n- b\n- c' : ''), i % 3));
  const hand = R.balancedPick(pool, 12); assert.equal(hand.length, 12); assert.equal(new Set(hand.map((c) => c.id)).size, 12);
  const per = {}; for (const c of hand) per[c.type] = (per[c.type] || 0) + 1; assert.equal(Object.keys(per).length, 5); assert.ok(Math.max(...Object.values(per)) <= 3);
  assert.ok(new Set(hand.map((c) => c.ability)).size >= 3);
});
test('every older card shape folds into the one record', () => {
  assert.equal(D.fromAny({ t: 'Tokyo', k: 'Place', b: 'Capital of Japan', src: [{ t: 'w' }] }).src, 1);
  assert.equal(D.fromAny({ name: 'calc', power: 7, resistance: 5, income: 1, arrows: 2, abilities: ['proven'] }).game, 'Verse Duel');
  assert.equal(D.fromAny({ key: 'weather', name: 'Weather', typeLine: 'Skill — Sky', adds: 'forecasts', isSkill: true }).kind, 'skill');
  assert.equal(D.fromAny(R.cardFrom({ t: 'moon', b: 'sky' })).game, 'Verse Rally');
  assert.equal(D.fromAny(null), null);
});
