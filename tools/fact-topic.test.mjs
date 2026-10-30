// "tell me a fact about octopuses" (skills/fact.js), 2026-10-30: a-to-mind.com sent it to the article search, which quoted a law that names
// octopuses in passing. A topic fact is now a sentence from the lead of the Wikipedia article on that topic, with the article as its source.
//   node --test tools/fact-topic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fact, { factTopic, factSentences, isFact } from '../void-live-deploy/skills/fact.js';

// the lead of "Octopus" as Wikipedia's API gave it on 2026-10-30, first paragraph
const lead = 'An octopus (pl.: octopuses or octopodes) is a soft-bodied, eight-limbed mollusc of the order Octopoda (, ok-TOP-ə-də). The order consists of some 300 species and is grouped within the class Cephalopoda with squids, cuttlefish, and nautiloids. Like other cephalopods, an octopus is bilaterally symmetric with two eyes and a beaked mouth at the centre point of the eight limbs. An octopus can radically deform its shape, enabling it to squeeze through small gaps. They trail their appendages behind them as they swim backwards. The siphon is used for respiration and locomotion (by water jet propulsion). Octopuses have a complex nervous system and excellent sight, and are among the most intelligent and behaviourally diverse invertebrates.';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function ask(text, answer) {
  const el = { innerHTML: '' }, real = globalThis.fetch, seen = [];
  globalThis.fetch = async (u) => { seen.push(String(u)); const b = answer(String(u)); if (b instanceof Error) throw b; return { ok: true, json: async () => b }; };
  try { const r = await fact.run(text, { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true }); return { r, html: el.innerHTML, seen }; }
  finally { globalThis.fetch = real; }
}

test('a fact about a topic names the topic; plain fact asks and other asks name none', () => {
  assert.equal(factTopic('tell me a fact about octopuses'), 'octopuses');
  assert.equal(factTopic('give me a fun fact about the moon'), 'moon');
  assert.equal(factTopic('fun facts about mars'), 'mars');
  assert.equal(factTopic('give me 3 facts about cats'), 'cats');
  for (const a of ['tell me a fact', 'fun fact', 'facts about space', 'what is a fact', 'tell me a fact about me', 'tell me something about rome']) assert.equal(factTopic(a), '', a);
  for (const a of fact.examples) assert.ok(fact.match(a.toLowerCase(), a), a);
  for (const a of fact.nearMisses) assert.ok(!fact.match(a.toLowerCase(), a), a);
  assert.ok(isFact('random fact') && !isFact('tell me a fact about octopuses'));
});

test('the lead splits into whole sentences, with no brackets, and the naming sentence last', () => {
  const s = factSentences(lead);
  assert.equal(s[0], 'The order consists of some 300 species and is grouped within the class Cephalopoda with squids, cuttlefish, and nautiloids.');
  assert.equal(s[s.length - 1], 'An octopus is a soft-bodied, eight-limbed mollusc of the order Octopoda.');
  assert.ok(s.includes('The siphon is used for respiration and locomotion.'));
  assert.ok(s.every((x) => !/[()]/.test(x) && /[.!?]$/.test(x)), s.join(' | '));
  assert.deepEqual(factSentences(''), []);
  assert.deepEqual(factSentences('Mercury may refer to many things in science and in myth.'), []);
});

test('the card shows a sentence of the article, linked to it; no article and no answer say so', async () => {
  let o = await ask('tell me a fact about octopuses', () => ({ query: { pages: { 22780: { pageid: 22780, title: 'Octopus', extract: lead } } } }));
  assert.equal(o.r, 'fact');
  assert.ok(o.seen[0].startsWith('https://en.wikipedia.org/w/api.php?') && o.seen[0].includes('redirects=1') && o.seen[0].includes('titles=octopuses'), o.seen[0]);
  assert.match(o.html, /<h2>A fact about Octopus<\/h2>/);
  assert.ok(factSentences(lead).slice(0, 6).some((x) => o.html.includes(esc(x))), o.html);
  assert.match(o.html, /Source: <a href="https:\/\/en\.wikipedia\.org\/wiki\/Octopus"[^>]*>Wikipedia, Octopus<\/a>/);
  o = await ask('a fact about zzyzx qq', () => ({ query: { pages: { '-1': { title: 'Zzyzx qq', missing: '' } } } }));
  assert.equal(o.r, 'fact'); assert.match(o.html, /no single article named/); assert.ok(!o.html.includes('Source:'));
  o = await ask('a fact about mercury', () => ({ query: { pages: { 9: { title: 'Mercury', pageprops: { disambiguation: '' }, extract: 'Mercury may refer to many things.' } } } }));
  assert.match(o.html, /no single article named/);
  o = await ask('a fact about octopuses', () => new Error('offline'));
  assert.equal(o.r, 'none'); assert.match(o.html, /Wikipedia didn't answer just now/);
});
