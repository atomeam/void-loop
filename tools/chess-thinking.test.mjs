// node tools/chess-thinking.test.mjs: while Void searches a chess move, the card says how far it has looked and what it leans
// to (asked by Void, ask-20261012-2345-3 / ask-20261012-2247-1: "a real-time reasoning or status line near the board during
// long-running calculations"). bestMove reports each finished depth; thinkingLine words it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create, play, bestMove, thinkingLine, legalMoves } from '../void-live-deploy/skills/chess-rules.js';

test('the search reports each depth it finishes: deeper each time, more positions, a legal move it leans to', () => {
  const s = play(create(), 'e2e4'), seen = [];
  const m = bestMove(s, { depth: 3, ms: 5000, rng: () => 0, onDepth: (i) => seen.push(i) });
  assert.ok(m, 'a move');
  assert.deepEqual(seen.map((i) => i.depth), [1, 2, 3]);
  for (let k = 1; k < seen.length; k++) assert.ok(seen[k].nodes >= seen[k - 1].nodes, 'positions only grow');
  const legal = legalMoves(s).map((x) => x.from + '-' + x.to);
  for (const i of seen) assert.ok(legal.includes(i.best.from + '-' + i.best.to), 'leans to a legal move');
});

test('the line names the depth, the positions and the move in chess notation; with nothing yet it just thinks', () => {
  const s = play(create(), 'e2e4'), best = legalMoves(s).find((x) => x.to === 36 && x.piece === 'p'); // e7-e5
  assert.equal(thinkingLine(null, s), 'Verse is thinking…');
  assert.equal(thinkingLine({ depth: 1, nodes: 20, best }, s), 'Verse is thinking… 1 move deep · 20 positions · leaning e5');
  assert.equal(thinkingLine({ depth: 3, nodes: 4812, best }, s), 'Verse is thinking… 3 moves deep · 4,812 positions · leaning e5');
});
