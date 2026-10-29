import test from 'node:test';
import assert from 'node:assert/strict';
import { tidy, whatOf, MAX } from './what-skills.mjs';

test('a line is one plain sentence: whitespace folded, the book\'s ellipsis dropped, long ones cut at a word', () => {
  assert.equal(tidy('  A   countdown\n on the stage… '), 'A countdown on the stage');
  assert.equal(tidy(null), '');
  const long = tidy('word '.repeat(60));
  assert.ok(long.length <= MAX + 1 && long.endsWith('…') && !/ …$/.test(long));
  assert.equal(tidy('x'.repeat(200)).length, MAX + 1);
});

test('every skill with something to say gets its line; one that only repeats its name, a game and a chapter do not', () => {
  const w = whatOf({ pages: [
    { kind: 'skill', name: 'timer', line: 'A countdown on the stage' }, { kind: 'skill', name: 'counter', line: 'counter' },
    { kind: 'skill', name: 'tiny', line: 'short' }, { kind: 'game', name: 'chess', line: 'A board game against Verse' }, { kind: 'chapter', name: 'make', line: 'x'.repeat(20) },
    { kind: 'skill', name: 'alpha', line: 'Answers in Spanish… ' },
  ] });
  assert.deepEqual(w, { alpha: 'Answers in Spanish', timer: 'A countdown on the stage' });
  assert.deepEqual(Object.keys(w), ['alpha', 'timer']);
  assert.deepEqual(whatOf(null), {});
});
