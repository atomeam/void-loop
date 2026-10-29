// Writing aids, proofread and thread (the owner's writing list, 2026-10-19: "syntax and grammar polishing", "format optimization"): mechanical and rule-based, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proofread, threadOf, parseWritingAsk, transform, MODES, MODE_LABEL } from '../void-live-deploy/lib/writing-aids.js';

test('proofread fixes the mechanical slips and says what it fixed', () => {
  const r = proofread('teh cat sat sat on the mat  .  i recieve it alot!!');
  assert.equal(r.text, 'The cat sat on the mat. I receive it a lot!');
  for (const k of ['doubled word', 'common misspelling', 'lowercase "I"']) assert.ok(r.fixes.some((f) => f.startsWith(k)), k);
});
test('proofread leaves clean text and legitimate repeats alone', () => {
  assert.equal(proofread('He said that that was fine. It is what it is.').text, 'He said that that was fine. It is what it is.');
  assert.deepEqual(proofread('A clean sentence.').fixes, []);
});
test('a thread keeps every post at 280 characters or fewer, numbered, in order, losing no words', () => {
  const text = Array.from({ length: 40 }, (_, i) => 'Sentence number ' + i + ' says one small thing.').join(' ');
  const posts = threadOf(text);
  assert.ok(posts.length > 1 && posts.every((p) => p.length <= 280));
  posts.forEach((p, i) => assert.ok(p.startsWith((i + 1) + '/' + posts.length + ' '), p.slice(0, 8)));
  assert.equal(posts.map((p) => p.replace(/^\d+\/\d+ /, '')).join(' '), text);
});
test('one short text is a single unnumbered post, and one huge sentence is cut at words', () => {
  assert.deepEqual(threadOf('Short and sweet.'), ['Short and sweet.']);
  const long = threadOf('word '.repeat(200).trim() + '.');
  assert.ok(long.length > 1 && long.every((p) => p.length <= 280));
});
test('the asks reach the modes, and both modes are on the card', () => {
  assert.equal(parseWritingAsk('proofread: teh cat').mode, 'proofread');
  assert.equal(parseWritingAsk('fix the grammar in: he go home').mode, 'proofread');
  assert.equal(parseWritingAsk('turn this into a thread: One. Two.').mode, 'thread');
  assert.equal(parseWritingAsk('make this a twitter thread: One. Two.'), null); // only the named shapes
  for (const m of ['proofread', 'thread']) { assert.ok(MODES.includes(m) && MODE_LABEL[m]); assert.equal(typeof transform(m, 'One thing. Another thing.').out, 'string'); }
});
