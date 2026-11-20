// One typed ask opens one card: when the article page bounces to the answer, showPage reuses the card already open
// for that ask, instead of stacking a second one. Run: node --test tools/one-card.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(resolve(root, 'void.html'), 'utf8');
const deploy = readFileSync(resolve(root, 'void-live-deploy/void.html'), 'utf8');
const index = readFileSync(resolve(root, 'void-live-deploy/index.html'), 'utf8');

const src = page.match(/\n    function sameAsk\(a, b\) \{[\s\S]*?\n    \}/);
assert.ok(src, 'sameAsk is on the home page');
const sameAsk = new Function(src[0] + '\nreturn sameAsk;')();

test('the three home pages stay the same, and a second showPage for the same ask reuses the open card', () => {
  assert.equal(page, deploy);
  assert.equal(page, index);
  assert.match(page, /sameAsk\(prev\._ask, currentAsk\)/);
  assert.match(page, /fill that one, so one typed line never opens two/);
});

test('two wordings of the same ask are one ask, and a different ask is not', () => {
  assert.equal(sameAsk('the matrix', 'The Matrix?'), true);
  assert.equal(sameAsk('311', '311'), true);
  assert.equal(sameAsk('slipknot', 'Slipknot.'), true);
  assert.equal(sameAsk('42', '42!'), true);
  assert.equal(sameAsk('the matrix', '311'), false);
  assert.equal(sameAsk('', ''), false);
  assert.equal(sameAsk('mercury', ''), false);
});
