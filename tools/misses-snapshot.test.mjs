// The public miss snapshot (tools/misses-snapshot.mjs): only short all-letter words seen in at least three different asks
// reach the repo, never an ask, an email, a number or a key. Run: node --test tools/misses-snapshot.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, words, madeThing, MIN_ASKS } from './misses-snapshot.mjs';

const row = (ask, count = 1, last = '2026-10-10T10:00') => ({ ask, count, last });

test('a term is listed only when at least three different asks contain it, counted over distinct asks', () => {
  const s = snapshot([row('tide times in lisbon'), row('Tide times in Lisbon', 4), row('tide table for porto'), row('when is high tide'), row('lisbon weather')]);
  assert.equal(MIN_ASKS, 3);
  const tide = s.terms.find((t) => t.term === 'tide');
  assert.deepEqual(tide, { term: 'tide', asks: 3, misses: 7 }, 'the same ask typed twice counts once as an ask, its misses add up');
  assert.equal(s.terms.find((t) => t.term === 'lisbon'), undefined, 'two different asks are not enough');
  assert.equal(s.distinctAsks, 4);
});

test('nothing personal-looking reaches the snapshot: no ask text, emails, numbers, keys, long or mixed words', () => {
  const rows = ['email bob.smith@example.com about tide', 'call 555 123 4567 about tide', 'tide sk_live_51HxQabc123def456ghi',
    'unlock hunter2 tide', 'tide supercalifragilisticexpialidocious', 'tide r2d2 status', 'tide charts'].map((a) => row(a));
  const s = snapshot(rows), text = JSON.stringify(s);
  for (const bad of ['bob', 'smith', 'example', '555', '4567', 'sk_live', 'hunter', 'supercali', 'r2d2']) assert.ok(!text.includes(bad), bad + ' must not appear');
  assert.ok(s.terms.some((t) => t.term === 'tide'));
  for (const t of [...s.terms, ...s.make]) assert.match(t.term, /^[a-z]{3,16}( [a-z]{3,16})?$/);
  assert.deepEqual(Object.keys(s).sort(), ['at', 'distinctAsks', 'make', 'rule', 'schema', 'since', 'terms']);
});

test('make/print asks give their thing, under the same three-asks rule (what the forge builds next)', () => {
  assert.equal(madeThing('make me a guitar'), 'guitar'); assert.equal(madeThing('3d print a chess set'), 'chess set');
  assert.equal(madeThing('Can you make a dragon?'), 'dragon'); assert.equal(madeThing('make a list of my tasks'), null);
  assert.equal(madeThing('what is a guitar'), null);
  const s = snapshot([row('make me a guitar'), row('make a guitar', 2), row('3d print a guitar'), row('make me a dragon'), row('make a dragon')]);
  assert.deepEqual(s.make, [{ term: 'guitar', asks: 3, misses: 4 }], 'the dragon has only two different asks');
});

test('stop words and short words are not terms; an old miss outside the window is left out', () => {
  assert.deepEqual(words('Can you show me how to make the tide chart?'), ['tide', 'chart']);
  const s = snapshot([row('tide a', 1, '2026-09-01T00:00'), row('tide b'), row('tide c'), row('tide d')], { since: '2026-10-01' });
  assert.deepEqual(s.terms.find((t) => t.term === 'tide'), { term: 'tide', asks: 3, misses: 3 });
});

test('a word only ever written with a capital (a name, a place) is never listed, however many asks contain it; written in lower case once, it may be', () => {
  const rows = ['ask Priya about the tide', 'did Priya call about the tide', 'Priya says the tide is high', 'make me a Priya', 'make me a Priya', 'make me a Priya please']
    .map((ask, i) => ({ ask: ask + ' ' + i, count: 1 }));
  const s = snapshot(rows);
  assert.ok(!s.terms.some((t) => t.term === 'priya'), JSON.stringify(s.terms));
  assert.ok(!s.make.some((t) => t.term === 'priya'), JSON.stringify(s.make));
  assert.ok(s.terms.some((t) => t.term === 'tide'));
  const once = snapshot(rows.concat([{ ask: 'priya is a word here', count: 1 }]));
  assert.ok(once.terms.some((t) => t.term === 'priya'), 'seen in lower case once');
});
