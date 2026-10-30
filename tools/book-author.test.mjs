// "who wrote pride and prejudice" (skills/book.js), 2026-10-30: this and "who is the author of dune" fell to an article on a-to-mind.com.
// Now Open Library's title search names the author, and only for a book whose title is the one asked; no such title says so.
//   node --test tools/book-author.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import book, { bookOf } from '../void-live-deploy/skills/book.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function ask(text, answer) {
  const el = { innerHTML: '' }, real = globalThis.fetch, seen = [];
  globalThis.fetch = async (u) => { seen.push(String(u)); const b = answer(String(u)); if (b instanceof Error) throw b; return { ok: true, json: async () => b }; };
  try { const r = await book.run(text, { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true }); return { r, html: el.innerHTML, seen }; }
  finally { globalThis.fetch = real; }
}

test('author asks are read; songs, documents and "this" are not', () => {
  assert.deepEqual(bookOf('who wrote pride and prejudice'), { q: 'pride and prejudice', isbn: false, author: true });
  assert.deepEqual(bookOf('Who wrote the novel Dracula?'), { q: 'Dracula', isbn: false, author: true });
  assert.deepEqual(bookOf('who is the author of dune'), { q: 'dune', isbn: false, author: true });
  for (const a of ['who wrote this song', 'who wrote it', 'who wrote the lyrics to hello', 'who wrote the declaration of independence', 'who wrote this code']) assert.equal(bookOf(a), null, a);
  for (const a of book.examples) assert.ok(book.match(a.toLowerCase(), a), a);
  for (const a of book.nearMisses) assert.ok(!book.match(a.toLowerCase(), a), a);
});

test('the author of the book whose title matches, linked, with Open Library as the source', async () => {
  const o = await ask('who wrote pride and prejudice', () => ({ docs: [{ key: '/works/OL1W', title: 'Pride and Prejudice and Zombies', author_name: ['Seth Grahame-Smith'] }, { key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'], first_publish_year: 1813 }] }));
  assert.equal(o.r, 'book'); assert.ok(o.seen[0].includes('&title=pride%20and%20prejudice'), o.seen[0]);
  assert.ok(o.html.includes('was written by Jane Austen, first published in 1813.') && !o.html.includes('Grahame'), o.html);
  assert.ok(o.html.includes('href="https://openlibrary.org/works/OL66554W"'));
  assert.match(o.html, /<div class="src">Source: <a href="https:\/\/openlibrary\.org\/search\?title=pride%20and%20prejudice"/);
});

test('no book with that title: no guessed author; no answer: says so', async () => {
  let o = await ask('who wrote zzyzx road', () => ({ docs: [{ key: '/works/X', title: 'Something Else', author_name: ['A. Writer'] }] }));
  assert.equal(o.r, 'book'); assert.match(o.html, /no book with that exact title/); assert.ok(!o.html.includes('A. Writer'));
  o = await ask('who wrote dune', () => new Error('offline'));
  assert.equal(o.r, 'none'); assert.match(o.html, /didn't answer/);
});
