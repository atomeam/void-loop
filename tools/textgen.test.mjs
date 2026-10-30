// textgen (skills/textgen.js): which generator an ask names (textgenOf), that a bare "band names" stays an encyclopedia ask, and the card:
// five results from the seed (the same five lib/generators.js gives for it), the /generators/ link with generator and seed, the seed line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk, { textgenOf } from '../void-live-deploy/skills/textgen.js';
import { GENERATORS, generate } from '../void-live-deploy/lib/generators.js';
import { pageOfCard } from '../void-live-deploy/lib/card-frame.js';
import { cardAsk } from '../void-live-deploy/lib/generators-card.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const m = (t) => sk.match(t.toLowerCase(), t);
const id = (t) => (textgenOf(t) || {}).id || null;

test('examples in, near misses out', () => {
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
});
test('which generator an ask names', () => {
  const want = { 'band name generator': 'band-names', 'Fantasy Name Generator?': 'fantasy-names', 'give me a story prompt': 'story-prompts', 'random generators': 'fantasy-names', generators: 'fantasy-names', 'name generators': 'fantasy-names',
    'give me 5 band names': 'band-names', 'pet name generator': 'pet-names', 'd&d npc generator': 'dnd-npcs', 'make me a superhero name': 'superhero-names', 'random villain plot': 'villain-plots', 'haiku generator': 'haiku',
    'i need a writing prompt': 'writing-prompts', 'generate some riddles': 'riddles', 'show me a recipe idea': 'recipe-ideas' };
  for (const [a, g] of Object.entries(want)) assert.equal(id(a), g, a);
  for (const a of ['band names', 'date ideas', 'password generator', 'random number', 'give me a hug', 'what is a haiku', '']) assert.equal(id(a), null, a);
});
test('the card: five results from the seed, the link that gives them again', () => {
  const r = Math.random; Math.random = () => 0.5; // newSeed() -> 50000
  const el = { innerHTML: '', dataset: {} };
  try { assert.equal(sk.run('band name generator', { showPage: (f) => f(el), esc }), 'textgen'); } finally { Math.random = r; }
  const five = generate('band-names', 50000, 5);
  assert.equal(five.length, 5); assert.equal(new Set(five).size, 5);
  assert.equal(el.dataset.page, '/generators/?g=band-names&seed=50000', 'the full-page link opens the same five');
  assert.deepEqual(pageOfCard('textgen', el.dataset.page), ['/generators/?g=band-names&seed=50000', 'Generators']);
  assert.match(el.innerHTML, /^<h2>Band names<\/h2>/);
  assert.deepEqual([...el.innerHTML.matchAll(/<li>(.*?)<\/li>/g)].map((x) => x[1]), five.map(esc));
  assert.ok(el.innerHTML.includes('href="/generators/?g=band-names&amp;seed=50000"'));
  assert.ok(el.innerHTML.includes('with ' + (GENERATORS.length - 1) + ' other generators')); assert.equal(GENERATORS.length, 27);
  assert.match(el.innerHTML, /Made on this device from seed 50000, so the link gives the same ones again/);
  assert.deepEqual(generate('band-names', 50000, 5), five); assert.notDeepEqual(generate('band-names', 50001, 5), five);
});
test('an ask that names no generator draws nothing', () => {
  let called = false;
  assert.equal(sk.run('band names', { showPage: () => { called = true; }, esc }), 'none'); assert.equal(called, false);
});

test('one colour is the color skill\'s, not the palette-names generator (issue #1695)', () => {
  for (const a of ['random colour', 'random color', 'a random colour', 'random colours']) assert.equal(textgenOf(a), null, a);
  assert.equal(textgenOf('band name generator').id, 'band-names');
});
test('the Generators page card asks for the generator open on it, and that card leads back to the page', () => {
  for (const g of GENERATORS) {
    const ask = cardAsk('?g=' + g.id + '&seed=12'); assert.ok(ask, g.id);
    assert.equal(textgenOf(ask).id, g.id, ask);
    const el = { innerHTML: '', dataset: {} }; assert.equal(sk.run(ask, { showPage: (f) => f(el), esc }), 'textgen');
    const [href, label] = pageOfCard('textgen', el.dataset.page); assert.equal(label, 'Generators');
    assert.equal(new URLSearchParams(href.slice(href.indexOf('?'))).get('g'), g.id, 'the card opens the same generator (' + href + ')');
  }
  for (const s of ['', '?', '?g=own', '?g=own&seed=3', '?g=nope', '?seed=4', null, '%%%']) assert.equal(cardAsk(s), '', String(s));
  assert.equal(cardAsk('?g=band-names'), 'band names generator');
});
