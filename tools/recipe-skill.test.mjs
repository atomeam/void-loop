// The recipe skill's card for a dish TheMealDB finds by name: scaled to the servings asked, the guessed base said, and the page link
// carrying the recipe (2026-10-30: "recipe for lasagna for 6" came back unscaled and its page link opened an empty /recipes/).
import test from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/recipe.js';

const MEAL = { idMeal: '52775', strMeal: 'Vegan Lasagna', strArea: 'Italian', strCategory: 'Vegan', strInstructions: 'Boil the lentils.\nBake for 25 minutes.',
  strIngredient1: 'green red lentils', strMeasure1: '1 cups', strIngredient2: 'Carrots', strMeasure2: '2', strIngredient3: 'flour', strMeasure3: '4 tablespoons' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function ask(text, meal = MEAL) {
  const el = { innerHTML: '', dataset: {} }, seen = [];
  globalThis.fetch = async (url) => { seen.push(String(url)); return { json: async () => ({ meals: /search\.php/.test(url) ? [meal] : null }) }; };
  const out = await skill.run(text, { esc, showPage: (fn) => { fn(el); return el; }, _pageStill: () => true });
  return { out, el, seen };
}
test('a dish found by name is scaled to the servings asked, and says its base was a guess', async () => {
  const { out, el, seen } = await ask('recipe for lasagna for 6');
  assert.equal(out, 'recipe'); assert.equal(seen.length, 1, 'one search, no second lookup');
  assert.match(el.innerHTML, /6 servings \(scaled from a guessed 4\)/);
  assert.match(el.innerHTML, /<li>1 ½ cups green red lentils<\/li>/); assert.match(el.innerHTML, /<li>3 Carrots<\/li>/); assert.match(el.innerHTML, /<li>6 tablespoons flour<\/li>/);
  assert.equal(el.dataset.page, '/recipes/?id=52775&servings=6&units=us');
});
test('without servings asked, the guessed 4 is labelled and the source spelling is fixed', async () => {
  const { el } = await ask('lasagna recipe');
  assert.match(el.innerHTML, /4 servings \(a guess\)/); assert.match(el.innerHTML, /<li>1 cup green red lentils<\/li>/);
  assert.equal(el.dataset.page, '/recipes/?id=52775&units=us');
});

// Adam's incident card, 2026-10-30: a question for one dish got another dish's card, and it was only reported quietly
test('a meal that is another dish is refused, not shown as the dish asked for', async () => {
  const PANCAKES = { idMeal: '1', strMeal: 'Pancakes', strCategory: 'Dessert', strArea: 'American', strInstructions: 'Mix and fry.', strIngredient1: 'Flour', strMeasure1: '1 cup' };
  const said = [];
  const el = { innerHTML: '', dataset: {} };
  globalThis.fetch = async (url) => ({ json: async () => ({ meals: /search\.php/.test(url) ? [PANCAKES] : null }) });
  const out = await skill.run('how do i make shakshuka', { esc, showPage: (fn) => { fn(el); return el; }, _pageStill: () => true, say: (t) => said.push(t) });
  assert.equal(out, 'none', 'the page reports the miss');
  assert.match(el.innerHTML, /I don't have a recipe for “shakshuka” yet/);
  assert.match(el.innerHTML, /These are other dishes, not shakshuka/);
  assert.match(el.innerHTML, /data-ask="recipe for Pancakes"/, 'the other dish is a choice, not the answer');
  assert.doesNotMatch(el.innerHTML, /1 cup Flour|Mix and fry/, 'no pancakes recipe is shown');
  assert.deepEqual(said, ['no recipe for shakshuka yet']);
  assert.equal(skill.refuseUngrounded, true);
  // a near spelling of the dish is the dish
  const { out: lasagne } = await ask('lasagna recipe', { ...MEAL, strMeal: 'Lasagne' });
  assert.equal(lasagne, 'recipe');
});
