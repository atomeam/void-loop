// Word origins in the define skill (skills/define.js), 2026-10-30: the bench had "what language does the word kindergarten come from"
// answered by an article, never by the dictionary. Verse now reads the word's English Etymology section from Wiktionary and names the language.
//   node --test tools/define-etymology.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import define, { etymologyOf, etymologySection, etymologyFrom, wordOf } from '../void-live-deploy/skills/define.js';

test('word-origin asks name the word, and other "come from" asks do not', () => {
  assert.equal(etymologyOf('what language does the word kindergarten come from'), 'kindergarten');
  assert.equal(etymologyOf('What language does kindergarten come from?'), 'kindergarten');
  assert.equal(etymologyOf('etymology of salary'), 'salary');
  assert.equal(etymologyOf("what's the etymology of the word quarantine"), 'quarantine');
  assert.equal(etymologyOf('where does the word okay come from'), 'okay');
  assert.equal(etymologyOf('origin of the word robot'), 'robot');
  assert.equal(etymologyOf('tsunami etymology'), 'tsunami');
  for (const a of ['what language do they speak in brazil', 'where does coffee come from', 'history of rome', 'origin of the universe', 'what is the origin of life', 'define serendipity'])
    assert.equal(etymologyOf(a), null, a);
  // the dictionary asks are unchanged
  assert.equal(wordOf('define serendipity'), 'serendipity');
  assert.ok(define.match('what language does the word kindergarten come from', 'what language does the word kindergarten come from'));
  assert.ok(!define.match('where does coffee come from', 'where does coffee come from'));
});

// the sections Wiktionary's parse API gives for "kindergarten" (shape of action=parse&prop=sections, trimmed)
const sections = [
  { level: '2', line: 'English', index: '1' }, { level: '3', line: 'Alternative forms', index: '2' }, { level: '3', line: 'Etymology', index: '3' },
  { level: '3', line: 'Pronunciation', index: '4' }, { level: '2', line: 'German', index: '8' }, { level: '3', line: 'Etymology', index: '9' },
];

test('the English Etymology section is found, never another language\'s', () => {
  assert.equal(etymologySection(sections), '3');
  assert.equal(etymologySection([{ level: '2', line: 'English', index: '1' }, { level: '3', line: 'Etymology 1', index: '2' }, { level: '3', line: 'Etymology 2', index: '5' }]), '2');
  assert.equal(etymologySection([{ level: '2', line: 'German', index: '1' }, { level: '3', line: 'Etymology', index: '2' }]), '');
  assert.equal(etymologySection([{ level: '2', line: 'English', index: '1' }, { level: '3', line: 'Noun', index: '2' }, { level: '2', line: 'French', index: '3' }, { level: '3', line: 'Etymology', index: '4' }]), '');
  assert.equal(etymologySection(null), '');
});

// the shape of the rendered section: a heading, sometimes an empty paragraph or a tree first, then the paragraph with span.etyl
const html = '<div class="mw-content-ltr mw-parser-output" lang="en"><div class="mw-heading mw-heading3"><h3 id="Etymology">Etymology</h3></div>'
  + '<style>.x{}</style><p></p><table class="tree"><tr><td><p>German Kinder</p></td></tr></table>'
  + '<p>Borrowed from <span class="etyl"><a href="https://en.wikipedia.org/wiki/German_language" class="extiw" title="w:German language">German</a></span> '
  + '<i class="Latn mention" lang="de"><a href="/wiki/Kindergarten#German">Kindergarten</a></i>, from <i>Kinder</i> (&#8220;children&#8221;) + <i>Garten</i> (&#8220;garden&#8221;).<sup class="reference">[1]</sup></p></div>';

test('the section gives the language it came from and the first paragraph, as plain text', () => {
  const e = etymologyFrom(html);
  assert.equal(e.from, 'German');
  assert.equal(e.text, 'Borrowed from German Kindergarten, from Kinder (“children”) + Garten (“garden”).');
  assert.deepEqual(etymologyFrom(''), { from: '', text: '' });
  // a name that is not a plain language name is left out
  assert.equal(etymologyFrom('<p>From <span class="etyl"><a>Proto-<b>X</b>{{bad}}</a></span> the old word for it.</p>').from, '');
  // a long history is cut at a whole sentence after 400 characters
  const long = '<p>' + 'This is one sentence of history. '.repeat(30) + '</p>', t = etymologyFrom(long).text;
  assert.ok(t.length <= 440 && t.endsWith('.'), t);
});

const fake = (routes) => async (u) => { for (const [k, v] of routes) if (String(u).includes(k)) { if (v instanceof Error) throw v; return { ok: true, json: async () => v }; } throw new Error('no route ' + u); };
async function ask(text, routes) {
  const el = { innerHTML: '' }, real = globalThis.fetch, asked = [];
  globalThis.fetch = async (u) => { asked.push(String(u)); return fake(routes)(u); };
  try {
    const r = await define.run(text, { showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/</g, '&lt;'), _pageStill: () => true });
    return { r, html: el.innerHTML, asked };
  } finally { globalThis.fetch = real; }
}

test('the kindergarten ask shows where the word comes from, with Wiktionary as its source', async () => {
  const { r, html: out, asked } = await ask('what language does the word kindergarten come from', [['prop=sections', { parse: { sections } }], ['prop=text', { parse: { text: html } }]]);
  assert.equal(r, 'define');
  assert.ok(asked.every((u) => u.startsWith('https://en.wiktionary.org/w/api.php?') && u.includes('origin=*')), asked.join(' '));
  assert.ok(asked[1].includes('section=3'));
  assert.ok(out.includes('<h2>kindergarten</h2>') && out.includes('From German.') && out.includes('Kinder (“children”) + Garten (“garden”)'), out);
  assert.ok(out.includes('Source: <a href="https://en.wiktionary.org/wiki/kindergarten#Etymology"'), out);
});

test('no word history, and no answer at all, each say so plainly', async () => {
  let o = await ask('etymology of zzyzx', [['prop=sections', { parse: { sections: [{ level: '2', line: 'English', index: '1' }] } }]]);
  assert.equal(o.r, 'define'); assert.match(o.html, /Wiktionary has no word history for “zzyzx”/);
  o = await ask('etymology of salary', [['prop=sections', new Error('offline')]]);
  assert.equal(o.r, 'none'); assert.match(o.html, /didn't answer just now/);
});
