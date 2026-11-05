// A "what does X mean" ask in Spanish, French, German, Italian or Portuguese is answered by the dictionary, and a foreign word
// whose entry is one English word gets that word's meanings too (exam definitions, lists run 12: "qué significa serendipia").
// Run: node --test tools/define-languages.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import define, { wordOf } from '../void-live-deploy/skills/define.js';

test('define: the ask in other languages names the word', () => {
  assert.equal(wordOf('qué significa serendipia'), 'serendipia');
  assert.equal(wordOf('¿Qué significa serendipia?'), 'serendipia');
  assert.equal(wordOf('que veut dire saudade'), 'saudade');
  assert.equal(wordOf('was bedeutet Schadenfreude'), 'Schadenfreude');
  assert.equal(wordOf('o que significa saudade'), 'saudade');
  assert.equal(wordOf('qué hora es'), null);
  assert.equal(wordOf('define serendipity'), 'serendipity');
});
test('define: a Spanish word shows its English word and that word\'s meanings', async () => {
  const pages = {
    serendipia: { es: [{ partOfSpeech: 'Noun', language: 'Spanish', definitions: [{ definition: '<a href="/wiki/serendipity">serendipity</a>' }] }] },
    serendipity: { en: [{ partOfSpeech: 'Noun', language: 'English', definitions: [{ definition: 'A combination of events which have come together by chance to make a surprisingly good or wonderful outcome.' }] }] }
  };
  const fetch = async (u) => { const w = decodeURIComponent(u.split('/definition/')[1].split('?')[0]); const b = pages[w];
    return { ok: !!b, status: b ? 200 : 404, json: async () => b }; };
  const el = { innerHTML: '' };
  const r = await define.run('qué significa serendipia', { fetch, showPage: (f) => { f(el); return el; }, esc: (s) => String(s), _pageStill: () => true });
  assert.equal(r, 'define');
  assert.match(el.innerHTML, /Spanish noun: in English, “serendipity”/);
  assert.match(el.innerHTML, /surprisingly good/);
});
