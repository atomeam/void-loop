// contradict — which kept things on the stage cannot both be true (asked by the owner, 2026-10-18, stage pack G). Pure and honest: it
// reads only the words and fields of the things handed in, finds four plain kinds of clash, and says nothing when it is not sure.
//   when      two things name the same event or deadline with two different days (both weekdays, both month-days, both ISO dates) or,
//             on the same or an unstated day, two different times of day
//   number    two things give the same label two different numbers in the same unit ("budget: 500" / "budget is 800")
//   timer     two timers, countdowns or clocks carry the same label and disagree (duration, target, zone)
//   decision  "yes to X" / "no to X", "do X" / "don't X" on the same subject
// A claim with no subject, a number with no label, a pair inside one thing, or two different units is never a contradiction.
// No DOM, no clock, no network: tools/stage-pack-g.test.mjs runs it on fixtures both ways.

const STOP = new Set('the a an my our your their is are was were be been am on at by to of for in this that it its due moved changed now will with and or as from has have had set only about around next'.split(' '));
const WEEK = { mon: 'mon', monday: 'mon', tue: 'tue', tues: 'tue', tuesday: 'tue', wed: 'wed', wednesday: 'wed', thu: 'thu', thur: 'thu', thurs: 'thu', thursday: 'thu', fri: 'fri', friday: 'fri', sat: 'sat', saturday: 'sat', sun: 'sun', sunday: 'sun' };
const MONTH = { jan: 'jan', january: 'jan', feb: 'feb', february: 'feb', mar: 'mar', march: 'mar', apr: 'apr', april: 'apr', may: 'may', jun: 'jun', june: 'jun', jul: 'jul', july: 'jul', aug: 'aug', august: 'aug', sep: 'sep', sept: 'sep', september: 'sep', oct: 'oct', october: 'oct', nov: 'nov', november: 'nov', dec: 'dec', december: 'dec' };
const WEEK_RE = '(?:' + Object.keys(WEEK).sort((a, b) => b.length - a.length).join('|') + ')';
const MON_RE = '(?:' + Object.keys(MONTH).sort((a, b) => b.length - a.length).join('|') + ')';

