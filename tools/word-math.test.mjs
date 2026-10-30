// wordMath in parts (asked by Verse): the parts run in order, each answers its own asks, and the whole still gives every golden answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, answer, PARTS, GOLDEN } from './word-math.mjs';
const W = load();
test('every golden answer is unchanged', () => {
  const G = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')); assert.ok(Object.keys(G).length > 500);
  for (const [a, want] of Object.entries(G)) assert.deepEqual(JSON.parse(JSON.stringify(answer(W.wordMath, a.toLowerCase()))), want, a);
});
test('each part answers its own asks and passes others on', () => {
  const own = { wmPercentsAndUnits: '15% off 80 dollars', wmGeometry: 'area of a circle with radius 3', wmExpression: '2 + 3 * 4', wmEverydayCounts: 'gas mark 4 in celsius' };
  for (const [p, a] of Object.entries(own)) { assert.notEqual(W[p](a, a), W.WM_NEXT, p + ': ' + a); }
  for (const p of PARTS.slice(0, -1)) assert.equal(W[p]('tell me a joke', 'tell me a joke'), W.WM_NEXT, p + ' passes a non-math ask on'); // the last part, the expression parser, ends the chain with null
  assert.equal(answer(W.wordMath, 'tell me a joke'), null);
});
test('roman numerals with no "for" (2026-10-30: live, "roman numeral 2024" went to the web and came back as a guess)', () => {
  for (const a of ['roman numeral 2024', 'roman numerals 2024', '2024 roman numeral', '2024 roman numerals']) assert.deepEqual(JSON.parse(JSON.stringify(answer(W.wordMath, a))), { value: 'MMXXIV', note: '2024 in Roman numerals' }, a);
  assert.deepEqual(JSON.parse(JSON.stringify(answer(W.wordMath, 'roman numeral mmxxiv'))), { value: '2024', note: 'MMXXIV = 2024' });
  for (const a of ['roman numeral 4000', 'roman numeral 0', 'roman numerals', 'roman numeral history']) assert.equal(answer(W.wordMath, a), null, a);
});
