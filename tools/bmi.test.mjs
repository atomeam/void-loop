// The BMI calculator (skills/nutrition.js, kind 'bmi'): "bmi calculator" opens a live form; the maths and its adult bands
// (WHO / CDC) are pure and checked here. A BMI asked with the numbers in it ("bmi for 5 foot 10 180 pounds") stays calc's.
// Run: node --test tools/bmi.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nutrition, { askOf, bmiOf } from '../void-live-deploy/skills/nutrition.js';

test('bmi: the calculator asks open the form; asks with numbers are left to calc', () => {
  for (const a of ['bmi calculator', 'BMI', 'body mass index calculator', 'calculate my bmi', 'what is my bmi', 'check my bmi', 'open the bmi calculator', 'bmi chart'])
    assert.equal((askOf(a) || {}).kind, 'bmi', a);
  for (const a of ['what is my bmi 5 foot 10 180 pounds', 'bmi for 5 feet 10 inches 170 pounds', 'what does bmi stand for', 'is bmi accurate', 'bmi of a cat'])
    assert.notEqual((askOf(a) || {}).kind, 'bmi', a);
  assert.ok(nutrition.examples.includes('bmi calculator'));
});

test('bmi: the number, its adult band and the healthy weights for the height', () => {
  const a = bmiOf(77.1, 177.8); // 5 ft 10 in, 170 lb
  assert.equal(a.bmi.toFixed(1), '24.4'); assert.equal(a.band, 'healthy weight');
  assert.equal(bmiOf(50, 175).band, 'underweight');
  assert.equal(bmiOf(85, 175).band, 'overweight');
  assert.equal(bmiOf(100, 175).band, 'obesity');
  assert.equal(Math.round(a.lo), 58); assert.equal(Math.round(a.hi), 79); // 18.5 and 24.9 at 177.8 cm, in kg
  assert.equal(bmiOf(0, 175), null); assert.equal(bmiOf(70, 0), null);
});
