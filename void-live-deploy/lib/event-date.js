// When is a named event (owner's pasted card, 2026-10-17: "how many hours til gta6?" was answered "there's no official release date"
// while GTA VI had one, 19 November 2026). The model's own memory goes stale; the event's Wikipedia summary says the announced date.
// This reads it: the asks it takes, the search words for an event, and the announced future date in a summary. Pure; the skill
// (skills/event-countdown.js) fetches. Never a guess: no future date in the source means "no announced date", said as that.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON = MONTHS.join('|') + '|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
// what the plain countdown, the clock or the sky already answer: a weekday, a time of day, the sun, a holiday, a month and day
const NOT_EVENT = new RegExp('^(?:(?:the\\s+)?(?:weekend|morning|evening|tonight|tomorrow|noon|midnight|lunch|dinner|bedtime|sunrise|sunset|dawn|dusk|' +
  'new\\s+years?(?:\\s+(?:day|eve))?|christmas(?:\\s+(?:day|eve))?|halloween|thanksgiving|easter|valentines?(?:\\s+day)?|my\\s+.+|' +
  '(?:mon|tues|wednes|thurs|fri|satur|sun)day)|\\d.*|(?:' + MON + ')\\b.*)$', 'i');
const TAIL = /\s+(?:comes?\s+out|is\s+out|(?:is\s+)?(?:released?|launch(?:es|ed)?|drops?|starts?|begins?|premieres?|opens?)|release|launch|release\s+date|day)$/i;

/** the event an ask counts down to, { event, unit } or null: "how many hours til gta6", "how long until the world cup starts",
 *  "countdown to gta 6". Dates, holidays and times of day are left to the countdown, holidays and clock skills. Pure. */
export function eventAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/['’]til\b/i, 'til');
  const q = t.match(/^(?:how\s+(?:many|much)\s+(hours|days|weeks|minutes|months|time)|how\s+long)\s+(?:is\s+it\s+|is\s+left\s+|left\s+)?(?:until|til|till|before)\s+(.{2,60})$/i);
  const c = !q && t.match(/^(?:a\s+|start\s+a\s+)?countdown\s+(?:to|until|till|for)\s+(.{2,60})$/i);
  if (!q && !c) return null;
  const unit = q && q[1] && q[1].toLowerCase() !== 'time' ? q[1].toLowerCase() : 'hours';
  const event = (q ? q[2] : c[1]).replace(TAIL, '').replace(/^the\s+/i, '').trim();
  if (!event || event.length < 2 || NOT_EVENT.test(event)) return null;
  return { event, unit };
}

// short names people type for long titles: "gta6" is Grand Theft Auto VI; numbers to roman numerals for game and film sequels
const ALIASES = [[/^gta\s*(\d+|[ivx]+)$/i, (m) => 'Grand Theft Auto ' + roman(m[1])], [/^gta$/i, () => 'Grand Theft Auto']];
function roman(x) { const n = Number(x); if (!Number.isFinite(n)) return String(x).toUpperCase(); const R = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = '', v = n; for (const [k, r] of R) while (v >= k) { s += r; v -= k; } return s; }
/** the words to search Wikipedia for. Pure. */
export function searchWords(event) {
  const e = String(event || '').trim();
  for (const [re, f] of ALIASES) { const m = e.match(re); if (m) return f(m); }
  return e;
}

const NEAR = /\b(?:release[ds]?|releasing|launch(?:es|ed)?|premiere[ds]?|scheduled|slated|set\s+to|due|opens?|opening|begin[s]?|start[s]?|takes?\s+place|will\s+be\s+held|is\s+to\s+be|arriv)/i;
/** every date written in a text, with the sentence it is in: [{ date: Date (UTC midnight), sentence }]. Pure. */
export function datesIn(text) {
  const out = [], s = String(text || '');
  for (const sentence of s.split(/(?<=[.!?])\s+/)) {
    const re = new RegExp('\\b(?:(\\d{1,2})\\s+(' + MON + ')\\.?,?\\s+(\\d{4})|(' + MON + ')\\.?\\s+(\\d{1,2}),?\\s+(\\d{4}))\\b', 'gi');
    for (const m of sentence.matchAll(re)) {
      const day = Number(m[1] || m[5]), mon = (m[2] || m[4]).toLowerCase().slice(0, 3), year = Number(m[3] || m[6]);
      const mi = MONTHS.findIndex((x) => x.startsWith(mon));
      const d = new Date(Date.UTC(year, mi, day));
      if (mi >= 0 && d.getUTCDate() === day) out.push({ date: d, sentence: sentence.trim() });
    }
  }
  return out;
}

/** the announced date of what a summary describes, the first one still ahead, preferring a sentence that says it is a release, a
 *  launch, a start: { date, sentence } or null when the source names no future date. Pure. */
export function announcedDate(text, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ahead = datesIn(text).filter((d) => d.date.getTime() >= today);
  if (!ahead.length) return null;
  const said = ahead.filter((d) => NEAR.test(d.sentence));
  const pick = (said.length ? said : ahead).sort((a, b) => a.date - b.date)[0];
  return pick;
}

/** the time left from now to the start of that day where you are: { ms, days, hours, minutes, totalHours }. Pure. */
export function left(date, now = new Date()) {
  const local = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()); // the day begins at local midnight
  const ms = Math.max(0, local - now), totalMinutes = Math.floor(ms / 60000);
  return { ms, days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60, totalHours: Math.floor(totalMinutes / 60) };
}
