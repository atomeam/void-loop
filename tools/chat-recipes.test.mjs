// Chat-fill for Recipes (lib/chat-recipes.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/lib/chat-recipes.js';

const run = (s, t) => R.plan(s, R.parseIntent(t));
const w = (s, t) => { const r = run(s, t); assert.equal(r.kind, 'write', t + ' -> ' + JSON.stringify(r).slice(0, 300)); return r; };
const SAVE = 'save this recipe: Lemon cake, serves 8, ingredients: 200 g flour, 3 eggs, 100 g sugar; steps: mix everything. bake 40 minutes';

test('a recipe is read from one sentence', () => {
  const f = R.recipeFrom('Lemon cake, serves 8, ingredients: 200 g flour, 3 eggs, 100 g sugar; steps: mix everything. bake 40 minutes');
  assert.deepEqual(f, { name: 'Lemon cake', servings: 8, ingredients: ['200 g flour', '3 eggs', '100 g sugar'], steps: ['Mix everything', 'Bake 40 minutes'] });
  assert.equal(R.recipeFrom('Toast: bread, butter').ingredients.length, 2); assert.equal(R.recipeFrom('Toast: bread'), null, 'one bare ingredient is not a recipe');
  assert.equal(R.recipeFrom('just some words'), null);
});
test('sentences are read', () => {
  const ops = { [SAVE]: 'save', 'add pancakes to my recipes': 'saveBuiltin', 'add salt to my lemon cake recipe': 'addIng', 'remove eggs from my lemon cake recipe': 'unadd', 'make my lemon cake recipe for 6': 'servings',
    'add a step: cool it to my lemon cake recipe': 'step', 'delete my lemon cake recipe': 'delete', 'show my saved recipes': 'list', 'pancake recipe': null, 'add eggs to my shopping list': null, 'how do i make pancakes': null };
  for (const [t, op] of Object.entries(ops)) assert.equal((R.parseIntent(t) || {}).op || null, op, t);
});
test('save, edit, undo', () => {
  let s = w({ hist: [], ticks: {} }, SAVE); const r0 = s.store.mine[0].recipe; assert.equal(r0.id, 'mine-lemon-cake'); assert.equal(r0.servings, 8); assert.deepEqual(s.store.hist, []); const saved = s;
  assert.deepEqual(R.undoOf(s.store, s.changes).mine, []);
  s = w(s.store, 'add salt to my lemon cake recipe'); assert.equal(s.store.mine[0].recipe.ingredients.length, 4); assert.equal(R.undoOf(s.store, s.changes).mine[0].recipe.ingredients.length, 3);
  assert.equal(run(s.store, 'add salt to my lemon cake recipe').kind, 'show');
  s = w(s.store, 'remove eggs from my lemon cake recipe'); assert.equal(s.store.mine[0].recipe.ingredients.length, 3);
  s = w(s.store, 'make my lemon cake recipe for 6'); assert.equal(s.store.mine[0].recipe.servings, 6);
  s = w(s.store, 'add a step: cool it to my lemon cake recipe'); assert.equal(s.store.mine[0].recipe.steps.at(-1), 'Cool it');
  assert.equal(run(s.store, 'delete my lemon cake recipe').kind, 'confirm'); const d = R.plan(s.store, { ...R.parseIntent('delete my lemon cake recipe'), sure: true }); assert.equal(d.store.mine.length, 0); assert.equal(R.undoOf(d.store, d.changes).mine.length, 1);
  assert.equal(run(saved.store, SAVE).kind, 'confirm', 'a second one with the same name asks first');
});
test('a built-in is copied; adding to a built-in asks first; strangers are left alone', () => {
  const b = w({ mine: [] }, 'add pancakes to my recipes'); assert.equal(b.store.mine[0].name, 'Pancakes'); assert.equal(run(b.store, 'add pancakes to my recipes').kind, 'show');
  const c = run({ mine: [] }, 'add cinnamon to my pancakes recipe'); assert.equal(c.kind, 'confirm'); const d = R.plan({ mine: [] }, c.intent); assert.equal(d.kind, 'write'); assert.match(d.store.mine[0].recipe.ingredients.at(-1), /Cinnamon/);
  assert.equal(run({ mine: [] }, 'add salt to my moon pie recipe').kind, 'none'); assert.equal(run({ mine: [] }, 'delete my moon pie recipe').kind, 'none');
});
