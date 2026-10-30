// Chat-fill for the Calendar (lib/chat-calendar.js): sentences read with the calendar's own date reading, the date said in words, every write undone.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../void-live-deploy/lib/chat-calendar.js';

const NOW = new Date(2026, 9, 26, 9, 0); // Monday 26 October 2026, 9:00
const run = (s, t, now = NOW) => K.plan(s, K.parseIntent(t), now);
const w = (s, t) => { const r = run(s, t); assert.equal(r.kind, 'write', t + ' -> ' + JSON.stringify(r).slice(0, 300)); return r; };

test('sentences are read', () => {
  const ops = { 'put dentist on Friday at 3': 'add', 'meeting with Sam tomorrow 10am for an hour': 'add', 'remind me to call mum tomorrow 6pm': 'add', 'add dentist tomorrow 3pm to my calendar': 'add',
    'dentist tomorrow 3pm, remind me 30 minutes before, every month': 'add', 'change the dentist to 4pm': 'change', 'move the dentist to Tuesday': 'change', 'delete the dentist event': 'delete', 'when is my dentist': 'when',
    'Zahnarzt morgen 15 Uhr in den Kalender': 'add', 'weather tomorrow': null, 'what is the weather': null, 'remind me to stretch in 20 minutes': null, 'dinner': null, 'put milk on my shopping list': null, 'add eggs to my shopping list': null, 'schedule a meeting with Anna tomorrow': null };
  for (const [t, op] of Object.entries(ops)) assert.equal((K.parseIntent(t) || {}).op || null, op, t);
});
test('an event is put in and said in words; undo takes it out', () => {
  const r = w({ events: [] }, 'put dentist on Friday at 3'); const e = r.store.events[0];
  assert.equal(e.title, 'Dentist'); assert.equal(e.start, '2026-10-30T15:00'); assert.equal(e.end, '2026-10-30T16:00');
  assert.match(r.said, /Friday, 30 October, 3:00 PM to 4:00 PM \(1 hour\)/);
  assert.deepEqual(K.undoOf(r.store, r.changes).events, []);
  const m = w({ events: [] }, 'meeting with Sam tomorrow 10am for an hour').store.events[0]; assert.equal(m.start, '2026-10-27T10:00'); assert.equal(m.title, 'Meeting with Sam');
  const rm = w({ events: [] }, 'remind me to call mum tomorrow 6pm').store.events[0]; assert.deepEqual(rm.reminders, [0]); assert.equal(rm.title, 'Call mum');
  const re = w({ events: [] }, 'dentist tomorrow 3pm, remind me 30 minutes before, every month'); assert.match(re.said, /every month, reminder 30 minutes before/);
  assert.match(w({ events: [] }, 'Zahnarzt morgen 15 Uhr in den Kalender').said, /Zahnarzt/);
});
test('no day or time: confirm first; a repeat adds nothing', () => {
  const c = run({ events: [] }, 'add dentist to my calendar'); assert.equal(c.kind, 'confirm'); assert.match(c.preview, /no day or time/); assert.equal(K.plan({ events: [] }, c.intent, NOW).kind, 'write');
  const s = w({ events: [] }, 'put dentist on Friday at 3').store; assert.equal(run(s, 'put dentist on Friday at 3').kind, 'show');
});
test('change, move, delete, when: found by words, two fit means ask', () => {
  let s = w({ events: [] }, 'put dentist on Friday at 3').store;
  const c = w(s, 'change the dentist to 4pm'); assert.equal(c.store.events[0].start, '2026-10-30T16:00'); assert.equal(c.store.events[0].end, '2026-10-30T17:00'); assert.match(c.said, /from Friday, 30 October, 3:00 PM .* to Friday, 30 October, 4:00 PM/);
  assert.equal(K.undoOf(c.store, c.changes).events[0].start, '2026-10-30T15:00');
  const mv = w(s, 'move the dentist to Tuesday'); assert.equal(mv.store.events[0].start, '2026-10-27T15:00');
  assert.match(run(s, 'when is my dentist').lines[0], /Dentist: Friday, 30 October, 3:00 PM/);
  const del = w(s, 'delete the dentist event'); assert.equal(del.store.events.length, 0); assert.equal(K.undoOf(del.store, del.changes).events.length, 1);
  assert.equal(run(s, 'delete the dentist').kind, 'confirm');
  assert.equal(run(s, 'delete the plumber event').kind, 'none'); assert.equal(run(s, 'when is my plumber').kind, 'none');
  s = w(s, 'put dentist kids on Saturday at 9').store; const q = run(s, 'change the dentist to 5pm'); assert.equal(q.kind, 'ask'); assert.equal(q.options.length, 2); assert.equal(K.plan(s, q.options[0].intent, NOW).kind, 'write');
});
test('other fields of the stored calendar survive', () => { const r = w({ events: [], view: 'week', lastCheck: 'x' }, 'put dentist on Friday at 3'); assert.equal(r.store.view, 'week'); assert.equal(r.store.lastCheck, 'x'); });
test('the stage card\'s adds are mirrored into the page store, once', () => {
  const m = K.mirror({ events: [] }, 'add dentist tomorrow 3pm to my calendar', NOW); assert.equal(m.event.start, '2026-10-27T15:00'); assert.match(m.line, /Tuesday, 27 October, 3:00 PM to 4:00 PM/);
  assert.equal(K.mirror(m.store, 'add dentist tomorrow 3pm to my calendar', NOW), null); assert.equal(K.mirror({ events: [] }, 'remind me to call mom at 6pm', NOW).event.reminders[0], 0);
  assert.equal(K.mirror({ events: [] }, 'put lunch with Ana on my calendar tomorrow at noon', NOW).event.title, 'Lunch with Ana');
});

test('a sticky is not an event: the planner\'s own "add a sticky that says draft to Sam ... by Friday" is left to the sticky skill', () => {
  for (const t of ["add a sticky that says draft to Sam (not sent): heads up, I'm aiming to ship the product page by Friday, 30 October", 'put a sticky that says call mum on Friday', 'add a sticky note for tomorrow 3pm']) assert.equal(K.parseIntent(t), null, t);
  assert.equal(K.parseIntent('put dentist on Friday at 3').op, 'add', 'a real event is still one');
});
