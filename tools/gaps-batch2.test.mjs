// docs/GAPS.md batch 2 (2026-11-06): discount, fuel cost, gas mileage, a table from headings, quizzes, speed tests and noise, all in the page.
//   node --test tools/gaps-batch2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import formulas, { filled, pick } from '../void-live-deploy/skills/formulas.js';
import fuel from '../void-live-deploy/skills/fuel.js';
import csvTable, { headsIntent } from '../void-live-deploy/skills/csv-table.js';
import noise, { noiseOf, fillNoise, rngOf, clock } from '../void-live-deploy/skills/noise.js';
import speed, { testOf, summary, cps, aimSummary } from '../void-live-deploy/skills/speed-tests.js';
import mathQuiz, { quizOf, question, questions, readAnswer, LEVELS } from '../void-live-deploy/skills/math-quiz.js';
import { run as calc } from '../void-live-deploy/lib/calculators.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a card whose parts run() wires up: querySelector hands out one stub per class
const card = async (skill, text) => {
  const parts = {}, part = (sel) => { const k = sel.replace(/^[.#]/, ''); return (parts[k] = parts[k] || { value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, on: {}, setAttribute() {}, focus() {}, append() {}, appendChild() {}, remove() {}, addEventListener(ev, f) { this.on[ev] = f; } }); };
  const el = { innerHTML: '', dataset: {}, addEventListener() {}, querySelector: part, querySelectorAll: () => [], append() {}, appendChild() {} };
  const said = await skill.run(text, { showPage: (f) => { f(el); return el; }, esc, say() {}, _pageStill: () => true });
  return { said, h: el.innerHTML, parts };
};
const lag1 = (xs) => { let m = 0; for (const x of xs) m += x; m /= xs.length; let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { den += (xs[i] - m) ** 2; if (i) num += (xs[i] - m) * (xs[i - 1] - m); } return num / den; };

test('30% off 80: the sale price is 56 and the saving 24, sale price first', () => {
  for (const a of ['discount 30% off 80', '30% off 80', 'price after 30% discount on 80', '$80 with 30% off', 'what is 30% off $80']) {
    const f = filled(a);
    assert.ok(f && f.calc.id === 'discount', a);
    const out = calc(f.calc, f.given).outputs.map((o) => o.label + ' ' + o.text).join(' | ');
    assert.match(out, /56/, a + ': ' + out);
    assert.match(out, /24/, a + ': ' + out);
  }
  for (const a of ['30% of 80', '150% off 80', '30% off coupon']) assert.ok(!filled(a) || filled(a).calc.id !== 'discount', a);
  assert.ok(formulas.match('discount 30% off 80', 'discount 30% off 80'));
});

test('gas mileage: 300 miles on 10 gallons is 30 mpg; "mpg calculator" stays fuel economy', () => {
  const f = filled('mpg for 300 miles on 10 gallons');
  assert.equal(f.calc.id, 'gas-mileage');
  const out = calc(f.calc, f.given).outputs;
  assert.match(out[0].text, /^30\b/, out[0].text);
  assert.match(out.map((o) => o.text).join(' '), /7\.84/);
  assert.equal(pick('gas mileage calculator').id, 'gas-mileage');
  assert.equal(pick('mpg calculator').id, 'fuel-economy');
});

test('fuel cost with no price: 10 gallons, and a box for the price works out the cost', async () => {
  assert.ok(fuel.match('fuel cost for 300 miles at 30 mpg', 'fuel cost for 300 miles at 30 mpg'));
  const c = await card(fuel, 'fuel cost for 300 miles at 30 mpg');
  assert.match(c.h, /\b10\b[^<]*gal/, c.h);
  assert.ok(c.h.includes('fuel-price'), 'a price box');
  c.parts['fuel-price'].value = '3.5';
  (c.parts['fuel-price'].on.input || (() => {}))();
  assert.match(c.parts['fuel-cost'].textContent, /\$35\.00/, c.parts['fuel-cost'].textContent);
});

test('a table from headings: an empty row under them, + row and two copy buttons; furniture is not a table', async () => {
  assert.deepEqual(headsIntent('make a table from a,b,c').rows, [['a', 'b', 'c'], ['', '', '']]);
  assert.deepEqual(headsIntent('make a table from name, age, city').rows[0], ['name', 'age', 'city']);
  for (const a of ['make a table from wood', 'build a table with legs, top, and screws for my patio from oak']) assert.equal(headsIntent(a), null, a);
  assert.ok(csvTable.match('make a table from a,b,c', 'make a table from a,b,c'));
});

test('noise: the ask names the sound and the timer; the sounds have the right colour', () => {
  assert.deepEqual(noiseOf('white noise'), { color: 'white', minutes: 0 });
  assert.deepEqual(noiseOf('pink noise for 30 minutes'), { color: 'pink', minutes: 30 });
  assert.deepEqual(noiseOf('play white noise for 1 hour'), { color: 'white', minutes: 60 });
  assert.deepEqual(noiseOf('rain sounds for sleep'), { color: 'rain', minutes: 0 });
  assert.equal(noiseOf('brownian noise').color, 'brown');
  for (const a of noise.nearMisses) assert.equal(noiseOf(a), null, a);
  // white has no memory from one sample to the next, pink some, brown a lot: lag-1 correlation in that order
  const r = Object.fromEntries(['white', 'pink', 'brown', 'rain'].map((c) => [c, lag1(fillNoise(c, 44100, rngOf(7)))]));
  assert.ok(Math.abs(r.white) < 0.05 && r.pink > 0.5 && r.brown > r.pink && r.brown > 0.95, JSON.stringify(r));
  for (const c of ['white', 'pink', 'brown', 'rain']) assert.ok(fillNoise(c, 20000, rngOf(3)).every((v) => v >= -1 && v <= 1), c);
  assert.equal(clock(1799), '29:59');
  assert.equal(clock(3600), '1:00:00');
});

test('the noise card starts silent, says the rain is made and not recorded, and fetches nothing', async () => {
  const c = await card(noise, 'rain sounds');
  assert.equal(c.said, 'noise');
  assert.match(c.h, /It is not a recording/);
  assert.ok(!/<audio|<img|https?:\/\//.test(c.h), 'nothing fetched');
  assert.equal(c.parts['nz-play'].textContent, '', 'no sound until play is pressed');
});

test('speed tests: the ask names the test; averages, clicks per second and accuracy', async () => {
  assert.deepEqual(testOf('reaction time test'), { kind: 'reaction' });
  assert.deepEqual(testOf('click speed test'), { kind: 'clicks', seconds: 10 });
  assert.deepEqual(testOf('5 second click test'), { kind: 'clicks', seconds: 5 });
  assert.deepEqual(testOf('aim trainer'), { kind: 'aim' });
  for (const a of speed.nearMisses) assert.equal(testOf(a), null, a);
  assert.deepEqual(summary([200, 300, 250]), { count: 3, avg: 250, best: 200 });
  assert.deepEqual(summary([]), { count: 0, avg: 0, best: 0 });
  assert.equal(cps(70, 10000), 7);
  assert.equal(cps(33, 5000), 6.6);
  assert.deepEqual(aimSummary([400, 500], 2), { hits: 2, misses: 2, accuracy: 50, avg: 450 });
  for (const a of ['reaction time test', 'click speed test', 'aim trainer']) assert.equal((await card(speed, a)).said, 'speed-tests', a);
});

test('math quiz: the ask names the kind and level; every answer is a whole number and right', async () => {
  assert.deepEqual(quizOf('times tables quiz'), { kind: 'times', level: 'medium' });
  assert.deepEqual(quizOf('7 times table quiz'), { kind: 'times', level: 'medium', table: 7 });
  assert.deepEqual(quizOf('maths quiz hard'), { kind: 'mixed', level: 'hard' });
  assert.deepEqual(quizOf('division quiz easy'), { kind: 'div', level: 'easy' });
  for (const a of mathQuiz.nearMisses) assert.equal(quizOf(a), null, a);
  let seed = 1; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const kind of ['times', 'mixed', 'add', 'sub', 'mul', 'div']) for (const level of LEVELS) for (let i = 0; i < 300; i++) {
    const q = question({ kind, level }, rng);
    const v = q.op === '+' ? q.a + q.b : q.op === '−' ? q.a - q.b : q.op === '×' ? q.a * q.b : q.a / q.b;
    assert.ok(v === q.answer && Number.isInteger(v) && v >= 0, kind + ' ' + level + ' ' + q.text);
  }
  const seven = questions({ kind: 'times', table: 7, level: 'medium' }, 10, rng);
  assert.equal(seven.length, 10);
  assert.equal(new Set(seven.map((q) => q.text)).size, 10, 'no repeats');
  assert.ok(seven.every((q) => q.a === 7));
  assert.equal(readAnswer(' 56 '), 56);
  assert.equal(readAnswer('1,000'), 1000);
  assert.equal(readAnswer('5 6'), null);
  const c = await card(mathQuiz, '7 times table quiz');
  assert.equal(c.said, 'math-quiz');
  assert.match(c.parts['mq-q'].textContent, /^7 × \d+ = \?$/);
  const ans = (() => { const [a, , b] = c.parts['mq-q'].textContent.split(' '); return String(+a * +b); })();
  c.parts['mq-in'].value = ans;
  c.parts['mq-form'].on.submit({ preventDefault() {} });
  assert.equal(c.parts['mq-say'].textContent, 'Right.');
  assert.match(c.parts['mq-score'].textContent, /Question 2 of 10 · 1 right/);
});
