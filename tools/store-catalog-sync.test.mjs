// The catalog the loops edit (domains/store.products.json) and the one the site ships (void-live-deploy/lib/store-products.js)
// must say the same thing, and a paid product shown as live must have a checkout. Two loop laps once added a $99 and a $499
// row with no checkout and a second id `full-stack-audit`, and renamed the $25 fix away from the id the pricing card reads.
// Run: node --test tools/store-catalog-sync.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import SHIPPED from '../void-live-deploy/lib/store-products.js';

const data = JSON.parse(fs.readFileSync(new URL('../domains/store.products.json', import.meta.url), 'utf8')).products;

test('every product id is used once', () => {
  const ids = data.map((p) => p.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});
test('a paid product marked live has a hosted checkout', () => {
  const bad = data.filter((p) => p.status === 'live' && p.cents > 0 && !p.pwyw && !p.gumroad && !p.special).map((p) => p.id);
  assert.deepEqual(bad, [], 'list it on Gumroad first, or mark it needs-gumroad');
});
test('the shipped catalog is the data file (node tools/store-publish.mjs sync)', () => {
  assert.deepEqual(SHIPPED.map((p) => [p.id, p.cents, p.gumroad || '', p.status, p.trial || '']), data.map((p) => [p.id, p.cents, p.gumroad || '', p.status, p.trial || '']));
});
test('the ids other code reads still exist', () => {
  for (const id of ['void-monthly', 'one-time-fix', 'keep-it-running', 'full-stack-audit', 'first-automation-setup', 'big-board', 'join-the-team', 'code-review-pro']) assert.ok(data.some((p) => p.id === id), id);
});
