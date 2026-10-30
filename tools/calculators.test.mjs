// /calculators/ (the tower's vcalc.com floor): the formula library (lib/calculators.js), its units and formula language (lib/calc-units.js) and
// its stage card (skills/formulas.js), checked against answers worked out by hand. Every value here is the exact text the page shows.
//   node --test tools/calculators.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CALCULATORS, CATEGORIES, BY_ID, FORMULA_COUNT, run, allUnits, readQuery, writeQuery, search, toCSV, toJSON, fmt, molarMass } from '../void-live-deploy/lib/calculators.js';
import { KINDS, findUnit, toSI, fromSI, evaluate, parseSpec, specText, runSpec } from '../void-live-deploy/lib/calc-units.js';
import formulas, { pick, isLibrary } from '../void-live-deploy/skills/formulas.js';

const out = (id, given = {}, units = {}, opts = {}) => { const r = run(id, given, units, opts); assert.equal(r.error, '', id + ': ' + r.error); return Object.fromEntries(r.outputs.map((o) => [o.k, o.text])); };

test('the library: 218 hand-built calculators (164, the 21 calculator.net home-page gap-fills in tools/calc-net.test.mjs, the 16 Maths gap-fills in tools/calc-math.test.mjs and the 17 Other gap-fills in tools/calc-other.test.mjs) plus the formula library (tools/formulas.test.mjs), in 21 kinds, each id once, each with a formula, inputs and outputs, and each works out with its own defaults', () => {
  assert.equal(CALCULATORS.filter((c) => !c.def).length, 219); assert.equal(FORMULA_COUNT.before, 219); assert.equal(CATEGORIES.length, 21); assert.equal(BY_ID.size, CALCULATORS.length);
  for (const c of CALCULATORS) {
    assert.ok(CATEGORIES.includes(c.cat), c.id); assert.ok(c.formula && c.inputs.length && c.outputs.length, c.id);
    const r = run(c, {}, {}, { kind: 'length' }); assert.equal(r.error, '', c.id + ': ' + r.error);
    assert.ok(r.outputs.some((o) => o.text !== '—'), c.id + ' has an answer');
  }
});

test('everyday answers, exact: percent, tip, loan, BMI, dates, sample size, combinations', () => {
  assert.equal(out('percent-of').r, '40.8');
  assert.deepEqual(out('tip', { bill: '64', people: '3' }), { tip: '$12.80', total: '$76.80', each: '$25.60' });
  assert.deepEqual(out('loan-payment'), { pay: '$483.32', total: '$28,999.20', interest: '$3,999.20' });
  assert.equal(out('bmi').bmi, '22.8571 kg/m²'); assert.equal(out('bmi').band, 'healthy weight');
  assert.equal(out('bmi', { m: '154 lb', h: '5.75 ft' }).bmi.slice(0, 5), '22.74');
  assert.equal(out('days-between').days, '358 days');
  assert.deepEqual(out('add-days', { from: '2026-10-28', n: '90' }), { date: '2027-01-26', day: 'Tuesday' });
  assert.equal(out('combinations').c, '2,598,960'); assert.equal(out('sample-size').n, '1,068 people');
  assert.equal(out('compound-interest').A, '$16,470.09');
});

test('units on the way in and out: a value in any unit of its kind, the answer in any other, the same SI underneath', () => {
  assert.equal(out('pipe-surface-area', { d: '2', 'd.u': 'in', l: '10', 'l.u': 'ft' }).a, '5.23599 ft²');
  assert.equal(out('pipe-surface-area', {}, { a: 'm²' }).a, '0.486439 m²');
  assert.equal(out('pipe-surface-area', { d: '5.08 cm', l: '3.048 m' }).a, '5.23599 ft²'); // a unit typed inside the box
  const si = run('pipe-surface-area').outputs[0].si, all = Object.fromEntries(allUnits('area', si).map((u) => [u.unit, u.text]));
  assert.equal(all['in²'], '753.982 in²'); assert.equal(all['yd²'], '0.581776 yd²'); assert.equal(all['cm²'], '4,864.39 cm²');
  assert.equal(out('convert', { v: '98.6', 'v.u': '°F' }, { r: '°C' }, { kind: 'temperature' }).r, '37 °C');
  assert.equal(out('convert', { v: '98.6', 'v.u': '°F' }, { r: 'K' }, { kind: 'temperature' }).r, '310.15 K');
  assert.equal(out('convert').r, '1.8288 m'); assert.equal(out('cooking').tbsp, '24 tbsp');
  assert.equal(toSI(1, findUnit('in').unit), 0.0254); assert.equal(fromSI(0.3048, findUnit('ft').unit), 1); assert.equal(toSI(0, findUnit('°C').unit), 273.15);
  assert.match(run('pipe-surface-area', { d: 'abc' }).error, /not a number/);
  assert.match(run('pipe-surface-area', { d: '2 kg' }).error, /./, 'a mass is not a length');
  assert.ok(Object.keys(KINDS).length >= 30);
});

