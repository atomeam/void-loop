// Room AC size comes from the ENERGY STAR chart (2026-10-30). Before, it said "about 20 BTU per square foot (ENERGY STAR)", which ENERGY
// STAR does not say, and gave 400 sq ft 8,000 BTU. CHART is the ENERGY STAR sizing chart as printed in its room AC PDF (read 2026-10-30):
// area to cool in sq ft, capacity in BTU an hour. Its own examples: 147.5 sq ft needs 5,000 (the window AC page), 525 sq ft needs 14,000 (PDF).
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase());
const CHART = [[100, 150, 5000], [150, 250, 6000], [250, 300, 7000], [300, 350, 8000], [350, 400, 9000], [400, 450, 10000], [450, 550, 12000], [500, 700, 14000], [700, 1000, 18000]];

test('a room inside each chart row gets that row', () => {
  for (const [lo, hi, btu] of CHART) {
    const a = lo === 450 ? 475 : Math.round((lo + hi) / 2), r = ask('btu needed for a ' + a + ' square foot room');
    assert.equal(r.value.split(' BTU')[0], btu.toLocaleString(), String(a));
    assert.match(r.src[0][1], /energystar\.gov/); assert.equal(r.read, '2026-10-30');
  }
});

test('the chart\'s own examples hold', () => {
  assert.equal(ask('btu for 147.5 sq ft').value, '5,000 BTU');
  assert.equal(ask('what size ac do i need for 525 sq ft').value, '14,000 BTU (about 1 ton)');
  assert.equal(ask('btu needed for a 400 square foot room').value, '9,000 BTU');
  assert.match(ask('btu needed for a 400 square foot room').note, /600 BTU for each person over two/);
});

test('heating and an area off the chart get no number', () => {
  assert.equal(ask('how many btu to heat a 400 sq ft room').value, 'off the ENERGY STAR chart');
  assert.equal(ask('btu for 2000 sq ft house').value, 'off the ENERGY STAR chart');
  assert.equal(ask('btu for 80 sq ft').value, 'off the ENERGY STAR chart');
});
