// Calendar (Versus' Google Calendar floor and its lane, /calendar/): the pure half, shared by the page and its tests. Everything on the device:
// events live in localStorage (KEY), recurrence is expanded here (occurrences: FREQ daily/weekly/monthly/yearly, INTERVAL, COUNT, UNTIL, BYDAY,
// the RFC 5545 words), .ics goes out and comes in (icsOf, parseIcs: VEVENT with DTSTART, DTEND, RRULE, SUMMARY, DESCRIPTION, ATTENDEE, VALARM),
// an invite is a link that carries one event (inviteLink: /calendar/?e=<base64url json>, and a mailto: with the .ics as its body), reminders are
// worked out from the occurrences (nextReminder, dueReminders), and a line of English or German becomes an event (quickAdd: "dentist tomorrow 3pm,
// remind me 30 minutes before, every month"). Dates are the device's local wall clock written "YYYY-MM-DDTHH:MM" (an all-day event "YYYY-MM-DD"),
// never a zone: a calendar on a phone means the phone's time. Pure throughout. Tests: tools/calendar.test.mjs.

export const KEY = 'a2m.void.calendar.v1';
export const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const pad = (n) => String(n).padStart(2, '0');
const DAY = 86400000;

/** a local wall-clock string as a Date: "2026-10-26T15:00" or "2026-10-26" (midnight); null when it is not one. Pure. */
export function parseLocal(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(s || '').trim()); if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); return isNaN(d) ? null : d;
}
/** a Date as the local "YYYY-MM-DDTHH:MM". Pure. */
export const fmtLocal = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
/** a Date's local day, "YYYY-MM-DD". Pure. */
export const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
/** midnight at the start of a Date's local day. Pure. */
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** the same wall-clock time n days on (across a daylight-saving change the hour stays). Pure. */
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
/** the same day-of-month n months on; a day the month lacks (31 Feb) is clipped to its last day. Pure. */
export function addMonths(d, n) {
  const y = d.getFullYear(), m = d.getMonth() + n, last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last), d.getHours(), d.getMinutes(), d.getSeconds());
}
/** the Monday (or Sunday, weekStart 0) that starts a Date's week, at midnight. Pure. */
export function startOfWeek(d, weekStart = 1) { const s = startOfDay(d); return addDays(s, -((s.getDay() - weekStart + 7) % 7)); }
/** the 42 days of a month view (6 rows of 7) from the week that holds the 1st. Pure. */
export function monthGrid(year, month, weekStart = 1) { const first = startOfWeek(new Date(year, month, 1), weekStart); return Array.from({ length: 42 }, (_, i) => addDays(first, i)); }

/** a fresh id. Pure but for the clock and the random source. */
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/** an event made whole: every field present and of the right shape; null when it has no title or no start. Pure. */
export function normalize(e) {
  if (!e || typeof e !== 'object') return null;
  const title = String(e.title || '').trim().slice(0, 200), allDay = !!e.allDay;
  const st = parseLocal(e.start); if (!title || !st) return null;
  let en = parseLocal(e.end); if (!en || en < st) en = allDay ? st : new Date(st.getTime() + 3600000);
  const rrule = e.rrule && typeof e.rrule === 'object' && FREQS.includes(String(e.rrule.freq || '').toUpperCase()) ? normalizeRule(e.rrule) : null;
  const reminders = [...new Set((Array.isArray(e.reminders) ? e.reminders : []).map((m) => Math.round(+m)).filter((m) => Number.isFinite(m) && m >= 0 && m <= 4 * 7 * 1440))].sort((a, b) => a - b).slice(0, 5);
  const invitees = [...new Set((Array.isArray(e.invitees) ? e.invitees : String(e.invitees || '').split(/[,;\s]+/)).map((s) => String(s || '').trim()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))].slice(0, 50);
  return { id: String(e.id || newId()).slice(0, 40), title, start: allDay ? dayKey(st) : fmtLocal(st), end: allDay ? dayKey(en) : fmtLocal(en), allDay, rrule, reminders, notes: String(e.notes || '').slice(0, 5000), invitees, exdates: Array.isArray(e.exdates) ? e.exdates.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(0, 500) : [] };
}
const normalizeRule = (r) => { const out = { freq: String(r.freq).toUpperCase(), interval: Math.max(1, Math.min(999, Math.round(+r.interval) || 1)) };
  if (+r.count > 0) out.count = Math.min(10000, Math.round(+r.count)); if (r.until && parseLocal(r.until)) out.until = String(r.until).slice(0, 10);
  const byday = (Array.isArray(r.byday) ? r.byday : String(r.byday || '').split(',')).map((s) => String(s).toUpperCase().trim()).filter((s) => /^(?:-?[1-5])?(?:SU|MO|TU|WE|TH|FR|SA)$/.test(s)); if (byday.length) out.byday = byday; return out; };

