// node tools/note-organise.test.mjs: the rules /notes/ takes from Simplenote and Google Keep (lib/note-organise.js).
import test from 'node:test'; import assert from 'node:assert/strict';
import * as O from '../void-live-deploy/lib/note-organise.js';
import { load, newDoc } from '../void-live-deploy/lib/notes.js';

const D = (id, title, o = {}) => ({ id, title, html: '<p>' + title + ' text</p>', updated: 0, versions: [], ...o });
const docs = [D('a', 'banana', { created: 3, updated: 10 }), D('b', 'Apple', { created: 1, updated: 30 }), D('c', 'cherry', { created: 2, updated: 20, pinned: true })];

test('the six sort orders, pinned first (Simplenote: Modified, Created, Name)', () => {
  const ids = (k) => O.sortDocs(docs, k).map((d) => d.id).join('');
  assert.equal(O.SORTS.length, 6);
  assert.equal(ids('modified-new'), 'cba'); assert.equal(ids('modified-old'), 'cab');
  assert.equal(ids('created-new'), 'cab'); assert.equal(ids('created-old'), 'cba');
  assert.equal(ids('name-az'), 'cba'); assert.equal(ids('name-za'), 'cab');
});

test('a new note has its creation time, and load keeps created, archived and colour', () => {
  const d = newDoc(1234); assert.equal(d.created, 1234);
  const s = load(JSON.stringify({ docs: [{ ...d, archived: true, color: 'mint' }, { id: 'x', title: '', html: '', updated: 5, color: '<b>' }] }));
  assert.equal(s.docs[0].created, 1234); assert.equal(s.docs[0].archived, true); assert.equal(s.docs[0].color, 'mint'); assert.equal(s.docs[1].color, undefined);
});

test('search words: tag:, is:, color: (Simplenote tag:groceries)', () => {
  const p = O.parseQuery('milk tag:Groceries is:pinned color:mint');
  assert.deepEqual(p, { words: ['milk'], tags: ['groceries'], is: ['pinned'], colors: ['mint'] });
  const set = [D('1', 'x', { tags: ['groceries'], pinned: true, color: 'mint' }), D('2', 'y', { tags: ['groceries'] }), D('3', 'z', { archived: true, tags: ['groceries'] })];
  assert.deepEqual(O.applyOperators(set, O.parseQuery('tag:groceries')).map((d) => d.id), ['1', '2', '3']);
  assert.deepEqual(O.applyOperators(set, p).map((d) => d.id), ['1']);
  assert.deepEqual(O.applyOperators(set, O.parseQuery('is:archived')).map((d) => d.id), ['3']);
  assert.deepEqual(O.applyOperators(set, O.parseQuery('color:default')).map((d) => d.id), ['2', '3']);
});

test('the archive (Keep): out of the list, in its own view', () => {
  const set = [D('1', 'x'), D('2', 'y', { archived: true })];
  assert.deepEqual(O.inView(set, 'all').map((d) => d.id), ['1']); assert.deepEqual(O.inView(set, 'archive').map((d) => d.id), ['2']);
});

test('a tag renamed or removed on every note (Simplenote)', () => {
  const set = [D('1', 'x', { tags: ['work', 'home'] }), D('2', 'y', { tags: ['work', 'job'] }), D('3', 'z')];
  const r = O.renameTag(set, 'work', 'Job', 9);
  assert.deepEqual(r.map((d) => d.tags), [['job', 'home'], ['job'], undefined]); assert.equal(r[0].updated, 9); assert.equal(r[2].updated, 0);
  assert.deepEqual(O.renameTag(set, '#work', '').map((d) => d.tags), [['home'], ['job'], undefined]);
});

test('a copy of a note (Keep): new id, "(copy)", no history', () => {
  const c = O.copyOf({ ...D('1', 'Trip', { pinned: true, color: 'sand' }), versions: [{ t: 1, title: 'a', html: '' }] }, 50);
  assert.notEqual(c.id, '1'); assert.equal(c.title, 'Trip (copy)'); assert.equal(c.color, 'sand'); assert.equal(c.pinned, false); assert.deepEqual(c.versions, []); assert.equal(c.created, 50);
});

