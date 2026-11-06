// lib/emoji-dict.js: the emoji dictionary (/emojis/dictionary/, emojigraph.org's tower lane), all on the device
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMOJI, GROUPS, SUBGROUPS, groupCounts, subgroupsOf, groupIndex, search, similar, recordOf, codepoints, writings, shortcode, stateToHash, stateFromHash, deal, newGame, flip, won, gameSpec } from '../void-live-deploy/lib/emoji-dict.js';
import { moduleOf, subgroupName } from './emoji-dict-data.mjs';

test('the list holds every emoji of the nine groups, each in a subgroup, with no component and no repeat', () => {
  assert.ok(EMOJI.length > 1800, EMOJI.length + ' emoji');
  assert.deepEqual(GROUPS.map((g) => g[1]), ['Smileys & Emotion', 'People & Body', 'Animals & Nature', 'Food & Drink', 'Travel & Places', 'Activities', 'Objects', 'Symbols', 'Flags']);
  assert.equal(new Set(EMOJI.map((e) => e.c)).size, EMOJI.length);
  assert.equal(groupCounts().reduce((n, g) => n + g.count, 0), EMOJI.length);
  for (const e of EMOJI) { assert.ok(SUBGROUPS[e.s], e.c); assert.ok(e.n, e.c); assert.ok(/^\d+(?:\.\d+)?$/.test(e.v), e.c + ' version ' + e.v); }
  assert.deepEqual(subgroupsOf(0).slice(0, 3).map((s) => s.name), ['Face smiling', 'Face affection', 'Face tongue']);
  assert.equal(groupIndex('animals-nature'), 2); assert.equal(groupIndex('Flags'), 8); assert.equal(groupIndex('nope'), -1);
  const cat = recordOf('🐱'); assert.equal(cat.n, 'cat face'); assert.equal(GROUPS[cat.g][1], 'Animals & Nature'); assert.ok(cat.k.includes('kitten'));
  assert.equal(recordOf('❤').n, 'red heart', 'found without its variation selector');
});
test('a search finds by name first, then by keyword, and a pasted emoji finds itself and the ones like it', () => {
  assert.equal(search('cat face')[0].c, '🐱');
  assert.ok(search('cat').slice(0, 8).every((e) => /cat/.test(e.n)));
  assert.ok(search('kitten').some((e) => e.c === '🐱'), 'a keyword');
  assert.ok(search('love').some((e) => e.c === '❤️'));
  const self = search('🐶'); assert.equal(self[0].c, '🐶'); assert.ok(self.length > 1);
  assert.deepEqual(search(''), []); assert.deepEqual(search('zzqqxx'), []);
  assert.ok(similar(recordOf('😀')).every((e) => e.c !== '😀')); assert.ok(similar(recordOf('😀')).some((e) => e.s === recordOf('😀').s));
});
test('the code points and the ways to write an emoji are right', () => {
  assert.equal(codepoints('🐱'), 'U+1F431');
  assert.equal(codepoints('❤️'), 'U+2764 U+FE0F');
  assert.deepEqual(writings('🐱'), { html: '&#x1F431;', css: '\\1F431', js: '\\u{1F431}', url: '%F0%9F%90%B1', utf8: 'F0 9F 90 B1', utf16: 'D83D DC31' });
  assert.equal(writings('👍🏽').html, '&#x1F44D;&#x1F3FD;');
  assert.equal(shortcode(recordOf('🐱')), ':cat_face:');
});
test('the whole view survives a round trip through the hash, and bad parts are dropped', () => {
  const st = { view: 'game', e: '🐱', q: 'cat face', g: 'animals-nature', k: 'hi 👋🏽 there', m: '42.8.3' };
  assert.deepEqual(stateFromHash(stateToHash(st)), st);
  assert.deepEqual(stateFromHash(stateToHash({ e: '❤' })), { view: 'browse', e: '❤️', q: '', g: '', k: '', m: '' }, 'an emoji is written in its full form');
  assert.equal(stateToHash({}), ''); assert.equal(stateToHash({ view: 'browse' }), '');
  assert.deepEqual(stateFromHash('#view=evil&e=notanemoji&g=nope&m=1;alert(1)&x=1'), { view: 'browse', e: '', q: '', g: '', k: '', m: '' });
  assert.ok(stateFromHash(stateToHash({ k: '😀'.repeat(400) })).k.length <= 280 * 2);
});
test('the memory game deals the same board from the same link, and plays fair', () => {
  assert.deepEqual(deal(7, 8), deal(7, 8)); assert.notDeepEqual(deal(7, 8), deal(8, 8));
  const cards = deal(7, 8); assert.equal(cards.length, 16); for (const c of new Set(cards)) assert.equal(cards.filter((x) => x === c).length, 2);
  assert.ok(deal(3, 6, 2).every((c) => recordOf(c).g === 2), 'a group board stays in its group');
  assert.deepEqual(gameSpec('42.8.3'), { seed: 42, pairs: 8, g: 3 }); assert.equal(gameSpec('1.99').pairs, 18);
  let g = newGame(5, 3); const pairOf = (i) => g.cards.findIndex((c, j) => j !== i && c === g.cards[i]);
  const miss = g.cards.findIndex((c, j) => j > 0 && c !== g.cards[0]);
  g = flip(flip(g, 0), miss); assert.equal(g.found.length, 0); assert.equal(g.moves, 1); assert.deepEqual(g.open, [0, miss]);
  g = flip(g, 0); assert.deepEqual(g.open, [0], 'the next turn turns the two back');
  g = flip(g, pairOf(0)); assert.equal(g.found.length, 2);
  assert.equal(flip(g, 0), g, 'a found card does not turn');
  for (let i = 0; i < g.cards.length; i++) if (!g.found.includes(i)) { g = flip(g, i); g = flip(g, pairOf(i)); }
  assert.ok(won(g)); assert.equal(g.moves, 4);
});
test('the data module is what tools/emoji-dict-data.mjs writes, and names its source', () => {
  const src = readFileSync(new URL('../void-live-deploy/lib/emoji-dict-data.js', import.meta.url), 'utf8');
  assert.match(src, /^\/\/ Written by tools\/emoji-dict-data\.mjs from emojibase-data [\d.]+ \(MIT/);
  assert.equal(subgroupName('face-neutral-skeptical'), 'Face neutral skeptical');
  const meta = { groups: { 0: 'smileys-emotion', 2: 'component' }, hierarchy: { 0: [0], 2: [32] }, subgroups: { 0: 'face-smiling', 32: 'skin-tone' } };
  const text = moduleOf([{ emoji: '😁', label: 'beaming face', group: 0, subgroup: 0, order: 2, version: 0.6, tags: ['grin'] }, { emoji: '😀', label: 'grinning face', group: 0, subgroup: 0, order: 1, version: 1, tags: ['face', 'grin'] }, { emoji: '🏻', label: 'light skin tone', group: 2, subgroup: 32, order: 3, version: 1 }], meta, '0.0.0');
  assert.match(text, /export const ROWS = "😀\|grinning face\|0\|1\|face grin\\n😁\|beaming face\|0\|0\.6\|grin";/);
  assert.match(text, /\["face-smiling","Face smiling",0\]/); assert.doesNotMatch(text, /skin tone/);
});
