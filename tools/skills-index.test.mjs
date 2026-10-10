// skills/index.json is generated from one order file per skill (tools/skills-index.mjs): the rank in the file name orders
// the routing, a tie orders by name, a malformed or doubled file is refused, and the committed index must match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { orderOf, indexState, writeIndex, indexText, ORDER_DIR, INDEX } from './skills-index.mjs';

test('order files give the routing order: by rank, then by name; bad names and doubles are refused', () => {
  assert.deepEqual(orderOf(['0020-sorry', '0010-aggravation', '0480-watch', '0480-calendar']), ['aggravation', 'sorry', 'calendar', 'watch']);
  assert.throws(() => orderOf(['watch']), /an order file is <rank>-<skill>/);
  assert.throws(() => orderOf(['0010-watch', '0020-watch']), /twice/);
});

test('a stale index is seen, --write settles it in the file\'s own one-line style', () => {
  const d = mkdtempSync(join(tmpdir(), 'void-skills-')), order = join(d, 'order'), index = join(d, 'index.json');
  mkdirSync(order); for (const f of ['0010-a', '0020-b']) writeFileSync(join(order, f), '');
  assert.equal(indexState(order, index).stale, true, 'no index yet');
  assert.deepEqual(writeIndex(order, index), ['a', 'b']);
  assert.equal(readFileSync(index, 'utf8'), '["a", "b"]\n');
  assert.equal(indexState(order, index).stale, false);
  writeFileSync(join(order, '0015-c'), '');
  assert.equal(indexState(order, index).stale, true, 'a new skill file makes the committed index stale');
  assert.deepEqual(writeIndex(order, index), ['a', 'c', 'b']);
  assert.equal(indexText(['x']), '["x"]\n');
});

test('the committed skills/index.json matches skills/order/ (node tools/skills-index.mjs --write when a skill was added)', () => {
  const { names, stale } = indexState(ORDER_DIR, INDEX);
  assert.ok(names.length > 50);
  assert.equal(stale, false, 'skills/index.json is stale: run node tools/skills-index.mjs --write');
});
