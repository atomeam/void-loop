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
test('find and replace touches text, never tags; the outline; the trash', () => {
  const r = X.replaceIn('<p class="x">Milk and <b>milk</b></p><a href="https://milk.co">MILK</a>', 'milk', 'oat <milk>'); assert.equal(r.count, 3); assert.equal(r.html, '<p class="x">oat &lt;milk&gt; and <b>oat &lt;milk&gt;</b></p><a href="https://milk.co">oat &lt;milk&gt;</a>');
  assert.equal(X.replaceIn('<p>a.b</p>', 'a.b', 'x').count, 1); assert.equal(X.replaceIn('<p>axb</p>', 'a.b', 'x').count, 0); assert.equal(X.replaceIn('<p>Milk</p>', 'milk', 'x', true).count, 0);
  assert.deepEqual(X.outlineOf('<h1>A</h1><p>x</p><h2>B <b>c</b></h2><h3></h3>'), [{ level: 1, text: 'A' }, { level: 2, text: 'B c' }]);
  const d = { id: 'a', title: 'T', html: '<p>x</p>', updated: 1, versions: [] }, s0 = { docs: [d, { id: 'b', title: 'U', html: '', updated: 1, versions: [] }], cur: 'a' };
  const t = X.toTrash(s0, d, 1000); assert.deepEqual(t.docs.map((x) => x.id), ['b']); assert.equal(t.cur, 'b'); assert.equal(t.trash[0].doc.id, 'a');
  const l = N.load(JSON.stringify(t)); assert.equal(l.trash.length, 1); assert.equal(l.trash[0].doc.html, '<p>x</p>');
  assert.equal(X.fromTrash(t, 'a', 2000).docs[0].id, 'a'); assert.equal(X.fromTrash(t, 'a', 2000).trash.length, 0);
  assert.equal(X.purgeTrash(t, 1000 + 31 * 864e5).trash.length, 0); assert.equal(X.purgeTrash(t, 1000 + 5 * 864e5).trash.length, 1);
});
