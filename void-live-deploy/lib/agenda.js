// The stage's calendar (the "Coming up" card, the 3D wall calendar, "export my calendar") reads and writes the one store the /calendar/ page
// keeps (lib/calendar.js KEY a2m.void.calendar.v1), so a sentence on the stage, a chat edit ("move the dentist to Tuesday", lib/chat-calendar.js)
// and the page itself never drift apart. Before 2026-10-25 the stage kept its own list under a2m.void.agenda.v1 ({ id, title, at, allDay } rows):
// those rows are moved into the page's store once (agendaMoved marks it done) and the old key is left as it is, readable, never written again.
// The stage still thinks in rows: rowsOf() gives each occurrence as { id, title, at, allDay } (a repeat's occurrences carry ids of their own,
// <event id>~<day>, so taking one off adds an exception, not a deleted series). Pure apart from read() and write(). Tests: tools/agenda.test.mjs.
import * as C from './calendar.js';

export const OLD_KEY = 'a2m.void.agenda.v1';
export const KEY = C.KEY;
const SEP = '~';

/** an old stage row as a page event (an hour long unless all day), or null when it has no title or no date. Pure. */
export function eventOfRow(r) {
  if (!r || typeof r !== 'object') return null;
  const at = new Date(r.at); if (isNaN(at.getTime())) return null;
  const allDay = r.allDay === true, start = allDay ? C.dayKey(at) : C.fmtLocal(at);
  const id = 'ag' + String(r.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 30);
  return C.normalize({ id: id.length > 2 ? id : undefined, title: r.title, allDay, start, end: allDay ? start : C.fmtLocal(new Date(at.getTime() + 3600000)) });
}
/** the store with the old rows moved in (one each: the same title at the same start is not added twice) and marked done; null when it was
 *  done already. Pure. */
export function migrate(store, oldRows) {
  const S = store && typeof store === 'object' && !Array.isArray(store) ? store : {};
  if (S.agendaMoved) return null;
  let events = Array.isArray(S.events) ? S.events : [];
  for (const r of Array.isArray(oldRows) ? oldRows : []) {
    const e = eventOfRow(r); if (!e) continue;
    if (events.some((x) => x && (x.id === e.id || (String(x.title).toLowerCase() === e.title.toLowerCase() && x.start === e.start)))) continue;
    events = C.withEvent(events, e);
  }
  return { ...S, events, agendaMoved: true };
}
const splitId = (rowId) => { const s = String(rowId || ''), i = s.indexOf(SEP); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)]; };
/** every occurrence from `from` to `to` as a stage row { id, title, at (ISO), allDay, repeats }, soonest first. Pure. */
export function rowsOf(events, from, to) {
  return C.agenda(events || [], C.fmtLocal(from), C.fmtLocal(to)).map((o) => {
    const st = C.parseLocal(o.start);
    return { id: o.rrule ? o.id + SEP + o.occurrence : o.id, title: o.title, at: st.toISOString(), allDay: o.allDay, repeats: !!o.rrule };
  });
}
/** the events with one row taken off: a single event removed, one day of a repeat skipped (an exception date). Pure. */
export function withoutRow(events, rowId) {
  const [id, day] = splitId(rowId), base = (events || []).find((e) => e.id === id);
  if (!base) return events || [];
  if (base.rrule && day) return C.withEvent(events, { ...base, exdates: [...new Set([...(base.exdates || []), day])] });
  return C.withoutEvent(events, id);
}
/** the events with a row changed: { title } renames the event, { at: Date, allDay } moves it (its length kept; a repeat keeps its first day and
 *  takes the new time of day). Pure. */
export function withRow(events, rowId, { title, at, allDay } = {}) {
  const [id] = splitId(rowId), base = (events || []).find((e) => e.id === id);
  if (!base) return events || [];
  const next = { ...base };
  if (title != null && String(title).trim()) next.title = String(title).trim().slice(0, 200);
  if (at instanceof Date && !isNaN(at.getTime())) {
    const st = C.parseLocal(base.start), en = C.parseLocal(base.end), all = allDay === true;
    const day = base.rrule ? st : at, s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), all ? 0 : at.getHours(), all ? 0 : at.getMinutes());
    const len = base.allDay || all ? 3600000 : Math.max(0, en - st);
    next.allDay = all; next.start = all ? C.dayKey(s) : C.fmtLocal(s); next.end = all ? C.dayKey(s) : C.fmtLocal(new Date(s.getTime() + len));
  }
  return C.withEvent(events, next);
}
/** the events with a new one: { title, at: Date, allDay }. Pure. */
export function withNew(events, { title, at, allDay = false }) {
  const e = eventOfRow({ id: C.newId(), title, at, allDay }); return e ? C.withEvent(events || [], e) : events || [];
}

const ls = (s) => { try { return s || globalThis.localStorage || null; } catch (_) { return null; } };
/** the page's store as it is kept ({ events, ... }), the old stage rows moved in the first time (and written back). Never throws. */
export function read(storage) {
  const st = ls(storage); let S = {};
  try { const v = JSON.parse((st && st.getItem(KEY)) || '{}'); if (v && typeof v === 'object' && !Array.isArray(v)) S = v; } catch (_) {}
  if (!Array.isArray(S.events)) S.events = [];
  if (!S.agendaMoved) {
    let old = []; try { const v = JSON.parse((st && st.getItem(OLD_KEY)) || '[]'); if (Array.isArray(v)) old = v; } catch (_) {}
    const m = migrate(S, old); if (m) { S = m; try { st && st.setItem(KEY, JSON.stringify(S)); } catch (_) {} }
  }
  return S;
}
/** the events written back into the page's store, everything else in it kept. */
export function write(events, storage) {
  const st = ls(storage), S = read(st); S.events = events || [];
  try { st && st.setItem(KEY, JSON.stringify(S)); } catch (_) {}
  return S;
}
/** the events kept (shorthand for read().events). */
export const events = (storage) => read(storage).events;

// The Calendar page's own card on the stage opens on the day the page shows (owner, 2026-10-25: pages and cards go both ways)
/** a real local day from 'YYYY-MM-DD', or null ('2026-02-30' is no day). Pure. */
export function dayOfKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}
/** the stage ask that opens the wall calendar on one day ('my calendar on 2026-12-03'), or '' for no real day. Pure. */
export const cardAskOf = (k) => (dayOfKey(k) ? 'my calendar on ' + k : '');
/** the day that ask names ('2026-12-03'), or '' for any other ask. Pure. */
export function cardDayOf(text) {
  const m = /^(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:the\s+)?(?:calendar|calender)\s+(?:on|for)\s+(\d{4}-\d{2}-\d{2})$/i.exec(String(text || '').trim());
  return m && dayOfKey(m[1]) ? m[1] : '';
}
