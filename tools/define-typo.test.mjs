// node --test tools/define-typo.test.mjs: issue #792, "menaing of saudade" got "don't know this yet". Misspelled meaning/definition
// still reach the dictionary card; real look-alike words ("mending of ...") do not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordOf } from '../void-live-deploy/skills/define.js';
test('typos in the key word still define', () => {
  for (const [a, w] of [['menaing of saudade', 'saudade'], ['meanign of saudade', 'saudade'], ['defintion of hubris', 'hubris'], ['what is the menaing of zen', 'zen'], ['dictionary defintion of empathy', 'empathy']]) assert.equal(wordOf(a), w, a);
  for (const a of ['mending of saudade', 'defense of rome']) assert.equal(wordOf(a), null, a);
});
