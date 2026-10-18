// eclipse — hide a whole family of skills from routing until a time passes (asked by the owner, 2026-10-18, stage pack G: skill-eclipse).
// Pure: the parsing of "eclipse media skills until friday" / "for an hour", the family words, the entries kept on this device and which
// skill names they hide. The router (void.html firstSkill) reads the kept entries and skips those names; skills/skill-eclipse.js draws
// the chips. Never hidden, whatever is asked: skill-eclipse itself, guide, status and stage, so the person can always lift it, and the
// whole "stage" family is refused for the same reason. tools/stage-pack-g.test.mjs tests every function here.
import { read, write } from './state.js';

export const PROTECTED = new Set(['skill-eclipse', 'guide', 'status', 'stage']);
export const MAX_MS = 30 * 864e5;
/** the words people use for a family: the family's id, and the common word for it. */
export const ALIAS = { media: 'words', money: 'numbers', numbers: 'numbers', maths: 'numbers', math: 'numbers', games: 'games', game: 'games', time: 'time', clocks: 'time', body: 'body', health: 'body', mind: 'body', sky: 'sky', weather: 'sky', space: 'sky', words: 'words', news: 'words', make: 'make', making: 'make', life: 'life', self: 'self', stage: 'stage' };
const DAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const DAY3 = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const UNIT_MS = { minute: 6e4, min: 6e4, hour: 36e5, hr: 36e5, day: 864e5, week: 6048e5 };
const clean = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

/** { until: ms, how: 'until fri' | 'for 2 h' } for "until friday", "till fri", "until tomorrow", "for an hour", "for 30 minutes", "for 3 days"; null if not understood. Pure. */
export function parseUntil(span, now = Date.now()) {
  const s = clean(span).replace(/^for the next\s+(?=\d|[a-z]+s\b)/, 'for ').replace(/^for the next\s+/, 'for a ');
  let m = /^(?:until|till|til|by)\s+(?:next\s+)?([a-z]+)$/.exec(s);
  if (m) {
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    if (m[1] === 'tomorrow') { d0.setDate(d0.getDate() + 1); return { until: d0.getTime(), how: 'until tomorrow' }; }
    if (!(m[1] in DAYS)) return null;
    let add = (DAYS[m[1]] - d0.getDay() + 7) % 7; if (add === 0) add = 7;
    d0.setDate(d0.getDate() + add);
    const until = d0.getTime();
    return until - now > MAX_MS ? null : { until, how: 'until ' + DAY3[DAYS[m[1]]] };
  }
  m = /^for\s+(?:half an hour|(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?))$/.exec(s);
  if (m) {
    const ms = m[1] ? (isNaN(+m[1]) ? NUM[m[1]] : +m[1]) * UNIT_MS[m[2].replace(/s$/, '')] : 18e5;
    if (!(ms > 0) || ms > MAX_MS) return null;
    return { until: now + ms, how: 'for ' + (m[1] ? m[1] + ' ' + m[2] : 'half an hour') };
  }
  return null;
}

/** the family ids named by "media", "media and money", "games, time": null when any word is not a family word. Pure. */
export function familiesIn(phrase) {
  const parts = clean(phrase).split(/\s*(?:,|&|\band\b)\s*/).filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  const ids = [];
  for (const p of parts) { const id = ALIAS[p.replace(/^the\s+/, '')]; if (!id) return null; if (!ids.includes(id)) ids.push(id); }
  return ids;
}
/** { act: 'set', ids, words, span } | { act: 'lift' } | null. Pure. */
export function eclipseOf(text) {
  const t = clean(text);
  if (/^(?:lift|end|stop|cancel|remove|clear|undo)\s+(?:the\s+|all\s+)?eclipses?$/.test(t) || /^(?:lift|end)\s+(?:the\s+)?eclipse\s+(?:now|early)$/.test(t)) return { act: 'lift' };
  const m = /^eclipse\s+(?:the\s+)?(.+?)\s+skills?(?:\s+((?:for|until|till|til|by)\s+.+))?$/.exec(t);
  if (!m) return null;
  const ids = familiesIn(m[1]);
  return ids ? { act: 'set', ids, words: m[1], span: m[2] || null } : null;
}

/** the skill names of the families (families.json, { families: [{ id, skills: [...] }] }), never a protected one. Pure. */
export function namesFor(familiesJson, ids) {
  const out = new Set();
  for (const f of (familiesJson && familiesJson.families) || []) if (ids.includes(f.id)) for (const s of f.skills || []) { const n = typeof s === 'string' ? s : s && s.name; if (n && !PROTECTED.has(n)) out.add(n); }
  return [...out].sort();
}

/** the entries still running at `now`. Pure. */
export const active = (list, now = Date.now()) => (Array.isArray(list) ? list : []).filter((e) => e && Number.isFinite(e.until) && e.until > now && Array.isArray(e.names));
/** the skill names hidden at `now`, never a protected one. Pure. */
export const hidden = (list, now = Date.now()) => new Set(active(list, now).flatMap((e) => e.names).filter((n) => !PROTECTED.has(n)));
/** the list with an entry for these families set (a family eclipsed again takes the new time). Pure. */
export function withEntry(list, entry, now = Date.now()) {
  return [...active(list, now).filter((e) => e.fam !== entry.fam), entry];
}
/** the list without one family, or without any when none is named. Pure. */
export const without = (list, fam) => (fam ? (Array.isArray(list) ? list : []).filter((e) => e && e.fam !== fam) : []);
/** "58 min left", "2 h left", "3 d left". Pure. */
export function leftWords(ms) {
  const m = Math.max(1, Math.round(ms / 6e4));
  return m < 90 ? m + ' min left' : m < 36 * 60 ? Math.round(m / 60) + ' h left' : Math.round(m / 1440) + ' d left';
}
/** the chip's words: "eclipsed: media · until fri" or "eclipsed: money · 58 min left". Pure. */
export function chipText(e, now = Date.now()) {
  return 'eclipsed: ' + e.label + ' · ' + (/^until/.test(e.how || '') ? e.how.replace(/^until /, 'until ') : leftWords(e.until - now));
}

/** the entries kept on this device (a storage can be handed in for a test). */
export function load(s) { try { return active(JSON.parse(read('eclipse', s) || '[]')); } catch (_) { return []; } }
export function save(list, s) { return write('eclipse', JSON.stringify(list), s); }
