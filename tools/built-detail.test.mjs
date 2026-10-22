// every built / improved line names the specific thing and what changed (owner, 2026-10-21: "never vague categories"), and the
// self card's per-skill view is read from the real ledger (lib/built-detail.js)
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { builtByFamily, specific, builtDetailHtml } from '../void-live-deploy/lib/built-detail.js';
const ledger = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url)));
const fam = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url)));
test('vague lines are refused', () => {
  assert.equal(specific('Sky and earth +1'), false); assert.equal(specific('3 skills improved'), false);
  assert.equal(specific('weather card: now shows the hourly forecast for the next day'), true);
});
test('every ledger line from 2026-10-22 on is specific', () => {
  const bad = ledger.filter((e) => e && String(e.at) >= '2026-10-22' && !specific(e.what));
  assert.deepEqual(bad.map((e) => e.at + ' ' + e.what), []);
});
test('the per-skill view comes from the ledger, whole lines, no ellipsis', () => {
  const r = builtByFamily(ledger, fam); assert.ok(r.families.length >= 5);
  const h = builtDetailHtml(r); assert.ok(h.includes('data-sec="built-detail"')); assert.ok(!/\u2026<\/li>/.test(h));
});
