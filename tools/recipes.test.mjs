// The recipes page's pure half (lib/recipes.js) and its API (functions/api/recipes.js) with a FAKE TheMealDB: scaling every quantity, swapping
// units, the timers in a step, the built-in dozen's shape, name and ingredient search, the ask bar's routes, and the endpoint's bounds and cache
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILT_IN, numOf, fmtQty, scale, swapUnits, timersIn, clock, dishOf, find, ingredientsOf, byIngredients, fromMeal, shareLink, wordsFor } from '../void-live-deploy/lib/recipes.js';
import { askIn, lookRecipes, onRequestGet, HOST } from '../void-live-deploy/functions/api/recipes.js';
import { routeAsk, TOOLS, RELATED } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');

test('quantities as people write them, read and written back', () => {
  assert.equal(numOf('1 ½'), 1.5); assert.equal(numOf('1½'), 1.5); assert.equal(numOf('½'), 0.5); assert.equal(numOf('1 1/2'), 1.5); assert.equal(numOf('2/3'), 2 / 3); assert.equal(numOf('1,5'), 1.5); assert.equal(numOf('3'), 3); assert.ok(Number.isNaN(numOf('a')));
  assert.equal(fmtQty(1.5), '1 ½'); assert.equal(fmtQty(0.25), '¼'); assert.equal(fmtQty(1 / 3), '⅓'); assert.equal(fmtQty(2), '2'); assert.equal(fmtQty(1.999), '2'); assert.equal(fmtQty(0.4), '0.4'); assert.equal(fmtQty(0), '0'); assert.equal(fmtQty(NaN), '');
});
test('scaling multiplies every quantity in a line (mixed numbers, fractions, ranges, the metric weight in brackets) and leaves temperatures and pan sizes alone', () => {
  assert.equal(scale('1 ½ cups all-purpose flour (190 g)', 2), '3 cups all-purpose flour (380 g)');
  assert.equal(scale('3 ½ teaspoons baking powder', 0.5), '1 ¾ teaspoons baking powder'); assert.equal(scale('1 egg', 3), '3 eggs'); assert.equal(scale('¼ teaspoon salt', 2), '½ teaspoon salt');
  assert.equal(scale('2 to 3 cloves garlic', 2), '4 to 6 cloves garlic'); assert.equal(scale('1/2 cup milk', 3), '1 ½ cups milk'); assert.equal(scale('1,5 l water', 2), '3 l water');
  assert.equal(scale('Heat the oven to 375°F and butter a 9x5-inch loaf pan.', 2), 'Heat the oven to 375°F and butter a 9x5-inch loaf pan.');
  // the word after the leading quantity agrees with the new number, both ways; other words are left as written
  assert.equal(scale('1 tablespoon sugar', 2), '2 tablespoons sugar'); assert.equal(scale('2 cups milk', 0.5), '1 cup milk'); assert.equal(scale('3 eggs', 1 / 3), '1 egg');
  assert.equal(scale('1 small tomato, diced', 2), '2 small tomatoes, diced'); assert.equal(scale('1 lime, juiced', 2), '2 limes, juiced'); assert.equal(scale('1 avocado', 3), '3 avocados');
  assert.equal(scale('1 to 2 cloves garlic', 2), '2 to 4 cloves garlic'); assert.equal(scale('½ teaspoon salt', 4), '2 teaspoons salt'); assert.equal(scale('2 egg yolks', 0.5), '1 egg yolks');
  assert.equal(scale('1 can crushed tomatoes (400 g)', 2), '2 cans crushed tomatoes (800 g)'); assert.equal(scale('14 oz spaghetti (400 g)', 0.5), '7 oz spaghetti (200 g)');
  assert.equal(scale('a pinch of salt', 2), 'a pinch of salt'); assert.equal(scale('1 egg', 1), '1 egg'); assert.equal(scale('1 egg', 0), '1 egg'); assert.equal(scale('1 egg', NaN), '1 egg');
});
test('units swapped both ways: cups, spoons, ounces, pounds, °F and inches to ml, g, °C and cm; a bracketed weight is used as written', () => {
  assert.equal(swapUnits('1 ½ cups all-purpose flour (190 g)'), '190 g all-purpose flour'); assert.equal(swapUnits('1 cup fresh lemon juice (240 ml, 5 to 6 lemons)'), '240 ml fresh lemon juice (5 to 6 lemons)');
  assert.equal(swapUnits('3 tablespoons butter, melted'), '45 ml butter, melted'); assert.equal(swapUnits('1 teaspoon salt'), '5 ml salt'); assert.equal(swapUnits('8 oz cream cheese'), '225 g cream cheese'); assert.equal(swapUnits('2 lb potatoes'), '905 g potatoes'); assert.equal(swapUnits('3 lb potatoes'), '1.4 kg potatoes');
  assert.equal(swapUnits('2 chicken breasts (about 1 lb, 450 g)'), '2 chicken breasts (450 g)'); assert.equal(swapUnits('Heat the oven to 375°F and butter a 9x5-inch loaf pan.'), 'Heat the oven to 190°C and butter a 9x5-inch loaf pan.');
  assert.equal(swapUnits('Pour ¼ cup of batter for each pancake.'), 'Pour 60 ml of batter for each pancake.'); assert.equal(swapUnits('3 eggs'), '3 eggs');
  assert.equal(swapUnits('360 ml milk', 'us'), '1 ½ cups milk'); assert.equal(swapUnits('190 g flour', 'us'), '6.7 oz flour'); assert.equal(swapUnits('Bake at 190°C for 10 minutes', 'us'), 'Bake at 375°F for 10 minutes'); assert.equal(swapUnits('15 ml oil', 'us'), '1 tbsp oil'); assert.equal(swapUnits('2 kg potatoes', 'us'), '4.4 lb potatoes');
  assert.equal(swapUnits('250 ml water', 'us'), '1 cup water'); assert.equal(swapUnits('0.24 l milk', 'us'), '1 cup milk'); assert.equal(swapUnits('1 l stock', 'us'), '4 cups stock'); assert.equal(swapUnits('100 ml cream', 'us'), '⅜ cup cream'); assert.equal(swapUnits('200 ml milk', 'us'), '⅞ cup milk'); assert.equal(swapUnits('0.5 l cream', 'us'), '2 cups cream');
  assert.equal(swapUnits('1 ½ cups milk', 'us'), '1 ½ cups milk', 'already US'); assert.equal(swapUnits('1 ¼ cups milk (300 ml)', 'us'), '1 ¼ cups milk (300 ml)', 'led by cups: the bracketed ml stays a hint');
});
test('the times a step names become countdowns: the lower end of a range, each once, hours and seconds too', () => {
  assert.deepEqual(timersIn('Cook for 2 minutes, until bubbles form, then flip and cook for 1 to 2 minutes more.'), [{ label: '2 minutes', seconds: 120 }, { label: '1 to 2 minutes', seconds: 60 }]);
  assert.deepEqual(timersIn('Chill for 30 minutes. Rest 1 ½ hours. After 30 seconds push the edges.'), [{ label: '30 minutes', seconds: 1800 }, { label: '1 ½ hours', seconds: 5400 }, { label: '30 seconds', seconds: 30 }]);
  assert.deepEqual(timersIn('Serve warm with butter and syrup.'), []); assert.deepEqual(timersIn('bake for 10 minutes, then 10 min more'), [{ label: '10 minutes', seconds: 600 }], 'the same time once');
  assert.equal(clock(90), '1:30'); assert.equal(clock(3661), '1:01:01'); assert.equal(clock(0), '0:00');
});
test('the built-in dozen: each with a name, servings, a time, quantities in its ingredients and timed steps, pancakes among them with flour, egg and milk', () => {
  assert.equal(BUILT_IN.length, 12); assert.equal(new Set(BUILT_IN.map((r) => r.id)).size, 12);
  for (const r of BUILT_IN) {
    assert.match(r.id, /^[a-z-]+$/); assert.ok(r.name && r.servings >= 1 && r.time > 0, r.id); assert.ok(r.ingredients.length >= 3 && r.steps.length >= 3, r.id);
    assert.ok(r.ingredients.some((l) => Number.isFinite(numOf(l.split(' ')[0]) ) || /^[¼½¾⅓⅔⅛]/.test(l)), r.id + ' has quantities');
    for (const s of r.steps) assert.doesNotMatch(s, /°C/, r.id + ': steps carry °F only, the swap makes °C');
  }
  assert.ok(Object.isFrozen(BUILT_IN)); assert.ok(BUILT_IN.filter((r) => r.steps.some((s) => timersIn(s).length)).length >= 11, 'all but the dressing have a timed step');
  const p = find('pancakes')[0]; assert.equal(p.id, 'pancakes'); assert.equal(p.servings, 4);
  const text = p.ingredients.join('\n'); assert.match(text, /\bflour\b/); assert.match(text, /\begg\b/); assert.match(text, /\bmilk\b/);
});
test('search by name forgives "recipe for", "how do I make" and plurals; search by ingredient ranks what uses the most of them', () => {
  assert.equal(dishOf('easy recipe for pancakes'), 'pancakes'); assert.equal(dishOf('how do I make rice'), 'rice');
  assert.deepEqual(find('pancake recipe').map((r) => r.id), ['pancakes']); assert.deepEqual(find('how do I make rice').map((r) => r.id), ['rice']); assert.deepEqual(find('cookies').map((r) => r.id), ['chocolate-chip-cookies']);
  assert.deepEqual(find('soup').map((r) => r.id), ['chicken-soup']); assert.deepEqual(find('spaghetti').map((r) => r.id), ['tomato-pasta']); assert.deepEqual(find('zebra'), []); assert.deepEqual(find(''), []);
  assert.deepEqual(ingredientsOf('what can I make with eggs, spinach and cheese'), ['eggs', 'spinach', 'cheese']); assert.deepEqual(ingredientsOf(''), []);
  const r = byIngredients('eggs and spinach'); assert.equal(r[0].recipe.id, 'omelette'); assert.deepEqual(r[0].have, ['eggs', 'spinach']); assert.deepEqual(r[0].missing, []); assert.ok(r.slice(1).every((x) => x.have.length === 1));
  assert.equal(byIngredients('tomatoes, garlic')[0].recipe.id, 'tomato-pasta'); assert.deepEqual(byIngredients('unobtainium'), []);
});
test('a TheMealDB record becomes the page\'s recipe: measure + ingredient lines, numbered or sentence steps, 4 servings assumed and said', () => {
  const m = { idMeal: '52855', strMeal: 'Banana Pancakes', strArea: 'American', strCategory: 'Dessert', strInstructions: 'STEP 1\r\nMash the bananas.\r\n2. Whisk in the eggs.\r\nSTEP 3 Fry for 2 minutes.', strMealThumb: 'https://www.themealdb.com/images/x.jpg', strSource: 'https://example.test/r', strYoutube: 'https://www.youtube.com/watch?v=x', strIngredient1: 'Banana', strMeasure1: '3', strIngredient2: 'Eggs', strMeasure2: '2 large', strIngredient3: '', strMeasure3: ' ' };
  const r = fromMeal(m); assert.equal(r.id, 'mealdb-52855'); assert.equal(r.name, 'Banana Pancakes'); assert.deepEqual(r.ingredients, ['3 Banana', '2 large Eggs']); assert.deepEqual(r.steps, ['Mash the bananas.', 'Whisk in the eggs.', 'Fry for 2 minutes.']);
  assert.equal(r.servings, 4); assert.equal(r.servingsGuessed, true); assert.equal(r.from, 'TheMealDB'); assert.equal(r.source, 'https://example.test/r'); assert.equal(fromMeal({ strMeal: 'x' }), null); assert.equal(fromMeal(null), null);
  const one = fromMeal({ idMeal: '1', strMeal: 'Soup', strInstructions: 'Chop the onion finely and sweat it in the butter until soft. Add the stock and bring to a simmer. '.repeat(3) + 'Season and serve.', strSource: 'javascript:alert(1)' });
  assert.ok(one.steps.length >= 2 && one.steps.every((s) => s.length < 200), 'one paragraph split into steps of a readable length'); assert.equal(one.source, '', 'only http links');
});
test('the share link carries the ask, the servings when changed and the units when swapped; the words come in English and German', () => {
  assert.equal(shareLink('https://a-to-mind.com', { q: 'pancakes', servings: 4, base: 4 }), 'https://a-to-mind.com/recipes/?q=pancakes');
  assert.equal(shareLink('https://a-to-mind.com', { q: 'pancakes', servings: 8, base: 4, units: 'metric' }), 'https://a-to-mind.com/recipes/?q=pancakes&servings=8&units=metric');
  assert.equal(shareLink('', { i: 'eggs,spinach' }), '/recipes/?i=eggs%2Cspinach'); assert.equal(shareLink('', { id: '52855', q: 'x' }), '/recipes/?id=52855');
  const d = wordsFor('de-DE'), e = wordsFor('en-US'); assert.equal(d.servings, 'Portionen'); assert.equal(e.servings, 'Servings'); assert.equal(d.stepMode, 'Schritt-Modus'); for (const k of Object.keys(e)) assert.ok(d[k], k);
});
test('the ask bar sends recipe asks to the page, by name or by ingredient, and the page is registered everywhere a tool page is', () => {
  assert.equal(routeAsk('pancake recipe'), '/recipes/?q=pancake'); assert.equal(routeAsk('recipe for pancakes'), '/recipes/?q=pancakes'); assert.equal(routeAsk('how do I make rice'), '/recipes/?q=rice'); assert.equal(routeAsk('how to cook rice'), '/recipes/?q=rice');
  assert.equal(routeAsk('what can I make with eggs, spinach'), '/recipes/?i=eggs%2C%20spinach'); assert.equal(routeAsk('translate hello to spanish'), '/translate/?q=hello&to=spanish', 'other routes untouched'); assert.equal(routeAsk('17% of 240'), '/calculator/?q=17%25%20of%20240');
  assert.equal(TOOLS['/recipes/'], 'Recipes'); assert.ok(RELATED['/recipes/'].includes('/stopwatch/')); assert.ok(PAGES.some((p) => p.path === '/recipes/'));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); assert.match(sw, /'\/recipes\/'/);
  const page = fs.readFileSync(path.join(root, 'recipes', 'index.html'), 'utf8');
  for (const w of ['By ingredient', 'Servings', 'Step mode', 'Metric', 'Copy list', 'Share link', 'History', 'offline', 'TheMealDB', 'Print']) assert.ok(page.includes(w), w);
  assert.match(page, /addEventListener\('load'/, 'the module lands after load'); assert.match(page, /<!-- seo -->/); assert.match(page, /<!-- asks -->/); assert.match(page, /id="related"/); assert.match(page, /serviceWorker/);
});

