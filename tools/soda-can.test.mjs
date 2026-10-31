// The soda can answer carries its sources (2026-10-30). Before, it said "355 ml in the US; 330 ml is common elsewhere" with nothing behind it.
// FDA (Changes to the Nutrition Facts Label, read 2026-10-30): the reference amount for a serving of soda changed from 8 ounces to 12 ounces.
// NIST Handbook 44 (2026), Appendix C: 1 fluid ounce is 29.573 milliliters. Coca-Cola HBC Italia lists its Coca-Cola can as "CAN 330 ml".
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase()), links = (r) => JSON.stringify(r.src.map((s) => s[1]));
const SRC = ['https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/changes-nutrition-facts-label',
  'https://www.nist.gov/document/2026-nist-handbook-44-appendix-c',
  'https://it.coca-colahellenic.com/en/portafoglio-prodotti/esplora-i-nostri-brand/coca-cola-original-taste'];

test('the soda can answer cites FDA, NIST and Coca-Cola HBC', () => {
  for (const q of ['how many ounces in a can of soda', 'how many fl ounces are in a standard can of coke', 'how many fluid ounces in a can of pop']) {
    const r = ask(q);
    assert.ok(r, q); assert.equal(r.value, '12 fl oz', q); assert.equal(links(r), JSON.stringify(SRC), q); assert.equal(r.read, '2026-10-30', q);
    assert.match(r.note, /FDA reference serving for soda/, q); assert.match(r.note, /355 ml/, q); assert.match(r.note, /330 ml/, q);
    assert.doesNotMatch(r.note, /common elsewhere/, q);
  }
  // the conversion holds: 12 × 29.573 53 ml rounds to 355 ml
  assert.equal(Math.round(12 * 29.57353), 355);
});
