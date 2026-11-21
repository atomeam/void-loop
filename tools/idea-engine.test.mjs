import test from 'node:test';
import assert from 'node:assert/strict';
import { boardOf, listsFrom } from './idea-engine.mjs';

test('one pass picks a single idea until the stranger gate has a pass rate, and keeps no visitor sentence', () => {
  const board = boardOf({
    at: '2026-11-21T00:00:00Z',
    lists: listsFrom({ skills: ['timer'], pages: ['/arcade/'], games: ['snake'] }),
    gaps: '| 18 | ring size chart | seen | a chart | open |\n',
    sweep: [{ id: 'make-video', name: 'Make a video', overall: 'fail', reason: 'at run (tools/x.mjs:1:1)' }],
    misses: [{ ask: 'my private plan for the trip', count: 1 }],
  });
  assert.equal(board.n, 1);
  assert.equal(board.passRate, null);
  assert.equal(board.picks.length, 1);
  assert.equal(board.picks[0].gate.waiting, true);
  assert.equal(board.cost.paidCents, 0);
  const text = JSON.stringify(board);
  assert.ok(!text.includes('private plan'));
  assert.ok(!text.includes('tools/x.mjs'));
  assert.ok(board.levers.blocks.ran > 0);
});
