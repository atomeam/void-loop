// The games family (skills/games.js): every old name still opens its own game, the picker answers, and the shared Verse
// strength (skills/game-level.js) slips only at the easy levels. Run: node --test tools/games-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import games from '../void-live-deploy/skills/games.js';
import { levelPick } from '../void-live-deploy/skills/game-level.js';

const asks = { 'play chess': 'chess', 'play checkers': 'checkers', 'play go': 'go', 'play othello': 'othello', 'play connect 4': 'connect4',
  'play tic tac toe': 'tictactoe', 'play mancala': 'mancala', 'play monopoly': 'monopoly', 'play voidquest': 'monopoly', 'play solar quest': 'monopoly',
  'play battleship': 'battleship', 'play poker': 'poker', 'play sorry': 'sorry', 'play aggravation': 'aggravation', 'games': 'rack', 'play a game': 'rack', 'games card': 'rack', 'pick a game': 'rack' };
test('each old name opens its own game inside the family', () => {
  for (const [a, want] of Object.entries(asks)) assert.equal(games.part(a.toLowerCase(), a), want, a);
});
test('the shared level: hard never slips, easy can', () => {
  assert.equal(levelPick('best', ['x'], 'hard', () => 0), 'best');
  assert.equal(levelPick('best', ['x'], 'easy', () => 0.1), 'x');
  assert.equal(levelPick('best', [], 'easy', () => 0), 'best');
});
