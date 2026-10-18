// Tools pack 3 (owner, 2026-10-18, list items 41 to 60): pixels and a typed-rate currency (skills/calc-more.js), tip with tax and the
// "84 dollar bill" fix (skills/tip.js), and seven decision cards (skills/decide-cards.js). Pure logic only; the browser section
// "tools pack 3" in test_void.mjs plays the cards on the stage.
// Run: node --test tools/tools-pack3.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePx, pxConvert, parseFx, fxConvert, openerOf, fmt } from '../void-live-deploy/lib/calc-more.js';
import { splitItems, parseCardAsk, moveItem, tallyView, leaders, sideTotals, survivors, toggleOut, pairsOf, nextPair, standings, bucketNames, placeItem, removeAt } from '../void-live-deploy/lib/decide-cards.js';
import { tipOf, compute } from '../void-live-deploy/skills/tip.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, a + ' vs ' + b);

test('pixels: converts both ways at a dpi', () => {
  near(pxConvert(96, 'px', 'in', 96), 1);
  near(pxConvert(300, 'px', 'cm', 150), 5.08);
  near(pxConvert(5, 'cm', 'px', 300), 590.5511811, 1e-6);
  near(pxConvert(1, 'in', 'mm', 96), 25.4);
  assert.equal(pxConvert(10, 'px', 'cm', 0), null);
  assert.equal(pxConvert(10, 'px', 'furlong', 96), null);
});

test('pixels: the asks it takes and the look-alikes it leaves', () => {
  assert.deepEqual(parsePx('pixels to cm at 96 dpi'), { value: null, from: 'px', to: 'cm', dpi: 96, dpiGiven: true });
  assert.deepEqual(parsePx('300 px in cm at 150 dpi'), { value: 300, from: 'px', to: 'cm', dpi: 150, dpiGiven: true });
  assert.deepEqual(parsePx('5 cm to pixels at 300 ppi'), { value: 5, from: 'cm', to: 'px', dpi: 300, dpiGiven: true });
  assert.deepEqual(parsePx('how many pixels in 5 cm at 300 dpi'), { value: 5, from: 'cm', to: 'px', dpi: 300, dpiGiven: true });
  assert.deepEqual(parsePx('convert 1024 px to inches'), { value: 1024, from: 'px', to: 'in', dpi: 96, dpiGiven: false });
  for (const a of ['5 cm to inches', 'convert 5 miles to km', 'what is a pixel', 'pixel 8 review', 'px to px', '10 px to cm at 0 dpi', '10 px to cm at 9999 dpi']) assert.equal(parsePx(a), null, a);
});

test('currency: only the rate the person typed is used', () => {
  assert.deepEqual(parseFx('convert 100 usd to eur at 0.92'), { amount: 100, from: 'usd', to: 'eur', rate: 0.92 });
  assert.deepEqual(parseFx('250 euros in dollars at a rate of 1.08'), { amount: 250, from: 'eur', to: 'usd', rate: 1.08 });
  assert.deepEqual(parseFx('$100 to eur at 0.9'), { amount: 100, from: 'usd', to: 'eur', rate: 0.9 });
  assert.deepEqual(parseFx('1,000 usd to eur at 0.9'), { amount: 1000, from: 'usd', to: 'eur', rate: 0.9 });
  assert.deepEqual(parseFx('if 1 usd is 0.92 eur, what is 250 usd'), { amount: 250, from: 'usd', to: 'eur', rate: 0.92 });
  const back = parseFx('if 1 usd = 0.5 eur how much is 100 eur');
  assert.equal(back.from, 'eur'); near(back.rate, 2);
  // no rate typed, a code that is not money, the same currency twice, a zero rate: none of them is a currency answer
  for (const a of ['100 usd in eur', 'convert 100 usd to eur', 'convert 5 kgs to lbs at 2.2', 'convert 5 miles to km at 3', 'convert 100 usd to usd at 1', 'convert 100 usd to eur at 0', 'what is the dollar rate today']) assert.equal(parseFx(a), null, a);
  const c = fxConvert(100, 0.92); near(c.out, 92); near(c.inverse, 1.0869565217, 1e-9);
  assert.equal(fxConvert(100, 0), null);
  assert.equal(fmt(92), '92'); assert.equal(fmt(1234.5678), '1,234.57'); assert.equal(fmt(0.123456), '0.1235');
});

