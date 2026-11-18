// skills/recipe.js: "recipe for X" asked in Spanish, French, German, Italian or Portuguese reaches the recipe card (the outcome exam's
// "receta de guacamole" reached another skill; lists run 26, 2026-11-18). Money and friends stay out, as in English. No network.
import test from 'node:test'; import assert from 'node:assert/strict';
import recipe, { dishOf } from '../void-live-deploy/skills/recipe.js';

test('the recipe ask in five languages names the dish', () => {
  const cases = { 'receta de guacamole': 'guacamole', 'receta de la paella': 'paella', 'recette de crêpes': 'crêpes', "recette d'une quiche": "une quiche",
    'Rezept für Pfannkuchen': 'Pfannkuchen', 'ricetta della carbonara': 'carbonara', 'receita de feijoada': 'feijoada' };
  for (const [a, dish] of Object.entries(cases)) {
    assert.equal(recipe.match(a.toLowerCase(), a), true, a);
    assert.equal(dishOf(a).dish, dish, a);
  }
});
test('servings carry over, and English asks are unchanged', () => {
  assert.deepEqual(dishOf('receta de guacamole for 6'), { dish: 'guacamole', by: 'name', servings: 6 });
  assert.deepEqual(dishOf('guacamole recipe'), { dish: 'guacamole', by: 'name' });
  assert.deepEqual(dishOf('recipe for pancakes'), { dish: 'pancakes', by: 'name' });
});
test('not food stays out', () => {
  for (const a of ['receta de dinero', 'recetas', 'receta', 'recette de mes amis']) assert.equal(recipe.match(a.toLowerCase(), a), false, a);
});
