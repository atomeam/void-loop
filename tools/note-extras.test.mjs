// Notion's core in Notes (lib/note-extras.js): wiki links and backlinks, tags and pins, tables, the slash menu; and the whitelist keeping tables and dividers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as X from '../void-live-deploy/lib/note-extras.js';
import * as N from '../void-live-deploy/lib/notes.js';

test('wiki links and backlinks', () => {
  assert.deepEqual(X.linksOf('<p>See [[Packing list]] and [[ lisbon |the trip]], [[packing list]] again, [[x</p>'), ['Packing list', 'lisbon']);
  const docs = [{ id: 'a', title: 'Lisbon', html: '<p>[[Packing List]]</p>', updated: 1 }, { id: 'b', title: 'Packing list', html: '', updated: 2 }, { id: 'c', title: 'Rome', html: '<p>[[lisbon]] and [[Packing list]]</p>', updated: 3 }];
  assert.deepEqual(X.backlinks(docs, docs[1]).map((d) => d.id), ['c', 'a']); assert.deepEqual(X.backlinks(docs, docs[0]).map((d) => d.id), ['c']); assert.equal(X.noteByTitle(docs, ' lisbon ').id, 'a');
});
test('tags and pins', () => {
  const docs = [{ id: 1, tags: ['travel', 'work'], pinned: true }, { id: 2, tags: ['travel'] }, { id: 3 }];
  assert.deepEqual(X.tagCounts(docs), [{ tag: 'travel', n: 2 }, { tag: 'work', n: 1 }]); assert.equal(X.filterDocs(docs, '#travel').length, 2); assert.equal(X.filterDocs(docs, 'pinned').length, 1); assert.equal(X.filterDocs(docs, 'all').length, 3);
  assert.deepEqual(X.parseTags('Travel, #work; my tag, travel'), ['travel', 'work', 'my-tag']);
});
test('tables: make, add a column and a row, sort', () => {
  let t = X.newTable(['City', 'Nights'], 0); assert.deepEqual(X.parseTable(t), { head: ['City', 'Nights'], rows: [] });
  t = X.addRow(X.addRow(X.addRow(t, ['Rome', '10']), ['Lisbon', '3']), ['Porto', '']); t = X.addColumn(t, 'Status');
  assert.deepEqual(X.parseTable(t).head, ['City', 'Nights', 'Status']); assert.equal(X.parseTable(t).rows.length, 3);
  assert.deepEqual(X.parseTable(X.sortTable(t, 'nights')).rows.map((r) => r[0]), ['Lisbon', 'Rome', 'Porto']);
  assert.deepEqual(X.parseTable(X.sortTable(t, 'City', 'desc')).rows.map((r) => r[0]), ['Rome', 'Porto', 'Lisbon']);
  assert.equal(X.sortTable(t, 'nope'), t); assert.equal(X.colIndex(t, 'status'), 2);
  assert.equal(X.mapTable('<p>x</p>', (x) => x).found, false); assert.match(X.mapTable('<p>x</p>' + t, (x) => X.addColumn(x, 'Z')).html, /<th>Z<\/th>/);
  assert.match(X.newTable(['<b>x</b>']), /&lt;b&gt;/);
});
test('the whitelist keeps tables and dividers and drops what is around them', () => {
  const h = '<table style="x" onclick="y()"><tr><th>A</th><td class="z">1</td></tr></table><hr><script>1</script>';
  assert.equal(N.clean(h), '<table><tr><th>A</th><td>1</td></tr></table><hr>');
  assert.match(N.toText(X.addRow(X.newTable(['A', 'B'], 0), ['1', '2'])), /A \| B\n1 \| 2/);
});
test('the slash menu finds commands by their words', () => {
  assert.equal(X.slashFor('').length, X.SLASH.length); assert.equal(X.slashFor('tab')[0].key, 'table'); assert.equal(X.slashFor('to')[0].key, 'todo'); assert.ok(X.slashFor('div').some((c) => c.key === 'divider')); assert.deepEqual(X.slashFor('zzz'), []);
});
