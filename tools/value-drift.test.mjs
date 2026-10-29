// Value drift (tools/value-drift.mjs, asked by Verse, lists run 7): Verse's store prices over time, grouped by kind. Run: node --test tools/value-drift.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { drift } from './value-drift.mjs';

test('each price keeps its moves, and a kind whose prices move apart is flagged', () => {
  const d = drift([
    { at: '2026-10-01T00:00:00Z', products: [{ id: 'a', kind: 'service', cents: 1000 }, { id: 'b', kind: 'service', cents: 2000 }, { id: 'c', kind: 'license', cents: 500 }] },
    { at: '2026-10-10T00:00:00Z', products: [{ id: 'a', kind: 'service', cents: 1500 }, { id: 'b', kind: 'service', cents: 2000 }, { id: 'c', kind: 'license', cents: 500 }] },
    { at: '2026-10-20T00:00:00Z', products: [{ id: 'a', kind: 'service', cents: 1500 }, { id: 'b', kind: 'service', cents: 2000 }, { id: 'c', kind: 'license', cents: 550 }, { id: 'x', kind: 'license', cents: 'bad' }] },
  ]);
  const a = d.products.find((p) => p.id === 'a');
  assert.equal(a.change, 50); assert.equal(a.changes, 1); assert.deepEqual(a.history.map((h) => h.cents), [1000, 1500]);
  const svc = d.groups.find((g) => g.kind === 'service'), lic = d.groups.find((g) => g.kind === 'license');
  assert.equal(svc.spread, 50); assert.equal(svc.reappraise, true);
  assert.equal(lic.products, 1); assert.equal(lic.reappraise, false);
  assert.equal(d.versions, 3); assert.ok(!d.products.some((p) => p.id === 'x'));
});
test('an empty history is an empty record', () => assert.deepEqual(drift([]).groups, []));