test('converter openers', () => {
  for (const a of ['dpi converter', 'open a pixel converter', 'pixels to cm converter']) assert.equal(openerOf(a), 'px', a);
  for (const a of ['currency converter with my own rate', 'a manual rate currency converter', 'show me a currency converter using a fixed rate']) assert.equal(openerOf(a), 'fx', a);
  for (const a of ['currency converter', 'unit converter', 'what is a dpi']) assert.equal(openerOf(a), null, a);
});

test('tip: the 84 dollar bill, and tax', () => {
  const split = tipOf('split an 84 dollar bill 4 ways');
  assert.equal(split.bill, 84); assert.equal(split.people, 4); near(compute(split).per, 21);
  const full = tipOf('45 with 8% tax and 20% tip');
  assert.equal(full.bill, 45); assert.equal(full.pct, 20); assert.equal(full.taxPct, 8);
  const r = compute(full); near(r.tax, 3.6); near(r.tip, 9); near(r.total, 57.6);
  assert.equal(tipOf('add 8% tax to 45').taxPct, 8);
  assert.equal(tipOf('add 8% tax to 45').pct, 0);
  assert.equal(tipOf('tip and tax on 45').taxWord, true); // no rate given: it says so on the card instead of guessing one
  near(compute(tipOf('split 100 between 5 people plus 10% tax')).per, 22);
  // what it did before is unchanged
  near(compute(tipOf('20% tip on 45')).total, 54);
  near(compute(tipOf('split $85 three ways with 20% tip')).per, 34);
  for (const a of ['income tax 20% of 5000', 'what is the sales tax on 45', '5 tips for writing', '100 usd in eur']) assert.equal(tipOf(a), null, a);
});

test('cards: the asks they take and the look-alikes they leave', () => {
  assert.deepEqual(parseCardAsk('rank pizza, tacos, sushi'), { kind: 'rank', title: '', items: ['pizza', 'tacos', 'sushi'] });
  assert.deepEqual(parseCardAsk('ranked list of my movies'), { kind: 'rank', title: 'my movies', items: [] });
  assert.equal(parseCardAsk('make a ranked list').kind, 'rank');
  assert.equal(parseCardAsk('weighted pros and cons for moving to Berlin').title, 'moving to Berlin');
  assert.equal(parseCardAsk('pros and cons list').kind, 'proscons');
  assert.deepEqual(parseCardAsk('vote marks for pizza, tacos, sushi').items, ['pizza', 'tacos', 'sushi']);
  assert.deepEqual(parseCardAsk('vote on tea or coffee'), { kind: 'votes', title: '', items: ['tea', 'coffee'] });
  assert.deepEqual(parseCardAsk('eliminate until one: red, green, blue, pink').items, ['red', 'green', 'blue', 'pink']);
  assert.equal(parseCardAsk('eliminate until one').kind, 'knockout');
  assert.deepEqual(parseCardAsk('pairwise compare pizza, tacos, sushi').items, ['pizza', 'tacos', 'sushi']);
  assert.deepEqual(parseCardAsk('2x2 matrix for impact vs effort'), { kind: 'buckets', mode: 'quad', title: '', items: [], axes: ['impact', 'effort'] });
  assert.equal(parseCardAsk('2x2 score matrix').axes[0], 'Impact');
  assert.equal(parseCardAsk('eisenhower matrix').axes[1], 'Urgent');
  const mo = parseCardAsk('must should could for the launch');
  assert.equal(mo.mode, 'moscow'); assert.equal(mo.title, 'the launch');
  assert.deepEqual(parseCardAsk('must/should/could buckets').kind, 'buckets');
  for (const a of ['ranked list of the best sci-fi movies', 'pros and cons of electric cars', 'who should I vote for', 'how to eliminate debt', 'eliminate pests from my garden',
    'what is a 2x2 matrix', 'what is moscow prioritisation', 'rank the planets by size', 'compare iphone and pixel', 'flip a coin', 'add milk to my list']) assert.equal(parseCardAsk(a), null, a);
});