test('maths, statistics and the sciences, exact', () => {
  assert.deepEqual([out('quadratic').x1, out('quadratic').x2], ['2', '1']);
  const d = out('descriptive'); assert.deepEqual([d.mean, d.median, d.sd, d.psd], ['5', '4.5', '2.13809', '2']);
  assert.equal(out('resistors-parallel').r, '56.8966 Ω'); assert.deepEqual(out('ohms-law-current'), { i: '3 A', p: '36 W' });
  assert.equal(out('escape-velocity').v, '11.186 km/s'); assert.equal(out('photon-energy').e, '2.25426 eV');
  assert.equal(out('ideal-gas-volume').v, '24.4654 L'); assert.equal(out('molar-mass').M, '180.156 g/mol');
  assert.equal(fmt(molarMass('H2O'), 6), '18.015'); assert.equal(out('z-score').z, '1.5'); assert.equal(out('normal-probability').p, '68.2689%');
});

test('a link holds the whole setting, and pro mode shows more digits', () => {
  const q = writeQuery({ calc: 'pipe-surface-area', given: { d: '2', 'd.u': 'in' }, outUnits: { a: 'm²' }, pro: true });
  assert.equal(q, '?calc=pipe-surface-area&d=2&d.u=in&a.u=m²&pro=1');
  const back = readQuery(q); assert.equal(back.calc, 'pipe-surface-area'); assert.deepEqual(back.given, { d: '2', 'd.u': 'in' }); assert.deepEqual(back.outUnits, { a: 'm²' }); assert.equal(back.pro, true);
  assert.equal(writeQuery(readQuery(q)), q);
  assert.equal(out('pipe-surface-area', {}, {}, { pro: true }).a, '5.23598775598 ft²');
  assert.equal(search('molar mass')[0].id, 'molar-mass'); assert.equal(search('ohm current')[0].id, 'ohms-law-current');
  const r = run('pipe-surface-area'); assert.match(toCSV(r), /Surface area/); assert.match(toJSON(r), /5\.23599/);
});

test('your own formula: the text and the model are one, units checked by dimension, a wrong sum said plainly', () => {
  const t = '# Kinetic energy\nE [J] = 0.5*m*v^2\nm [kg] = 2\nv [km/h] = 36', s = parseSpec(t);
  assert.equal(s.title, 'Kinetic energy'); assert.deepEqual(s.errors, []); assert.equal(specText(s), t);
  const r = runSpec(s); assert.equal(r.results[0].shown, 100); assert.equal(r.results[0].unitText, 'J');
  assert.equal(runSpec(parseSpec('A [ft²] = pi*d*l\nd [in] = 2\nl [ft] = 10')).results[0].shown.toFixed(5), '5.23599');
  assert.equal(runSpec(parseSpec('x [m] = a+b\na [m] = 1\nb [s] = 2')).results[0].error, 'cannot add m and s');
  assert.equal(evaluate('2*pi').v, 2 * Math.PI);
});

test('the stage card: a calculator asked by name, the library by "formula calculators", and the page asks left to their own answers', () => {
  assert.equal(pick('pipe surface area calculator').id, 'pipe-surface-area'); assert.equal(pick('calculator for molar mass').id, 'molar-mass');
  assert.ok(isLibrary('formula calculators')); for (const a of formulas.nearMisses) assert.ok(!formulas.match(a.toLowerCase(), a), a);
  for (const a of formulas.examples) assert.ok(formulas.match(a.toLowerCase(), a), a);
  for (const a of ['age calculator', 'bmi calculator', 'calorie calculator', 'savings calculator', 'paint calculator', 'flooring calculator', 'wallpaper calculator', 'calculator for drywall'])
    assert.ok(!formulas.match(a.toLowerCase(), a), 'left to its own skill: ' + a);
  assert.ok(formulas.match('bmr calculator', 'bmr calculator'), 'a calculator no other skill answers is still taken');
  let html = '', page = ''; const api = { esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]), showPage: (f) => { const el = { dataset: {} }; f(el); html = el.innerHTML; page = el.dataset.page; return el; } };
  return formulas.run('pipe surface area calculator', api).then((name) => {
    assert.equal(name, 'formulas'); assert.equal(page, '/calculators/?calc=pipe-surface-area'); assert.match(html, /5\.23599 ft²/); assert.match(html, /href="\/calculators\/\?calc=pipe-surface-area"/);
  });
});

test('the floor: vcalc.com on the tower, its ask answered by /calculators/, a probe for its four extras (library size held to vcalc.com\'s published count)', async () => {
  const { FLOORS } = await import('../void-live-deploy/lib/tower.js'); const { probeFor } = await import('./tower-probes.mjs');
  const f = FLOORS.find((x) => x.id === 'formula calculators'); assert.ok(f); assert.equal(f.page, '/calculators/'); assert.equal(f.site, 'vcalc.com');
  assert.deepEqual(f.extra, ['formula library', 'unit-aware inputs', 'custom formulas', 'library size']);
  const p = probeFor('formula calculators'); assert.ok(p); assert.match(p.ask.verse, /calc=pipe-surface-area&d=2&d\.u=in&l=10&l\.u=ft/);
  assert.deepEqual(Object.keys(p.askParts || {}).sort(), ['custom formulas', 'formula library', 'library size', 'unit-aware inputs']);
});
