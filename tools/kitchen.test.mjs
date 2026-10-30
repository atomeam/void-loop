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
test('the meal plan: the next 7 days; a recipe once a day, past days dropped, kept in day order', () => {
  const days = K.nextDays(new Date(2026, 9, 30), 7); assert.equal(days.length, 7); assert.equal(days[0].key, '2026-10-30'); assert.equal(days[2].key, '2026-11-01');
  let plan = K.withPlanned([{ day: '2026-10-20', id: 'old', name: 'Old', recipe: by('rice') }], '2026-10-31', by('omelette'), 2, '2026-10-30');
  plan = K.withPlanned(plan, '2026-10-30', by('pancakes'), 4, '2026-10-30'); plan = K.withPlanned(plan, '2026-10-30', by('pancakes'), 8, '2026-10-30');
  assert.deepEqual(plan.map((x) => x.day + ':' + x.id + ':' + x.servings), ['2026-10-30:pancakes:8', '2026-10-31:omelette:2']);
});
test('cost: a rough estimate from typical US prices per kilogram, said as one; unreadable lines are counted out', () => {
  const c = K.costOf(by('pancakes').ingredients, 4); assert.ok(c.perServing > 0.2 && c.perServing < 0.8, String(c.perServing)); assert.equal(c.counted, 7); assert.equal(c.of, 7); assert.ok(Math.abs(c.total / 4 - c.perServing) < 0.01);
  const d = K.costOf(['1 cup mystery powder', '2 eggs'], 1); assert.equal(d.counted, 1); assert.equal(d.total, 0.5, '100 g of egg at about 5 dollars a kilogram'); assert.equal(K.costOf([], 4).total, 0);
  assert.equal(K.pricePerKg(K.entryOf('salmon fillets')), 22); assert.equal(K.pricePerKg(null), null); assert.equal(K.pricePerKg(K.entryOf('mace')), K.pricePerKg(K.entryOf('mace')));
});
test('store links: fixed https addresses, a clean search from a list line, a country\'s own first store; nothing from a recipe becomes an address', () => {
  assert.ok(K.STORES.length >= 8 && K.STORES.every((s) => /^https:\/\/[a-z.]+\//.test(s.url)) && new Set(K.STORES.map((s) => s.id)).size === K.STORES.length);
  assert.deepEqual(['1 ½ cups all-purpose flour (190 g)', '3 cloves garlic, thinly sliced', '2 tablespoons chopped coriander (cilantro)', '1 can crushed tomatoes (400 g)', '200g Flour'].map(K.searchName), ['all-purpose flour', 'garlic', 'coriander', 'crushed tomatoes', 'Flour']);
  assert.equal(K.storeLink('tesco', '2 eggs'), 'https://www.tesco.com/groceries/en-GB/search?query=eggs'); assert.equal(K.storeLink('instacart', '1 tbsp olive oil'), 'https://www.instacart.com/store/s?k=olive+oil');
  assert.equal(K.storeLink('sainsburys', '2 tbsp olive oil'), 'https://www.sainsburys.co.uk/gol-ui/SearchResults/olive%20oil'); assert.equal(K.storeLink('nope', '2 eggs'), null); assert.equal(K.storeLink('walmart', '  '), null);
  const evil = K.storeLink('walmart', '1 cup ../../evil?x=1&url=http://evil.test'); assert.ok(evil.startsWith('https://www.walmart.com/search?q='), evil); assert.ok(!/[&]url=|evil\.test\//.test(evil.slice('https://www.walmart.com/search?q='.length)), 'the item is encoded into the search');
  assert.deepEqual(['en-US', 'en-GB', 'de-DE', 'fr-FR', 'en'].map(K.defaultStore), ['walmart', 'tesco', 'rewe', 'walmart', 'walmart']);
});
test('voice commands: next, back, repeat, timers, ingredients, close, in English and German; anything else is nothing', () => {
  const cases = [['next', 'next'], ['Okay, next step.', 'next'], ['go back', 'prev'], ['previous', 'prev'], ['repeat that', 'repeat'], ['say it again', 'repeat'], ['start timer', 'timer'], ['start the timer please', 'timer'], ['set a timer', 'timer'], ['timer', 'timer'],
    ['stop the timer', 'stopTimer'], ['timer stop', 'stopTimer'], ['cancel timer', 'stopTimer'], ['stop', 'stop'], ['close', 'close'], ['stop cooking', 'close'], ['what are the ingredients', 'ingredients'],
    ['weiter', 'next'], ['zurück', 'prev'], ['nochmal bitte', 'repeat'], ['Timer starten', 'timer'], ['Timer stopp', 'stopTimer'], ['Zutaten', 'ingredients'], ['schließen', 'close'], ['banana bread', null], ['', null], ['I am so hungry now', null], ['x'.repeat(200), null]];
  for (const [said, want] of cases) assert.equal(K.voiceCommand(said), want, JSON.stringify(said));
});
test('browsing by time and occasion: only recipes whose time is known, each once, quickest first; an occasion is a TheMealDB category or the quick-weeknight time', () => {
  const rs = [{ id: 'a', name: 'Soup', time: 60 }, { id: 'b', name: 'Toast', time: 5 }, { id: 'b', name: 'Toast again', time: 5 }, { id: 'c', name: 'Unknown' }, { id: 'd', name: 'Eggs', time: 10 }, { id: 'e', name: 'Beans', time: 10 }, null];
  assert.deepEqual(K.byTime(rs, 30).map((r) => r.id), ['b', 'e', 'd'], 'known, once each, quickest first, ties by name'); assert.deepEqual(K.byTime(rs, 4), []); assert.equal(K.byTime(BUILT_IN, 15).length, 6); assert.equal(K.byTime(BUILT_IN, 30).length, 10);
  assert.deepEqual(K.TIMES, [15, 30, 45, 60]); assert.ok(K.OCCASIONS.every((o) => (o.c && !o.time) || (o.time && !o.c)) && new Set(K.OCCASIONS.map((o) => o.id)).size === K.OCCASIONS.length);
  const cats = ['Beef', 'Breakfast', 'Chicken', 'Dessert', 'Goat', 'Lamb', 'Miscellaneous', 'Pasta', 'Pork', 'Seafood', 'Side', 'Starter', 'Vegan', 'Vegetarian']; assert.ok(K.OCCASIONS.filter((o) => o.c).every((o) => cats.includes(o.c)), 'only categories TheMealDB has');
});
