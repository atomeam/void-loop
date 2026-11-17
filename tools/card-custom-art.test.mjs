// Custom card art, PR 1 (lib/card-custom-art.js): a choice is parsed, the same choice draws the same picture, a re-roll draws another, a word with
// a drawing draws it, and the choice is kept in storage only. Run: node --test tools/card-custom-art.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, hashOf, parseChoice, customCard, choiceFor, saveChoice, CUSTOM_KEY } from '../void-live-deploy/lib/card-custom-art.js';
import { artSvg } from '../void-live-deploy/lib/card-art.js';

const card = { key: 'Car loan payment', name: 'Car loan payment', kind: 'Skill', typeLine: 'SKILL — NUMBERS AND MONEY', hue: 150, rarity: 'Rare', nouns: ['payment'] };
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('a choice is read from what a visitor types: a style by its key or its label, the rest as words, and the re-roll count', () => {
  assert.deepEqual(parseChoice('solar car loan', 2), { style: 'solar', words: 'car loan', n: 2 });
  assert.deepEqual(parseChoice('Emerald Ledger'), { style: 'ledger', words: '', n: 0 }, 'a whole label is a style');
  assert.deepEqual(parseChoice('midnight cyberpunk coupe'), { style: '', words: 'midnight cyberpunk coupe', n: 0 });
  assert.equal(parseChoice('x'.repeat(300)).words.length, 60, 'the words are capped');
  assert.equal(parseChoice('  ').words, '');
});

test('the same choice draws the same picture; a re-roll draws another; a style changes the palette (owner, 2026-11-17)', () => {
  const pick = { style: 'ledger', words: 'car', n: 0 };
  const a = artSvg(customCard(card, pick)), b = artSvg(customCard(card, pick));
  assert.equal(a, b, 'deterministic');
  assert.notEqual(a, artSvg(customCard(card, { ...pick, n: 1 })), 're-roll changes the seed');
  assert.notEqual(a, artSvg(customCard(card, { ...pick, style: 'pixel' })), 'a style changes the picture');
  assert.equal(customCard(card, { style: 'obsidian', words: '', n: 0 }).hue, 150, 'the obsidian style keeps the card\'s own hue');
  assert.equal(customCard(card, pick).hue, STYLES.ledger.hue);
});

test('a word with a drawing draws it: "car loan" draws a car and a ledger, and the card keeps its name and kind', () => {
  const c = customCard(card, { style: '', words: 'car loan', n: 0 });
  assert.ok(c.nouns.includes('car') && c.nouns.includes('loan'));
  assert.ok(artSvg(c).includes('M6 68V56Q6 50'), 'the car');
  assert.equal(c.name, card.name); assert.equal(c.kind, card.kind); assert.equal(card.key, 'Car loan payment', 'the input card is not changed');
});

test('the choice is kept in storage per card and removed on reset; a corrupt store reads as nothing; a full store does not throw', () => {
  const s = memory();
  assert.equal(choiceFor(s, 'Car loan payment'), null);
  assert.ok(saveChoice(s, 'Car loan payment', { style: 'grid', words: 'car', n: 3 }));
  assert.deepEqual(choiceFor(s, 'Car loan payment'), { style: 'grid', words: 'car', n: 3 });
  assert.equal(choiceFor(s, 'Another card'), null, 'one card\'s art never reaches another');
  assert.ok(saveChoice(s, 'Car loan payment', null)); assert.equal(choiceFor(s, 'Car loan payment'), null, 'reset removes it');
  s.setItem(CUSTOM_KEY, '{not json'); assert.equal(choiceFor(s, 'x'), null); assert.ok(saveChoice(s, 'x', { style: 'grid' }), 'a corrupt store is replaced');
  s.setItem(CUSTOM_KEY, JSON.stringify({ x: { style: 'nonsense', words: 5, n: 'many' } })); assert.deepEqual(choiceFor(s, 'x'), { style: '', words: '5', n: 0 });
  assert.equal(saveChoice({ getItem: () => '{}', setItem: () => { throw new Error('full'); } }, 'x', { style: 'grid' }), false);
  assert.equal(choiceFor(null, 'x'), null);
});

test('typed words never reach the page as markup: they only seed the picture and name drawings', () => {
  const s = artSvg(customCard(card, parseChoice('<script>alert(1)</script> "&\'', 0)));
  assert.ok(!/<script/.test(s) && !/onerror|javascript:/.test(s));
  assert.equal(hashOf('abc'), hashOf('abc')); assert.notEqual(hashOf('abc'), hashOf('abd'));
});
