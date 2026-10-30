// The decision matrix answers only an ask that names a decision matrix (or a decision grid); a bare "france vs spain", "show the
// grid" or "2x2 matrix" stay with country, stage-arrange and decide-cards (lists run 2, 2026-10-21: the overlap check was red on main).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dm, { parseDecision } from '../void-live-deploy/skills/decision-matrix.js';

test('every example still opens the matrix, the overlapping asks do not', () => {
  for (const t of dm.examples) assert.ok(parseDecision(t), t);
  for (const t of ['france vs spain', '2x2 matrix for impact vs effort', 'show the grid', ...dm.nearMisses]) assert.equal(parseDecision(t), null, t);
  assert.deepEqual(parseDecision('decision matrix for pasta vs pizza').options, ['pasta', 'pizza']);
  assert.ok(parseDecision('decision grid for jobs'));
});
