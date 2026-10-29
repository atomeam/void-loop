// The deploy's smoke check must compare what the preview serves with the copy the deploy uploaded, not the repo's void.html:
// tools/public-quotes.mjs takes the owner's quoted words out of the uploaded copy, so the two differ and every deploy after
// 2026-10-18 failed at "did not serve the tested void.html" (run 39198120938) while the page was served correctly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const yml = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const smoke = yml.slice(yml.indexOf('Smoke check the deployment'), yml.indexOf('Smoke check the deployment') + 1500);

test('the preview smoke check compares with the uploaded copy', () => {
  assert.match(smoke, /cmp -s page\.html void-live-deploy\/index\.html/);
  assert.doesNotMatch(smoke, /cmp -s page\.html void\.html/);
});
test('the quote strip runs before the smoke check, on the uploaded copy only', () => {
  assert.ok(yml.indexOf('tools/public-quotes.mjs') > -1 && yml.indexOf('tools/public-quotes.mjs') < yml.indexOf('Smoke check the deployment'));
});
