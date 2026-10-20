/**
 * Calendar file (asked for in the owner's "things to learn as a website" list: "provide calendar integration (iCal, Google Calendar)"):
 * the events of this browser's agenda (skills/calendar.js) as one standard .ics file (RFC 5545) that any calendar app imports. Nothing is
 * sent anywhere: the file is built on this device. Timed events are written in the browser's time zone (TZID and its VTIMEZONE) or else UTC, all-day ones as dates; lines are folded at 75 bytes.
 * Pure.
 */
const pad = (n, w = 2) => String(n).padStart(w, '0');
const utc = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
const day = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
/** text values: backslash, semicolon, comma and newlines escaped, control characters dropped. */
export const escText = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
/** one content line folded at 75 bytes with a leading space on each continuation (never inside a multi-byte character). */
export function fold(line) {
  const out = []; let cur = '', bytes = 0, limit = 75;
  for (const ch of String(line)) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}
/** the events that are well formed: { title, at: Date, allDay }, newest-first order kept as given. */
export function eventsOf(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    if (!r || typeof r !== 'object') return null;
    const at = new Date(r.at), title = String(r.title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    return title && !isNaN(at.getTime()) ? { id: String(r.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40), title, at, allDay: r.allDay === true } : null;
  }).filter(Boolean).slice(0, 500);
}
// Time zone (asked by Verse, 2026-10-18: "Add a 'time-zone-detect' skill to the export so .ics files are automatically adjusted to the
// user's local browser time"): given the browser's IANA zone (Intl), timed events are written as local wall time with TZID, and the file
// carries that zone's VTIMEZONE (RFC 5545 3.6.5), its offsets and every change of offset across the events' span read from Intl, so a
// calendar app shows them at the hour they were set even after a clock change or on another device. Without a usable zone: UTC, as before.
const DAY_MS = 864e5;
const fmts = new Map();
function partsAt(ms, tz) {
  let f = fmts.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); fmts.set(tz, f); }
  const p = {}; for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}
/** the zone's offset from UTC in minutes at an instant. */
export function offsetAt(ms, tz) { const t = Math.floor(ms / 1000) * 1000, p = partsAt(t, tz); return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - t) / 6e4); }
const wall = (ms) => { const d = new Date(ms); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()); };
/** local wall time in the zone: YYYYMMDDTHHMMSS. */
export const localStamp = (ms, tz) => wall(Math.floor(ms / 1000) * 1000 + offsetAt(ms, tz) * 6e4);
const offText = (m) => (m < 0 ? '-' : '+') + pad(Math.floor(Math.abs(m) / 60)) + pad(Math.abs(m) % 60);
/** the zone name when Intl knows it and it is not plain UTC; null otherwise (then the file stays in UTC). */
export function zoneOf(tz) {
  const z = String(tz || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_+\-]*(?:\/[A-Za-z0-9_+\-]+){0,2}$/.test(z) || /^(?:Etc\/)?(?:UTC|GMT|Zulu|UCT|Universal)$/i.test(z)) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return z; } catch (_) { return null; }
}
/** the VTIMEZONE lines for the zone across [from, to] (ms): one observance from a day before the first event, then one per change of offset,
 *  each found to the minute; DAYLIGHT when the new offset is above the year's lower one. At most 20 years are walked. */
export function vtimezone(tz, from, to) {
  const start = from - DAY_MS, end = Math.min(to + DAY_MS, start + 20 * 365 * DAY_MS), o0 = offsetAt(start, tz);
  const std = (ms) => { const y = new Date(ms).getUTCFullYear(); return Math.min(offsetAt(Date.UTC(y, 0, 1), tz), offsetAt(Date.UTC(y, 6, 1), tz)); };
  const obs = (ms, from, to) => [to > std(ms) ? 'DAYLIGHT' : 'STANDARD', wall(ms + from * 6e4), from, to];
  const list = [obs(start, o0, o0)];
  for (let t = start, o = o0; t < end; t += DAY_MS) {
    const o2 = offsetAt(t + DAY_MS, tz);
    if (o2 === o) continue;
    let lo = t, hi = t + DAY_MS; while (hi - lo > 6e4) { const mid = lo + Math.max(1, Math.floor((hi - lo) / 12e4)) * 6e4; if (offsetAt(mid, tz) === o) lo = mid; else hi = mid; }
    list.push(obs(hi, o, o2)); o = o2;
  }
  const out = ['BEGIN:VTIMEZONE', 'TZID:' + tz];
  for (const [kind, at, f, t] of list) out.push('BEGIN:' + kind, 'DTSTART:' + at, 'TZOFFSETFROM:' + offText(f), 'TZOFFSETTO:' + offText(t), 'END:' + kind);
  out.push('END:VTIMEZONE');
  return out;
}
/** the whole calendar text, CRLF line ends; null when there is nothing to write. tz: the browser's IANA zone (optional). */
export function icsOf(rows, now = new Date(), { tz } = {}) {
  const ev = eventsOf(rows);
  if (!ev.length) return null;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//a-to-mind//Verse agenda//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const zone = zoneOf(tz), timed = ev.filter((e) => !e.allDay).map((e) => e.at.getTime());
  if (zone && timed.length) lines.push('X-WR-TIMEZONE:' + zone, ...vtimezone(zone, Math.min(...timed), Math.max(...timed) + 3600e3));
  ev.forEach((e, i) => {
    lines.push('BEGIN:VEVENT', 'UID:' + (e.id || 'e' + i) + '-' + utc(e.at) + '@a-to-mind.com', 'DTSTAMP:' + utc(now));
    if (e.allDay) { const next = new Date(e.at.getFullYear(), e.at.getMonth(), e.at.getDate() + 1); lines.push('DTSTART;VALUE=DATE:' + day(e.at), 'DTEND;VALUE=DATE:' + day(next)); }
    else if (zone) lines.push('DTSTART;TZID=' + zone + ':' + localStamp(e.at.getTime(), zone), 'DTEND;TZID=' + zone + ':' + localStamp(e.at.getTime() + 3600e3, zone));
    else lines.push('DTSTART:' + utc(e.at), 'DTEND:' + utc(new Date(e.at.getTime() + 3600e3)));
    lines.push('SUMMARY:' + escText(e.title), 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
