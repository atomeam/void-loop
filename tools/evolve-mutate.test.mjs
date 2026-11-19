import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeRe, mutations, addedChars } from './evolve-mutate.mjs';

test('regexes from asks are escaped before they become patterns', () => {
  assert.equal(escapeRe('what is 1+1?'), 'what is 1\\+1\\?');
});

test('three competing mutations, distinct and bounded', () => {
  const missed = [{ ask: 'chuck it off the screen' }, { ask: 'fling it off the screen' }];
  const [a, b, c] = mutations({ name: 'throw-off', missed, cap: 2 });
  assert.deepEqual(a.patterns.map((p) => p.slice(0, 2)), ['^c', '^f']);
  assert.equal(a.strategy, 'conservative');
  assert.equal(b.strategy, 'adaptive');
  assert.ok(b.patterns.every((p) => p.includes('\\b')));
  assert.equal(c.strategy, 'synthesis');
  assert.equal(c.patterns.length, 1);
  assert.ok(c.patterns[0].includes('|'));
  assert.ok(a.addedChars === undefined && addedChars(a) > 0);
});

test('nothing missed means no candidates to spend a tournament on', () => {
  assert.deepEqual(mutations({ name: 'throw-off', missed: [] }), []);
});
