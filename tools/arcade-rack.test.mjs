// The arcade on the game rack (2026-10-19: "arcade games" came back as a Wikipedia page): the asks reach the rack, and each arcade
// game has a title, an ask that opens it and your record against Verse once played.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rackOf } from '../void-live-deploy/skills/rack.js';
import { GAMES, TITLES, ASKS, arcadeRow, record } from '../void-live-deploy/lib/ladder.js';

test('arcade asks open the rack; the word alone and other arcades do not', () => {
  for (const q of ['arcade games', 'show me the arcade', 'my arcade ladder', 'play an arcade game', 'what arcade games can i play']) assert.deepEqual(rackOf(q), { kind: 'rack' }, q);
  for (const q of ['arcade', 'arcade fire', 'arcade machine for sale', 'history of arcade games']) assert.equal(rackOf(q), null, q);
});
test('every arcade game has a Verse title and an opening ask, and its row shows the record once played', () => {
  for (const g of GAMES) { assert.ok(TITLES[g] && ASKS[g], g); assert.doesNotMatch(TITLES[g], /void/i); }
  let l = record(null, 'pong', 'you'); l = record(l, 'pong', 'void'); l = record(l, 'pong', 'void');
  assert.equal(arcadeRow(l, 'pong'), 'Verse Pong · I won 2, you won 1');
  assert.equal(arcadeRow(l, 'snake'), 'Verse Snake');
});
