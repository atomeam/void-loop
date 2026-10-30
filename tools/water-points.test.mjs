// The boiling and freezing point answers carry their source (2026-10-30). Before, the boiling answer said "about 203 °F in Denver"
// with nothing behind it. USDA FSIS (High Altitude Cooking, read 2026-10-30) says water boils at 212 °F at sea level, the boiling
// point drops just under 1 °F for each 500 ft of elevation, it is 208 °F at 2,000 ft and about 198 °F at 7,500 ft.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase()), links = (r) => JSON.stringify(r.src.map((s) => s[1]));
const FSIS = 'https://www.fsis.usda.gov/es/node/3340';

test('the boiling point cites USDA FSIS and its altitude figures', () => {
  for (const q of ['boiling point of water', 'what is the boiling point of water in fahrenheit', 'what temperature does water boil']) {
    const r = ask(q);
    assert.ok(r, q); assert.equal(links(r), JSON.stringify([FSIS]), q); assert.equal(r.read, '2026-10-30', q);
    assert.match(r.note, /212 °F = 100 °C/, q); assert.match(r.note, /just under 1 °F less for each 500 ft/, q);
    assert.match(r.note, /208 °F at 2,000 ft/, q); assert.match(r.note, /about 198 °F at 7,500 ft/, q); assert.doesNotMatch(r.note, /Denver|203/, q);
  }
  // the 2 examples fit the rule: 4 °F down over 2,000 ft, about 14 °F over 7,500 ft (just under 15)
  assert.equal(212 - 2000 / 500, 208); assert.ok(212 - 7500 / 500 < 198);
  assert.equal(ask('boiling point of water in celsius').value, '100 °C');
});

test('the freezing point keeps its sea level values, with no altitude note and no borrowed source', () => {
  const r = ask('freezing point of water');
  assert.match(r.note, /32 °F = 0 °C = 273.15 K/); assert.doesNotMatch(r.note, /500 ft/); assert.equal(r.src, undefined);
});
