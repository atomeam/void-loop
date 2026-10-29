// Verse's body asks (skills/nutrition.js, 2026-10-16): "plan my meals" splits the day's calories into meals (ask-20261014-1453-1),
// the BMI card keeps a weight trend only when "save this" is tapped (ask-20261014-2248-1) and links its band to the calorie
// card with the same height and weight (ask-20261014-2248-2). Run: node --test tools/meals.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nutrition, { askOf, mealsAskOf, mealSplit, mealsAsk, bandAsk, bmiTrend } from '../void-live-deploy/skills/nutrition.js';

test('meals: the asks it takes, with the target when one is given; a week, a diet or recipes are not it', () => {
  for (const [a, kcal] of [['plan my meals', 0], ['plan my meals for today', 0], ['make me a meal plan', 0], ['meal plan for 2100 calories', 2100], ['plan my meals for 1800 calories', 1800],
    ['plan my meals at 1,800 kcal', 1800], ['split 2000 calories into meals', 2000], ['Plan my meals for 2400 calories a day', 2400], ['plan my meals around 2200 calories', 2200]]) {
    const q = askOf(a); assert.ok(q && q.kind === 'meals', a); assert.equal(q.kcal, kcal, a);
  }
  for (const a of ['meal plan for the week', 'vegan meal plan recipes', 'plan my move', 'calories in a banana', 'how many calories should i eat a day', 'keto meal plan'])
    assert.notEqual((askOf(a) || {}).kind, 'meals', a);
  assert.equal(mealsAskOf('plan my meals for 100 calories').kcal, 0, 'a target under 800 is dropped, not planned');
  assert.ok(nutrition.examples.includes('plan my meals'));
});

test('meals: the 25 / 30 / 35 / 10 split, rounded to 5, with protein per meal when the weight is known', () => {
  const r = mealSplit(2000, 80);
  assert.deepEqual(r.map((x) => [x.meal, x.kcal]), [['Breakfast', 500], ['Lunch', 600], ['Dinner', 700], ['Snacks', 200]]);
  assert.deepEqual(r.map((x) => x.protein), [24, 29, 34, 10]); // 96 g a day at 1.2 g/kg
  assert.ok(mealSplit(2100).every((x) => x.protein === 0 && x.kcal % 5 === 0));
  assert.equal(mealsAsk(2137), 'plan my meals for 2137 calories'); assert.equal(mealsAsk(0), 'plan my meals');
  assert.equal(askOf(mealsAsk(2137)).kcal, 2137, 'the link the calorie card makes is an ask this skill reads back');
});

test('bmi: the band link carries the height and weight into a calorie ask the skill reads', () => {
  const a = bandAsk('overweight', 85, 177.8, false);
  assert.equal(a, "how many calories should i eat to lose weight at 5'10 187 lb");
  const q = askOf(a); assert.equal(q.kind, 'cal'); assert.equal(q.s.goal, 'lose'); assert.equal(Math.round(q.s.cm), 178); assert.equal(q.s.lb, 187);
  assert.match(bandAsk('underweight', 50, 175, true), /to gain weight at 175 cm 50 kg$/);
  assert.match(bandAsk('healthy weight', 70, 175, true), /eat a day at 175 cm 70 kg$/);
  assert.equal(askOf(bandAsk('healthy weight', 70, 175, true)).s.goal, undefined);
});

test('bmi: the trend of saved entries: none, one, several with the change a week', () => {
  assert.equal(bmiTrend([]), null);
  const one = bmiTrend([{ at: '2026-10-01T08:00:00Z', kg: 85, cm: 178, bmi: 26.8 }]);
  assert.equal(one.n, 1); assert.equal(one.kgWeek, null);
  const t = bmiTrend([{ at: '2026-10-15T08:00:00Z', kg: 83, cm: 178, bmi: 26.2 }, { at: '2026-10-01T08:00:00Z', kg: 85, cm: 178, bmi: 26.8 }]); // unsorted in
  assert.equal(t.n, 2); assert.equal(t.first.kg, 85); assert.equal(t.last.kg, 83); assert.equal(t.dKg, -2); assert.equal(t.dBmi, -0.6); assert.equal(t.days, 14); assert.equal(t.kgWeek, -1);
});
