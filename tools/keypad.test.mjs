// tools/keypad.test.mjs: the scientific keypad on /calculators/ (lib/keypad.js), every key on known answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, start, press, pressAll, calc, show } from '../void-live-deploy/lib/keypad.js';

const run = (keys, st, rng) => pressAll(keys, st, rng);
const val = (keys) => run(keys).shown;

test('the full button set is there', () => {
  for (const k of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+', '−', '×', '÷', 'Back', 'Ans', 'M+', 'M−', 'MR', 'EXP', '±', 'RND', 'AC', '=']) assert.ok(KEYS.includes(k), k);
  for (const k of KEYS) assert.doesNotThrow(() => press(start(), k, { next: () => 0.25 }), k);
});
test('arithmetic keeps the order of operations', () => {
  assert.equal(val(['2', '+', '3', '×', '4', '=']), '14');
  assert.equal(val(['1', '0', '÷', '4', '−', '1', '=']), '1.5');
  assert.equal(val(['(', '2', '+', '3', ')', '×', '4', '=']), '20');
  assert.equal(val(['0', '.', '1', '+', '0', '.', '2', '=']), '0.3');
  assert.equal(val(['2', 'xʸ', '1', '0', '=']), '1024');
  assert.equal(val(['7', 'x²', '=']), '49');
  assert.equal(val(['√', '1', '4', '4', '=']), '12');
  assert.equal(val(['5', 'n!', '=']), '120');
  assert.equal(val(['5', '0', '%', '×', '8', '=']), '4');
  assert.equal(val(['4', '1/x', '=']), '0.25');
  assert.equal(val(['(', '2', '+', '1', '=']), '3'); // an open bracket is closed for you
});
test('EXP, ± and Back', () => {
  assert.equal(val(['2', 'EXP', '3', '=']), '2000');
  assert.equal(val(['5', 'EXP', '±', '3', '=']).length > 0, true);
  assert.equal(val(['1', '2', '±', '+', '2', '=']), '-10');
  assert.equal(val(['1', '2', '±', '±', '+', '2', '=']), '14');
  assert.equal(val(['1', '2', '3', 'Back', '=']), '12');
  assert.equal(run(['sin', 'Back']).expr, '');
  assert.equal(val(['6', '=', '±', '=']), '-6');
});
test('trig in degrees and radians, logs and constants', () => {
  assert.equal(val(['sin', '3', '0', '=']), '0.5');
  assert.equal(val(['cos', '6', '0', '=']), '0.5');
  assert.equal(val(['sin', '1', '8', '0', '=']), '0');
  assert.equal(val(['tan', '4', '5', '=']), '1');
  assert.equal(val(['asin', '1', '=']), '90');
  assert.equal(val(['Deg', 'cos', 'π', '=']), '-1');
  assert.equal(val(['ln', 'e', '=']), '1');
  assert.equal(val(['log', '1', '0', '0', '0', '=']), '3');
  assert.equal(val(['π', '=']), '3.14159265359');
});
test('Ans, memory, AC and RND', () => {
  assert.equal(val(['2', '+', '3', '=', '×', '1', '0', '=']), '50'); // an operator after = carries on from the answer
  assert.equal(val(['2', '+', '3', '=', '7', '=']), '7'); // a digit after = starts again
  assert.equal(val(['4', '=', 'AC', 'Ans', '+', '1', '=']), '5');
  let s = run(['9', 'M+', 'AC', '1', 'M+', 'AC', '3', 'M−', 'AC', 'MR', '=']);
  assert.equal(s.shown, '7'); assert.equal(s.mem, 7);
  s = run(['5', 'M−', 'AC', 'MR', '×', '2', '=']); assert.equal(s.shown, '-10');
  assert.equal(run(['MR', 'MC']).mem, 0);
  s = run(['1', '+', '2', 'AC']); assert.equal(s.expr, ''); assert.equal(s.shown, '0');
  assert.equal(run(['RND'], start(), { next: () => 0.123456789 }).expr, '0.123456789');
  assert.equal(val(['RND', '=']).startsWith('0.'), true);
});
test('mistakes say what is wrong', () => {
  assert.equal(run(['1', '÷', '0', '=']).shown, 'Error');
  assert.match(run(['1', '÷', '0', '=']).error, /division by zero/);
  assert.match(run(['2', '.', '5', 'n!', '=']).error, /whole number/);
  assert.match(run(['×', '=']).error, /./);
  assert.equal(run(['1', '÷', '0', '=', '2', '=']).shown, '2'); // a key after an error starts again
  assert.equal(show(1e15), '1e+15'); assert.equal(show(1 / 3), '0.333333333333');
  assert.equal(calc('Ans*2', { ans: 21 }), 42);
});
