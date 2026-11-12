// "the value of 7 factorial" is arithmetic again (lists run 23, 2026-11-12, a slice of closed PR #2335): the snippet skill wrote a Python
// function for any ask with "factorial" in it, so the number never reached the calculator. A factorial with a number and no code words
// now goes to wordMath in void.html; a function ask keeps the code card.
// Run: node --test tools/factorial-value.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './word-math.mjs';
import snippet, { snippetOf } from '../void-live-deploy/skills/snippet.js';

const W = load(), ask = (a) => W.wordMath(a.toLowerCase());

test('a factorial with a number is answered by the calculator', () => {
  for (const [q, v] of [['the value of 7 factorial', '5,040'], ['what is the value of 7 factorial', '5,040'], ['7 factorial', '5,040'], ['value of 10 factorial', '3,628,800'], ['the value of 5!', '120'], ['factorial of 6', '720'], ['what is the value of the factorial of 4', '24']]) {
    const r = ask(q); assert.ok(r, q); assert.equal(r.value, v, q);
  }
  assert.equal(ask('the value of 171 factorial'), null, 'past 170 the calculator says nothing rather than Infinity');
});
test('the snippet card steps aside for the arithmetic and keeps every code ask', () => {
  for (const q of ['the value of 7 factorial', '7 factorial', 'value of 10 factorial', 'what is 12 factorial']) assert.equal(snippetOf(q), null, q);
  for (const q of ['write a python function factorial of n', 'python function for factorial of 5', 'recursive factorial', 'factorial', 'factorial code for 10', 'write a factorial function in javascript']) assert.deepEqual(snippetOf(q), { kind: 'factorial' }, q);
  for (const a of snippet.examples) assert.equal(snippet.match(a.toLowerCase(), a), true, a);
});
