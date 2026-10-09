import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicTacToeState as fresh, resolveMove as move, bestMove } from '../void-live-deploy/skills/tictactoe.js';

test('Void (O) never loses to any line of play by X', () => {
  let games = 0;
  const go = (s) => {
    if (s.status !== 'playing') { games++; assert.notEqual(s.status, 'X_wins'); return; }
    if (s.currentPlayer === 'O') return go(move(s, bestMove(s)).nextState);
    for (let i = 0; i < 9; i++) if (s.board[i] === null) go(move(s, i).nextState);
  };
  go(fresh());
  assert.ok(games > 500);
});
test('Void takes a win and blocks a threat', () => {
  const o = (board) => ({ board, currentPlayer: 'O', status: 'playing' });
  assert.equal(bestMove(o(['X', 'X', null, null, 'O', null, null, null, null])), 2); // blocks 0-1-2
  assert.equal(bestMove(o(['O', 'O', null, 'X', 'X', null, null, null, null])), 2); // wins before blocking
});

test('every way of asking for the game reaches the native card, and questions about it do not', async () => {
  const { tictactoeOf } = await import('../void-live-deploy/skills/tictactoe.js');
  for (const a of ['lets play tic tac toe', 'tic tac toe', 'play tic tac toe', 'a game of tic tac toe', 'noughts and crosses',
    'play tic tac toe with void', 'tic tac toe against void', 'i want to play tic tac toe against the computer']) assert.ok(tictactoeOf(a), a);
  for (const a of ['who invented tic tac toe', 'tic tac toe rules', 'connect 4']) assert.equal(tictactoeOf(a), null, a);
});
