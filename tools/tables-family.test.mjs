// The tables family (skills/tables.js, lists run 24, 2026-11-12): csv-table and list-tools are one routing entry, every old ask
// still reaches the member that answered it, both old names stay as parts, and the family sits where csv-table sat (0457).
// Run: node --test tools/tables-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/tables.js';
import csvTable from '../void-live-deploy/skills/csv-table.js';
import listTools from '../void-live-deploy/skills/list-tools.js';

test('every example of both old skills lands on the same member as before (csv-table first, as before)', () => {
  for (const a of csvTable.examples) assert.equal(fam.part(a.toLowerCase(), a), 'csv-table', a);
  for (const a of listTools.examples) assert.equal(fam.part(a.toLowerCase(), a), csvTable.match(a.toLowerCase(), a) ? 'csv-table' : 'list-tools', a);
  for (const a of ['paste csv: item;price\ntea;3\ncake;5', 'table from csv: a,b\n1,2']) assert.equal(fam.part(a.toLowerCase(), a), 'csv-table', 'the overlapping ask stays with csv-table: ' + a);
  for (const a of ['sort the list', 'sum of column 2', 'transpose the table']) assert.equal(fam.part(a, a), 'list-tools', a);
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where csv-table sat', () => {
  assert.deepEqual(fam.parts, ['csv-table', 'list-tools']);
  const order = readOrder();
  assert.ok(order.includes('tables'));
  assert.ok(!order.includes('csv-table') && !order.includes('list-tools'));
  assert.ok(order.indexOf('outline-note') === order.indexOf('tables') - 1, 'outline-note still comes right before');
  assert.ok(order.indexOf('qr-scan') === order.indexOf('tables') + 1, 'qr-scan still comes right after');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0457-tables', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0457-csv-table', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1530-list-tools', import.meta.url)));
});
