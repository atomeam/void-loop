// /world/: every fact the snail scene states names its source page and the exact words it rests on, and the checker finds those words. Run: node --test tools/world-facts.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { manifest, CARDS } from '../void-live-deploy/world/snail-facts.js';
import { checkFact, titleOf, verify, norm } from './world-facts.mjs';

test('every fact has its source, a link to it and the exact words it rests on', () => {
  assert.ok(manifest.facts.length >= 10);
  for (const f of manifest.facts) { assert.ok(f.text && f.source && titleOf(f.url), f.id); assert.ok(norm(f.quote).length >= 15, f.id + ' quote'); }
  assert.equal(new Set(manifest.facts.map((f) => f.id)).size, manifest.facts.length);
});
test('every part card names a source', () => { for (const p of manifest.parts) assert.ok(CARDS[p.id] && CARDS[p.id][2], p.id); });
test('the checker finds a quote on the page and fails one that is not there', async () => {
  const f = manifest.facts[0], page = 'intro\n' + f.quote.toUpperCase().replace(/ /g, '  ') + '\nend';
  assert.equal(checkFact(f, page).ok, true); assert.equal(checkFact(f, 'nothing here').ok, false);
  const r = await verify([f, { ...f, id: 'x', quote: 'words that are not on the page at all' }], async () => ({ json: async () => ({ query: { pages: { 1: { extract: page } } } }) }));
  assert.deepEqual([r.total, r.verified, r.failed], [2, 1, ['x']]);
});
