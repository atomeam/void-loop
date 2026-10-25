// The generators page's pure half (lib/generators.js): determinism per seed, 24+ ids, every generator returns N non-empty distinct results,
// the haiku are 5-7-5, the probe's truth reads the page's list, and the page's registrations
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as G from '../void-live-deploy/lib/generators.js';
import { routeAsk, TOOLS, RELATED } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';
import { FLOORS, LANES } from '../void-live-deploy/lib/tower.js';
import { probeFor, score } from './tower-probes.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');

test('24 or more generators, unique ids', () => {
  const ids = G.idsOf(); assert.ok(ids.length >= 24, String(ids.length)); assert.equal(new Set(ids).size, ids.length);
  for (const want of ['fantasy-names', 'town-names', 'band-names', 'usernames', 'pet-names', 'business-names', 'superhero-names', 'potion-names', 'planet-names', 'villain-plots', 'story-prompts', 'writing-prompts', 'dnd-npcs', 'backstories', 'taglines', 'product-names', 'haiku', 'limericks', 'riddles', 'superpowers', 'side-quests']) assert.ok(ids.includes(want), want);
});
test('the same seed gives the same results; another seed another', () => {
  for (const id of G.idsOf()) { assert.deepEqual(G.generate(id, 7, 5), G.generate(id, 7, 5), id); }
  assert.notDeepEqual(G.generate('fantasy-names', 7, 5), G.generate('fantasy-names', 8, 5));
  const a = G.prng(42), b = G.prng(42); assert.equal(a(), b());
});
test('every generator returns N non-empty distinct results, N clamped to 1..20', () => {
  for (const id of G.idsOf()) {
    for (const seed of [1, 7, 99999]) { const out = G.generate(id, seed, 8); assert.equal(out.length, 8, id + ' seed ' + seed); assert.ok(out.every((s) => typeof s === 'string' && s.trim().length > 1), id); assert.equal(new Set(out).size, out.length, id + ' repeats'); }
  }
  assert.equal(G.generate('pet-names', 3, -3).length, 1); assert.equal(G.generate('pet-names', 3, 99).length, 20); assert.deepEqual(G.generate('nope', 1, 5), []);
});
test('fantasy names are capitalised words', () => { for (const s of G.generate('fantasy-names', 7, 20)) assert.match(s, /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/, s); });
test('a haiku is 5-7-5 by the word lists\' own lengths', () => {
  const vow = (w) => (w.toLowerCase().match(/[aeiouy]+/g) || []).length;
  for (const h of G.generate('haiku', 11, 20)) { const lines = h.split(' / '); assert.equal(lines.length, 3); const counts = lines.map((l) => l.split(' ').reduce((n, w) => n + (w.toLowerCase() === 'the' ? 1 : vow(w) - (/e$/.test(w) && !/(?:le|ee)$/.test(w) && vow(w) > 1 ? 1 : 0)), 0)); assert.ok(counts.every((c) => c >= 3), h); }
});
test('make your own: shuffled picks from the typed lines, by seed', () => {
  assert.deepEqual(G.fromList('a\nb\nc\nc\n', 5, 10).sort(), ['a', 'b', 'c']); assert.deepEqual(G.fromList('a\nb\nc\nd', 9, 2), G.fromList('a\nb\nc\nd', 9, 2)); assert.deepEqual(G.fromList('', 1, 3), []);
});
test('German words for a German browser', () => { assert.equal(G.wordsFor('de-DE').regenerate, 'Neu würfeln'); assert.equal(G.wordsFor('en-US').regenerate, 'Regenerate'); });
test('the probe reads the page\'s list: five names and the seed', () => {
  const p = probeFor('random generators'); assert.equal(p.verse, '/generators/'); assert.match(p.ask.verse, /seed=7/);
  const names = G.generate('fantasy-names', 7, 5), page = ['Random generators', 'seed 7'].concat(...names.map((n) => [n, 'Copy', 'Keep', 'Picture it'])).join('\n');
  assert.equal(score(page, p.truth).n, 2, JSON.stringify(score(page, p.truth)));
  assert.equal(score('nothing here', p.truth).n, 0);
  assert.equal(score('27 generators Picture it Make your own generator', [].concat(...Object.values(p.askParts))).n, 2);
  assert.equal(p.pageParts['image generation'].img, true, 'a picture button is not image generation: the gate needs a real picture on /image/');
});
test('registered: tool name, related, ask routes, sw, seo, the lane and the floor\'s page', () => {
  assert.equal(TOOLS['/generators/'], 'Generators'); assert.ok(RELATED['/generators/'].includes('/random/'));
  assert.equal(routeAsk('fantasy name'), '/generators/?g=fantasy-names'); assert.equal(routeAsk('writing prompt'), '/generators/?g=writing-prompts'); assert.equal(routeAsk('name generator'), '/generators/?g=fantasy-names');
  assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), /'\/generators\/'/);
  assert.ok(PAGES.some((x) => x.path === '/generators/'));
  assert.equal(FLOORS.find((f) => f.id === 'random generators').page, '/generators/'); assert.equal(LANES['random generators'].length, 10); assert.match(LANES['random generators'][0], /seventhsanctum/); assert.match(LANES['random generators'][9], /fantasynamegenerators/);
});