test('a backup round-trips every note, archive and colour included', () => {
  const store = { docs: [D('1', 'x', { archived: true, color: 'dusk', tags: ['a'], created: 4, updated: 5 })], trash: [] };
  const r = O.readBackup(O.backup(store, 0), 100);
  assert.equal(r.kind, 'verse'); assert.equal(r.docs.length, 1);
  const d = r.docs[0]; assert.notEqual(d.id, '1'); assert.equal(d.title, 'x'); assert.equal(d.archived, true); assert.equal(d.color, 'dusk'); assert.deepEqual(d.tags, ['a']); assert.equal(d.created, 4);
  assert.equal(O.readBackup('{"kind":"verse-notes-backup","docs":[{"title":"<script>","html":"<script>x</script><p>ok</p>"}]}').docs[0].html, '<p>ok</p>');
});

test("Simplenote's export (activeNotes): first line the title, tags, pinned, markdown", () => {
  const sn = { activeNotes: [{ id: 'q', content: 'Groceries\r\n\r\n- [ ] milk\n- [x] eggs', creationDate: '2024-01-02T03:04:05.000Z', lastModified: '2024-02-01T00:00:00.000Z', tags: ['Food'], pinned: true, markdown: true }], trashedNotes: [{ id: 't', content: 'gone' }] };
  const r = O.readBackup(JSON.stringify(sn), 1);
  assert.equal(r.kind, 'simplenote'); assert.equal(r.docs.length, 1);
  const d = r.docs[0]; assert.equal(d.title, 'Groceries'); assert.equal(d.pinned, true); assert.deepEqual(d.tags, ['food']); assert.equal(d.created, Date.parse('2024-01-02T03:04:05.000Z'));
  assert.match(d.html, /milk/); assert.match(d.html, /eggs/);
});

test("Google Keep's Takeout note: checklist, colour, labels, archive; trashed ones left out", () => {
  const k = { color: 'GREEN', isTrashed: false, isPinned: true, isArchived: true, title: 'Packing', userEditedTimestampUsec: 1700000000000000, createdTimestampUsec: 1690000000000000, listContent: [{ text: 'passport', isChecked: true }, { text: 'socks <b>', isChecked: false }], labels: [{ name: 'Travel' }] };
  const r = O.readBackup(JSON.stringify(k), 1);
  assert.equal(r.kind, 'keep'); const d = r.docs[0];
  assert.equal(d.title, 'Packing'); assert.equal(d.color, 'mint'); assert.equal(d.archived, true); assert.equal(d.pinned, true); assert.deepEqual(d.tags, ['travel']);
  assert.equal(d.updated, 1700000000000); assert.equal(d.html, '<ul class="todo"><li class="chk done">passport</li><li class="chk">socks &lt;b&gt;</li></ul>');
  assert.equal(O.readBackup(JSON.stringify({ ...k, isTrashed: true })).docs.length, 0);
  assert.equal(O.readBackup('not json').kind, 'unknown'); assert.equal(O.readBackup('{"a":1}').kind, 'unknown');
});

test('line starts that format as you type', () => {
  assert.deepEqual(O.lineStart('# '), { block: 'h1', strip: 2 }); assert.equal(O.lineStart('## ').block, 'h2'); assert.equal(O.lineStart('### ').block, 'h3');
  assert.equal(O.lineStart('- ').block, 'ul'); assert.equal(O.lineStart('* ').block, 'ul'); assert.equal(O.lineStart('1. ').block, 'ol');
  assert.equal(O.lineStart('[] ').block, 'todo'); assert.equal(O.lineStart('[ ] ').block, 'todo'); assert.equal(O.lineStart('- [ ] ').block, 'todo');
  assert.equal(O.lineStart('> ').block, 'quote'); assert.equal(O.lineStart('#\u00a0').block, 'h1');
  assert.equal(O.lineStart('a # '), null); assert.equal(O.lineStart('#'), null); assert.equal(O.lineStart('2. '), null);
});

test('Keep colour names', () => { assert.equal(O.COLORS.length, 12); assert.equal(O.colorOf('mint').label, 'Mint'); assert.equal(O.colorOf('nope').label, 'Default'); });
