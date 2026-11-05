// The where-is family (skills/where-is.js, lists run 13, 2026-11-05): sky-card and place are one routing entry, every old ask
// still reaches the member that answered it, both old names stay as parts, and the family sits at sky-card's old rank.
// Run: node --test tools/where-is-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/where-is.js';
import skyCard from '../void-live-deploy/skills/sky-card.js';
import place from '../void-live-deploy/skills/place.js';

test('every example of both old skills lands on the same member as before (sky-card first, as at rank 0215)', () => {
  for (const a of skyCard.examples) assert.equal(fam.part(a.toLowerCase(), a), 'skycard', a);
  for (const a of place.examples) {
    const before = skyCard.match(a.toLowerCase(), a) ? 'skycard' : 'place';
    assert.equal(fam.part(a.toLowerCase(), a), before, a);
  }
  // the asks both took (tools/skill-overlap.mjs): the sky card answered them first and still does; a city is still a map
  assert.equal(fam.part('where is jupiter', 'where is jupiter'), 'skycard');
  assert.equal(fam.part('where is the moon tonight', 'where is the moon tonight'), 'skycard');
  assert.equal(fam.part('where is lisbon', 'where is lisbon'), 'place');
  assert.equal(fam.part('map of paris', 'map of paris'), 'place');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['skycard', 'place']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('where-is')); assert.ok(!index.includes('sky-card') && !index.includes('place'));
  assert.ok(index.indexOf('where-is') === index.indexOf('eat') + 1, 'the family sits where sky-card sat, right after eat');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0215-where-is', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0215-sky-card', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0220-place', import.meta.url)));
});
