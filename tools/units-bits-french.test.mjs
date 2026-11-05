// The page's word maths takes bits and bytes and French unit asks (exam units, lists run 12: "1 byte in bits" and
// "5 milles en kilomètres" fell through to the article fallback). Run: node --test tools/units-bits-french.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './word-math.mjs';

const { wordMath } = load();
test('units: bits and bytes convert both ways, and the 1,024 note shows only where KB and up are in the ask', () => {
  assert.equal(wordMath('1 byte in bits').value, '8 bits');
  assert.equal(wordMath('8 bits in bytes').value, '1 bytes');
  assert.ok(!/1,024/.test(wordMath('1 byte in bits').note));
  assert.equal(wordMath('1 kb in bits').value, '8,192 bits');
  assert.ok(/1,024/.test(wordMath('2 gb in mb').note));
});
test('units: a French ask with "en" and French unit names converts', () => {
  assert.equal(wordMath('5 milles en kilomètres').value, '8.05 km');
  assert.equal(wordMath('3 kilomètres en mètres').value, '3,000 meters');
  assert.equal(wordMath('100 km in miles').value, '62.14 miles');
});
