// Frontier #12, the first piece: a dropped PDF becomes a card that answers questions about it with the line each answer came
// from, read in the browser, nothing uploaded. lib/pdf-qa.js is the pure half: the text by page and line, and an answer that
// is the document's own best-matching lines, each with where it is. Run: node --test tools/pdf-qa.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linesOf, ask, terms } from '../void-live-deploy/lib/pdf-qa.js';

const pages = [
  'Lease agreement\nThe tenant pays rent of 1,200 dollars on the first day of each month.\nA late fee of 50 dollars applies after the fifth day.',
  'Pets\nOne cat or one small dog is allowed with a deposit of 300 dollars.\nThe lease ends on 31 August 2027 unless renewed in writing.',
];

test('pdf-qa: the text by page and line, blank lines and page furniture dropped, each line knows where it is', () => {
  const lines = linesOf(['Header\n\n  Line one  \n3', 'Second page text']);
  assert.deepEqual(lines.map((l) => [l.page, l.line, l.text]), [[1, 1, 'Header'], [1, 2, 'Line one'], [2, 1, 'Second page text']]);
  assert.deepEqual(terms('What is the late fee, and when?'), ['late', 'fee']);
});

test('pdf-qa: three questions about one document, each answered with the line it came from', () => {
  const L = linesOf(pages);
  const rent = ask('how much is the rent?', L), late = ask('is there a late fee', L), end = ask('when does the lease end?', L);
  assert.match(rent.lines[0].text, /rent of 1,200 dollars/); assert.deepEqual([rent.lines[0].page, rent.lines[0].line], [1, 2]);
  assert.match(late.lines[0].text, /late fee of 50 dollars/); assert.equal(late.lines[0].page, 1);
  assert.match(end.lines[0].text, /31 August 2027/); assert.deepEqual([end.lines[0].page, end.lines[0].line], [2, 3]);
});

test('pdf-qa: a question the document does not answer says so instead of guessing; an empty document has nothing to say', () => {
  const none = ask('who won the 1998 world cup', linesOf(pages));
  assert.equal(none.lines.length, 0); assert.match(none.say, /does not say/);
  assert.match(ask('anything', []).say, /no text/);
});
