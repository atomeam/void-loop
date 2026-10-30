// tests for lib/kanban.js: the board model, moves, limits, due days, repeats, swimlanes, export and the Trello import
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../void-live-deploy/lib/kanban.js';
const seed = () => { const b = K.newBoard('B'); const [t, d, x] = b.columns; K.addCard(b, t.id, 'one'); K.addCard(b, t.id, 'two'); K.addCard(b, d.id, 'three'); return { b, t, d, x }; };
test('a fresh board has To do, Doing, Done and six labels; empty titles make no card', () => {
  const s = K.newState(), b = K.boardOf(s); assert.deepEqual(b.columns.map((c) => c.name), ['To do', 'Doing', 'Done']); assert.equal(b.labels.length, 6);
  assert.equal(K.addCard(b, b.columns[0].id, '   '), null); assert.equal(K.addCard(b, 'nope', 'x'), null);
});
test('moving cards: between columns at an index, by key, and a limit says so', () => {
  const { b, t, d, x } = seed(); const one = t.cards[0];
  assert.deepEqual(K.moveCard(b, one.id, d.id, 0), { ok: true, over: false, done: false }); assert.deepEqual(d.cards.map((k) => k.title), ['one', 'three']);
  K.setWip(b, d.id, 2); assert.equal(K.moveCard(b, t.cards[0].id, d.id).over, true); assert.equal(K.overWip(d), true);
  assert.equal(K.moveCardBy(b, d.cards[0].id, 'right').ok, true); assert.equal(x.cards.length, 1); assert.equal(K.moveCardBy(b, x.cards[0].id, 'right').ok, false);
  assert.equal(K.moveCard(b, 'zzz', d.id).ok, false); const two = d.cards[d.cards.length - 1]; assert.equal(K.moveCardBy(b, two.id, 'up').ok, true);
  assert.equal(K.moveCard(b, d.cards[0].id, x.id).done, true);
});
test('columns: add, rename, move, delete keeps the cards in the archive', () => {
  const { b, t } = seed(); const c = K.addColumn(b, 'Review', 1); assert.equal(b.columns[1].name, 'Review'); K.renameColumn(b, c.id, 'QA'); assert.equal(c.name, 'QA');
  assert.equal(K.moveColumn(b, c.id, -1), true); assert.equal(K.moveColumn(b, c.id, -5), false); assert.equal(K.deleteColumn(b, t.id), true); assert.equal(b.archive.length, 2);
  assert.equal(K.restoreCard(b, b.archive[0].id, b.columns[0].id), true); assert.equal(b.archive.length, 1);
});
test('archive and restore a card; labels, checklist progress, comments, time', () => {
  const { b, t } = seed(), k = t.cards[0]; const l = K.addLabel(b, 'Urgent', '#ff0000'); assert.equal(K.toggleLabel(k, l.id), true); assert.equal(K.toggleLabel(k, l.id), false);
  K.addCheck(k, 'a'); const c2 = K.addCheck(k, 'b'); K.toggleCheck(k, c2.id); assert.deepEqual(K.checkProgress(k), { done: 1, total: 2, pct: 50 }); assert.equal(K.addCheck(k, ' '), null);
  K.addComment(k, 'hello', 5); assert.equal(k.comments[0].t, 'hello'); K.addTime(k, 90, true); assert.equal(K.clock(k.timeSec), '1m 30s'); assert.equal(k.pomos, 1);
  K.toggleLabel(k, l.id); K.deleteLabel(b, l.id); assert.deepEqual(k.labels, []);
  assert.equal(K.archiveCard(b, k.id), true); assert.equal(t.cards.length, 1); assert.equal(K.deleteArchived(b, k.id), true);
});
test('due days: overdue, today, soon, later; repeats land on the next day and keep month ends', () => {
  const c = (due) => K.newCard('x', { due }), td = '2026-10-26';
  assert.deepEqual(['2026-10-25', '2026-10-26', '2026-10-28', '2026-11-30', ''].map((d) => K.dueState(c(d), td)), ['overdue', 'today', 'soon', 'later', '']);
  assert.equal(K.nextDue('2026-10-26', 'daily', td), '2026-10-27'); assert.equal(K.nextDue('2026-10-26', 'weekly', td), '2026-11-02'); assert.equal(K.nextDue('2026-01-31', 'monthly', '2026-01-01'), '2026-02-28'); assert.equal(K.nextDue('2026-10-26', '', td), '');
  assert.equal(K.newCard('x', { due: '2026-13-45' }).due, '');
  const { b, t, x } = seed(), k = t.cards[0]; K.updateCard(k, { recur: 'weekly', due: '2026-10-26' }); K.addCheck(k, 'step'); K.toggleCheck(k, k.checklist[0].id);
  const r = K.repeatIfDone(b, k, td); assert.equal(r.due, '2026-11-02'); assert.equal(r.checklist[0].done, false); assert.equal(t.cards.includes(r), true); assert.equal(K.repeatIfDone(b, t.cards[1], td), null);
});
test('filter by words, label, assignee and due; swimlanes by label and assignee', () => {
  const { b, t, d } = seed(), l = b.labels[0], k = t.cards[0]; K.toggleLabel(k, l.id); K.updateCard(k, { assignee: 'Ana', due: '2020-01-01' }); K.addComment(d.cards[0], 'needle in a comment');
  assert.equal(K.matches(k, { q: 'ONE' }), true); assert.equal(K.matches(k, { q: 'zzz' }), false); assert.equal(K.matches(d.cards[0], { q: 'needle' }), true);
  assert.equal(K.matches(k, { label: l.id }), true); assert.equal(K.matches(t.cards[1], { label: l.id }), false); assert.equal(K.matches(k, { assignee: 'ana' }), true); assert.equal(K.matches(k, { due: 'overdue' }), true); assert.equal(K.matches(t.cards[1], { due: 'none' }), true);
  const rows = K.lanes(b, 'label'); assert.deepEqual(rows.map((r) => r.name), [l.name, 'No label']); assert.equal(rows[0].cells[t.id].length, 1); assert.deepEqual(K.lanes(b, 'assignee').map((r) => r.name), ['Ana', 'Nobody']);
  const s = K.stats(b, '2026-10-26'); assert.equal(s.cards, 3); assert.equal(s.overdue, 1);
});
test('export then import round-trips with new ids; CSV quotes; mend repairs junk', () => {
  const s = K.newState(), b = K.boardOf(s); K.addCard(b, b.columns[0].id, 'say "hi", ok', { desc: 'line\nbreak', due: '2026-12-01' });
  const text = K.exportJSON(s), back = K.importText(text); assert.equal(back.length, 1); assert.notEqual(back[0].id, b.id); assert.equal(back[0].columns[0].cards[0].title, 'say "hi", ok'); assert.equal(back[0].columns[0].cards[0].due, '2026-12-01');
  assert.match(K.exportCSV(b), /"To do","say ""hi"", ok","","2026-12-01"/); assert.throws(() => K.importText('nope'), /not JSON/); assert.throws(() => K.importText('{"a":1}'), /not a board/);
  assert.equal(K.mend('{{').boards.length, 1); assert.equal(K.mend({ boards: [{ columns: [{ cards: [{ title: 5 }] }] }] }).boards[0].columns[0].cards[0].title, '5');
});
test('a Trello export comes in: lists in order, labels, checklists, due, closed cards archived', () => {
  const j = { name: 'Trip', labels: [{ id: 'l1', name: 'Hot', color: 'red' }], lists: [{ id: 'b', name: 'Done', pos: 2 }, { id: 'a', name: 'Ideas', pos: 1 }, { id: 'z', name: 'Old', closed: true }],
    cards: [{ id: 'c1', name: 'Book', idList: 'a', pos: 1, idLabels: ['l1'], due: '2026-11-03T12:00:00.000Z', desc: 'd' }, { id: 'c2', name: 'Packed', idList: 'b', pos: 1, closed: true }], checklists: [{ idCard: 'c1', checkItems: [{ name: 'tent', state: 'complete', pos: 1 }, { name: 'bag', state: 'incomplete', pos: 2 }] }],
    actions: [{ type: 'commentCard', date: '2026-10-01T00:00:00Z', data: { text: 'ok', card: { id: 'c1' } } }] };
  const [b] = K.importText(JSON.stringify(j)); assert.deepEqual(b.columns.map((c) => c.name), ['Ideas', 'Done']); const k = b.columns[0].cards[0];
  assert.deepEqual([k.title, k.due, k.labels.length, K.checkProgress(k).done, k.comments[0].t], ['Book', '2026-11-03', 1, 1, 'ok']); assert.equal(b.archive.length, 1); assert.equal(b.labels[0].color, K.LABEL_COLORS[3]);
});