/** the RFC 5545 RRULE text of a rule ("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"), '' for none. Pure. */
export function rruleText(r) {
  if (!r || !r.freq) return ''; const parts = ['FREQ=' + r.freq]; if (r.interval > 1) parts.push('INTERVAL=' + r.interval);
  if (r.count) parts.push('COUNT=' + r.count); if (r.until) parts.push('UNTIL=' + r.until.replace(/-/g, '') + 'T235959'); if (r.byday && r.byday.length) parts.push('BYDAY=' + r.byday.join(','));
  return parts.join(';');
}
/** a rule from RRULE text (with or without the "RRULE:" in front); null when it names no frequency we expand. Pure. */
export function parseRrule(text) {
  const kv = {}; for (const p of String(text || '').replace(/^RRULE:/i, '').split(';')) { const i = p.indexOf('='); if (i > 0) kv[p.slice(0, i).trim().toUpperCase()] = p.slice(i + 1).trim(); }
  if (!FREQS.includes(String(kv.FREQ || '').toUpperCase())) return null;
  const r = { freq: kv.FREQ.toUpperCase(), interval: +kv.INTERVAL || 1 }; if (+kv.COUNT > 0) r.count = +kv.COUNT;
  if (kv.UNTIL) { const m = /^(\d{4})(\d{2})(\d{2})/.exec(kv.UNTIL); if (m) r.until = m[1] + '-' + m[2] + '-' + m[3]; }
  if (kv.BYDAY) r.byday = kv.BYDAY.split(','); return normalizeRule(r);
}

const nthWeekday = (year, month, n, wd) => { // the nth (1..5, or -1 last) weekday of a month, or null
  if (n > 0) { const first = new Date(year, month, 1), d = 1 + ((wd - first.getDay() + 7) % 7) + (n - 1) * 7; return d <= new Date(year, month + 1, 0).getDate() ? d : null; }
  const last = new Date(year, month + 1, 0); return last.getDate() - ((last.getDay() - wd + 7) % 7);
};
/** every time an event happens between two local dates (inclusive of a day the range names), its recurrence expanded: [{ ...event, start, end,
 *  occurrence: the local day it is the instance of }], sorted. A plain event is its own one occurrence. Hard cap of 1000 instances. Pure. */
