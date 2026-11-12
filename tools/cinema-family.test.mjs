// The cinema family (skills/cinema.js, lists run 21, 2026-11-12): films and movie are one routing entry, every old ask still reaches the
// member that answered it, both old names stay as parts, and the family sits where films sat (1100).
// Run: node --test tools/cinema-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/cinema.js';
import films from '../void-live-deploy/skills/films.js';
import movie from '../void-live-deploy/skills/movie.js';

test('every example of both old skills lands on the same member as before (films first, as before)', () => {
  for (const a of films.examples) assert.equal(fam.part(a.toLowerCase(), a), 'films', a);
  for (const a of movie.examples) assert.equal(fam.part(a.toLowerCase(), a), films.match(a.toLowerCase(), a) ? 'films' : 'movie', a);
  assert.equal(fam.part('where do i watch the films', 'where do I watch the films'), 'films', 'the overlapping ask stays with the films card');
  for (const a of ['pick a movie to watch with me', 'movie night', 'where can i stream the blair witch project']) assert.equal(fam.part(a, a), 'movie', a);
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where films sat', () => {
  assert.deepEqual(fam.parts, ['films', 'movie']);
  const order = readOrder();
  assert.ok(order.includes('cinema'));
  assert.ok(!order.includes('films') && !order.includes('movie'));
  assert.ok(order.indexOf('app') === order.indexOf('cinema') + 1, 'app still comes right after');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/1100-cinema', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1100-films', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1400-movie', import.meta.url)));
});
