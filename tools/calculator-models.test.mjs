// skills/mini/calculator.js: the five Verse calculator models are one builder's data (owner, 2026-10-25: "a cycle of all the existing
// calculators too for 3d, all with verse branding but also saying which model"), and skills/calc.js hands a new card the next one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, MODEL_IDS, modelOf, layoutKeys, keysFit, CANON } from '../void-live-deploy/skills/mini/calculator.js';
import { CALC_MODELS, nextModel, MODEL_KEY } from '../void-live-deploy/skills/calc.js';

test('five models, each with its own id, case, display and key rows', () => {
  assert.equal(MODELS.length, 5);
  assert.deepEqual(MODEL_IDS, ['SL-200', 'FX-900', 'DT-12', 'RP-11', 'GX-84']);
  for (const m of MODELS) { assert.ok(m.case.w > 0.05 && m.case.l > 0.05 && m.case.t > 0, m.id + ' case'); assert.ok(['seg', 'seg2', 'pixel'].includes(m.display.kind), m.id + ' display'); assert.ok(m.keys.rows.length >= 4, m.id + ' rows'); }
  assert.equal(MODELS.find((m) => m.id === 'DT-12').case.tb > MODELS.find((m) => m.id === 'DT-12').case.t, true, 'the desk one is a wedge');
  assert.ok(MODELS.find((m) => m.id === 'RP-11').case.w > MODELS.find((m) => m.id === 'RP-11').case.l, 'the financial one is landscape');
  assert.equal(MODELS.find((m) => m.id === 'FX-900').display.kind, 'seg2'); assert.equal(MODELS.find((m) => m.id === 'GX-84').display.kind, 'pixel');
});
test('every key row sits inside its case, on every model', () => {
  for (const m of MODELS) {
    const keys = layoutKeys(m);
    assert.ok(keysFit(m), m.id + ': ' + JSON.stringify(keys.filter((k) => Math.abs(k.x) + k.w / 2 > m.case.w / 2 - 0.003 || k.z + k.h / 2 > m.case.l / 2 - 0.004)));
    assert.ok(keys.length <= 64, m.id + ' fits the label atlas');
    for (const d of ['7', '5', '+']) assert.ok(keys.some((k) => k.lab === d), m.id + ' has ' + d);
    assert.ok(keys.some((k) => (CANON[k.lab] || k.lab) === '='), m.id + ' has = or ENTER'); assert.ok(keys.some((k) => (CANON[k.lab] || k.lab) === 'C'), m.id + ' has a clear key');
  }
});
test('each badge is two lines, VERSE-branded by the builder, saying the model and what kind it is; never a real maker', () => {
  const brands = /casio|sharp|texas|instruments|\bhp\b|hewlett|packard|canon|citizen|olympia|victor|\bti\b/i;
  for (const m of MODELS) {
    assert.equal(m.badge.length, 2, m.id); assert.ok(m.badge[0].startsWith(m.id), m.id + ' model line'); assert.ok(/^(pocket solar|scientific|desk printing|RPN financial|graphing)$/.test(m.badge[1]), m.id + ' kind: ' + m.badge[1]);
    assert.doesNotMatch(JSON.stringify(m), brands, m.id);
  }
  assert.equal(modelOf('fx-900').id, 'FX-900'); assert.equal(modelOf(undefined).id, 'SL-200'); assert.equal(modelOf('nonsense').id, 'SL-200');
});
test('the card skill cycles the models round-robin from a counter in localStorage (a2m.void.calcmodel.v1)', () => {
  assert.deepEqual(CALC_MODELS, MODEL_IDS, 'calc.js names the same models as the miniature');
  assert.equal(MODEL_KEY, 'a2m.void.calcmodel.v1');
  const store = new Map(); globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  try {
    const seen = [nextModel(), nextModel(), nextModel(), nextModel(), nextModel(), nextModel()];
    assert.deepEqual(seen, ['SL-200', 'FX-900', 'DT-12', 'RP-11', 'GX-84', 'SL-200']);
    assert.equal(store.get(MODEL_KEY), '6');
    store.set(MODEL_KEY, 'junk'); assert.equal(nextModel(), 'SL-200', 'a broken counter starts over');
  } finally { delete globalThis.localStorage; }
  assert.equal(nextModel(), 'SL-200', 'no storage: the first model, no throw');
});
