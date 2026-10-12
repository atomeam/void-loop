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

// run 59: the same card takes a saved web page, a text or markdown file, or pasted text. Each heading starts a section, and an
// answer says the section (its heading) and the line, the way a PDF answer says the page and line.
import { sectionsOf, blocksOfText } from '../void-live-deploy/lib/pdf-qa.js';
test('pdf-qa: headings split a page or a text into sections, and an answer names its section and line', () => {
  const s = sectionsOf([{ text: 'Intro words', heading: false }, { text: 'Rent', heading: true }, { text: 'Rent is 900 dollars a month.', heading: false }, { text: 'Pets', heading: true }, { text: 'No dogs over 20 kg.', heading: false }]);
  assert.deepEqual(s.titles, ['', 'Rent', 'Pets']);
  const a = ask('how much is the rent', linesOf(s.pages));
  assert.match(a.lines[0].text, /900 dollars/); assert.equal(s.titles[a.lines[0].page - 1], 'Rent');
  const md = blocksOfText('# Lease\nThe tenant pays on the first.\n\n## Pets\nOne cat is allowed.\n');
  assert.deepEqual(md.map((b) => [b.heading, b.text]), [[true, 'Lease'], [false, 'The tenant pays on the first.'], [true, 'Pets'], [false, 'One cat is allowed.']]);
  assert.deepEqual(sectionsOf([]).pages, []);
});

import { outlineOf } from '../void-live-deploy/lib/pdf-qa.js';
test('pdf-qa: "map it": the headings as a tree, each with its depth, how many lines it holds and where its lines are', () => {
  const md = blocksOfText('Before any heading.\n# Lease\nThe tenant pays on the first.\n## Rent\nRent is 900.\nLate fees are 50.\n## Pets\nOne cat.\n### Deposits\nThe deposit is 300.\n# Signing\nSign both copies.\n');
  assert.deepEqual(md.filter((b) => b.heading).map((b) => [b.text, b.level]), [['Lease', 1], ['Rent', 2], ['Pets', 2], ['Deposits', 3], ['Signing', 1]]);
  const o = outlineOf(sectionsOf(md));
  assert.deepEqual(o.map((n) => [n.title, n.depth, n.lines, n.page]), [['the opening', 0, 1, 1], ['Lease', 0, 1, 2], ['Rent', 1, 2, 3], ['Pets', 1, 1, 4], ['Deposits', 2, 1, 5], ['Signing', 0, 1, 6]]);
  // levels that skip ("#" then "###") still nest one step at a time, and a heading-only doc maps with zero lines
  assert.deepEqual(outlineOf(sectionsOf(blocksOfText('# A\n### B\ntext\n# C'))).map((n) => [n.title, n.depth, n.lines]), [['A', 0, 0], ['B', 1, 1], ['C', 0, 0]]);
  assert.deepEqual(outlineOf(sectionsOf([])), []);
});
