// What /calendar/ takes from Google Calendar's appointment schedules, Outlook's Bookings, Proton and Cozi: a booking link that offers your
// free times (from Find a time's free slots), which a guest opens in their own time zone and picks from; their pick comes back to you as a
// link (or an email they send) that adds the booking to your calendar. Also Google Calendar's time insights (where the week's hours went)
// and an undo for a deleted event. Everything rides in the links: no account, nothing kept on a server. The pure half.
// Tests: tools/calendar-rivals.test.mjs (rules), tools/calendar-rivals-e2e.mjs (the page in a real browser).
import { agenda, fmtLocal, parseLocal, normalize, calendarOf, dayKey, addDays, startOfDay } from './calendar.js';

const b64url = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => { const bin = atob(String(s || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(s || '').length / 4) * 4, '=')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };
const text = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
const mail = (s) => (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(String(s || '').trim()) ? String(s).trim().slice(0, 120) : '');
export const MAX_SLOTS = 60;
const MIN = 5, MAX_MIN = 480;

/** a booking link: { title, host, email?, minutes, slots: [{ start }] in local time } as '<origin>/calendar/?book=…'; the times travel as
 *  instants (epoch minutes), so a guest anywhere sees them in their own zone. null without a title or a slot. Pure. */
export function bookingLink(b, origin = '') {
  const title = text(b.title, 120), minutes = Math.round(+b.minutes), slots = (b.slots || []).map((s) => parseLocal(s.start)).filter(Boolean).map((d) => Math.round(d.getTime() / 60000));
  if (!title || !(minutes >= MIN && minutes <= MAX_MIN) || !slots.length) return null;
  const o = { t: title, h: text(b.host, 60), m: minutes, s: [...new Set(slots)].sort((x, y) => x - y).slice(0, MAX_SLOTS), ...(mail(b.email) ? { e: mail(b.email) } : {}), ...(text(b.note, 300) ? { n: text(b.note, 300) } : {}) };
  return String(origin || '').replace(/\/$/, '') + '/calendar/?book=' + b64url(JSON.stringify(o));
}
/** the booking a ?book= link carries, with its times as local { start, end } for this device and only those after `now`; null when broken. Pure. */
export function readBooking(param, now = new Date()) {
  let o; try { o = JSON.parse(unb64url(param)); } catch (_) { return null; }
  if (!o || typeof o !== 'object' || !text(o.t, 120) || !Array.isArray(o.s)) return null;
  const minutes = Math.round(+o.m); if (!(minutes >= MIN && minutes <= MAX_MIN)) return null;
  const slots = o.s.map(Number).filter((x) => Number.isFinite(x) && x * 60000 > now.getTime()).slice(0, MAX_SLOTS).map((x) => ({ at: x, start: fmtLocal(new Date(x * 60000)), end: fmtLocal(new Date((x + minutes) * 60000)) }));
  return { title: text(o.t, 120), host: text(o.h, 60), email: mail(o.e), note: text(o.n, 300), minutes, slots };
}
/** the guest's pick as the link that adds it to the host's calendar ('?booked=…'), with a mail the guest can send that carries it. Pure. */
export function bookedLink(booking, at, guest, origin = '', note = '') {
  const o = { t: booking.title, h: booking.host, m: booking.minutes, a: Math.round(+at), g: text(guest, 60), ...(text(note, 300) ? { n: text(note, 300) } : {}) };
  if (!o.t || !o.g || !Number.isFinite(o.a)) return null;
  const url = String(origin || '').replace(/\/$/, '') + '/calendar/?booked=' + b64url(JSON.stringify(o));
  const when = new Date(o.a * 60000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  return { url, mailto: booking.email ? 'mailto:' + booking.email + '?subject=' + encodeURIComponent('Booked: ' + o.t + ' with ' + o.g + ' (' + when + ')') + '&body=' + encodeURIComponent(o.g + ' picked ' + when + ' for ' + o.t + (o.n ? '.\n\n' + o.n : '.') + '\n\nAdd it to your calendar: ' + url) : '' };
}
/** what a ?booked= link carries: { title, host, guest, note, at, start, end } in this device's time, or null. Pure. */
export function readBooked(param) {
  let o; try { o = JSON.parse(unb64url(param)); } catch (_) { return null; }
  const minutes = Math.round(+(o && o.m)), at = Math.round(+(o && o.a));
  if (!o || !text(o.t, 120) || !text(o.g, 60) || !(minutes >= MIN && minutes <= MAX_MIN) || !Number.isFinite(at)) return null;
  return { title: text(o.t, 120), host: text(o.h, 60), guest: text(o.g, 60), note: text(o.n, 300), minutes, at, start: fmtLocal(new Date(at * 60000)), end: fmtLocal(new Date((at + minutes) * 60000)) };
}
/** the event a booking makes, for the host ('with <guest>') or the guest ('with <host>'); the same id on both sides, so it is added once. Pure. */
export function bookingEvent(b, side = 'host') {
  const who = side === 'host' ? b.guest : b.host;
  return normalize({ id: 'bk' + b.at.toString(36) + (b.guest || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8), title: b.title + (who ? ' with ' + who : ''), start: b.start, end: b.end, notes: b.note || '', reminders: [10] });
}

// ---- time insights: where the hours of a span went (Google Calendar's Time insights) ----
/** { total, events, byCal: [{ id, name, color, minutes }], byDay: [{ day, minutes }], busiest, longest, meetings } for timed events from
 *  fromDay (inclusive) for `days` days, all-day events left out, overlaps counted once each. Pure. */
export function timeInsights(events, cals, fromDay, days = 7) {
  const first = parseLocal(fromDay) || startOfDay(new Date()), lastKey = dayKey(addDays(first, days - 1));
  const occ = agenda(events, dayKey(first), lastKey).filter((o) => !o.allDay);
  const byCal = new Map(), byDay = new Map(); let total = 0, longest = null, meetings = 0;
  for (let i = 0; i < days; i++) byDay.set(dayKey(addDays(first, i)), 0);
  for (const o of occ) {
    const s = parseLocal(o.start), e = parseLocal(o.end); if (!s || !e || e <= s) continue;
    const mins = Math.round((e - s) / 60000), k = dayKey(s); if (!byDay.has(k)) continue;
    total += mins; byDay.set(k, byDay.get(k) + mins);
    const c = calendarOf(cals, o), cur = byCal.get(c.id) || { id: c.id, name: c.name, color: c.color, minutes: 0 }; cur.minutes += mins; byCal.set(c.id, cur);
    if (!longest || mins > longest.minutes) longest = { title: o.title, minutes: mins };
    if ((o.invitees || []).length || o.video) meetings++;
  }
  const dayList = [...byDay].map(([day, minutes]) => ({ day, minutes }));
  const busiest = dayList.reduce((a, b) => (b.minutes > (a ? a.minutes : 0) ? b : a), null);
  return { total, events: occ.length, byCal: [...byCal.values()].sort((a, b) => b.minutes - a.minutes), byDay: dayList, busiest: busiest && busiest.minutes ? busiest : null, longest, meetings };
}
/** "3 h 20 min". Pure. */
export const hm = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : r + ' min'; };
