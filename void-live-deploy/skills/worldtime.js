/**
 * worldtime skill — the time anywhere, converting a time between two places, sunrise and sunset. Open-Meteo, no key
 * Contract: { name, examples, match(lower, text), run(text, api) }
 * Places and time zones come from Open-Meteo geocoding; sunrise and sunset from the Open-Meteo forecast. Clock math uses the
 * browser's own time-zone data (Intl), so nothing else is called.
 */
const CLEAN = (s) => s.replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
const PLACE = (s) => CLEAN(s).replace(/^(the\s+)/i, '').replace(/\s+(right\s+)?now$/i, '').replace(/\s+(today|tomorrow)$/i, '').trim();
const NOT_PLACE = /^(it|this|that|here|there|my\s+\w+|the\s+\w+\s+zone|a\s+\w+|\d+.*)$/i;
const TIME = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|\\d{1,2}:\\d{2}|noon|midnight)';

// One ask -> { kind: 'now' | 'convert' | 'sun', ... } or null. Only asks that name a place (or two) are ours.
export function parseWorldTime(text) {
  const t = CLEAN(text || '');
  let m = t.match(/^(?:(?:what|what's|whats)\s+(?:is\s+)?)?(?:the\s+)?(?:current\s+|local\s+)?time\s+(?:is\s+it\s+)?(?:right\s+now\s+)?(?:in|at)\s+(.+)$/i)
    || t.match(/^what\s+time\s+is\s+it\s+(?:right\s+now\s+)?(?:in|at)\s+(.+)$/i)
    || t.match(/^(?:current|local)\s+time\s+(?:in|at|for)\s+(.+)$/i);
  if (m) { const place = PLACE(m[1]); return place && !NOT_PLACE.test(place) ? { kind: 'now', place } : null; }
  m = t.match(new RegExp('^(?:convert\\s+|what\\s+is\\s+|what\'s\\s+)?' + TIME + '\\s+(?:in\\s+)?(.+?)\\s+(?:to|in)\\s+(.+?)(?:\\s+time)?$', 'i'));
  if (m) {
    const from = PLACE(m[2]), to = PLACE(m[3]);
    if (from && to && !NOT_PLACE.test(from) && !NOT_PLACE.test(to)) return { kind: 'convert', time: m[1].toLowerCase().replace(/\./g, '').replace(/\s+/g, ''), from, to };
    return null;
  }
  m = t.match(/^(?:(?:when|what\s+time)\s+is\s+|what's\s+|whats\s+)?(?:the\s+)?(?:(today's|tomorrow's)\s+)?(sunrise|sunset|sun\s+rise|sun\s+set|dawn|dusk)\s+(?:(?:today|tomorrow)\s+)?(?:in|at|for)\s+(.+)$/i)
    || t.match(/^(?:(when)\s+)?does\s+the\s+sun\s+(rise|set)\s+(?:(?:today|tomorrow)\s+)?(?:in|at)\s+(.+)$/i);
  if (m) {
    const which = /rise|dawn/i.test(m[2]) ? 'sunrise' : 'sunset', place = PLACE(m[3]);
    const tomorrow = /tomorrow/i.test(t);
    return place && !NOT_PLACE.test(place) ? { kind: 'sun', which, place, tomorrow } : null;
  }
  return null;
}

// The UTC offset (minutes) of a time zone at a given instant, from Intl alone.
function offsetMin(tz, at) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const g = (k) => +parts.find((p) => p.type === k).value;
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - at.getTime()) / 60000);
}
// Wall-clock y-m-d h:m in tz -> the real instant (checked twice, so a DST change in between still lands right).
function instantIn(tz, y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo, d, h, mi);
  let at = new Date(guess - offsetMin(tz, new Date(guess)) * 60000);
  at = new Date(guess - offsetMin(tz, at) * 60000);
  return at;
}
function ymdIn(tz, at) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at).split('-');
  return [+p[0], +p[1] - 1, +p[2]];
}
function parseClock(s) {
  if (s === 'noon') return [12, 0];
  if (s === 'midnight') return [0, 0];
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = +m[1]; const mi = +(m[2] || 0);
  if (m[3]) { if (h < 1 || h > 12) return null; h = (h % 12) + (m[3] === 'pm' ? 12 : 0); }
  if (h > 23 || mi > 59) return null;
  return [h, mi];
}
const fmtTime = (tz, at) => new Intl.DateTimeFormat([], { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(at);
const fmtDay = (tz, at) => new Intl.DateTimeFormat([], { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(at);
const gmt = (min) => 'UTC' + (min >= 0 ? '+' : '−') + Math.floor(Math.abs(min) / 60) + (Math.abs(min) % 60 ? ':' + String(Math.abs(min) % 60).padStart(2, '0') : '');
function diffWords(min) {
  if (!min) return 'same time as you';
  const h = Math.abs(min) / 60, n = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(/\.0$/, '');
  return n + (h === 1 ? ' hour ' : ' hours ') + (min > 0 ? 'ahead of you' : 'behind you');
}
const label = (r) => r.name + (r.admin1 && r.admin1 !== r.name ? ', ' + r.admin1 : '') + (r.country ? ', ' + r.country : '');
const SRC = '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (place and time zone) · clock from your browser</div>';

async function geo(name) {
  const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=' + encodeURIComponent(name)).then((r) => r.json());
  const rs = (g.results || []).filter((r) => r.timezone).sort((a, b) => (b.population || 0) - (a.population || 0));
  return rs[0] || null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseWorldTime(text);
  if (!q) return 'none';
  const title = q.kind === 'convert' ? q.time + ' ' + q.from + ' → ' + q.to : q.kind === 'sun' ? q.which[0].toUpperCase() + q.which.slice(1) + ' in ' + q.place : 'Time in ' + q.place;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">…</div>'; });
  const missing = (n) => { el.innerHTML = '<h2>' + esc(title) + '</h2><p>I couldn\'t find "' + esc(n) + '". Try a city name, like "time in Tokyo".</p>'; return 'none'; };
  try {
    const now = new Date(), youTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (q.kind === 'now') {
      const r = await geo(q.place);
      if (!api._pageStill(el)) return 'worldtime';
      if (!r) return missing(q.place);
      const off = offsetMin(r.timezone, now), youOff = offsetMin(youTz, now);
      el.innerHTML = '<h2 class="wt">' + esc(label(r)) + '</h2>'
        + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(fmtTime(r.timezone, now)) + '</div>'
        + '<div class="sub">' + esc(fmtDay(r.timezone, now)) + ' · ' + esc(r.timezone.replace(/_/g, ' ')) + ' · ' + gmt(off) + ' · ' + esc(diffWords(off - youOff)) + '</div>'
        + SRC;
      return 'worldtime';
    }
    if (q.kind === 'convert') {
      const hm = parseClock(q.time);
      const [a, b] = await Promise.all([geo(q.from), geo(q.to)]);
      if (!api._pageStill(el)) return 'worldtime';
      if (!hm) { el.innerHTML = '<h2>' + esc(title) + '</h2><p>"' + esc(q.time) + '" isn\'t a time I can read. Try "3pm London to Tokyo".</p>'; return 'none'; }
      if (!a) return missing(q.from);
      if (!b) return missing(q.to);
      const [y, mo, d] = ymdIn(a.timezone, now);
      const at = instantIn(a.timezone, y, mo, d, hm[0], hm[1]);
      const dayA = ymdIn(a.timezone, at).join('-'), dayB = ymdIn(b.timezone, at).join('-');
      const shift = dayA === dayB ? '' : (dayB > dayA ? ' (next day)' : ' (day before)');
      el.innerHTML = '<div class="sub wt">' + esc(fmtTime(a.timezone, at)) + ' in ' + esc(label(a)) + ' is</div>'
        + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(fmtTime(b.timezone, at)) + '</div>'
        + '<div class="sub">in ' + esc(label(b)) + ' · ' + esc(fmtDay(b.timezone, at)) + esc(shift) + ' · ' + gmt(offsetMin(a.timezone, at)) + ' → ' + gmt(offsetMin(b.timezone, at)) + '</div>'
        + SRC;
      return 'worldtime';
    }
    // sunrise / sunset
    const r = await geo(q.place);
    if (!api._pageStill(el)) return 'worldtime';
    if (!r) return missing(q.place);
    const w = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + r.latitude + '&longitude=' + r.longitude + '&daily=sunrise,sunset&timezone=' + encodeURIComponent(r.timezone) + '&forecast_days=2').then((x) => x.json());
    if (!api._pageStill(el)) return 'worldtime';
    const days = (w.daily && w.daily.time) || [], list = (w.daily && w.daily[q.which]) || [];
    if (!list.length) throw new Error('no sun times');
    const toInstant = (s) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return instantIn(r.timezone, +m[1], +m[2] - 1, +m[3], +m[4], +m[5]); };
    let i = q.tomorrow ? 1 : 0;
    if (!q.tomorrow && list[1] && toInstant(list[0]) < now) i = 1; // today's already passed: show the next one
    const at = toInstant(list[i] || list[0]);
    const other = q.which === 'sunrise' ? 'sunset' : 'sunrise', o = w.daily[other] && w.daily[other][i];
    el.innerHTML = '<h2 class="wt">' + esc(q.which === 'sunrise' ? 'Sunrise' : 'Sunset') + ' · ' + esc(label(r)) + '</h2>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(fmtTime(r.timezone, at)) + '</div>'
      + '<div class="sub">' + esc(fmtDay(r.timezone, at)) + (i && !q.tomorrow ? ' (today\'s has passed)' : '') + ' · local time, ' + esc(r.timezone.replace(/_/g, ' '))
      + (o ? ' · ' + other + ' ' + esc(fmtTime(r.timezone, toInstant(o))) : '') + '</div>'
      + '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></div>';
    return 'worldtime';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>The time service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'worldtime',
  examples: ['time in Tokyo', '3pm London to Tokyo', 'sunset in Paris', 'when is sunrise in New York', 'what time is it in Sydney'],
  nearMisses: ['make a clock', 'make a 5 minute timer', 'what is time', 'set a timer for 3pm', 'time zones explained'],
  match(lower, text) { return !!parseWorldTime(text); },
  run
};