export function occurrences(ev, fromISO, toISO) {
  const e = normalize(ev); if (!e) return [];
  const from = parseLocal(fromISO) || new Date(0), to0 = parseLocal(toISO); const to = to0 ? (/^\d{4}-\d{2}-\d{2}$/.test(String(toISO).trim()) ? addDays(to0, 1) : to0) : new Date(8640000000000000);
  const st = parseLocal(e.start), en = parseLocal(e.end), len = Math.max(0, en - st) + (e.allDay ? DAY : 0), out = [];
  const push = (s) => { const d = dayKey(s); if (e.exdates.includes(d)) return; const f = new Date(s.getTime() + len); if (f > from && s < to) out.push({ ...e, start: e.allDay ? dayKey(s) : fmtLocal(s), end: e.allDay ? dayKey(new Date(f.getTime() - DAY)) : fmtLocal(f), occurrence: d }); };
  const r = e.rrule; if (!r) { push(st); return out; }
  // n counts every instance made (COUNT means all of them, shown or not); iter caps the work whatever the rule says
  const until = r.until ? addDays(parseLocal(r.until), 1) : null; let n = 0, iter = 0;
  const stop = (s) => (until && s >= until) || (r.count && n >= r.count) || s >= to || ++iter > 5000;
  if (r.freq === 'WEEKLY' && r.byday && r.byday.length) {
    const days = [...new Set(r.byday.map((b) => DAYS.indexOf(b.slice(-2))))].filter((i) => i >= 0).sort((a, b) => a - b);
    for (let wk = startOfWeek(st, 0); !stop(wk); wk = addDays(wk, 7 * r.interval)) for (const d of days) { const s = new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() + d, st.getHours(), st.getMinutes()); if (s < st) continue; if (stop(s)) break; n++; push(s); }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }
  if (r.freq === 'MONTHLY' && r.byday && r.byday.length) {
    const spec = /^(-?[1-5])?(SU|MO|TU|WE|TH|FR|SA)$/.exec(r.byday[0]); const nth = spec && spec[1] ? +spec[1] : Math.ceil(st.getDate() / 7), wd = spec ? DAYS.indexOf(spec[2]) : st.getDay();
    for (let k = 0; k < 5000; k++) { const y = st.getFullYear(), m = st.getMonth() + k * r.interval, day = nthWeekday(y, m, nth, wd); if (day == null) continue; const s = new Date(y, m, day, st.getHours(), st.getMinutes()); if (s < st) continue; if (stop(s)) break; n++; push(s); }
    return out;
  }
  for (let k = 0; k < 5000; k++) {
    const s = r.freq === 'DAILY' ? addDays(st, k * r.interval) : r.freq === 'WEEKLY' ? addDays(st, 7 * k * r.interval) : r.freq === 'MONTHLY' ? addMonths(st, k * r.interval) : addMonths(st, 12 * k * r.interval);
    if (stop(s)) break;
    if ((r.freq === 'MONTHLY' || r.freq === 'YEARLY') && s.getDate() !== st.getDate()) continue; // a 31st in a month of 30 days, a 29 Feb: the month is skipped, as RFC 5545 says
    n++; push(s);
  }
  return out;
}
/** the occurrences of many events in a range, soonest first: by day, the all-day ones first within it. Pure. */
export const agenda = (events, fromISO, toISO) => (events || []).flatMap((e) => occurrences(e, fromISO, toISO)).sort((a, b) => a.start.slice(0, 10).localeCompare(b.start.slice(0, 10)) || (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
/** the occurrences on one local day. Pure. */
export const onDay = (events, dayISO) => agenda(events, dayISO, dayISO);

/** the events with one put in (by id) or added. Pure. */
export function withEvent(events, ev) { const e = normalize(ev); if (!e) return events || []; const list = (events || []).filter((x) => x.id !== e.id); list.push(e); return list.sort((a, b) => a.start.localeCompare(b.start)); }
/** the events without one. Pure. */
export const withoutEvent = (events, id) => (events || []).filter((x) => x.id !== id);
/** the events whose title, notes or invitees say the words, every word somewhere. Pure. */
export function search(events, q) { const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return []; return (events || []).filter((e) => { const hay = (e.title + ' ' + e.notes + ' ' + (e.invitees || []).join(' ')).toLowerCase(); return words.every((w) => hay.includes(w)); }); }

// reminders: each is minutes before the start of an occurrence
/** every reminder that falls in (sinceISO, nowISO]: [{ event, at, minutes }], the ones to fire when a timer wakes. Pure. */
export function dueReminders(events, sinceISO, nowISO) {
  const since = parseLocal(sinceISO) || new Date(0), now = parseLocal(nowISO) || new Date(), out = [];
  for (const o of agenda(events, fmtLocal(since), fmtLocal(new Date(now.getTime() + 28 * DAY)))) for (const m of o.reminders || []) { const at = new Date(parseLocal(o.start).getTime() - m * 60000); if (at > since && at <= now) out.push({ event: o, at: fmtLocal(at), minutes: m }); }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
/** the next reminder from now on, within 60 days: { event, at, minutes } or null. Pure. */
export function nextReminder(events, nowISO) {
  const now = parseLocal(nowISO) || new Date(); let best = null;
  for (const o of agenda(events, fmtLocal(now), fmtLocal(new Date(now.getTime() + 60 * DAY)))) for (const m of o.reminders || []) { const at = new Date(parseLocal(o.start).getTime() - m * 60000); if (at >= now && (!best || at < best.atDate)) best = { event: o, at: fmtLocal(at), atDate: at, minutes: m }; }
  if (!best) return null; const { atDate, ...r } = best; return r;
}

// .ics (RFC 5545): floating local times, since the calendar is the device's own clock
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const unesc = (s) => String(s || '').replace(/\\n/gi, '\n').replace(/\\([\\;,])/g, '$1');
const stamp = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
const fold = (line) => { const out = []; let s = line; while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); } out.push(s); return out.join('\r\n'); };
const trigger = (m) => (m === 0 ? '-PT0M' : m % 1440 === 0 ? '-P' + m / 1440 + 'D' : m % 60 === 0 ? '-PT' + m / 60 + 'H' : '-PT' + m + 'M');
/** the events as one iCalendar file (VCALENDAR of VEVENTs with DTSTART, DTEND, RRULE, SUMMARY, DESCRIPTION, ATTENDEE and a VALARM per reminder). Pure but for DTSTAMP. */
export function icsOf(events, now = new Date()) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Verse//Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const raw of events || []) { const e = normalize(raw); if (!e) continue; const st = parseLocal(e.start), en = parseLocal(e.end);
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '@a-to-mind.com', 'DTSTAMP:' + now.toISOString().replace(/[-:]|\.\d{3}/g, ''));
    if (e.allDay) L.push('DTSTART;VALUE=DATE:' + e.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + dayKey(addDays(en, 1)).replace(/-/g, '')); else L.push('DTSTART:' + stamp(st), 'DTEND:' + stamp(en));
    L.push('SUMMARY:' + esc(e.title)); if (e.notes) L.push('DESCRIPTION:' + esc(e.notes)); if (e.rrule) L.push('RRULE:' + rruleText(e.rrule));
    for (const x of e.exdates) L.push('EXDATE' + (e.allDay ? ';VALUE=DATE:' + x.replace(/-/g, '') : ':' + x.replace(/-/g, '') + 'T' + pad(st.getHours()) + pad(st.getMinutes()) + '00'));
    for (const a of e.invitees) L.push('ATTENDEE;CN=' + esc(a.split('@')[0]) + ';RSVP=TRUE:mailto:' + a);
    for (const m of e.reminders) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), 'TRIGGER:' + trigger(m), 'END:VALARM');
    L.push('END:VEVENT'); }
  L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
}
const icsDate = (v, params) => { // a DTSTART value as a local Date; a Z time is moved to the device's clock
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(v || '').trim()); if (!m) return null;
  if (m[7]) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
  return { d: new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)), allDay: /VALUE=DATE(?!-TIME)/i.test(params || '') || !m[4] };
};
const minutesOf = (trig) => { const m = /^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(trig || '').trim()); if (!m) return null; return (+(m[1] || 0)) * 10080 + (+(m[2] || 0)) * 1440 + (+(m[3] || 0)) * 60 + (+(m[4] || 0)); };
/** the events in an iCalendar text (each VEVENT with a SUMMARY and a DTSTART; folded lines, TZID and Z times, VALUE=DATE, RRULE, EXDATE, ATTENDEE,
 *  VALARM triggers before the start); [] for anything else. Pure. */
