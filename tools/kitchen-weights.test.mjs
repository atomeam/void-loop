// Kitchen weights and turkey times carry their source (2026-10-30). Before, "1 cup of sugar in grams" said 200 g and "how long to cook a
// 12 pound turkey" said "(USDA)" with no link, no read date and "add about 30 min if stuffed". The cup weights are the King Arthur
// ingredient weight chart and the turkey rows the USDA FSIS "Let's Talk Turkey" tables, both read 2026-10-30. CHART below is the chart's
// row for each ingredient, as read (amount in cups, grams); a cup weight on the page must be that row scaled to one cup.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase());
const KA_URL = 'https://www.kingarthurbaking.com/learn/ingredient-weight-chart';
const FSIS_URL = 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/poultry/lets-talk-turkey-roasting';
const CHART = { flour: [1, 120], 'bread flour': [1, 120], 'whole wheat flour': [1, 113], sugar: [1, 198], 'brown sugar': [1, 213], 'powdered sugar': [1, 113],
  butter: [0.5, 113], rice: [0.5, 99], oats: [1, 89], honey: [1 / 16, 21], milk: [1, 227], cocoa: [0.5, 42], 'chocolate chips': [1, 170], 'maple syrup': [0.5, 156],
  'vegetable oil': [1, 198], 'olive oil': [0.25, 50], cornstarch: [0.25, 28], 'almond flour': [1, 96], yogurt: [1, 227], 'peanut butter': [0.5, 135], salt: [1 / 16, 18] };

test('each cup weight is the King Arthur row, scaled to a cup', () => {
  for (const [k, [cups, g]] of Object.entries(CHART)) {
    const r = ask('1 cup of ' + k + ' in grams'); assert.ok(r && r.value, k);
    assert.equal(r.value, Math.round(g / cups) + ' g', k);
    assert.equal(r.src[0][1], KA_URL, k); assert.equal(r.read, '2026-10-30', k);
  }
});

test('sugar is 198 g a cup both ways, and water is worked out from the cup, not the chart', () => {
  assert.equal(ask('1 cup of sugar in grams').value, '198 g');
  const back = ask('250 g sugar in cups'); assert.equal(back.value, '1.26 cups'); assert.equal(back.src[0][1], KA_URL);
  const w = ask('1 cup of water in grams'); assert.equal(w.value, '237 g'); assert.equal(w.src, undefined); assert.match(w.note, /236\.6 ml/);
  assert.equal(ask('2 sticks of butter in grams').value, '226 grams');
});

test('turkey roasting is the USDA row, with its stuffed time', () => {
  const r = ask('how long to cook a 12 pound turkey');
  assert.equal(r.value, '2¾–3 h'); assert.match(r.note, /stuffed: 3–3½ h/); assert.equal(r.src[0][1], FSIS_URL); assert.equal(r.read, '2026-10-30');
  assert.equal(ask('how long to cook a 16 lb turkey').value, '3¾–4¼ h');
  assert.match(ask('how long to cook a 6 lb turkey').note, /a breast/);
  assert.equal(ask('how long to cook a 30 lb turkey').value, 'past the USDA table');
});

test('turkey thawing is the USDA row', () => {
  const f = ask('how long to thaw a 15 lb turkey in the fridge');
  assert.equal(f.value, '3–4 days'); assert.equal(f.src[0][1], FSIS_URL);
  assert.equal(ask('how long to thaw a 15 lb turkey in cold water').value, '6–8 h');
  assert.equal(ask('how long to thaw a 30 lb turkey in cold water').value, 'about 15 h');
});
