// The parody matrix as data (void-live-deploy/lib/parody.js, written by tools/parody.mjs from domains/void.board-game-law.md §5):
// it matches the doc, and every row is whole enough for the game rack to show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ROWS from '../void-live-deploy/lib/parody.js';
import { rows, DOC } from './parody.mjs';

test('lib/parody.js is the doc\'s matrix, row for row', () => {
  assert.deepEqual(ROWS, rows(readFileSync(DOC, 'utf8')));
});

test('every row names the game, its lookup names, its status and an original parody that is not the protected name', () => {
  assert.ok(ROWS.length >= 20, 'the matrix has its rows: ' + ROWS.length);
  const seen = new Set();
  for (const r of ROWS) {
    for (const k of ['game', 'status', 'protects', 'safest', 'generic', 'parody']) assert.ok(typeof r[k] === 'string' && r[k].trim(), r.game + ': ' + k);
    assert.equal(typeof r.pd, 'boolean', r.game + ': pd');
    assert.ok(Array.isArray(r.names) && r.names.length, r.game + ': names');
    for (const n of r.names) { assert.match(n, /^[a-z0-9 &']+$/, r.game + ': name ' + n); assert.ok(!seen.has(n), 'a name looks up one game: ' + n); seen.add(n); }
    for (const n of r.names) assert.notEqual(r.parody.toLowerCase(), n, r.game + ': the parody is not the protected name');
  }
});
