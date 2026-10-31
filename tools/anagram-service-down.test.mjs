// An anagram card never says "no common word uses these letters" when the word service did not answer (2026-10-30: with Datamuse
// blocked, "anagram of listen" said no word fits, though silent, enlist, tinsel and inlets do).
import test from 'node:test';
import assert from 'node:assert/strict';
import words from '../void-live-deploy/skills/words.js';

async function ask(text, fetcher) {
  const el = { innerHTML: '' }, real = globalThis.fetch;
  globalThis.fetch = fetcher;
  try { await words.run(text, { showPage: (f) => { f(el); return el; }, esc: (s) => String(s), _pageStill: () => true }); } finally { globalThis.fetch = real; }
  return el.innerHTML;
}
const lists = { s: ['silent', 'solid'], e: ['enlist', 'every'], t: ['tinsel'], i: ['inlets'], l: ['listen', 'lemons'], n: ['nobody'] };
const ok = (u) => ({ json: async () => (lists[decodeURIComponent(String(u).split('sp=')[1])[0]] || []).map((word) => ({ word })) });

test('every lookup answers: the anagrams, and no note', async () => {
  const html = await ask('anagram of listen', async (u) => ok(u));
  for (const w of ['silent', 'enlist', 'tinsel', 'inlets']) assert.match(html, new RegExp(w));
  assert.doesNotMatch(html, /did not answer|No common English word/);
});

test('no lookup answers: the service failed, not "no word fits"', async () => {
  const html = await ask('anagram of listen', async () => { throw new Error('blocked'); });
  assert.match(html, /word service didn't answer/);
  assert.doesNotMatch(html, /No common English word/);
});

test('some lookups fail: the words found, and a note that the list may be short', async () => {
  const html = await ask('anagram of listen', async (u) => { if (/sp=s/.test(String(u))) throw new Error('blocked'); return ok(u); });
  assert.match(html, /enlist/);
  assert.match(html, /1 of 6 lookups did not answer/);
});

test('every lookup answers with nothing that fits: that is a real answer', async () => {
  const html = await ask('anagram of xyzq', async () => ({ json: async () => [] }));
  assert.match(html, /No common English word uses exactly the letters XYZQ/);
});
