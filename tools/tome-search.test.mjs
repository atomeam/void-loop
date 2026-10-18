// Search the tome (asked by Verse): the best pages for a few typed words, from the book's own words.
// Run: node --test tools/tome-search.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchBook, SEARCH_CSS } from '../void-live-deploy/lib/tome-search.js';

const book = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/guide.json', import.meta.url), 'utf8'));
const skill = (n) => book.pages.find((p) => p.kind === 'skill' && p.name === n);

test('a skill is found by its name, its title or an ask it answers, and the name comes first', () => {
  const w = skill('weather'); assert.ok(w);
  assert.equal(searchBook(book, 'weather')[0].n, w.n);
  assert.equal(searchBook(book, 'Weather')[0].n, w.n);
  const ex = w.examples[0]; const hit = searchBook(book, ex).find((h) => h.n === w.n); assert.ok(hit, 'found by the ask "' + ex + '"'); assert.equal(hit.hint, ex);
});
test('every skill page is found by its own name (the book is not missing a page)', () => {
  for (const p of book.pages.filter((x) => x.kind === 'skill')) assert.ok(searchBook(book, p.title || p.name, 20).some((h) => h.n === p.n), p.name);
});
test('nothing for one letter or for words the book does not have; at most `max`; covers and indexes are not hits', () => {
  assert.deepEqual(searchBook(book, 'a'), []); assert.deepEqual(searchBook(book, ''), []); assert.deepEqual(searchBook(book, 'qzxv wibble'), []);
  assert.ok(searchBook(book, 'the', 3).length <= 3);
  assert.ok(searchBook(book, 'index').every((h) => ['skill', 'game', 'mini'].includes(h.kind)));
  assert.deepEqual(searchBook(null, 'weather'), []);
});
test('the bar is docked to the top, and its css is plain', () => { assert.match(SEARCH_CSS, /\.tome-search\{position:absolute;top:/); assert.doesNotMatch(SEARCH_CSS, /url\(|@import/); });
