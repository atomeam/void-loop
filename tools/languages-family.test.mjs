// The languages family (skills/languages.js, lists run 2026-10-21): spanish and translate are one routing entry, each old ask still
// reaches the member that answered it before, and both old names stay as parts (aliases). Run: node --test tools/languages-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import languages from '../void-live-deploy/skills/languages.js';
import spanish from '../void-live-deploy/skills/spanish.js';
import translate from '../void-live-deploy/skills/translate.js';

const before = (a) => (spanish.match(a.toLowerCase(), a) ? 'spanish' : translate.match(a.toLowerCase(), a) ? 'translate' : null); // the old order: spanish at 190, translate at 200
test('every example of both old skills lands on the same member as before the merge', () => {
  const asks = [...(spanish.examples || []), ...(translate.examples || []), 'answer me in Spanish', 'reply in Spanish', 'answer me in Spanish: what is a void'];
  assert.ok(asks.length >= 4);
  for (const a of asks) assert.equal(languages.part(a.toLowerCase(), a), before(a), a);
});
test('the old names are kept as parts, the family takes one place in the index, the members left it', () => {
  assert.deepEqual(languages.parts, ['spanish', 'translate']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('languages')); assert.ok(!index.includes('spanish') && !index.includes('translate'));
});
test('near misses of either member still miss the family', () => {
  for (const a of languages.nearMisses) assert.equal(languages.match(a.toLowerCase(), a), false, a);
});
