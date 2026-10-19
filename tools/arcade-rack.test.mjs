// The arcade on the game rack (2026-10-19: "arcade games" came back as a Wikipedia page): the asks reach the rack, and each arcade
// game has a title, an ask that opens it and your record against Verse once played.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rackOf } from '../void-live-deploy/skills/rack.js';
import { GAMES, TITLES, ASKS, arcadeRow, record } from '../void-live-deploy/lib/ladder.js';

test('the rack no longer takes arcade asks (the arcade skill does)', () => {
  for (const q of ['arcade games', 'show me the arcade', 'arcade']) assert.equal(rackOf(q), null, q);
});
test('every arcade game has a Verse title and an opening ask, and its row shows the record once played', () => {
  for (const g of GAMES) { assert.ok(TITLES[g] && ASKS[g], g); assert.doesNotMatch(TITLES[g], /void/i); }
  let l = record(null, 'pong', 'you'); l = record(l, 'pong', 'void'); l = record(l, 'pong', 'void');
  assert.equal(arcadeRow(l, 'pong'), 'Verse Pong · I won 2, you won 1');
  assert.equal(arcadeRow(l, 'snake'), 'Verse Snake');
});

test('the arcade skill takes the arcade asks, leaves the word and other arcades alone; the cabinet maps a screen tap to its row', async () => {
  const { arcadeOf } = await import('../void-live-deploy/skills/arcade.js');
  const { rowAt } = await import('../void-live-deploy/skills/mini/arcade.js');
  for (const q of ['arcade games', 'show me the arcade', 'my arcade ladder', 'arcade machine', 'verse arcade', 'what arcade games can i play']) assert.equal(arcadeOf(q), true, q);
  for (const q of ['arcade', 'arcade fire', 'arcade machine for sale', 'arcade near me', 'history of arcade games']) assert.equal(arcadeOf(q), false, q);
  assert.equal(rowAt(0.79, 6), 0); assert.equal(rowAt(0.09, 6), 5); assert.equal(rowAt(0.95, 6), -1, 'the title band is no row'); assert.equal(rowAt(0.02, 6), -1, 'below the list is no row');
});
