// The frontier (domains/void.frontier.md, the one build order) must never be swapped for a stub: on 2026-11-11 a "mark shipped" PR replaced
// its 601 lines with one placeholder word and merged green, which emptied every open item, target and step for every agent that reads it.
// Lists run 17 restored it; this keeps the file whole. Run: node --test tools/frontier-intact.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFrontier, openItems, targets, OPEN_HEADER, TARGETS_HEADER } from './frontier.mjs';

test('the frontier is a whole file with its open list and targets, never a placeholder', () => {
  const t = readFrontier();
  assert.ok(t.split('\n').length > 200, 'the frontier has its lines (601 when it was restored)');
  assert.doesNotMatch(t.trim(), /^(?:PLACEHOLDER|TODO|TBD)\b/i);
  assert.ok(t.includes(OPEN_HEADER), 'the open list header is there');
  assert.ok(t.includes(TARGETS_HEADER), 'the targets header is there');
  assert.ok(openItems(t).length > 0, 'it has open items');
  assert.ok(targets(t).length > 0, 'it has targets');
});
