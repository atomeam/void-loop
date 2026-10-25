// lib/agenda.js: the stage's calendar and the /calendar/ page share one store; the stage's older list is moved in once.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as A from '../void-live-deploy/lib/agenda.js';

const mem = (init = {}) => { const st = { ...init }; return { st, getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); } }; };
const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; };

test('the old stage rows move into the page store once, the old key kept as it was', () => {
  const old = JSON.stringify([{ id: 'abc1', title: 'Dentist', at: at(1, 15).toISOString() }, { id: 'x', title: 'Rent', at: at(2, 0).toISOString(), allDay: true }, { id: 'bad' }]);
  const ls = mem({ [A.OLD_KEY]: old, [A.KEY]: JSON.stringify({ events: [], view: 'week' }) });
  const S = A.read(ls);
  assert.equal(S.events.length, 2); assert.equal(S.agendaMoved, true); assert.equal(S.view, 'week', 'the page\'s own settings are kept');
  const d = S.events.find((e) => e.title === 'Dentist'); assert.equal(d.allDay, false); assert.match(d.start, /T15:00$/); assert.match(d.end, /T16:00$/);
  assert.equal(S.events.find((e) => e.title === 'Rent').allDay, true);
  assert.equal(ls.st[A.OLD_KEY], old, 'the old list is left readable');
  A.write([], ls); assert.equal(A.read(ls).events.length, 0, 'moved once: a cleared calendar does not get the old rows back');
});

test('an event already in the page (the stage mirrored it) is not added twice; a broken store is an empty one', () => {
  const t = at(1, 9), start = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') + 'T09:00';
  const ls = mem({ [A.OLD_KEY]: JSON.stringify([{ id: 'q', title: 'standup', at: t.toISOString() }]), [A.KEY]: JSON.stringify({ events: [{ id: 'p1', title: 'Standup', start, end: start, allDay: false }] }) });
  assert.equal(A.read(ls).events.length, 1);
  assert.deepEqual(A.read(mem({ [A.KEY]: '{not json', [A.OLD_KEY]: '[oops' })).events, []);
});

test('rows: repeats are one row a day, taking one off skips that day; a row moves and renames its event', () => {
  let ev = [{ id: 'w1', title: 'Yoga', start: '2026-10-26T18:00', end: '2026-10-26T19:00', allDay: false, rrule: { freq: 'WEEKLY', interval: 1 } }];
  const rows = A.rowsOf(ev, new Date(2026, 9, 25), new Date(2026, 10, 20));
  assert.deepEqual(rows.map((r) => r.id), ['w1~2026-10-26', 'w1~2026-11-02', 'w1~2026-11-09', 'w1~2026-11-16']);
  ev = A.withoutRow(ev, rows[1].id); assert.deepEqual(ev[0].exdates, ['2026-11-02']); assert.equal(A.rowsOf(ev, new Date(2026, 9, 25), new Date(2026, 10, 20)).length, 3);
  ev = A.withRow(ev, rows[0].id, { at: new Date(2026, 10, 3, 7, 30) }); assert.equal(ev[0].start, '2026-10-26T07:30', 'a repeat keeps its first day, takes the new time');
  ev = A.withNew(ev, { title: 'Dentist', at: new Date(2026, 10, 4, 15, 0) });
  const id = ev.find((e) => e.title === 'Dentist').id;
  ev = A.withRow(ev, id, { title: 'Dentist (Dr Lee)', at: new Date(2026, 10, 5, 16, 0) });
  const d = ev.find((e) => e.id === id); assert.equal(d.title, 'Dentist (Dr Lee)'); assert.equal(d.start, '2026-11-05T16:00'); assert.equal(d.end, '2026-11-05T17:00');
  assert.equal(A.withoutRow(ev, id).length, 1);
});
