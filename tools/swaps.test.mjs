// Kitchen swaps (skills/swaps.js): "substitute for buttermilk", "what can i use instead of eggs", "out of brown sugar"
// read from a built-in table; an ingredient not in it, or a look-alike, is left to the other skills.
// Run: node --test tools/swaps.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import swaps, { swapAsk, swapHit, SWAPS } from '../void-live-deploy/skills/swaps.js';

test('swaps: the asks it takes, with the ingredient', () => {
  const cases = [
    ['substitute for buttermilk', 'buttermilk'], ['buttermilk substitute', 'buttermilk'], ['what is a good substitute for buttermilk?', 'buttermilk'],
    ['what can i use instead of eggs in baking', 'eggs'], ['egg substitute', 'eggs'], ['what can i use instead of an egg', 'eggs'],
    ['baking powder substitute', 'baking powder'], ['substitute for baking soda', 'baking soda'], ['out of brown sugar', 'brown sugar'],
    ['i ran out of baking powder what can i use', 'baking powder'], ['how to make self rising flour', 'self-rising flour'],
    ['how do i make buttermilk', 'buttermilk'], ['make cake flour at home', 'cake flour'], ['replacement for heavy cream', 'heavy cream'],
    ['alternative to sour cream', 'sour cream'], ['what to use instead of butter in cookies', 'butter'], ['substitute cornstarch', 'cornstarch'],
    ['what can i use instead of vanilla extract', 'vanilla extract'], ['no powdered sugar what can i use', 'powdered sugar'],
    ['substitute for icing sugar', 'powdered sugar'], ['what can i use instead of wine in a sauce', 'wine'], ['mayo substitute', 'mayonnaise'],
    ['Substitute for Buttermilk?', 'buttermilk'], ['substitute for cream of tartar', 'cream of tartar'], ['what to use instead of cornstarch to thicken soup', 'cornstarch']
  ];
  for (const [ask, name] of cases) { const a = swapAsk(ask); assert.ok(a, ask); assert.equal(a.item.name, name, ask); assert.equal(a.use, '', ask); }
});

test('swaps: "can i use X instead of Y" says yes when X is one of the swaps', () => {
  let a = swapAsk('can i use greek yogurt instead of sour cream');
  assert.equal(a.item.name, 'sour cream'); assert.equal(a.use, 'greek yogurt'); assert.ok(swapHit(a.item, a.use) >= 0);
  a = swapAsk('can i use applesauce instead of eggs'); assert.ok(swapHit(a.item, a.use) >= 0);
  a = swapAsk('can i use baking powder instead of baking soda'); assert.equal(a.item.name, 'baking soda'); assert.ok(swapHit(a.item, a.use) >= 0);
  a = swapAsk('can i use ketchup instead of eggs'); assert.equal(swapHit(a.item, a.use), -1);
});

test('swaps: leaves look-alikes and unknown things to others', () => {
  for (const ask of ['substitute teacher', 'what can i use instead of google', 'substitution method', 'how to make bread', 'egg timer',
    'replacement windows', 'substitute for x in algebra', 'alternative to chrome', 'how to make pancakes', 'no', 'out of office',
    'substitute for sugar in my life', 'can i use my phone instead of a wallet', 'calories in buttermilk', 'eggs', 'buttermilk pancakes recipe',
    'how many cups is 500g of flour', 'no more milk', 'replace windows', 'swaps'])
    assert.equal(swapAsk(ask), null, ask);
});

test('swaps: every row is whole, and the skill names its examples and near misses truly', () => {
  for (const s of SWAPS) {
    for (const k of ['name', 're', 'amount']) assert.ok(s[k], s.name + ' ' + k);
    assert.ok(Array.isArray(s.swaps) && s.swaps.length, s.name + ' swaps');
  }
  for (const ex of swaps.examples) assert.ok(swaps.match(ex.toLowerCase(), ex), ex);
  for (const nm of swaps.nearMisses) assert.ok(!swaps.match(nm.toLowerCase(), nm), nm);
});

// Substitution impact (asked by Verse): every swap has its "then:" line slot, and the ones that change water, fat, acid or salt say so.
import { IMPACT, impactOf } from '../void-live-deploy/skills/swaps.js';
test('swaps: IMPACT is one line per swap, in SWAPS order, and the known adjustments are there', () => {
  for (const s of SWAPS) { assert.ok(Array.isArray(IMPACT[s.name]), 'IMPACT has ' + s.name); assert.equal(IMPACT[s.name].length, s.swaps.length, s.name + ' has a line per swap'); }
  for (const k of Object.keys(IMPACT)) assert.ok(SWAPS.some((s) => s.name === k), k + ' is a SWAPS ingredient');
  const butter = SWAPS.find((s) => s.name === 'butter');
  assert.match(impactOf(butter, 0), /water|liquid/i); // oil for butter: add liquid
  assert.match(impactOf(SWAPS.find((s) => s.name === 'cornstarch'), 0), /simmer|longer/i);
  assert.match(impactOf(SWAPS.find((s) => s.name === 'breadcrumbs'), 0), /salt/i);
  assert.equal(impactOf(SWAPS.find((s) => s.name === 'brown sugar'), 0), ''); // white sugar + molasses: nothing else changes
  assert.equal(impactOf(null, 0), ''); assert.equal(impactOf(butter, 99), '');
  for (const s of SWAPS) for (const line of IMPACT[s.name]) assert.ok(line.length <= 140, s.name + ': a line fits under a swap');
});

import { timeShift, shiftedTime, shiftWords, IMPACT as IMP2 } from '../void-live-deploy/skills/swaps.js';
test('swaps: the time a swap moves the cook by is read off its own line and applied to the recipe time', () => {
  assert.deepEqual(timeShift('bake 2–3 minutes longer'), { lo: 2, hi: 3, sign: 1 });
  assert.deepEqual(timeShift('cook a minute less'), { lo: 1, hi: 1, sign: -1 });
  assert.equal(timeShift('stand 5 minutes'), null);
  assert.deepEqual(shiftedTime(30, timeShift('bake 2–3 minutes longer')), { lo: 32, hi: 33 });
  assert.deepEqual(shiftedTime(30, timeShift('take it out 1–2 minutes sooner')), { lo: 28, hi: 29 });
  assert.equal(shiftedTime('x', { lo: 1, hi: 1, sign: 1 }), null);
  assert.equal(shiftWords({ lo: 2, hi: 3, sign: 1 }), '+2–3 min');
  assert.ok(Object.values(IMP2).flat().some((l) => timeShift(l)), 'some swap changes the time');
});