export function parseIcs(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n'), out = []; let e = null, alarm = null;
  for (const raw of lines) { const line = raw.trim(); if (!line) continue;
    if (/^BEGIN:VEVENT$/i.test(line)) { e = { reminders: [], invitees: [], exdates: [] }; continue; } if (!e) continue;
    if (/^BEGIN:VALARM$/i.test(line)) { alarm = {}; continue; }
    if (/^END:VALARM$/i.test(line)) { if (alarm && alarm.minutes != null) e.reminders.push(alarm.minutes); alarm = null; continue; }
    if (/^END:VEVENT$/i.test(line)) { const ev = normalize(e); if (ev) out.push(ev); e = null; continue; }
    const i = line.indexOf(':'); if (i < 0) continue; const head = line.slice(0, i), val = line.slice(i + 1), name = head.split(';')[0].toUpperCase(), params = head.slice(name.length);
    if (alarm) { if (name === 'TRIGGER' && !/RELATED=END/i.test(params)) { const m = minutesOf(val); if (m != null) alarm.minutes = m; } continue; }
    if (name === 'UID') e.id = val.replace(/@.*$/, '').replace(/[^\w.-]/g, '').slice(0, 40) || undefined;
    else if (name === 'SUMMARY') e.title = unesc(val); else if (name === 'DESCRIPTION') e.notes = unesc(val);
    else if (name === 'DTSTART') { const d = icsDate(val, params); if (d instanceof Date) { e.start = fmtLocal(d); e.allDay = false; } else if (d) { e.start = d.allDay ? dayKey(d.d) : fmtLocal(d.d); e.allDay = d.allDay; } }
    else if (name === 'DTEND') { const d = icsDate(val, params); if (d instanceof Date) e.end = fmtLocal(d); else if (d) e.end = d.allDay ? dayKey(addDays(d.d, -1)) : fmtLocal(d.d); }
    else if (name === 'DURATION' && !e.end) { const m = minutesOf(val); if (m != null && e.start) { const s = parseLocal(e.start); e.end = fmtLocal(new Date(s.getTime() + m * 60000)); } }
    else if (name === 'RRULE') e.rrule = parseRrule(val);
    else if (name === 'EXDATE') for (const v of val.split(',')) { const d = icsDate(v, params); const dd = d instanceof Date ? d : d && d.d; if (dd) e.exdates.push(dayKey(dd)); }
    else if (name === 'ATTENDEE') { const m = /mailto:([^\s,;]+)/i.exec(val); if (m) e.invitees.push(m[1]); }
  }
  return out;
}

// invites: a link that carries one event, and a mail with the .ics as its body
const b64url = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => { const bin = atob(String(s || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(s || '').length / 4) * 4, '=')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };
/** the invite for an event: { url: '<origin>/calendar/?e=<base64url json>' (the event whole, opens as "Add to my calendar"), mailto: a mail to its
 *  invitees with the .ics text as the body, ics: that text }. Pure. */
export function inviteLink(ev, origin = '') {
  const e = normalize(ev); if (!e) return null;
  const { exdates, ...carried } = e; const url = String(origin || '').replace(/\/$/, '') + '/calendar/?e=' + b64url(JSON.stringify(carried));
  const ics = icsOf([e]), st = parseLocal(e.start), when = e.allDay ? e.start : e.start.replace('T', ' ');
  const body = e.title + '\n' + when + (e.notes ? '\n' + e.notes : '') + '\n\n' + url + '\n\n' + ics;
  return { url, mailto: 'mailto:' + e.invitees.join(',') + '?subject=' + encodeURIComponent('Invitation: ' + e.title + ' (' + when + ')') + '&body=' + encodeURIComponent(body), ics, when: st };
}
/** the event an ?e= link carries, or null. Pure. */
export function eventFromLink(e) { try { return normalize(JSON.parse(unb64url(e))); } catch (_) { return null; } }

