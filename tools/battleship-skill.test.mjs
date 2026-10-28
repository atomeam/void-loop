// The battleship skill (void-live-deploy/skills/battleship.js): which asks open Sea Battle against Verse.
import test from 'node:test';
import assert from 'node:assert/strict';
import battleship, { battleshipOf } from '../void-live-deploy/skills/battleship.js';

test('battleshipOf opens a game for the ways people ask for one', () => {
  for (const a of ['play battleship', 'Play Battleship!', "let's play battleships", 'start a game of battleship', 'play sea battle', 'play battleship against verse', 'battleship board game', 'a game of battleship', 'new battleship game with me'])
    assert.deepEqual(battleshipOf(a), { kind: 'game' }, a);
});

test('battleshipOf leaves other asks alone', () => {
  for (const a of ['', 'what is a battleship', 'battleship potemkin', 'play chess', 'how big was the battleship yamato', 'battleship movie cast'])
    assert.equal(battleshipOf(a), null, a);
});

test('the skill is named, and every example it lists opens the game', () => {
  assert.equal(battleship.name, 'battleship');
  assert.ok(Array.isArray(battleship.examples) && battleship.examples.length > 0);
  for (const e of battleship.examples) assert.ok(battleshipOf(e), 'example: ' + e);
  for (const n of battleship.nearMisses || []) assert.equal(battleshipOf(n), null, 'near miss: ' + n);
});
