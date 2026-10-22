/**
 * Calendar file (asked for in the owner's "things to learn as a website" list: "provide calendar integration (iCal, Google Calendar)"):
 * the events of this browser's agenda (skills/calendar.js) as one standard .ics file (RFC 5545) that any calendar app imports. Nothing is
 * sent anywhere: the file is built on this device. Timed events are written in UTC, all-day ones as dates; lines are folded at 75 bytes.
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
/** a time zone name worth writing (IANA style like America/New_York or UTC), else ''. Pure. */
export const tzName = (tz) => (/^(?:UTC|[A-Z][A-Za-z_+-]{1,30}(?:\/[A-Za-z0-9_+-]{1,30}){1,2})$/.test(String(tz || '')) ? String(tz) : '');
/** the whole calendar text, CRLF line ends; null when there is nothing to write. tz (asked by Verse, 'time-zone-detect'): the browser's
 * own zone, written as X-WR-TIMEZONE so an importing app files the calendar under it; times stay absolute UTC, so every app shows them
 * at the reader's local time. */
export function icsOf(rows, now = new Date(), { tz = '' } = {}) {
  const ev = eventsOf(rows);
  if (!ev.length) return null;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//a-to-mind//Verse agenda//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (tzName(tz)) lines.push('X-WR-TIMEZONE:' + tzName(tz));
  ev.forEach((e, i) => {
    lines.push('BEGIN:VEVENT', 'UID:' + (e.id || 'e' + i) + '-' + utc(e.at) + '@a-to-mind.com', 'DTSTAMP:' + utc(now));
    if (e.allDay) { const next = new Date(e.at.getFullYear(), e.at.getMonth(), e.at.getDate() + 1); lines.push('DTSTART;VALUE=DATE:' + day(e.at), 'DTEND;VALUE=DATE:' + day(next)); }
    else lines.push('DTSTART:' + utc(e.at), 'DTEND:' + utc(new Date(e.at.getTime() + 3600e3)));
    lines.push('SUMMARY:' + escText(e.title), 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
