// Subscribing to a calendar by its address (an iCal feed: Google's "secret address in iCal format", a team's or a school's .ics, a sports
// fixture list), the way Google Calendar, Outlook and Teamup do. The page cannot read most feeds itself (they do not allow other sites to), so
// Verse's server reads it (functions/api/icsfeed.js) and hands back only the events, never the file. Pure. Tests: tools/icsfeed.test.mjs.
export const FEED = Object.freeze({ bytes: 2000000, events: 3000, timeoutMs: 8000, cacheSecs: 1800, perMinute: 20 });
/** the https address to read for what a person pasted (webcal:// is the same address over https), or null for anything else: no
 *  credentials, no port, no bare IP address, no single-label or local name, nothing on Verse itself. Pure. */
export function feedUrl(raw) {
  let s = String(raw || '').trim(); if (!s || s.length > 1000) return null;
  s = s.replace(/^webcals?:\/\//i, 'https://'); if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch (_) { return null; }
  if (u.protocol === 'http:') u.protocol = 'https:';
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || /^\[|^\d+(?:\.\d+){3}$|^0x/i.test(h) || /(?:^|\.)(?:localhost|local|internal|lan|home|arpa|test|example|invalid)$/.test(h)) return null;
  if (/(?:^|\.)a-to-mind\.com$/.test(h)) return null;
  u.hash = ''; return u.toString();
}
/** the calendar's own name in the file (X-WR-CALNAME), else ''. Pure. */
export function calNameOf(text) {
  const m = /^X-WR-CALNAME(?:;[^:\r\n]*)?:(.*)$/im.exec(String(text || '')); return m ? m[1].replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim().slice(0, 60) : '';
}
/** a short name for a feed with none of its own: its site ("calendar.google.com" -> "google.com"). Pure. */
export const hostName = (url) => { try { return new URL(url).hostname.replace(/^(?:www|calendar|cal|ics|ical)\./, '').slice(0, 60); } catch (_) { return 'Calendar'; } };
