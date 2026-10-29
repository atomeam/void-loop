/**
 * calendar-fill skill - a sentence puts an event in the calendar (owner, 2026-10-25: "make sure Verse knows how to fill out its own relevant pages for you just by chatting with it"). The
 * reading and the writing are lib/chat-calendar.js (pure, tested); the data is the one /calendar/ keeps on this device (a2m.void.calendar.v1). The card says what changed, has
 * Undo and a link to the page; a weak match asks Confirm, two that fit are listed. Nothing is sent anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as L from '../lib/chat-calendar.js';
import { drawFill } from '../lib/fill-card.js';
import { parseCalendar } from './calendar.js'; // an add the stage's calendar card takes stays with it (it also puts the event in the page, lib/chat-calendar.js mirror)

import * as A from '../lib/agenda.js';

const KEY = A.KEY, LOG = 'a2m.void.chatfill.cal.v1';
const read = () => A.read(); // the one store (lib/agenda.js): the stage card's events are in it, so "move the dentist to Tuesday" finds one added there
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { return false; } };

function match(lower, text) {
  const it = L.parseIntent(text); if (!it) return false;
  if (it.op === 'add' && parseCalendar(text)) return false;
  return L.plan(read(), it, new Date(), navigator.language || 'en').kind !== 'none';
}
function run(text, api) {
  const el = api.showPage(() => {}); const it = L.parseIntent(text);
  drawFill(el, { intent: it, plan: (s, i, n) => L.plan(s, i, new Date(n), navigator.language || 'en'), undo: L.undoOf, read, write: (st) => { const ok = write(st); if (api.refreshThings) api.refreshThings(); return ok; } /* the stage's calendar card reads the same store: drawn again so it shows the change */, logKey: LOG, openHref: (id) => '/calendar/', openLabel: 'Open the Calendar', hint: L.HINT, heading: 'Calendar' });
  return 'calendar-fill';
}
export default {
  name: 'calendar-fill',
  examples: ['Zahnarzt morgen 15 Uhr in den Kalender', 'trage Yoga am Freitag 18 Uhr in den Kalender ein'],
  nearMisses: ['what is the weather tomorrow', 'remind me to stretch in 20 minutes', 'add eggs to my shopping list', 'remind me at 5 to call home'],
  match,
  run
};
