// The family heat-map of corrections (lib/correction-heat.js). node --test tools/correction-heat.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { heatRows, heatHtml } from '../void-live-deploy/lib/correction-heat.js';
const sk = (n) => ({ name: n, tier: 'proven' });
const FAM = { families: [{ id: 'time', name: 'Time', skills: [sk('clock'), sk('timer')] }, { id: 'words', name: 'Wor<ds>', skills: [sk('poem'), sk('essay'), sk('quote'), sk('haiku')] }, { id: 'sky', name: 'Sky', skills: [sk('moon')] }] };
const c = (skill, text = 't') => ({ skill, text });

test('density is corrections per skill, heat is against the hottest family, every family shows', () => {
  const h = heatRows([c('clock'), c('timer'), c('poem'), c('mystery')], FAM);
  assert.equal(h.total, 4); assert.equal(h.unplaced, 1);
  assert.deepEqual(h.rows.map((r) => [r.id, r.errors, r.skills, r.density, r.heat]), [['time', 2, 2, 1, 1], ['words', 1, 4, 0.25, 0.25], ['sky', 0, 1, 0, 0]]);
});
test('empty log: an honest empty state with no number', () => {
  for (const l of [[], undefined, null]) { const html = heatHtml(l, FAM); assert.match(html, /No corrections yet/); assert.ok(!/\d/.test(html.replace(/<[^>]*>/g, '').replace(/&#\d+;/g, ''))); assert.ok(!html.includes('ch-cell')); }
  assert.deepEqual(heatRows([], FAM).rows.map((r) => r.heat), [0, 0, 0]);
  assert.match(heatHtml([c('clock')], null), /could not be read/);
});
test('the markup escapes untrusted text and puts unplaced corrections apart', () => {
  const html = heatHtml([c('poem', '<script>x</script>'), c('', 'orphan')], FAM);
  assert.ok(!html.includes('Wor<ds>') && html.includes('Wor&lt;ds&gt;')); assert.ok(!html.includes('<script'));
  assert.match(html, /data-family="words"/); assert.match(html, /1 more is about answers no skill family owns/);
  assert.match(html, /data-heat-level="1"/);
});
