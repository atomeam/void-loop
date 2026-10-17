// Family velocity: which way each family moved against about a day ago, from recorded rows only (lib/better.js velocityOf, skills/family-health.js). node --test tools/family-velocity.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { velocityOf, familySnapshot, rowOf } from '../void-live-deploy/lib/better.js';
import { velocityWords, healthHtml } from '../void-live-deploy/skills/family-health.js';
const sk = (tier, failing) => ({ name: 'n' + Math.random(), tier, ...(failing ? { failing: ['x'] } : {}) });
const fam = (a, b) => ({ families: [{ id: 'a', name: 'A', skills: a }, { id: 'b', name: 'B', skills: b }] });
const NOW = Date.parse('2026-10-17T12:00:00Z'), ago = (h) => new Date(NOW - h * 36e5).toISOString();
const esc = (s) => String(s).replace(/[&<>"]/g, '');

test('no history: no rows, rows without a snapshot, or rows outside 12 to 48 hours give no velocity', () => {
  const f = fam([sk('proven')], [sk('proven')]);
  for (const rows of [undefined, [], [{ at: ago(24), score: 70 }], [{ at: ago(3), families: [{ id: 'a', health: 50 }] }], [{ at: ago(80), families: [{ id: 'a', health: 50 }] }]])
    assert.deepEqual(velocityOf(rows, f, NOW), { since: null, byFamily: {} });
  assert.match(velocityWords(undefined), /no history yet/);
  assert.match(healthHtml(esc, f, null, NOW, []), /velocity: no history yet/);
});
test('improving, decaying and steady against the row nearest a day old', () => {
  const before = fam([sk('experiment'), sk('proven')], [sk('proven'), sk('proven')]);       // a: 75, b: 100
  const rows = [{ at: ago(40), families: familySnapshot(fam([sk('experiment')], [sk('experiment')])) }, { at: ago(25), families: familySnapshot(before) }, { at: ago(2), families: [{ id: 'a', health: 1 }] }];
  const now = fam([sk('proven'), sk('proven')], [sk('proven'), sk('experiment', true)]);      // a: 100, b: 50 (failing counts 0 -> (1+0)/2)
  const v = velocityOf(rows, now, NOW);
  assert.equal(v.since, ago(25));
  assert.deepEqual([v.byFamily.a.trend, v.byFamily.a.delta], ['improving', 25]); assert.equal(v.byFamily.b.trend, 'decaying');
  assert.equal(velocityOf(rows, before, NOW).byFamily.a.trend, 'steady');
  assert.match(velocityWords(v.byFamily.a), /improving \(\+25 points\) since about a day ago/); assert.match(velocityWords(v.byFamily.b), /decaying/);
  const html = healthHtml(esc, now, null, NOW, rows); assert.match(html, /data-velocity="improving"/); assert.match(html, /data-velocity="decaying"/);
});
test('a family the old row did not know has no velocity, and rowOf records the snapshot only when there are families', () => {
  const rows = [{ at: ago(24), families: [{ id: 'a', health: 50 }] }];
  const v = velocityOf(rows, fam([sk('proven')], [sk('proven')]), NOW);
  assert.ok(v.byFamily.a && !v.byFamily.b);
  assert.ok(Array.isArray(rowOf({ week: 1, owner: 0 }, ago(0), fam([sk('proven')], [sk('tested')])).families));
  assert.ok(!('families' in rowOf({ week: 1, owner: 0 }, ago(0), null)));
});
