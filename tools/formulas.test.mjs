// the formula library (lib/formulas-*.js, worked by lib/formula-engine.js): every formula's worked example, checked exactly. Each definition
// carries `want`, its left side at its example values, worked out separately with Python's math library; the page's own run() must give it
// to 1 part in 10⁹, and solving the same equation back for each of its other variables must give that variable's example to 1 part in 10⁷.
//   node --test tools/formulas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMULA_BATCHES } from '../void-live-deploy/lib/formulas.js';
import batch1 from '../void-live-deploy/lib/formulas-1.js';
import { CALCULATORS, CATEGORIES, BY_ID, FORMULA_COUNT, run, readQuery, writeQuery, search, toJSON } from '../void-live-deploy/lib/calculators.js';
import { KINDS, unitOf } from '../void-live-deploy/lib/calc-units.js';

const ALL = FORMULA_BATCHES.flat();
const near = (got, want, rel) => Math.abs(got - want) <= rel * Math.max(Math.abs(want), 1e-12);

test('the library: every formula once, in a known category, with a source, all loaded into /calculators/', () => {
  assert.equal(FORMULA_COUNT.formulas, ALL.length);
  assert.equal(CALCULATORS.length, FORMULA_COUNT.before + ALL.length);
  const ids = new Set();
  for (const d of ALL) {
    assert.ok(!ids.has(d.id), d.id + ' twice'); ids.add(d.id);
    assert.ok(CATEGORIES.includes(d.cat), d.id + ': category ' + d.cat);
    assert.match(d.src, /^https:\/\/\S+$/, d.id + ': a source link');
    assert.ok(BY_ID.get(d.id) && BY_ID.get(d.id).def, d.id + ' is in the library');
  }
});

for (const [bi, batch] of FORMULA_BATCHES.entries()) {
  test('batch ' + (bi + 1) + ': ' + batch.length + ' formulas give their worked example, and solve back for each variable', () => {
    for (const d of batch) {
      const c = BY_ID.get(d.id), def = c.def;
      // forwards: the page's run() at the examples
      const r = run(c);
      assert.equal(r.error, '', d.id + ': ' + r.error);
      const o = r.outputs[0];
      assert.ok(near(o.value, d.want, 1e-9), d.id + ': got ' + o.value + ', want ' + d.want);
      // backwards: each other variable from the rest, its own example the answer
      for (const k of def.solve) {
        if (k === def.lhs) continue;
        const v = def.by[k], rr = run(c, {}, {}, { solve: k });
        assert.equal(rr.error, '', d.id + ' for ' + k + ': ' + rr.error);
        assert.equal(rr.calc.target, k);
        const got = rr.outputs[0].value, want = Number(v.v);
        assert.ok(near(got, want, 1e-7), d.id + ' solved for ' + k + ': got ' + got + ', want ' + want);
      }
    }
  });
}

test('a formula worked another way round keeps its units, its link and its source', () => {
  const id = ALL[0].id, c = BY_ID.get(id), k = c.def.solve.find((x) => x !== c.def.lhs);
  const q = writeQuery({ calc: id, solve: k, given: {} });
  assert.match(q, new RegExp('solve=' + k));
  const back = readQuery(q);
  assert.equal(back.solve, k);
  const r = run(back.calc, back.given, back.outUnits, { solve: back.solve });
  assert.equal(r.calc.target, k); assert.equal(r.error, '');
  assert.equal(JSON.parse(toJSON(r)).source, c.src);
  // solving for the left side is the plain calculator, and its link says nothing extra
  assert.equal(writeQuery({ calc: id, solve: c.def.lhs, given: {} }), '?calc=' + id);
});

test('every variable is a real kind and unit, and search finds formulas by name', () => {
  for (const d of ALL) for (const v of BY_ID.get(d.id).def.vars) { assert.ok(KINDS[v.kind], d.id); assert.ok(unitOf(v.kind, v.unit), d.id + ' ' + v.unit); }
  assert.ok(search('braking distance').some((c) => c.id === 'braking-distance'));
  assert.ok(search('du bois').some((c) => c.id === 'bsa-du-bois'));
});

test('lib/formulas-1.js is the first batch the library ships, every definition with its worked example', () => {
  assert.equal(FORMULA_BATCHES[0], batch1);
  assert.ok(batch1.length > 0 && batch1.every((d) => d.id && d.eq && typeof d.want === 'number'), 'a definition without id, eq or want');
});
