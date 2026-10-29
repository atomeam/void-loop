// Chat-fill for Notes (lib/chat-notes.js): sentences read, notes written, every write undone.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../void-live-deploy/lib/chat-notes.js';
import * as N from '../void-live-deploy/lib/notes.js';

const T0 = 1_800_000_000_000;
const run = (store, text, now = T0) => C.plan(store, C.parseIntent(text), now);
const empty = () => ({ docs: [], cur: null });
const with1 = (s, text, now) => { const r = run(s, text, now); assert.equal(r.kind, 'write', text + ' -> ' + JSON.stringify(r).slice(0, 300)); return r; };

test('sentences are read', () => {
  const ops = { 'add a note: buy milk': 'create', 'make a note about my trip to Lisbon: flights Friday, hotel Alfama, packing list': 'create', 'note to self call the vet': 'create',
    'write down the wifi is in the hall': 'create', 'add eggs to my shopping list': 'append', 'add to my shopping list: milk, eggs': 'append', 'tick milk': 'tick', 'cross off milk from my shopping list': 'tick',
    'untick milk': 'untick', 'remove eggs from my shopping list': 'removeItem', 'clean up my shopping list': 'tidy', 'summarise my meeting note': 'summary', 'what did I write about Lisbon': 'find',
    'rename my trip note to Lisbon 2027': 'rename', 'pin my shopping list': 'pin', 'tag my trip note as travel': 'tag', 'merge trip and packing': 'merge', 'split my trip note': 'split',
    'start a meeting note': 'template', 'under hotel in my Lisbon note add check-in 3pm': 'under', 'delete my old ideas note': 'delete',
    'neue Notiz: Milch kaufen': 'create', 'füge Eier zu meiner Einkaufsliste hinzu': 'append', 'hake Milch ab': 'tick', 'was habe ich über Lissabon geschrieben': 'find', 'fasse meine Reise zusammen': 'summary',
    'undo my last note change': 'undo', 'what is the weather': null, 'add dentist tomorrow to my calendar': null, 'put the notes in folder errands': null };
  for (const [t, op] of Object.entries(ops)) assert.equal((C.parseIntent(t) || {}).op || null, op, t);
});
test('a note from one sentence: headed sections, a checklist for the list', () => {
  const n = C.noteFrom('my trip to Lisbon: flights Friday, hotel Alfama, packing list');
  assert.equal(n.title, 'My trip to Lisbon');
  assert.match(n.html, /<h2>Flights<\/h2><p>Friday<\/p><h2>Hotel<\/h2><p>Alfama<\/p><h2>Packing list<\/h2><ul class="todo"><li class="chk"><\/li><\/ul>/);
  assert.equal(C.noteFrom('Shopping list - milk, eggs, bread').html, '<ul class="todo"><li class="chk">Milk</li><li class="chk">Eggs</li><li class="chk">Bread</li></ul>');
  assert.deepEqual(C.noteFrom('buy milk'), { title: 'Buy milk', html: '' });
  assert.match(C.noteFrom('x: <script>alert(1)</script>').html, /&lt;script&gt;/);
});
test('create, append, tick, untick, remove, each undone', () => {
  let s = empty(); const log = [];
  const go = (t, n) => { const r = with1(s, t, T0 + (log.length + 1) * 60000 * n); log.push({ before: s, r }); s = r.store; return r; };
  go('add a note: Shopping list - milk, eggs', 1); assert.equal(s.docs.length, 1);
  go('add bread and butter to my shopping list', 1); assert.deepEqual(N.toText(s.docs[0].html).split('\n'), ['[ ] Milk', '[ ] Eggs', '[ ] Bread', '[ ] Butter']);
  go('tick milk', 1); assert.match(s.docs[0].html, /<li class="chk done">Milk<\/li>/);
  go('untick milk', 1); assert.doesNotMatch(s.docs[0].html, /done/);
  go('remove eggs from my shopping list', 1); assert.doesNotMatch(s.docs[0].html, /Eggs/);
  assert.ok(s.docs[0].versions.length >= 3, 'earlier states kept as versions');
  for (const { before, r } of log.reverse()) { s = C.undoOf(s, r.changes, T0 + 1e9); assert.deepEqual(s.docs.map((d) => [d.title, d.html]), before.docs.map((d) => [d.title, d.html])); }
  assert.equal(s.docs.length, 0);
});
test('a repeat adds nothing, a missing list is made, a stranger target is left alone', () => {
  let s = with1(empty(), 'add a note: Shopping list - milk').store;
  assert.equal(run(s, 'add milk to my shopping list').kind, 'show');
  assert.equal(run(s, 'add dentist tomorrow to my calendar').kind, 'none');
  assert.equal(run(s, 'tick pizza').kind, 'none');
  const r = with1(empty(), 'add socks to my packing list'); assert.equal(r.store.docs[0].title, 'Packing list'); assert.match(r.said, /No note called/);
});
test('two notes fit: ask which; a weak match: confirm', () => {
  let s = empty(); for (const t of ['add a note: Shopping list for Sam - milk', 'add a note: Party shopping list - cake']) s = with1(s, t, T0 + (s.docs.length + 1) * 1e6).store;
  const q = run(s, 'add eggs to my shopping list'); assert.equal(q.kind, 'ask'); assert.equal(q.options.length, 2);
  const r = C.plan(s, q.options[0].intent, T0 + 9e6); assert.equal(r.kind, 'write');
  const t = run(s, 'tick milk'); assert.equal(t.kind, 'write', 'one item only: no question');
  s = with1(empty(), 'make a note about Lisbon: hotel Alfama and flights on Friday are booked for two').store;
  const w = run(s, 'add check-in to my alfama note'); assert.equal(w.kind, 'confirm'); assert.equal(C.plan(s, w.intent, T0).kind, 'write');
});
test('under a heading, tidy, summary, rename, pin, tag, merge, split, delete, find, template', () => {
  let s = with1(empty(), 'make a note about my trip to Lisbon: flights Friday, hotel Alfama, packing list', T0).store;
  s = with1(s, 'under hotel in my lisbon note add check-in 3pm', T0 + 1e5).store; assert.match(s.docs[0].html, /<h2>Hotel<\/h2><p>Alfama<\/p><p>Check-in 3pm<\/p><h2>Packing/);
  s = with1(s, 'add passport, charger to my lisbon note', T0 + 2e5).store; assert.match(s.docs[0].html, /<li class="chk">Passport<\/li><li class="chk">Charger<\/li>/);
  assert.match(run(s, 'summarise my lisbon note').lines.join(' '), /Sections: Flights, Hotel, Packing list/);
  assert.equal(run(s, 'clean up my lisbon note').kind, 'show'); s.docs[0].html += '<p><br></p><ul class="todo"><li class="chk done">Zed</li><li class="chk">zed</li><li class="chk">alpha</li></ul>';
  s = with1(s, 'clean up my lisbon note', T0 + 3e5).store; assert.doesNotMatch(s.docs[0].html, /<p><br><\/p>/); assert.match(s.docs[0].html, /<li class="chk">Alpha<\/li><li class="chk done">Zed<\/li><\/ul>$/);
  s = with1(s, 'rename my lisbon note to Lisbon 2027', T0 + 4e5).store; assert.equal(s.docs[0].title, 'Lisbon 2027');
  s = with1(s, 'pin lisbon 2027', T0 + 5e5).store; assert.equal(s.docs[0].pinned, true);
  s = with1(s, 'tag my lisbon 2027 note as travel', T0 + 6e5).store; assert.deepEqual(s.docs[0].tags, ['travel']);
  assert.equal(N.load(JSON.stringify(s)).docs[0].pinned, true); assert.deepEqual(N.load(JSON.stringify(s)).docs[0].tags, ['travel']);
  assert.equal(run(s, 'what did I write about alfama').hits[0].title, 'Lisbon 2027'); assert.equal(run(s, 'find notes about travel').hits.length, 1);
  const split = with1(s, 'split my lisbon 2027 note', T0 + 7e5); assert.equal(split.store.docs.length, 4);
  s = with1(s, 'add a note: Ideas - one, two', T0 + 8e5).store;
  const merged = with1(s, 'merge ideas into lisbon 2027', T0 + 9e5); assert.equal(merged.store.docs.length, 1); assert.match(merged.store.docs[0].html, /<h2>Ideas<\/h2>/);
  assert.equal(C.undoOf(merged.store, merged.changes, T0 + 1e7).docs.length, 2);
  const del = with1(s, 'delete my ideas note', T0 + 1e6); assert.equal(del.store.docs.length, 1); assert.equal(C.undoOf(del.store, del.changes).docs.length, 2); assert.equal(del.store.trash.length, 1); assert.equal(C.undoOf(del.store, del.changes).trash, undefined);
  const rs = with1(del.store, 'restore my ideas note', T0 + 2e6); assert.equal(rs.store.docs.length, 2); assert.equal(rs.store.trash.length, 0); assert.equal(C.undoOf(rs.store, rs.changes).trash.length, 1); assert.match(run(del.store, 'show my trash').hits[0].title, /Ideas/);
  const tp = with1(s, 'start a trip note for Rome', T0); assert.equal(tp.store.docs[0].title, 'Rome trip'); assert.match(tp.store.docs[0].html, /Packing list/);
});
test('replace and outline', () => {
  let s = with1(empty(), 'make a note about my trip to Lisbon: flights Friday, hotel Alfama').store;
  const r = with1(s, 'replace alfama with Baixa in my lisbon note', T0 + 1e5); assert.match(r.store.docs[0].html, /<p>Baixa<\/p>/); assert.match(r.said, /1 time/); assert.equal(C.undoOf(r.store, r.changes).docs[0].html, s.docs[0].html);
  assert.equal(run(s, 'replace zzz with y in my lisbon note').kind, 'show'); assert.equal(run(s, 'replace a with b in my nothing note').kind, 'none');
  assert.deepEqual(run(s, 'outline of my lisbon note').lines, ['Flights', 'Hotel']);
});
test('german verbs write the same way', () => {
  let s = with1(empty(), 'neue Notiz: Einkaufsliste - Milch, Eier').store;
  s = with1(s, 'füge Brot zu meiner Einkaufsliste hinzu').store; assert.match(s.docs[0].html, /Brot/);
  s = with1(s, 'hake Milch ab').store; assert.match(s.docs[0].html, /chk done">Milch/);
  assert.equal(run(s, 'was habe ich über Eier geschrieben').hits.length, 1);
});
test('the hint, and nothing in the added html can carry markup', () => {
  assert.ok(C.looksLikeNotes('merge my notes somehow')); assert.ok(!C.looksLikeNotes('add a note: x')); assert.ok(!C.looksLikeNotes('what is the weather'));
  const r = with1(empty(), 'add a note: T: <img src=x onerror=alert(1)>, <b>x</b>');
  assert.doesNotMatch(r.store.docs[0].html, /<img|<b>|<script/);
});
test('tables, links, pins and tags by sentence', () => {
  assert.equal(run(empty(), 'make a table with City, Nights in my trip note').kind, 'none', 'no such note: nothing is guessed');
  let s = with1(empty(), 'make a table with City, Nights', T0).store; assert.equal(s.docs[0].title, 'City table');
  s = with1(s, 'add a column Status to my city table', T0 + 1e5).store; s = with1(s, 'add row Rome, 10, booked to my city table', T0 + 2e5).store; s = with1(s, 'add row Lisbon, 3 to my city table', T0 + 3e5).store;
  assert.match(s.docs[0].html, /<th>Status<\/th>/); assert.equal(run(s, 'add a column status to my city table').kind, 'show');
  s = with1(s, 'sort my city table by nights', T0 + 4e5).store; assert.ok(s.docs[0].html.indexOf('Lisbon') < s.docs[0].html.indexOf('Rome'));
  assert.match(run(s, 'sort my city table by colour').lines[0], /No column/);
  s = with1(s, 'make a note about Packing: socks', T0 + 5e5).store; s = with1(s, 'link my city table to packing', T0 + 6e5).store; assert.match(s.docs.find((d) => d.title === 'City table').html, /\[\[Packing\]\]/);
  assert.equal(run(s, 'what links to packing').hits[0].title, 'City table');
  s = with1(s, 'pin packing', T0 + 7e5).store; s = with1(s, 'tag my packing note as trip', T0 + 8e5).store;
  assert.equal(run(s, 'show my pinned notes').hits.length, 1); assert.equal(run(s, 'show notes tagged trip').hits.length, 1);
  assert.equal(run(empty(), 'add a table to my x note').kind, 'none');
});
