// Food facts (skills/food.js): "calories in a banana", "protein in an egg", "sugar in a can of coke" read from a built-in
// table of USDA values; an unknown food or a daily-needs ask is left to the skills that answer those.
// Run: node --test tools/food.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import food, { foodAsk, FOODS } from '../void-live-deploy/skills/food.js';

test('food: the asks it takes, with the food and the nutrient asked for', () => {
  const cases = [
    ['calories in a banana', 'banana', 'kcal', 1], ['how many calories are in an apple', 'apple', 'kcal', 1],
    ['how much protein in an egg', 'egg', 'protein', 1], ['protein in 2 eggs', 'egg', 'protein', 2],
    ['carbs in rice', 'white rice', 'carbs', 1], ['sugar in a can of coke', 'cola', 'sugar', 1],
    ['how many grams of sugar in a can of coca cola', 'cola', 'sugar', 1], ['avocado calories', 'avocado', 'kcal', 1],
    ['nutrition facts for oatmeal', 'oatmeal', '', 1], ['how much fat is in peanut butter', 'peanut butter', 'fat', 1],
    ['fiber in black beans', 'black beans', 'fiber', 1], ['calories in half an avocado', 'avocado', 'kcal', 0.5],
    ['how many calories in a slice of pizza', 'cheese pizza', 'kcal', 1], ['calories in a glass of red wine', 'red wine', 'kcal', 1],
    ['How many calories in a banana?', 'banana', 'kcal', 1], ['calories in 3 strawberries', null]
  ];
  for (const [ask, name, want, n] of cases) {
    const a = foodAsk(ask);
    if (name === null) { assert.equal(a, null, ask); continue; }
    assert.ok(a, ask); assert.equal(a.food.name, name, ask); assert.equal(a.want, want, ask); assert.equal(a.n, n, ask);
  }
});

test('food: leaves daily needs, burns, unknown foods and look-alikes to others', () => {
  for (const ask of ['how many calories should i eat a day', 'how much protein do i need', 'calories burned running', 'calories in a pound of fat',
    'how many calories in a big mac', 'banana bread recipe', 'apple stock price', 'protein synthesis', 'egg timer', 'how much water should i drink',
    'is avocado healthy', 'calories in kj', '100 calories in kj', 'protein structure'])
    assert.equal(foodAsk(ask), null, ask);
});

test('food: every row is whole, and the energy roughly matches its protein, carbs and fat', () => {
  for (const f of FOODS) {
    for (const k of ['name', 'serving', 'g', 'kcal', 'protein', 'carbs', 'sugar', 'fat', 'fiber']) assert.ok(f[k] != null, f.name + ' ' + k);
    assert.ok(f.sugar <= f.carbs + 0.1 && f.fiber <= f.carbs + 0.1, f.name + ': sugar and fiber are part of the carbs');
    // 4/4/9 (and alcohol at 7 for drinks that have it): within 20% or 25 kcal of the label
    const est = 4 * f.protein + 4 * (f.carbs - (f.fiber || 0) * 0.5) + 9 * f.fat + 7 * (f.alcohol || 0);
    assert.ok(Math.abs(est - f.kcal) <= Math.max(25, f.kcal * 0.2), f.name + ': ' + Math.round(est) + ' vs ' + f.kcal);
  }
  assert.ok(food.examples.every((e) => foodAsk(e)), 'every example is taken');
  assert.ok(food.nearMisses.every((e) => !foodAsk(e)), 'no near miss is taken');
});
