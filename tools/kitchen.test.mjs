// lib/kitchen.js: nutrition per serving (an estimate), diets and allergies, "without", and the shopping list. Run: node --test tools/kitchen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../void-live-deploy/lib/kitchen.js';
import { BUILT_IN } from '../void-live-deploy/lib/recipes.js';
const by = (id) => BUILT_IN.find((r) => r.id === id);

test('grams from a line: the grams written in brackets first, then cups and spoons by density, pieces by their weight, TheMealDB\'s 100g', () => {
  assert.equal(K.gramsOf('1 ½ cups all-purpose flour (190 g)').grams, 190);
  assert.equal(Math.round(K.gramsOf('3 tablespoons butter, melted').grams), 43);
  assert.equal(K.gramsOf('2 eggs').grams, 100); assert.equal(K.gramsOf('3 cloves garlic, thinly sliced').grams, 15);
  assert.equal(K.gramsOf('100g Flour').grams, 100); assert.equal(Math.round(K.gramsOf('300ml Milk').grams), 309); assert.equal(K.gramsOf('1 can crushed tomatoes').grams, 400);
  assert.equal(K.gramsOf('salt and pepper').grams, 0, 'no amount, no calories: read as nothing'); assert.equal(K.gramsOf('grated parmesan, to serve').grams, null);
  assert.equal(K.entryOf('chicken stock').words[0], 'stock'); assert.equal(K.entryOf('peanut butter').words[0], 'peanut butter'); assert.equal(K.entryOf('egg yolks').words[0], 'egg yolk');
});
test('nutrition per serving: pancakes for 4 are about 330 kcal each, every line read; what cannot be read is counted out loud', () => {
  const p = K.nutritionOf(by('pancakes').ingredients, 4); assert.ok(p.kcal > 280 && p.kcal < 380, String(p.kcal)); assert.equal(p.counted, 7); assert.equal(p.of, 7);
  const half = K.nutritionOf(['1 cup mystery powder', '2 eggs'], 1); assert.equal(half.counted, 1); assert.equal(half.of, 2); assert.equal(half.kcal, 143);
});
test('diets and allergies from the ingredients: guacamole is vegan, pancakes are not; rice flour is not gluten, peanut butter is not dairy, eggplant is not egg', () => {
  assert.ok(K.dietsOf(by('guacamole')).includes('vegan')); assert.ok(!K.dietsOf(by('pancakes')).includes('vegan')); assert.ok(K.dietsOf(by('pancakes')).includes('vegetarian'));
  assert.ok(!K.dietsOf(by('chicken-soup')).includes('vegetarian'));
  const c = K.containsOf({ ingredients: ['1 cup rice flour', '2 tbsp peanut butter', '1 eggplant'] }); assert.ok(!c.has('gluten') && !c.has('dairy') && !c.has('egg') && c.has('nuts'));
});
test('asks: "without eggs", "no nuts", "vegan", "gluten-free", "ohne Ei"; fits() keeps out a group or any ingredient word', () => {
  assert.deepEqual(K.askOf('pancakes without eggs'), { dish: 'pancakes', without: ['eggs'], diets: [] });
  assert.deepEqual(K.askOf('vegan chocolate cake no nuts'), { dish: 'chocolate cake', without: ['nuts'], diets: ['vegan'] });
  assert.deepEqual(K.askOf('gluten-free banana bread').diets, ['gluten-free']); assert.deepEqual(K.askOf('Pfannkuchen ohne Ei').without, ['ei']);
  assert.equal(K.fits(by('pancakes'), { without: ['eggs'] }), false); assert.equal(K.fits(by('guacamole'), { without: ['eggs'], diets: ['vegan'] }), true);
  assert.equal(K.fits(by('guacamole'), { without: ['onion'] }), false, 'an ingredient word'); assert.equal(K.fits(by('tomato-pasta'), { diets: ['gluten-free'] }), false);
});
test('the shopping list: lines from two recipes, one line once per recipe, the text grouped by recipe without what is ticked', () => {
  let l = K.withLines([], 'Pancakes', ['2 eggs', '1 cup milk'], 1); l = K.withLines(l, 'Pancakes', ['2 eggs'], 2); l = K.withLines(l, 'Omelette', ['3 eggs'], 3);
  assert.equal(l.length, 3); l[1].done = true;
  assert.equal(K.listText(l), 'Pancakes\n☐ 2 eggs\n\nOmelette\n☐ 3 eggs');
});
