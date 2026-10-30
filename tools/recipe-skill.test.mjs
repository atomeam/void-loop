// The recipe skill's card for a dish TheMealDB finds by name: scaled to the servings asked, the guessed base said, and the page link
// carrying the recipe (2026-10-30: "recipe for lasagna for 6" came back unscaled and its page link opened an empty /recipes/).
import test from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/recipe.js';

const MEAL = { idMeal: '52775', strMeal: 'Vegan Lasagna', strArea: 'Italian', strCategory: 'Vegan', strInstructions: 'Boil the lentils.\nBake for 25 minutes.',
  strIngredient1: 'green red lentils', strMeasure1: '1 cups', strIngredient2: 'Carrots', strMeasure2: '2', strIngredient3: 'flour', strMeasure3: '4 tablespoons' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function ask(text) {
  const el = { innerHTML: '', dataset: {} }, seen = [];
  globalThis.fetch = async (url) => { seen.push(String(url)); return { json: async () => ({ meals: /search\.php/.test(url) ? [MEAL] : null }) }; };
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
