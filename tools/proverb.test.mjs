// the proverb skill (skills/proverb.js), 2026-10-30: it showed one of 15 fixed lines with no source ("an old saying" on a-to-mind.com).
// It now shows a proverb from Wikiquote's "English proverbs" page, linked to its keyword's section, and says so plainly when Wikiquote does not answer.
//   node --test tools/proverb.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { proverbsFrom, cleanProverb, fetchProverb } from '../void-live-deploy/skills/proverb.js';

// the "Cat" section as Wikiquote's parse API gave it on 2026-10-30, trimmed: each proverb with its meaning, usage and sources nested under it
const cat = '<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><div class="mw-heading mw-heading2"><h2 id="Cat"><a href="/wiki/Cat" class="mw-redirect" title="Cat">Cat</a></h2>'
  + '<span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=English_proverbs&amp;action=edit&amp;section=1"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>\n'
  + '<ul><li>A cat may look at a king.\n<ul><li>"I am firmly convinced, as I have already said, that to effect any great social improvement, it is sympathy rather than self-interest."</li>\n'
  + '<li><a href="/wiki/Henry_George" title="Henry George">Henry George</a>, <i>Social Problems</i>, Chapter 21: Conclusion (1883).</li>\n'
  + '<li><cite style="font-style:normal" class="book" id="CITEREFCarew&#95;Hazlitt1869">Carew Hazlitt, William&#32;(1869).&#32;<i>English Proverbs and Proverbial Phrases</i>. p.&#160;5.</cite></li></ul></li>\n'
  + '<li>Curiosity killed the cat.\n<ul><li>"Inquisitiveness – or a desire to find about something – can lead you into trouble."</li>\n<li><cite class="book">Martin H. Manser&#32;(2007).</cite></li></ul></li>\n'
  + '<li>There\'s more than one way to skin a cat.\n<ul><li><cite class="book">Anand Prahlad (1996).</cite></li></ul></li>\n'
  + '<li>The more you stroke the cat\'s tail, the more he raises his back. (Strauss, 1994 p. 1184)</li>\n'
  + '<li>When the cat is away, the mice will play. (16th century) (Citatboken)\n<ul><li>"In the absence of the person in authority those under his control will often neglect the duties." (Paczolay, 1997 p. 114)</li></ul></li></ul></div>';
const secs = [{ level: '2', line: 'Absent', index: '1', anchor: 'Absent' }, { level: '2', line: 'Cat', index: '54', anchor: 'Cat' }, { level: '2', line: 'See also', index: '230', anchor: 'See_also' }];

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.equal(skill.suite().ok, true);
});

test('a section gives its proverbs only, never the meanings, usages or books nested under them', () => {
  assert.deepEqual(proverbsFrom(cat), ['A cat may look at a king.', 'Curiosity killed the cat.', 'There\'s more than one way to skin a cat.',
    'The more you stroke the cat\'s tail, the more he raises his back.', 'When the cat is away, the mice will play.']);
  assert.deepEqual(proverbsFrom(''), []);
  assert.equal(cleanProverb('Beauty is truth, truth beauty (John Keats)'), 'Beauty is truth, truth beauty (John Keats)', 'a named person stays with the line');
  assert.equal(cleanProverb('When the cat is away, the mice will play. (16th century) (Citatboken)'), 'When the cat is away, the mice will play.');
  assert.equal(proverbsFrom('<ul><li>Fish &amp; chips &lt;b&gt;win&lt;/b&gt; every time.</li></ul>')[0], 'Fish & chips <b>win</b> every time.', 'entities decoded once; the card escapes them');
});

async function ask(pages) {
  const el = { innerHTML: '' }, real = globalThis.fetch, asked = [];
  globalThis.fetch = async (u) => { asked.push(String(u)); const p = pages.shift(); if (p instanceof Error) throw p; return { ok: true, json: async () => p }; };
  try {
    const r = await skill.run('tell me an old saying', { showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), _pageStill: () => true });
    return { r, html: el.innerHTML, asked };
  } finally { globalThis.fetch = real; }
}

test('an ask reads the keyword list, then one keyword, and shows a proverb from it with that section as its source', async () => {
  const { r, html, asked } = await ask([{ parse: { title: 'English proverbs', sections: secs } }, { parse: { text: cat } }]);
  assert.equal(r, 'proverb');
  assert.ok(asked[0].startsWith('https://en.wikiquote.org/w/api.php?') && asked[0].includes('origin=*') && asked[0].includes('prop=sections') && asked[0].includes('page=English%20proverbs'), asked[0]);
  assert.ok(/section=(1|54)\b/.test(asked[1]) && !asked[1].includes('section=230'), asked[1]);
  assert.match(html, /<h2>A proverb<\/h2><p [^>]*>[^<]{8,}<\/p>/);
  assert.match(html, /Source: <a href="https:\/\/en\.wikiquote\.org\/wiki\/English_proverbs#(Absent|Cat)"[^>]*>Wikiquote, English proverbs: (Absent|Cat)<\/a>/);
  assert.ok(!/Hazlitt|Henry George|Inquisitiveness/.test(html), 'no note or source text shows as the proverb');
});

test('the keyword list is read once; a section with no proverb is skipped; no answer says so instead of a fixed line', async () => {
  let o = await ask([{ parse: { text: '<p>nothing listed</p>' } }, { parse: { text: cat } }]);
  assert.equal(o.r, 'proverb'); assert.equal(o.asked.length, 2, 'the list from the last ask is kept'); assert.ok(o.asked.every((u) => u.includes('prop=text')));
  o = await ask([new Error('offline')]);
  assert.equal(o.r, 'none'); assert.match(o.html, /Wikiquote didn't answer just now/); assert.ok(!/A stitch in time/.test(o.html));
  o = await ask([{ parse: { sections: secs } }, { parse: { text: cat } }]);
  assert.equal(o.r, 'proverb', 'after a failure the list is read again'); assert.ok(o.asked[0].includes('prop=sections'));
});
