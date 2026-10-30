// lib/calculator.js: a scientific calculator with no floating noise, percent as calculators mean it, trig in degrees or radians, memory, history
import test from 'node:test';
import assert from 'node:assert/strict';
import { calc, show, grouped, memory, remember, tokens } from '../void-live-deploy/lib/calculator.js';
const v = (e, o) => { const r = calc(e, o); assert.ok(r.ok, e + ': ' + r.error); return show(r.value); };

test('results to 15 significant digits: no floating noise', () => {
  assert.equal(v('0.1+0.2'), '0.3'); assert.equal(v('1.1*3'), '3.3'); assert.equal(v('1/3'), '0.333333333333333'); assert.equal(v('2π'), '6.28318530717959');
  assert.equal(show(-0), '0'); assert.equal(show(1e22), '1e+22'); assert.equal(show(1.23e-10), '1.23e-10'); assert.equal(grouped(12345678.9), '12,345,678.9');
});
test('order of operations, brackets, powers right to left, implicit multiplication', () => {
  assert.equal(v('3 + 4 * 2'), '11'); assert.equal(v('(1+2)(3+4)'), '21'); assert.equal(v('2^3^2'), '512'); assert.equal(v('-2^2'), '-4'); assert.equal(v('2^-1'), '0.5');
  assert.equal(v('(2+3'), '5', 'a bracket left open closes at the end'); assert.equal(v('2 × 3 ÷ 4 − 1'), '0.5'); assert.equal(v('5!'), '120'); assert.equal(v('√9 + sqrt(16) + ∛27'), '10');
  assert.equal(v('2e3'), '2000'); assert.equal(v('3²'), '9'); assert.equal(v('1,000 + 1'), '1001');
});
test('percent the way a calculator means it', () => {
  assert.equal(v('what is 17% of 240'), '40.8'); assert.equal(v('200 + 10%'), '220'); assert.equal(v('200 - 10%'), '180'); assert.equal(v('200 * 10%'), '20'); assert.equal(v('50%'), '0.5');
});
test('trig in degrees is exact at the usual angles; radians too; inverses and logs', () => {
  assert.equal(v('sin 30'), '0.5'); assert.equal(v('cos 90'), '0'); assert.equal(v('sin(180)'), '0'); assert.equal(v('tan 45'), '1'); assert.equal(v('sin(30)^2'), '0.25');
  assert.equal(v('sin(pi)', { deg: false }), '0'); assert.equal(v('cos(pi)', { deg: false }), '-1'); assert.equal(v('asin 1'), '90'); assert.equal(v('asin(1)', { deg: false }), '1.5707963267949');
  assert.equal(v('log 1000'), '3'); assert.equal(v('ln e'), '1'); assert.equal(v('log2 8'), '3');
  assert.equal(calc('tan 90').ok, false);
});
test('the stage calculator\'s asks and units are reused: "calculate", "5 miles to km", "100 c to f"', () => {
  assert.equal(v('calculate 2 + 2'), '4'); assert.equal(v('5 miles to km'), '8.04672'); assert.equal(v('100 c to f'), '212');
});
test('Ans and memory; mistakes say what is wrong instead of a number', () => {
  assert.equal(v('Ans * 2', { ans: 21 }), '42'); assert.equal(v('MR + 1', { mem: 4 }), '5');
  let m = memory(0, 'm+', 5); m = memory(m, 'm+', 0.1); m = memory(m, 'm+', 0.2); assert.equal(m, 5.3); assert.equal(memory(m, 'm-', 5.3), 0); assert.equal(memory(9, 'mc'), 0); assert.equal(memory(1, 'ms', 7), 7);
  for (const bad of ['1/0', 'abc', '2 +', ')', 'sqrt(-1)', 'ln 0', '0.5!', '']) assert.equal(calc(bad).ok, false, bad);
  assert.throws(() => tokens('2 & 3'));
});
test('history: newest first, a repeat kept once, at most 50', () => {
  let h = remember([], '1+1', 2); h = remember(h, '1+1', 2); h = remember(h, '0.1+0.2', 0.30000000000000004);
  assert.deepEqual(h, [{ e: '0.1+0.2', v: '0.3' }, { e: '1+1', v: '2' }]);
  for (let i = 0; i < 60; i++) h = remember(h, i + '+0', i); assert.equal(h.length, 50);
});
