import test from 'node:test';
import assert from 'node:assert/strict';
import { gentler, gentleRecipe, thanksLine, kindOf, GUIDE } from '../void-live-deploy/lib/recipe-respect.js';
import { BUILT_IN, fromMeal, timersIn } from '../void-live-deploy/lib/recipes.js';
import { shape } from '../void-live-deploy/lib/recipeimport.js';
import { CORE, charterBlock } from '../void-live-deploy/lib/charter.js';
import { tonePrompt, readTone, toneCauses, toneJudge } from './recipe-tone.mjs';
import { judge, POOL } from './guards/cards.mjs';

test('harsh verbs become gentle ones that mean the same in a kitchen, and the step stays correct', () => {
  assert.equal(gentler('Kill the heat and stir for 5 minutes.'), 'Turn off the heat and stir for 5 minutes.');
  assert.equal(gentler('Chop the heads off the prawns, then rinse.'), 'Take the heads off the prawns, then rinse.');
  assert.equal(gentler('Butcher the chicken into 8 pieces and roast at 200°C for 40 minutes.'), 'Cut up the chicken into 8 pieces and roast at 200°C for 40 minutes.');
  assert.equal(gentler('Stab the potatoes with a fork.'), 'Pierce the potatoes with a fork.');
  assert.equal(gentler('Gut the fish and rinse it.'), 'Clean the fish and rinse it.');
  assert.equal(gentler('Punch down the dough.'), 'Press down the dough.');
});
test('only what is harsh changes: ordinary cooking words, a butcher, a head of garlic and every number stay', () => {
  for (const t of ['Ask your butcher for a whole chicken.', 'Cut the head of garlic in half.', 'Chop the onion finely and fry for 6 minutes.', 'Beat the eggs with 2 tablespoons of milk.', 'Bake at 180°C for 25 minutes.', 'Smash burgers on a hot pan.']) assert.equal(gentler(t), t);
  assert.equal(gentler(gentler('Kill the heat.')), gentler('Kill the heat.'));
  assert.equal(gentler(null), '');
});
test('the built-in recipes keep every step, quantity and time when made gentle', () => {
  for (const r of BUILT_IN) {
    const g = gentleRecipe(r);
    assert.equal(g.steps.length, r.steps.length, r.id);
    assert.deepEqual(g.ingredients, r.ingredients);
    assert.deepEqual(g.steps.map((s) => s.match(/\d+/g)), r.steps.map((s) => s.match(/\d+/g)), r.id);
    assert.deepEqual(timersIn(g.steps.join(' ')), timersIn(r.steps.join(' ')), r.id);
    assert.ok(g.thanks && g.thanks.length < 140 && !/\n/.test(g.thanks), r.id);
  }
});
test('the thank-you is short, warm and plain, fits what is in the recipe, and never says plants feel pain', () => {
  assert.equal(kindOf({ name: 'Chicken noodle soup', ingredients: ['2 chicken breasts'] }), 'animal');
  assert.equal(kindOf({ name: 'Pancakes', ingredients: ['1 egg', 'milk'] }), 'gentle-animal');
  assert.equal(kindOf({ name: 'Green salad', ingredients: ['lettuce', 'tomato'] }), 'plant');
  for (const r of [{ name: 'Soup', ingredients: ['chicken'] }, { name: 'Salad', ingredients: ['kale'] }, { name: 'Cake', ingredients: ['egg'] }, { name: 'Stew', ingredients: ['beef'] }]) {
    const t = thanksLine(r);
    assert.match(t, /thank/i); assert.ok(t.length <= 130); assert.doesNotMatch(t, /\b(feel|feelings|pain|suffer|scream)\b/i);
    assert.equal(thanksLine(r), t);
  }
  assert.match(thanksLine({ name: 'Salad', ingredients: ['kale'] }), /vegetable|herb/);
  assert.match(thanksLine({ name: 'Soup', ingredients: ['chicken'] }), /animal/);
  assert.match(GUIDE, /never a claim that they feel pain/);
});
test('a recipe from TheMealDB or an import reads gently, with its thank-you', () => {
  const m = fromMeal({ idMeal: '1', strMeal: 'Prawn curry', strInstructions: '1. Chop the heads off the prawns.\n2. Kill the heat after 10 minutes.', strIngredient1: 'Prawns', strMeasure1: '500g' });
  assert.deepEqual(m.steps, ['Take the heads off the prawns.', 'Turn off the heat after 10 minutes.']);
  assert.match(m.thanks, /thank/i);
  const i = shape({ name: 'Roast', ingredients: ['1 chicken'], steps: ['Butcher the bird into 8 pieces.'] });
  assert.deepEqual(i.steps, ['Cut up the bird into 8 pieces.']);
});
test('the charter carries the recipe guide, so every prompt Verse runs on its own starts with it', () => {
  assert.ok(CORE.some((c) => c.id === 'kind' && c.text.includes(GUIDE)));
  assert.match(charterBlock(), /every recipe with care for the animals and the plants/);
});
test('the tone judge: the prompt carries the guide and the card, a well-formed reply is read, a poor one is named in plain words', () => {
  const p = tonePrompt('Soup\nTurn off the heat.', 'CHARTER\n');
  assert.ok(p.startsWith('CHARTER')); assert.ok(p.includes(GUIDE)); assert.ok(p.includes('Turn off the heat.')); assert.match(p, /plants feel pain/);
  const good = readTone('{"gentle":9,"warm":8,"preachy":1,"accurate":9,"falseScience":false,"harsh":[]}');
  assert.deepEqual(toneCauses(good), []);
  assert.equal(readTone('nonsense'), null); assert.equal(readTone('{"gentle":11,"warm":1,"preachy":1,"accurate":1}'), null);
  assert.match(toneCauses(readTone('{"gentle":3,"warm":2,"preachy":1,"accurate":9,"harsh":["slaughter the bird"]}'))[0], /not gentle enough \(slaughter the bird\)/);
  assert.deepEqual(toneCauses(readTone('{"gentle":9,"warm":5,"preachy":8,"accurate":9}')), ['recipe sounds preachy']);
  assert.deepEqual(toneCauses(readTone('{"gentle":9,"warm":5,"preachy":2,"accurate":9,"falseScience":true}')), ['recipe claims plants feel pain']);
  assert.deepEqual(toneCauses(readTone('{"gentle":9,"warm":5,"preachy":2,"accurate":3}')), ['recipe steps lost their clarity']);
  assert.deepEqual(toneCauses(null), []);
});
test('the tone judge asks the free model, and a run no judge answers is not passed or failed', async () => {
  let asked;
  const fetchFn = async (url, init) => { asked = { url, body: JSON.parse(init.body) }; return { json: async () => ({ result: { response: '{"gentle":9,"warm":7,"preachy":1,"accurate":9,"falseScience":false,"harsh":[]}' } }) }; };
  const v = await toneJudge('Soup. Thank you to the vegetables.', { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a' }, fetchFn);
  assert.equal(v.gentle, 9); assert.equal(v.by, 'workers-ai'); assert.match(asked.url, /\/ai\/run\//); assert.match(asked.body.messages[0].content, /Thank you to the vegetables/);
  assert.equal(await toneJudge('x', {}, fetchFn), null);
  assert.equal(await toneJudge('x', { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'a' }, async () => { throw new Error('down'); }), null);
});
test('the cards guard asks a meat and a vegetable recipe and counts a tone problem as a card problem, apart from art', () => {
  assert.ok(POOL.some((p) => /chicken soup/.test(p.ask)) && POOL.some((p) => /salad/.test(p.ask)));
  const ok = { card: true, expectArt: false, copy: null };
  assert.deepEqual(judge({ ...ok, tone: readTone('{"gentle":9,"warm":7,"preachy":1,"accurate":9}') }), []);
  const bad = judge({ ...ok, tone: readTone('{"gentle":2,"warm":1,"preachy":9,"accurate":2,"falseScience":true}') });
  assert.equal(bad.length, 4);
  assert.ok(bad.every((c) => !/art|placeholder|vision|subject/.test(c)), 'a tone cause must not trigger a repaint');
});
