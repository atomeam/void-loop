// lib/formula-engine.js: one definition (equation, variables with kinds and units, source) worked for any of its variables, checked against
// answers worked out by hand.   node --test tools/formula-engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readVar, define, root, solve, pretty, compile, compileAll } from '../void-live-deploy/lib/formula-engine.js';
import { run } from '../void-live-deploy/lib/calculators.js';

// a cylinder's side: A = π d l. d = 2 m, l = 3 m gives 6π = 18.84955592153876 m²
const CYL = { id: 't-cyl', name: 'Cylinder side', cat: 'Geometry', eq: 'A = pi*d*l', vars: 'A|Area|area|m²; d|Diameter|length|m|2; l|Length|length|m|3', want: 6 * Math.PI, src: 'https://en.wikipedia.org/wiki/Cylinder' };

test('readVar reads a variable and refuses an unknown kind or unit', () => {
  assert.deepEqual(readVar('d|Diameter|length|cm|2'), { k: 'd', label: 'Diameter', kind: 'length', unit: 'cm', v: '2' });
  assert.throws(() => readVar('d|Diameter|lenght|cm|2'), /no kind "lenght"/);
  assert.throws(() => readVar('d|Diameter|length|parsec-ish|2'), /no unit "parsec-ish"/);
});

test('define checks the equation, its variables, its example, its source and its dimensions', () => {
  const def = define(CYL);
  assert.equal(def.lhs, 'A'); assert.deepEqual(def.solve, ['A', 'd', 'l']);
  assert.throws(() => define({ ...CYL, eq: 'pi*d*l' }), /result = formula/);
  assert.throws(() => define({ ...CYL, eq: 'A = pi*d*l*w' }), /"w" is not one of its variables/);
  assert.throws(() => define({ ...CYL, eq: 'A = pi*d*d' }), /"l" is not in the formula/);
  assert.throws(() => define({ ...CYL, vars: 'A|Area|area|m²; d|Diameter|length|m|; l|Length|length|m|3' }), /"d" needs an example/);
  assert.throws(() => define({ ...CYL, src: '' }), /needs a source/);
  assert.throws(() => define({ ...CYL, want: undefined }), /worked example/);
  // a unit slip cannot ship: π d is a length, not an area
  assert.throws(() => define({ ...CYL, eq: 'A = pi*d + l*0', vars: CYL.vars }), /right side is m but A is area/);
  // a fixed formula (constants in set units) skips the dimension check
  assert.ok(define({ ...CYL, eq: 'A = pi*d + l*0', fixed: true }));
});

test('solve works the left side directly and any other variable numerically, in SI', () => {
  const def = define(CYL);
  assert.equal(solve(def, 'A', { d: 2, l: 3 }), 6 * Math.PI);
  assert.ok(Math.abs(solve(def, 'd', { A: 6 * Math.PI, l: 3 }) - 2) < 1e-12);
  assert.ok(Math.abs(solve(def, 'l', { A: 10, d: 1 }) - 10 / Math.PI) < 1e-12);
  // a length is never negative, so A = 0 has no answer rather than a nonsense one
  assert.throws(() => solve(def, 'd', { A: -1, l: 3 }), /no diameter gives area of that value/);
});

test('root finds a root by secant, falls back to a scan and bisection, and refuses a pole', () => {
  assert.ok(Math.abs(root((x) => x * x - 2, 1) - Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(root((x) => Math.exp(x) - 1e6, 1) - Math.log(1e6)) < 1e-9);
  // tanh flattens out, so the secant from far away stalls; the scan still finds 0.5 = tanh(x) at x = atanh(0.5)
  assert.ok(Math.abs(root((x) => Math.tanh(x) - 0.5, 50) - Math.atanh(0.5)) < 1e-9);
  assert.ok(Number.isNaN(root((x) => 1 / x, 1)));
  assert.ok(Number.isNaN(root((x) => x * x + 1, 1)));
  assert.ok(Number.isNaN(root((x) => x + 1, 1, { positive: true })));
});

test('pretty writes the equation for people', () => {
  assert.equal(pretty('A = pi*r^2'), 'A = π × r²');
  assert.equal(pretty('V = sqrt(a/b) - c^3'), 'V = √(a ÷ b) − c³');
  assert.equal(pretty('x = y^2.5'), 'x = y^2.5');
});

test('compile makes a calculator for any variable, with the rest as its boxes', () => {
  const def = define(CYL), c = compile(def, 'd');
  assert.equal(c.target, 'd'); assert.equal(c.formula, 'A = π × d × l (solved for d)');
  assert.deepEqual(c.inputs.map((i) => i.k + '=' + i.v), ['A=18.84955592', 'l=3']);
  assert.deepEqual(c.solveFor, [['A', 'Area'], ['d', 'Diameter'], ['l', 'Length']]);
  assert.equal(compile(def, 'nope').target, 'A');
  assert.throws(() => compileAll([CYL, CYL]), /t-cyl is defined twice/);
});

test('through run(): units on the way in and out, and solving back', () => {
  const [c] = compileAll([CYL]);
  // d = 20 cm, l = 3 m: 0.6π m² = 1.88496 m²
  let r = run(c, { d: '20', 'd.u': 'cm' });
  assert.equal(r.error, ''); assert.equal(r.outputs[0].text, '1.88496 m²');
  // 1 m² over 3 m of length: d = 1/(3π) m = 10.6103 cm
  r = run(c, { A: '1', l: '3' }, { d: 'cm' }, { solve: 'd' });
  assert.equal(r.error, ''); assert.equal(r.outputs[0].text, '10.6103 cm');
  r = run(c, { A: '-1', l: '3' }, {}, { solve: 'd' });
  assert.match(r.error, /no diameter/);
});