// the API, with a fake TheMealDB
const MEAL = { idMeal: '52855', strMeal: 'Banana Pancakes', strInstructions: 'Mash.\nFry for 2 minutes.', strIngredient1: 'Banana', strMeasure1: '3' };
const fake = (calls, { meals = [MEAL], status = 200 } = {}) => async (u) => { calls.push(u); return { ok: status === 200, status, json: async () => ({ meals: /filter\.php\?i=egg/.test(u) ? [{ idMeal: '1', strMeal: 'A' }, { idMeal: '2', strMeal: 'B' }] : /filter\.php\?i=spinach/.test(u) ? [{ idMeal: '2', strMeal: 'B' }] : meals }) }; };
const req = (qs) => new Request('https://example.test/api/recipes' + qs);
test('what a request asks is bounded: a plain dish, up to three ingredients or a numeric id, 60 characters, or nothing', () => {
  assert.deepEqual(askIn('https://x.test/api/recipes?q=pancakes'), { kind: 'q', value: 'pancakes' }); assert.deepEqual(askIn('https://x.test/api/recipes?i=eggs,%20spinach,cheese,ham'), { kind: 'i', value: 'eggs,spinach,cheese' });
  assert.deepEqual(askIn('https://x.test/api/recipes?id=52855'), { kind: 'id', value: '52855' }); assert.equal(askIn('https://x.test/api/recipes?id=x'), null); assert.equal(askIn('https://x.test/api/recipes'), null);
  assert.equal(askIn('https://x.test/api/recipes?q=' + encodeURIComponent('http://evil.test/x')), null); assert.equal(askIn('https://x.test/api/recipes?q=' + 'a'.repeat(61)), null);
});
test('TheMealDB asked once per dish or id, once per ingredient (the meals that use every one of them), and a service away reported', async () => {
  const calls = []; const q = await lookRecipes({ kind: 'q', value: 'pancakes' }, fake(calls)); assert.equal(q.recipes[0].name, 'Banana Pancakes'); assert.equal(calls[0], HOST + 'search.php?s=pancakes');
  const id = await lookRecipes({ kind: 'id', value: '52855' }, fake(calls)); assert.equal(id.recipes[0].id, 'mealdb-52855'); assert.equal(calls[1], HOST + 'lookup.php?i=52855');
  const i = await lookRecipes({ kind: 'i', value: 'egg,spinach' }, fake(calls)); assert.deepEqual(i.list.map((m) => m.id), ['2']); assert.equal(i.all, true); assert.equal(calls.length, 4);
  const one = await lookRecipes({ kind: 'i', value: 'egg,unobtainium' }, fake([], { meals: [] })); assert.deepEqual(one.list.map((m) => m.id), ['1', '2']); assert.equal(one.all, false, 'none uses both: the ones that use most, said so');
  assert.deepEqual(await lookRecipes({ kind: 'q', value: 'x' }, fake([], { status: 503 })), { ok: false, kind: 'away' });
});
test('the route: 400 for no ask, 502 for the catalogue away (never cached), 200 with the recipes, then the edge cache answers', async () => {
  const store = new Map(); globalThis.caches = { default: { match: async (k) => store.get(k.url) ? new Response(store.get(k.url)) : undefined, put: async (k, res) => { store.set(k.url, await res.text()); } } };
  const kept = () => [...store.keys()].filter((k) => k.includes('__void-recipes/') && !k.includes('/rl/')).length;
  try {
    assert.equal((await onRequestGet({ request: req(''), env: {}, fetchFn: fake([]) })).status, 400);
    const away = await onRequestGet({ request: req('?q=pancakes'), env: {}, fetchFn: fake([], { status: 503 }) }); assert.equal(away.status, 502); assert.equal(away.headers.get('cache-control'), 'no-store'); assert.equal(kept(), 0);
    const calls = []; const ok = await onRequestGet({ request: req('?q=pancakes'), env: {}, fetchFn: fake(calls) }); const j = await ok.json();
    assert.equal(ok.status, 200); assert.equal(j.ok, true); assert.equal(j.recipes[0].name, 'Banana Pancakes'); assert.equal(calls.length, 1); assert.equal(kept(), 1);
    const again = await (await onRequestGet({ request: req('?q=Pancakes'), env: {}, fetchFn: fake(calls) })).json(); assert.equal(again.cached, true); assert.equal(calls.length, 1, 'the repeat cost TheMealDB nothing');
  } finally { delete globalThis.caches; }
});

test('browsing: a category or a cuisine from the closed lists, nothing else; the meals come back as a list', async () => {
  assert.deepEqual(askIn('https://x.test/api/recipes?c=Seafood'), { kind: 'c', value: 'Seafood' }); assert.deepEqual(askIn('https://x.test/api/recipes?a=Italian'), { kind: 'a', value: 'Italian' });
  for (const bad of ['c=seafood', 'c=Seafood%26x%3D1', 'a=Atlantis', 'a=' + encodeURIComponent('http://evil.test')]) assert.equal(askIn('https://x.test/api/recipes?' + bad), null, bad);
  const calls = []; const fetchFn = async (u) => { calls.push(u); return new Response(JSON.stringify({ meals: [{ idMeal: '52959', strMeal: 'Baked salmon with fennel', strMealThumb: 'https://img/x.jpg' }] })); };
  const r = await lookRecipes({ kind: 'a', value: 'Italian' }, fetchFn); assert.equal(calls[0], HOST + 'filter.php?a=Italian'); assert.deepEqual(r.list, [{ id: '52959', name: 'Baked salmon with fennel', image: 'https://img/x.jpg' }]);
});
