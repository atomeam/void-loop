/**
 * weekday — day of week for a date. "what day is 2026-10-22", "weekday of July 4 1776".
 * Pure local calendar math; no network. Contract: { name, examples, nearMisses, match, run, suite }
 */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

export function parseDate(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
    return null;
  }
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const mo = +m[1] - 1, d = +m[2], y = +m[3];
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
    return null;
  }
  m = t.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()] != null) {
    const mo = MONTHS[m[1].toLowerCase()], d = +m[2], y = +m[3];
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
  }
  return null;
}

export function weekdayOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:what\s+)?(?:day|weekday)\s+(?:of\s+(?:the\s+week\s+)?)?(?:is|was|for)\s+(.+)$/i)
    || t.match(/^what\s+day\s+(?:of\s+the\s+week\s+)?(?:is|was)\s+(.+)$/i);
  if (!m) return null;
  const dt = parseDate(m[1].trim());
  if (!dt) return null;
  return { date: dt };
}

async function run(text, api) {
  const q = weekdayOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const name = DAYS[q.date.getDay()];
  const label = q.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(label) + '</h2>'
      + '<div style="font-size:40px;font-weight:300;margin:10px 0">' + esc(name) + '</div>'
      + '<p style="color:#8a8a8a">day of the week · local calendar</p>';
  });
  api.say(name);
  return 'weekday';
}

export default {
  name: 'weekday',
  examples: ['what day is 2026-10-22', 'weekday of July 4 1776', 'what day of the week is 12/25/2026'],
  nearMisses: ['weekday schedule', 'weekend plans', 'days of the week song'],
  match(lower, text) { return !!weekdayOf(text); },
  run,
  suite() {
    const a = weekdayOf('what day is 2026-10-22'), b = weekdayOf('weekend plans');
    // 2026-10-22 is Thursday
    return { ok: !!(a && a.date.getDay() === 4 && b === null) };
  },
};
