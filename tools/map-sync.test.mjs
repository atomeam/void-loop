// The live "show the map" card (void-live-deploy/skills/map.js) keeps a light copy of the assimilation table
// (domains/void.assimilate.md). The copy drifted once (grouping said "queued" and games "not started" long after both were
// live, found in cleanup step 2), so the status of every row must match the table's, up to its first bracket or comma.
// node --test tools/map-sync.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const word = (s) => String(s).split('(')[0].split(',')[0].trim().toLowerCase();
const table = new Map();
for (const line of readFileSync(new URL('../domains/void.assimilate.md', import.meta.url), 'utf8').split('\n')) {
  const c = line.split('|').map((x) => x.trim());
  if (/^\d+$/.test(c[1] || '') && c.length >= 7) table.set(+c[1], word(c[5]));
}
const card = new Map([...readFileSync(new URL('../void-live-deploy/skills/map.js', import.meta.url), 'utf8')
  .matchAll(/\{ n: (\d+),[^\n]*?s: '([^']*)'/g)].map((m) => [+m[1], word(m[2])]));

test('the map card shows every row of the assimilation table, with the same status', () => {
  assert.ok(table.size >= 13, 'the table has its rows: ' + table.size);
  assert.deepEqual([...card.keys()].sort((a, b) => a - b), [...table.keys()].sort((a, b) => a - b));
  const off = [...table].filter(([n, s]) => card.get(n) !== s).map(([n, s]) => `row ${n}: table "${s}", card "${card.get(n)}"`);
  assert.deepEqual(off, [], off.join('; '));
});
