// The calculator card's maths (skills/calc.js, moved out of void.html in cleanup step 6): no eval, + - * / and brackets,
// percents, unit conversions, and the asks that carry a sum. Run: node --test tools/calc.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMath, evaluate, expressionOf, convertUnits, formatResult, plainCalc } from '../void-live-deploy/skills/calc.js';

test('calc: a plain sum keeps precedence and brackets, and refuses what it cannot work out', () => {
  assert.deepEqual(evaluateMath('2+5'), { ok: true, value: 7 });
  assert.equal(evaluateMath('12 * (3 + 4)').value, 84);
  assert.equal(evaluateMath('-3 + 10 / 4').value, -0.5);
  for (const bad of ['', '1/0', '2 +', 'alert(1)', '(1+2']) assert.equal(evaluateMath(bad).ok, false, bad);
});

test('calc: percents and units, and how a result is shown', () => {
  assert.equal(evaluate('15 % of 240').value, 36);
  assert.equal(formatResult(evaluate('convert(5, "miles", "km")').value), '8.04672');
  assert.equal(convertUnits(100, 'c', 'f'), 212);
  assert.equal(evaluate('convert(1, "cups", "km")').ok, false);
  assert.equal(formatResult(0.1 + 0.2), '0.3');
  assert.equal(formatResult(-0), '0');
});

test('calc: the asks that carry a sum, and the only asks the skill takes before the page', () => {
  assert.equal(expressionOf('calculator 2+5'), '2+5');
  assert.equal(expressionOf('15 percent of 240'), '15 % of 240');
  // as on the page before the move: "what is …" is taken first, so its "percent" stays a word the card cannot work out (the
  // answer card answers that ask before it reaches the card)
  assert.equal(expressionOf('what is 15 percent of 240?'), '15 percent of 240');
  assert.equal(expressionOf('5 miles to km'), 'convert(5, "miles", "km")');
  assert.equal(expressionOf('open a calculator'), null);
  assert.ok(plainCalc('calculator') && plainCalc('open a calculator') && plainCalc('give me a calc'));
  assert.ok(!plainCalc('calculator 2+5') && !plainCalc('calculate 12*3') && !plainCalc('remove the calculator'));
});