// quick add: one line in English or German into an event
const WD = { sunday: 0, sonntag: 0, monday: 1, montag: 1, tuesday: 2, dienstag: 2, wednesday: 3, mittwoch: 3, thursday: 4, donnerstag: 4, friday: 5, freitag: 5, saturday: 6, samstag: 6, sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTHS = { jan: 0, january: 0, januar: 0, feb: 1, february: 1, februar: 1, mar: 2, march: 2, märz: 2, maerz: 2, apr: 3, april: 3, may: 4, mai: 4, jun: 5, june: 5, juni: 5, jul: 6, july: 6, juli: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, okt: 9, oktober: 9, nov: 10, november: 10, dec: 11, december: 11, dez: 11, dezember: 11 };
const WDRE = Object.keys(WD).sort((a, b) => b.length - a.length).join('|'), MONRE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|uhr)?`;
const hourOf = (h, mi, ap) => { h = +h; if (h > 24) return null; if (ap && /p/i.test(ap) && h < 12) h += 12; if (ap && /a/i.test(ap) && h === 12) h = 0; return { h: h === 24 ? 0 : h, m: +(mi || 0) }; };
/** an event from one line as people type it: "lunch with Sam tomorrow 1pm", "dentist tomorrow 3pm, remind me 30 minutes before, every month",
 *  "team call every monday 10:00 for 30 minutes", "Zahnarzt morgen 15 Uhr", "mum's birthday 3 nov all day". Today, tomorrow, weekday names, a date
 *  (3 nov, nov 3, 3.11., 2026-11-03, 11/3 as month/day), a time or a range (3-4pm, from 3 to 4pm, noon, midnight), a length (for 2 hours), a repeat
 *  (every day/week/month/year, weekly, every 2 weeks, every monday, until 20 dec, 5 times), a reminder (remind me 30 minutes before, 1 day before),
 *  "all day". No time means an all-day event; no date means today. The title is what is left. null when nothing is left for a title. Pure. */
export function quickAdd(text, now = new Date()) {
  let s = ' ' + String(text || '').replace(/\s+/g, ' ').trim() + ' '; if (s.trim().length < 1) return null;
  const take = (re, f) => { const m = re.exec(s); if (!m) return null; s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return f ? f(m) : m; };
  const ev = { reminders: [], invitees: [], notes: '' }; let date = null, time = null, endTime = null, minutes = null, rrule = null, allDay = false, evening = false;
  // reminders: "remind me 30 minutes before", "reminder 1 hour before", "erinnere mich 10 min vorher"
  take(new RegExp(String.raw`[,;]?\s*(?:remind(?:er)?(?: me)?|erinner(?:e|ung)(?: mich)?|alert(?: me)?)\s*(?::|at|,)?\s*(\d+)\s*(min(?:ute)?s?|h(?:ou)?rs?|days?|stunden?|tage?n?)\s*(?:before|early|vorher|davor|zuvor|ahead)?`, 'i'), (m) => { const n = +m[1], u = m[2].toLowerCase(); ev.reminders.push(/^d|^t/.test(u) ? n * 1440 : /^h|^s/.test(u) ? n * 60 : n); });
  take(/[,;]?\s*(?:remind(?: me)?|erinnere mich|with a reminder|reminder)\s*(?=[,;]|$)/i, () => { if (!ev.reminders.length) ev.reminders.push(30); });
  // repeat
  take(/[,;]?\s*(?:every|each|jeden?|alle)\s+(\d+)\s+(days?|weeks?|months?|years?|tage?n?|wochen?|monate?n?|jahre?n?)/i, (m) => { rrule = { freq: /^d|^t/i.test(m[2]) ? 'DAILY' : /^w/i.test(m[2]) ? 'WEEKLY' : /^m/i.test(m[2]) ? 'MONTHLY' : 'YEARLY', interval: +m[1] }; });
  take(new RegExp(String.raw`[,;]?\s*(?:every|each|jeden)\s+(${WDRE})s?\b`, 'i'), (m) => { rrule = { freq: 'WEEKLY', interval: 1, byday: [DAYS[WD[m[1].toLowerCase()]]] }; if (!date) date = nextWeekday(now, WD[m[1].toLowerCase()]); });
  take(/[,;]?\s*(?:every|each|jeden?|jedes|alle)\s+(day|week|month|year|tag|woche|monat|jahr|weekday|workday)s?\b|[,;]?\s*\b(daily|weekly|monthly|yearly|annually|täglich|wöchentlich|monatlich|jährlich)\b/i, (m) => { const w = (m[1] || m[2]).toLowerCase(); if (/^weekday|^workday/.test(w)) rrule = { freq: 'WEEKLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'] }; else rrule = { freq: /^d|^t/.test(w) ? 'DAILY' : /^w/.test(w) ? 'WEEKLY' : /^m/.test(w) ? 'MONTHLY' : 'YEARLY', interval: 1 }; });
  take(/[,;]?\s*(?:for\s+)?(\d+)\s*(?:times|x|mal)\b/i, (m) => { if (rrule) rrule.count = +m[1]; });
  // all day, length
  take(/[,;]?\s*\b(?:all[- ]day|ganztägig|ganzen tag)\b/i, () => { allDay = true; });
  take(/[,;]?\s*\b(?:for|lasting|für|dauer)\s+(\d+(?:[.,]\d+)?)\s*(min(?:ute)?s?|h(?:ou)?rs?|hrs?|h|stunden?|std)\b/i, (m) => { const n = parseFloat(m[1].replace(',', '.')); minutes = /^m/i.test(m[2]) ? n : n * 60; });
  // until (before the dates, or its date would be taken for the event's own)
  take(new RegExp(String.raw`[,;]?\s*\b(?:until|till|bis)\s+(?:(\d{1,2})(?:st|nd|rd|th|\.)?\s+(${MONRE})|(${MONRE})\s+(\d{1,2})|(\d{4})-(\d{2})-(\d{2}))\b(?:\s+(\d{4}))?`, 'i'), (m) => { const d = m[5] ? new Date(+m[5], +m[6] - 1, +m[7]) : dated(now, MONTHS[(m[2] || m[3]).toLowerCase()], +(m[1] || m[4]), m[8]); if (rrule && d) rrule.until = dayKey(d); });
  // dates
  take(/[,;]?\s*\b(?:the day after tomorrow|übermorgen)\b/i, () => { date = addDays(startOfDay(now), 2); });
  take(/[,;]?\s*\b(?:tomorrow|tmrw|tmr|morgen)\b/i, () => { date = addDays(startOfDay(now), 1); });
  take(/[,;]?\s*\b(?:today|tonight|this evening|heute abend|heute)\b/i, (m) => { date = startOfDay(now); evening = /night|evening|abend/i.test(m[0]); });
  take(new RegExp(String.raw`[,;]?\s*\b(?:on\s+|am\s+)?(?:(next|this|coming|nächsten?|kommenden?)\s+)?(${WDRE})\b(?!\s*(?:uhr|am|pm))`, 'i'), (m) => { if (!date) { date = nextWeekday(now, WD[m[2].toLowerCase()]); if (/^(next|nächste)/i.test(m[1] || '') && date.getTime() === startOfDay(now).getTime()) date = addDays(date, 7); } });
  take(/[,;]?\s*\b(?:on\s+|am\s+)?(\d{4})-(\d{2})-(\d{2})\b/, (m) => { date = new Date(+m[1], +m[2] - 1, +m[3]); });
  take(new RegExp(String.raw`[,;]?\s*\b(?:on\s+|am\s+)?(\d{1,2})(?:st|nd|rd|th|\.)?\s+(?:of\s+)?(${MONRE})\b(?:\s+(\d{4}))?`, 'i'), (m) => { date = dated(now, MONTHS[m[2].toLowerCase()], +m[1], m[3]); });
  take(new RegExp(String.raw`[,;]?\s*\b(?:on\s+)?(${MONRE})\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?(?!\s*(?::|am|pm|uhr))`, 'i'), (m) => { date = dated(now, MONTHS[m[1].toLowerCase()], +m[2], m[3]); });
  take(/[,;]?\s*\b(?:on\s+|am\s+)?(\d{1,2})\.(\d{1,2})\.?(?:\s?(\d{4})\b)?(?![\d:])/, (m) => { date = dated(now, +m[2] - 1, +m[1], m[3]); });
  take(/[,;]?\s*\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b(?!\s*(?::|am|pm))/, (m) => { date = dated(now, +m[1] - 1, +m[2], m[3]); });
  // times: a range first, then one time
  take(new RegExp(String.raw`[,;]?\s*\b(?:from\s+|von\s+|at\s+|um\s+)?${TIME}\s*(?:-|–|to|bis|until)\s*${TIME}(?![\d:])`, 'i'), (m) => { const b = hourOf(m[4], m[5], m[6] || (m[3] && /u/i.test(m[3]) ? 'uhr' : null)), a = hourOf(m[1], m[2], m[3] || (m[6] && !/u/i.test(m[6]) && +m[1] <= 12 && +m[1] + 12 <= (b ? b.h : 0) ? m[6] : null)); if (a && b) { time = a; endTime = b; if (endTime.h < time.h && !m[6]) endTime.h += 12; } });
  take(/[,;]?\s*\b(?:at\s+|um\s+)?(noon|midday|mittag|midnight|mitternacht)\b/i, (m) => { time = /^(noon|midday|mittag)$/i.test(m[1]) ? { h: 12, m: 0 } : { h: 0, m: 0 }; });
  take(new RegExp(String.raw`[,;]?\s*\b(?:at\s+|um\s+|@\s*)?(\d{1,2})(?::(\d{2}))\s*(am|pm|a\.m\.|p\.m\.|uhr)?(?![\d:.])`, 'i'), (m) => { time = hourOf(m[1], m[2], m[3]); });
  take(new RegExp(String.raw`[,;]?\s*\b(?:at\s+|um\s+|@\s*)?(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.|uhr)\b`, 'i'), (m) => { time = hourOf(m[1], 0, m[2]); });
  take(/[,;]?\s*\b(?:at|um|@)\s+(\d{1,2})\b(?![\d:.])/i, (m) => { time = hourOf(m[1], 0, +m[1] <= 7 || (evening && +m[1] < 12) ? 'pm' : null); });
  if (!date) date = startOfDay(now);
  ev.title = s.replace(/\s+/g, ' ').replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '').replace(/\s+(?:at|on|from|um|am)$/i, '').replace(/^(?:add|new|create|neu|termin)\s+/i, '').trim();
  if (!ev.title) return null;
  if (!time || allDay) { ev.allDay = true; ev.start = dayKey(date); ev.end = ev.start; }
  else { const st = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.h, time.m); let en = endTime ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), endTime.h, endTime.m) : new Date(st.getTime() + (minutes || 60) * 60000); if (en <= st) en = addDays(en, 1); ev.allDay = false; ev.start = fmtLocal(st); ev.end = fmtLocal(en); }
  if (rrule) ev.rrule = rrule;
  return normalize(ev);
}
const nextWeekday = (now, wd) => { const t = startOfDay(now); return addDays(t, (wd - t.getDay() + 7) % 7); };
const dated = (now, month, day, year) => { if (!(month >= 0 && month <= 11 && day >= 1 && day <= 31)) return null; let y = year ? (String(year).length === 2 ? 2000 + +year : +year) : now.getFullYear(); let d = new Date(y, month, day); if (!year && d < startOfDay(now) && startOfDay(now) - d > 30 * DAY) d = new Date(y + 1, month, day); return d; };

/** a clock time as people read it: "3:00 PM" (en) or "15:00" (de), a plain space, never a narrow one. Pure. */
export function fmtTime(d, lang = 'en') {
  const h = d.getHours(), m = d.getMinutes(); if (/^de\b/i.test(lang)) return pad(h) + ':' + pad(m);
  return (h % 12 || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM');
}
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], DE_DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], DE_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** a day written out: "Monday, 26 October 2026" or "Montag, 26. Oktober 2026". Pure. */
export function fmtDay(d, lang = 'en', { weekday = true, year = true } = {}) {
  const de = /^de\b/i.test(lang), wd = (de ? DE_DAYS : EN_DAYS)[d.getDay()], mo = (de ? DE_MONTHS : EN_MONTHS)[d.getMonth()];
  return (weekday ? wd + ', ' : '') + d.getDate() + (de ? '. ' : ' ') + mo + (year ? ' ' + d.getFullYear() : '');
}
/** "October 2026" / "Oktober 2026". Pure. */
export const fmtMonth = (d, lang = 'en') => (/^de\b/i.test(lang) ? DE_MONTHS : EN_MONTHS)[d.getMonth()] + ' ' + d.getFullYear();
export const dayNames = (lang = 'en', weekStart = 1) => Array.from({ length: 7 }, (_, i) => (/^de\b/i.test(lang) ? DE_DAYS : EN_DAYS)[(i + weekStart) % 7].slice(0, /^de\b/i.test(lang) ? 2 : 3));

/** a rule in words: "every month", "every 2 weeks on Mon, Wed", "every day until 20 Dec 2026, 5 times". Pure. */
export function repeatText(r, lang = 'en') {
  if (!r || !r.freq) return ''; const de = /^de\b/i.test(lang), n = r.interval || 1;
  const unit = de ? { DAILY: ['Tag', 'Tage'], WEEKLY: ['Woche', 'Wochen'], MONTHLY: ['Monat', 'Monate'], YEARLY: ['Jahr', 'Jahre'] }[r.freq] : { DAILY: ['day', 'days'], WEEKLY: ['week', 'weeks'], MONTHLY: ['month', 'months'], YEARLY: ['year', 'years'] }[r.freq];
  let s = (de ? (n === 1 ? (r.freq === 'WEEKLY' ? 'jede ' : 'jeden ') : 'alle ' + n + ' ') : 'every ' + (n === 1 ? '' : n + ' ')) + (n === 1 ? unit[0] : unit[1]);
  if (r.byday && r.byday.length) { const names = r.byday.map((b) => { const m = /^(-?[1-5])?(\w\w)$/.exec(b); const d = (de ? DE_DAYS : EN_DAYS)[DAYS.indexOf(m[2])].slice(0, de ? 2 : 3); return m[1] ? (m[1] === '-1' ? (de ? 'letzter ' : 'last ') : m[1] + (de ? '. ' : ['st', 'nd', 'rd', 'th', 'th'][+m[1] - 1] + ' ')) + d : d; }); s += (de ? ' am ' : ' on ') + names.join(', '); }
  if (r.until) { const d = parseLocal(r.until); if (d) s += (de ? ' bis ' : ' until ') + fmtDay(d, lang, { weekday: false }); }
  if (r.count) s += ', ' + r.count + (de ? ' Mal' : ' times');
  return s;
}
/** a reminder in words: "30 minutes before", "1 hour before", "1 day before", "at the time". Pure. */
export function reminderText(m, lang = 'en') {
  const de = /^de\b/i.test(lang); m = Math.round(+m || 0); if (m === 0) return de ? 'zum Termin' : 'at the time';
  const [n, u] = m % 10080 === 0 ? [m / 10080, de ? ['Woche', 'Wochen'] : ['week', 'weeks']] : m % 1440 === 0 ? [m / 1440, de ? ['Tag', 'Tage'] : ['day', 'days']] : m % 60 === 0 ? [m / 60, de ? ['Stunde', 'Stunden'] : ['hour', 'hours']] : [m, de ? ['Minute', 'Minuten'] : ['minute', 'minutes']];
  return n + ' ' + (n === 1 ? u[0] : u[1]) + (de ? ' vorher' : ' before');
}
/** what the page says in the person's own language: English, or German for a German browser. Pure. */
export function wordsFor(lang) {
  const de = /^de\b/i.test(String(lang || ''));
  return de ? {
    title: 'Kalender', sub: 'Monat, Woche und Tag; Termine mit Wiederholung, Erinnerung und Einladung; alles bleibt auf diesem Gerät und geht offline.',
    placeholder: 'Schnell eintragen: „Zahnarzt morgen 15 Uhr, erinnere mich 30 min vorher, jeden Monat"', add: 'Eintragen', search: 'Suchen', searchPh: 'Termine durchsuchen',
    month: 'Monat', week: 'Woche', day: 'Tag', today: 'Heute', prev: 'Zurück', next: 'Weiter', newEvent: 'Neuer Termin', edit: 'Bearbeiten', save: 'Speichern', del: 'Löschen', cancel: 'Abbrechen', close: 'Schließen',
    titleL: 'Titel', start: 'Beginn', end: 'Ende', allDay: 'Ganztägig', repeat: 'Wiederholen', none: 'Nie', daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich', every: 'Alle', on: 'am', until: 'Bis', times: 'Anzahl',
    reminder: 'Erinnerung', remNone: 'Keine', atTime: 'Zum Termin', minBefore: 'Minuten vorher', hourBefore: 'Stunde vorher', dayBefore: 'Tag vorher', notes: 'Notizen', invitees: 'Eingeladene (E-Mail, mit Komma)',
    invite: 'Einladen', share: 'Link teilen', copied: 'Kopiert', mail: 'Per E-Mail einladen', ics: '.ics herunterladen', importIcs: '.ics importieren', exportIcs: 'Alles als .ics', exportDone: 'exportiert', imported: 'importiert',
    nextRem: 'Nächste Erinnerung', noRem: 'Keine Erinnerung geplant', allow: 'Benachrichtigungen erlauben', allowed: 'Benachrichtigungen an', denied: 'Erinnerungen erscheinen hier auf der Seite', inPage: 'Erinnerung',
    added: 'Eingetragen', addToMine: 'In meinen Kalender', invitedTo: 'Du bist eingeladen', alreadyIn: 'Schon im Kalender', empty: 'Keine Termine', events: 'Termine', more: 'mehr', offline: 'Offline: alles bleibt auf diesem Gerät',
    deleteOne: 'Nur diesen Termin löschen', deleteAll: 'Alle Wiederholungen löschen', results: 'Treffer', nothing: 'Nichts gefunden', keyHelp: 'Pfeiltasten blättern, T ist heute, M W D wechseln die Ansicht, N ein neuer Termin, / sucht',
    note: 'Termine, Erinnerungen und Einladungen bleiben in diesem Browser; nichts geht an einen Server. Eine Einladung ist ein Link, der den Termin selbst trägt, oder eine E-Mail mit der .ics-Datei.',
  } : {
    title: 'Calendar', sub: 'Month, week and day; events that repeat, remind and invite; everything stays on this device and works offline.',
    placeholder: 'Quick add: "dentist tomorrow 3pm, remind me 30 minutes before, every month"', add: 'Add', search: 'Search', searchPh: 'Search events',
    month: 'Month', week: 'Week', day: 'Day', today: 'Today', prev: 'Previous', next: 'Next', newEvent: 'New event', edit: 'Edit', save: 'Save', del: 'Delete', cancel: 'Cancel', close: 'Close',
    titleL: 'Title', start: 'Starts', end: 'Ends', allDay: 'All day', repeat: 'Repeat', none: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', every: 'Every', on: 'on', until: 'Until', times: 'Times',
    reminder: 'Reminder', remNone: 'None', atTime: 'At the time', minBefore: 'minutes before', hourBefore: 'hour before', dayBefore: 'day before', notes: 'Notes', invitees: 'Invitees (emails, with commas)',
    invite: 'Invite', share: 'Share link', copied: 'Copied', mail: 'Invite by email', ics: 'Download .ics', importIcs: 'Import .ics', exportIcs: 'Export all as .ics', exportDone: 'exported', imported: 'imported',
    nextRem: 'Next reminder', noRem: 'No reminder scheduled', allow: 'Allow notifications', allowed: 'Notifications on', denied: 'Reminders will show here on the page', inPage: 'Reminder',
    added: 'Added', addToMine: 'Add to my calendar', invitedTo: 'You are invited', alreadyIn: 'Already in your calendar', empty: 'No events', events: 'events', more: 'more', offline: 'Offline: everything stays on this device',
    deleteOne: 'Delete only this one', deleteAll: 'Delete all repeats', results: 'results', nothing: 'Nothing found', keyHelp: 'Arrow keys move, T is today, M W D switch the view, N is a new event, / searches',
    note: 'Events, reminders and invites stay in this browser; nothing goes to a server. An invite is a link that carries the event itself, or an email with the .ics file.',
  };
}