const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
/** the content words of a subject, sorted, as one key ('' when there are none worth comparing). Pure. */
export function keyOf(s) {
  const w = words(s).map((x) => x.replace(/'s$/, '')).filter((x) => !STOP.has(x) && x.length > 1 && !/^\d+$/.test(x));
  return w.some((x) => x.length >= 3) ? [...new Set(w)].sort().join(' ') : '';
}
const strip = (html) => String(html == null ? '' : html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** a thing's words: its text, name, title, label and (kept cards) the plain text of its html. Pure. */
export function textOfThing(t) {
  if (!t) return '';
  const parts = [t.text, t.name, t.title, t.label, t.html ? strip(t.html) : ''].filter((x) => typeof x === 'string' && x.trim());
  return [...new Set(parts.map((x) => x.trim()))].join('\n');
}
/** the claims in a text: its lines, split again at sentence ends and semicolons. Pure. */
export const claimsOf = (text) => String(text || '').split(/\n+|(?<=[.!?;])\s+/).map((c) => c.replace(/[.!?;]+$/, '').trim()).filter((c) => c.length > 2 && c.length < 240);

/** the day a claim names, as { k: 'week'|'md'|'iso', v } plus the claim with that phrase taken out. Pure. */
export function dayIn(c) {
  let m = /\b(20\d\d)-(\d\d)-(\d\d)\b/.exec(c);
  if (m) return { k: 'iso', v: m[1] + '-' + m[2] + '-' + m[3], rest: c.replace(m[0], ' ') };
  m = new RegExp('\\b(' + MON_RE + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b', 'i').exec(c) || null;
  if (m) return { k: 'md', v: MONTH[m[1].toLowerCase()] + ' ' + +m[2], rest: c.replace(m[0], ' ') };
  m = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(' + MON_RE + ')\\b', 'i').exec(c);
  if (m) return { k: 'md', v: MONTH[m[2].toLowerCase()] + ' ' + +m[1], rest: c.replace(m[0], ' ') };
  m = new RegExp('\\b(' + WEEK_RE + ')\\b', 'i').exec(c);
  if (m) return { k: 'week', v: WEEK[m[1].toLowerCase()], rest: c.replace(m[0], ' ') };
  return null;
}
/** the time of day a claim names, in minutes after midnight ("3pm", "15:30", "9:05 am"), plus the claim with it taken out. Pure. */
export function timeIn(c) {
  let m = /\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i.exec(c);
  if (m && +m[1] >= 1 && +m[1] <= 12) { const h = (+m[1] % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0); return { v: h * 60 + (m[2] ? +m[2] : 0), rest: c.replace(m[0], ' ') }; }
  m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(c);
  if (m) return { v: +m[1] * 60 + +m[2], rest: c.replace(m[0], ' ') };
  return null;
}
const hhmm = (v) => { const h = Math.floor(v / 60), mm = v % 60, ap = h >= 12 ? 'pm' : 'am'; return ((h % 12) || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + ap; };
const dayWords = (d) => (d.k === 'week' ? d.v : d.v);

/** the facts of one claim: [{ kind, key, ... }]. Pure. */
export function factsOf(claim) {
  const out = [], c = String(claim || '').trim();
  const day = dayIn(c), rest0 = day ? day.rest : c, time = timeIn(rest0), rest = time ? time.rest : rest0;
  if (day || time) {
    const key = keyOf(rest.replace(/\b(?:at|on|by|until|till|before|after)\b/gi, ' '));
    if (key) out.push({ kind: 'when', key, day: day ? { k: day.k, v: day.v } : null, time: time ? time.v : null, quote: c });
    return out;
  }
  let m = /^(.*?)\s*(?::|=|\bis\b|\bcosts?\b|\bat\b)\s*([$€£]?)\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*([a-z%]{1,12})?\s*$/i.exec(c);
  if (m && !/^\d/.test(m[1].trim())) {
    const key = keyOf(m[1]), unit = (m[2] || '') + (m[5] && !STOP.has(m[5].toLowerCase()) ? m[5].toLowerCase() : '');
    const n = parseFloat(m[3].replace(/,/g, '')) * (m[4] ? (m[4].toLowerCase() === 'k' ? 1e3 : 1e6) : 1);
    if (key && Number.isFinite(n)) out.push({ kind: 'number', key, n, unit, quote: c });
    return out;
  }
  m = /^(?:decision\s*:\s*)?(yes|do|approve|approved|no|don'?t|do not|never|reject|rejected)\b[\s,:\-]*(?:to|on|with|for)?\s*(.+)$/i.exec(c);
  if (m) {
    const key = keyOf(m[2]), pos = /^(yes|do|approve|approved)$/i.test(m[1]);
    if (key) out.push({ kind: 'decision', key, pos, quote: c });
  }
  return out;
}

const idOf = (t, i) => String((t && t.id) || 'thing' + i);
/** a short name for a thing in a line. Pure. */
export const nameOfThing = (t) => {
  if (!t) return 'thing';
  const w = t.name || t.title || t.label || (typeof t.text === 'string' && t.text.trim() ? '\u201c' + t.text.trim().split(/\n/)[0].slice(0, 22) + '\u201d' : '') || t.kind || 'thing';
  return String(w).replace(/\s+/g, ' ').slice(0, 28);
};
const dur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 && m % 60 === 0 ? m / 60 + ' h' : m + ' min'; };

/** the pairs of things that cannot both be true: [{ id, a, b, kind, label, line }], a and b being thing ids. Pure. */
export function contradictions(things) {
  const list = (Array.isArray(things) ? things : Object.values(things || {})).filter((t) => t && typeof t === 'object');
  const facts = [], seen = new Set(), pairs = [];
  list.forEach((t, i) => {
    const id = idOf(t, i), name = nameOfThing(t);
    for (const claim of claimsOf(textOfThing(t))) for (const f of factsOf(claim)) facts.push({ ...f, id, name });
    const lab = keyOf(t.label || t.name || '');
    if (lab && ['timer', 'countdown', 'clock'].includes(t.kind)) {
      const v = t.kind === 'timer' ? (Number.isFinite(t.duration) && t.duration > 0 ? t.duration : null) : t.kind === 'clock' ? (t.tz || t.zone || null) : (t.target || t.at || t.date || null);
      if (v != null) facts.push({ kind: 'timer', key: lab, thing: t.kind, v, id, name });
    }
  });
  const push = (x, y, kind, key, label, line) => {
    const ids = [x.id, y.id].sort(), pid = ids.join('|') + '|' + kind + '|' + key;
    if (seen.has(pid)) return; seen.add(pid);
    pairs.push({ id: pid, a: x.id, b: y.id, kind, label, line });
  };
  for (let i = 0; i < facts.length; i++) for (let j = i + 1; j < facts.length; j++) {
    const x = facts[i], y = facts[j];
    if (x.id === y.id || x.kind !== y.kind || x.key !== y.key) continue;
    const who = 'the ' + x.name + ' and the ' + y.name;
    if (x.kind === 'when') {
      const sameDay = x.day && y.day && x.day.k === y.day.k;
      if (sameDay && x.day.v !== y.day.v) push(x, y, 'when', x.key, 'two days', who + ' give "' + x.key + '" two days: ' + dayWords(x.day) + ' and ' + dayWords(y.day));
      else if (x.time != null && y.time != null && x.time !== y.time && (!x.day || !y.day || (sameDay && x.day.v === y.day.v))) push(x, y, 'when', x.key, 'two times', who + ' give "' + x.key + '" two times: ' + hhmm(x.time) + ' and ' + hhmm(y.time));
    } else if (x.kind === 'number') {
      if (x.unit === y.unit && x.n !== y.n) push(x, y, 'number', x.key, 'two numbers', who + ' give "' + x.key + '" two numbers: ' + x.n + (x.unit ? ' ' + x.unit : '') + ' and ' + y.n + (y.unit ? ' ' + y.unit : ''));
    } else if (x.kind === 'timer') {
      if (x.thing === y.thing && String(x.v) !== String(y.v)) push(x, y, 'timer', x.key, 'two ' + x.thing + 's', who + ' share the label "' + x.key + '" but disagree: ' + (x.thing === 'timer' ? dur(x.v) + ' and ' + dur(y.v) : x.v + ' and ' + y.v));
    } else if (x.kind === 'decision') {
      if (x.pos !== y.pos) push(x, y, 'decision', x.key, 'yes and no', who + ' decide "' + x.key + '" both ways: ' + (x.pos ? 'yes' : 'no') + ' and ' + (y.pos ? 'yes' : 'no'));
    }
  }
  return pairs;
}

/** the pairs not yet dismissed (a Set of pair ids). Pure. */
export const visible = (pairs, dismissed) => pairs.filter((p) => !(dismissed && dismissed.has(p.id)));

/** "what contradicts" and its plain variants, nothing about anything else: true for the ask. Pure. */
export const contradictsAsk = (text) => /^(?:so,?\s+)?(?:what|which\s+(?:of\s+)?(?:my\s+)?(?:things|cards|notes))\s+(?:on\s+(?:the\s+|my\s+)?stage\s+)?contradicts?(?:\s+(?:what|which|each\s+other))?(?:\s+(?:on|in)\s+(?:the\s+|my\s+)?stage)?$|^(?:what|anything)\s+contradicts?\s+(?:on\s+)?(?:my\s+|the\s+)?(?:stage|things|cards|notes)$|^(?:do\s+)?(?:any\s+of\s+)?(?:my\s+)?(?:things|cards|notes)\s+(?:on\s+the\s+stage\s+)?contradict(?:\s+each\s+other)?$|^contradiction\s+lamp$/.test(String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