test('cards: list splitting keeps names whole and caps the list', () => {
  assert.deepEqual(splitItems('pizza, tacos and sushi'), ['pizza', 'tacos', 'sushi']);
  assert.deepEqual(splitItems('tea or coffee'), ['tea', 'coffee']);
  assert.deepEqual(splitItems('salt and pepper'), ['salt', 'pepper']);
  assert.deepEqual(splitItems('a, A, b'), ['a', 'b']);
  assert.equal(splitItems(Array.from({ length: 30 }, (_, i) => 'x' + i).join(', ')).length, 12);
  assert.equal(splitItems('x'.repeat(80))[0].length, 30);
  assert.deepEqual(splitItems(''), []);
});

test('cards: ranked list moves, tally marks, leaders', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 5, 1), ['a', 'b']);
  assert.deepEqual(tallyView(7), { fives: 1, rest: 2, count: 7 });
  assert.deepEqual(tallyView(-3), { fives: 0, rest: 0, count: 0 });
  assert.deepEqual(tallyView('x'), { fives: 0, rest: 0, count: 0 });
  assert.deepEqual(leaders([1, 3, 3]), [1, 2]);
  assert.deepEqual(leaders([0, 0]), []);
});

test('cards: weighted pros and cons', () => {
  const s = sideTotals([{ text: 'cheap', w: 5 }, { text: 'close', w: 2 }, { text: '', w: 5 }], [{ text: 'loud', w: 4 }]);
  assert.deepEqual(s, { pro: 7, con: 4, net: 3, verdict: 'pros' });
  assert.equal(sideTotals([{ text: 'a', w: 2 }], [{ text: 'b', w: 2 }]).verdict, 'even');
  assert.equal(sideTotals([], []).verdict, 'empty');
  assert.equal(sideTotals([{ text: 'a', w: 99 }], []).pro, 5); // a weight is clamped to 1 to 5
  assert.equal(sideTotals([{ text: 'a', w: 'x' }], []).pro, 1);
});

test('cards: eliminate until one never removes the last', () => {
  let out = [];
  out = toggleOut(3, out, 0); out = toggleOut(3, out, 1);
  assert.deepEqual(survivors(3, out), [2]);
  assert.deepEqual(toggleOut(3, out, 2), out); // the last one standing stays
  assert.deepEqual(toggleOut(3, out, 0), [1]); // bring one back
  assert.deepEqual(toggleOut(3, [], 9), []);
  assert.deepEqual(survivors(2, [7, 'x']), [0, 1]);
});

test('cards: pairwise covers every pair once and ranks by wins', () => {
  assert.equal(pairsOf(4).length, 6);
  assert.equal(pairsOf(8).length, 28);
  assert.deepEqual(nextPair(3, {}), [0, 1]);
  assert.deepEqual(nextPair(3, { '0|1': 0 }), [0, 2]);
  assert.equal(nextPair(3, { '0|1': 0, '0|2': 0, '1|2': 1 }), null);
  const st = standings(3, { '0|1': 0, '0|2': 0, '1|2': 1 });
  assert.deepEqual(st.map((r) => [r.i, r.wins]), [[0, 2], [1, 1], [2, 0]]);
  assert.ok(st.every((r) => !r.tied));
  assert.ok(standings(3, { '0|1': 0, '0|2': 2, '1|2': 1 }).every((r) => r.tied)); // a cycle ties them all
});

test('cards: buckets and removing an item keeps the maps pointing at the right things', () => {
  assert.deepEqual(bucketNames('moscow'), ['Must', 'Should', 'Could']);
  assert.equal(bucketNames('quad', ['Impact', 'Effort']).length, 4);
  assert.match(bucketNames('quad', ['Cost', 'Joy'])[0], /High Cost, low Joy/);
  assert.deepEqual(placeItem({ 0: 1 }, 2, 3, 4), { 0: 1, 2: 3 });
  assert.deepEqual(placeItem({ 0: 1 }, 0, null, 4), {});
  assert.deepEqual(placeItem({ 0: 1 }, 2, 9, 4), { 0: 1 }); // a bucket that isn't there changes nothing
  const r = removeAt({ items: ['a', 'b', 'c'], place: { 0: 1, 1: 2, 2: 0 }, out: [1, 2], counts: [4, 5, 6] }, 1);
  assert.deepEqual(r.items, ['a', 'c']);
  assert.deepEqual(r.place, { 0: 1, 1: 0 });
  assert.deepEqual(r.out, [1]);
  assert.deepEqual(r.counts, [4, 6]);
});
