// Words to a date answer (tools pack 11, DATES & CALENDARS 341-400). dateAsk(text, { today, nowMin }) returns null or
// { kind, title, rows: [[label, value], ...], note?, light? } and is pure: "today" and the clock time are passed in, so a test
// always gets the same answer. Every mode needs its own keywords AND the dates/numbers it works from, so look-alike asks
// ("what is a sprint", "lease a car") return null and go on to the other skills. Dates only: nothing here moves money.
import * as M from './date-math.js';

const MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WD = '(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*';
const DP = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4}|' + MON + '\\.? \\d{1,2}(?:st|nd|rd|th)?(?:,? \\d{4})?|\\d{1,2}(?:st|nd|rd|th)? ' + MON + '\\.?(?:,? \\d{4})?|today|tomorrow|yesterday|(?:next|last|this) ' + WD + '|(?:end|start) of (?:this |next |last )?(?:month|quarter|week|year))';
const TM = '(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?|noon|midnight)';
const NW = '(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)';
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, other: 2 };
const nOf = (s) => (/^\d+$/.test(s) ? +s : NUMW[String(s).toLowerCase()]);
const UNIT = '(business days?|working days?|weekdays?|days?|weeks?|months?|years?)';
const re = (src, flags = '') => new RegExp(src, flags); // void-review: ok (src is one of this file's own fixed pattern strings, never the person's text)
const fmt = (iso) => M.formatDay(iso, 'long');
const plural = (n, w) => n + ' ' + w + (Math.abs(n) === 1 ? '' : 's');
// "1 week 1 day", "3 days", "2 months": no "1 weeks" and no "0 weeks" (the days alone when under a week)
const weeksDays = (n) => (n < 7 ? plural(n, 'day') : plural(Math.floor(n / 7), 'week') + (n % 7 ? ' ' + plural(n % 7, 'day') : ''));
const monthsDays = (mo, d) => (mo ? plural(mo, 'month') + (d ? ' ' + plural(d, 'day') : '') : plural(d, 'day'));
const signed = (n) => (n > 0 ? 'in ' + plural(n, 'day') : n < 0 ? plural(-n, 'day') + ' ago' : 'today');
const hm = (min) => { const m = Math.max(0, Math.round(min)); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; };
const hasYear = (s) => /\d{4}/.test(s);

/** the tidy lower-case form of an ask: no polite edges, no end punctuation, one space between words. Pure. */
export function tidyAsk(text) {
  return String(text || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
    .replace(/^(?:please|hey|can you|could you|tell me|show me|work out|calculate|give me)\s+/, '').replace(/\s+please$/, '').replace(/[?!.]+$/, '').trim();
}
const dayIn = (s, today) => M.parseDay(String(s || '').trim(), today);
/** every date phrase in a text, parsed, in the order written. */
function findDates(t, today) {
  const out = [];
  for (const m of t.matchAll(re(DP, 'g'))) { const iso = dayIn(m[0], today); if (iso) out.push({ iso, said: m[0] }); }
  return out;
}
function holidayList(s, today) { return s ? findDates(s, today).map((d) => d.iso) : []; }
const SKIP_Q = '(?: (?:skipping|skip|excluding|except|without|not counting|avoiding|but not) (.+))?';

function dur(s) { // minutes from "47 minutes", "2h 10m", "1.5 hours", "2 hours 10 minutes"
  const t = String(s || '').toLowerCase();
  let total = 0, any = false;
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/g)) { any = true; total += +m[1] * (/^h/.test(m[2]) ? 60 : 1); }
  return any ? Math.round(total) : null;
}
const DUR = '((?:\\d+(?:\\.\\d+)?\\s*(?:hours?|hrs?|h|minutes?|mins?|m)\\b[ ,]*(?:and )?)+)';

const ans = (kind, title, rows, extra = {}) => ({ kind, title, rows, ...extra });
const lightWord = { red: 'red: due or within 2 days', amber: 'amber: within 7 days', green: 'green: more than 7 days away' };

export function dateAsk(text, opts = {}) {
  const today = opts.today, nowMin = Number.isFinite(opts.nowMin) ? opts.nowMin : 720;
  if (!M.isDay(today)) return null;
  const t = tidyAsk(text);
  if (!t || t.length > 240) return null;
  let m;

  // 341-343: days / weeks / months / business days after, before or from a date
  const dateRows = (iso) => [['Date', fmt(iso)], ['ISO', iso], ['From today', signed(M.daysBetween(today, iso))]];
  const a1 = re('^(?:what(?:\'s| is) )?(?:the date )?(' + NW + ') ' + UNIT + ' (after|before|from|past|since) (' + DP + ')' + SKIP_Q + '$').exec(t);
  const a2 = a1 ? null : re('^(?:what(?:\'s| is) )?(?:the date )?(' + NW + ') ' + UNIT + ' (from now|ago|from today)' + SKIP_Q + '$').exec(t);
  if (a1 || a2) {
    const g = a1 || a2, n = nOf(g[1]), u = g[2].replace(/s$/, ''), word = g[3];
    if (!n && n !== 0) return null;
    if (a2 && word === 'ago' && /^(?:month|year)$/.test(u)) return null; // "10 years ago" is not a date sum
    const base = a1 ? dayIn(g[4], today) : today, hol = holidayList(a1 ? g[5] : g[4], today);
    if (!base) return null;
    const sign = word === 'before' || word === 'ago' ? -1 : 1;
    const out = /^(business day|working day|weekday)$/.test(u) ? M.addBusinessDays(base, sign * n, hol)
      : u === 'day' ? M.addDays(base, sign * n) : u === 'week' ? M.addWeeks(base, sign * n) : u === 'month' ? M.addMonths(base, sign * n) : M.addYears(base, sign * n);
    return ans('add', plural(n, u) + (sign < 0 ? ' before ' : ' after ') + fmt(base), dateRows(out), { note: /business|working|weekday/.test(u) ? 'Monday to Friday only' + (hol.length ? '; skipping ' + hol.join(', ') : '; public holidays are not removed unless you list them: “… skipping 2026-12-25”') : u === 'month' || u === 'year' ? 'A day that does not exist in the target month lands on its last day.' : '' });
  }
  if ((m = re('^(add|plus|subtract|take|minus) (' + NW + ') ' + UNIT + ' (to|from|off|away from) (' + DP + ')' + SKIP_Q + '$').exec(t))
    || (m = re('^(' + DP + ') (plus|minus|\\+|-) (' + NW + ') ' + UNIT + SKIP_Q + '$').exec(t))) {
    const lead = /^(add|plus|subtract|take|minus)$/.test(m[1]);
    const verb = lead ? m[1] : m[2], n = nOf(lead ? m[2] : m[3]), unit = (lead ? m[3] : m[4]).replace(/s$/, ''), base = dayIn(lead ? m[5] : m[1], today), hol = holidayList(lead ? m[6] : m[5], today);
    if (!base || !n && n !== 0) return null;
    const sign = /^(subtract|take|minus|-)$/.test(verb) ? -1 : 1;
    const out = /^(business day|working day|weekday)$/.test(unit) ? M.addBusinessDays(base, sign * n, hol)
      : unit === 'day' ? M.addDays(base, sign * n) : unit === 'week' ? M.addWeeks(base, sign * n) : unit === 'month' ? M.addMonths(base, sign * n) : M.addYears(base, sign * n);
    return ans('add', fmt(base) + (sign < 0 ? ' minus ' : ' plus ') + plural(n, unit), dateRows(out), { note: /business|working|weekday/.test(unit) ? 'Monday to Friday only' + (hol.length ? '; skipping ' + hol.join(', ') : '') : '' });
  }
  if ((m = re('^in (' + NW + ') (business days?|working days?|weekdays?)' + SKIP_Q + '$').exec(t))) {
    const n = nOf(m[1]), out = M.addBusinessDays(today, n, holidayList(m[3], today));
    return ans('add', 'In ' + plural(n, 'business day'), dateRows(out), { note: 'Monday to Friday only' });
  }

  // 344-350 and 355: the next monday, end of month, quarter edges, ISO week start, yesterday / next week
  const lead = '(?:what(?:\'s| is| was) (?:the )?(?:date |day )?(?:of |for )?|what (?:date|day) (?:is|was) |when is |when\'s |date of |date for |the date )?';
  if ((m = re('^' + lead + '(?:the )?(end|start|beginning|first day|last day) of (?:the )?(this |next |last )?(month|quarter|week|year)(?: (?:of|for|in|containing) (' + DP + '))?$').exec(t))) {
    const base = m[4] ? dayIn(m[4], today) : null;
    const word = m[2] ? m[1] + ' of ' + m[2] + m[3] : m[1] + ' of the ' + m[3];
    const iso = base ? dayIn(m[1] + ' of ' + m[3], base) : dayIn(m[1] + ' of ' + (m[2] || 'this ') + m[3], today);
    if (!iso) return null;
    return ans('edge', word + (base ? ' containing ' + fmt(base) : ''), [['Date', fmt(iso)], ['ISO', iso], ['From today', signed(M.daysBetween(today, iso))]]);
  }
  if ((m = re('^(?:when|what day) (?:does|is) (?:the )?(this|next|last|current) (month|quarter|year) (end|start|begin|finish)s?$').exec(t))) {
    const w = m[1] === 'current' ? 'this' : m[1], iso = dayIn((/^(end|finish)/.test(m[3]) ? 'end' : 'start') + ' of ' + w + ' ' + m[2], today);
    return ans('edge', m[1] + ' ' + m[2] + ' ' + m[3] + 's', [['Date', fmt(iso)], ['ISO', iso], ['From today', signed(M.daysBetween(today, iso))]]);
  }
  if ((m = re('^(?:(?:the )?iso )?week (?:start|begins?|starts)(?: (?:of|for|on|containing) (' + DP + '))?$').exec(t)) || (m = re('^(?:what(?:\'s| is) )?(?:the )?(?:monday|start) of (?:the )?(?:iso )?week(?: (?:of|for|containing) (' + DP + '))?$').exec(t))
    || (m = re('^(?:what )?(?:iso )?week (?:number|no)(?: is it)?(?: (?:of|for|on) (' + DP + '))?$').exec(t)) || (m = re('^what week (?:of the year )?is it$').exec(t))) {
    const base = m[1] ? dayIn(m[1], today) : today;
    if (!base) return null;
    const w = M.isoWeek(base), st = M.isoWeekStart(base);
    return ans('week', 'ISO week of ' + fmt(base), [['Week starts (Monday)', fmt(st)], ['Week ends (Sunday)', fmt(M.addDays(st, 6))], ['ISO week', 'week ' + w.week + ' of ' + w.year], ['Quarter', 'Q' + M.quarterOf(base)]]);
  }
  if ((m = re('^what (?:quarter|q) (?:is|was) (?:it )?(?:on |for )?(' + DP + ')$').exec(t)) || (m = re('^(?:what|which) quarter (?:is it|are we in)(?: now| today)?$').exec(t))) {
    const base = m[1] ? dayIn(m[1], today) : today;
    return ans('quarter', 'Quarter of ' + fmt(base), [['Quarter', 'Q' + M.quarterOf(base)], ['Starts', fmt(M.quarterStart(base))], ['Ends', fmt(M.quarterEnd(base))]]);
  }
  {
    const relOk = '(?:(?:next|last|this) ' + WD + '|tomorrow|yesterday|next week|last week|next month|last month|next year|last year|' + NW + ' (?:day|week|month|year)s? (?:ago|from now)|in ' + NW + ' (?:day|week|month|year)s?)';
    const prefixed = re('^(?:what(?:\'s| is| was) (?:the )?(?:date |day )?(?:of |for )?|what (?:date|day) (?:is|was|will it be) |when is |when\'s |date of |date for |the date (?:of |for )?|resolve |what is the date )(' + relOk + ')$').exec(t);
    const bare = re('^((?:next|last) ' + WD + ')$').exec(t);
    const mm = prefixed || bare;
    if (mm) {
      const iso = dayIn(mm[1], today);
      if (iso) return ans('resolve', mm[1], [['Date', fmt(iso)], ['ISO', iso], ['From today', signed(M.daysBetween(today, iso))]]);
    }
  }

  // 351: formats
  if ((m = re('^(?:format|reformat|write) (' + DP + ')(?: (?:as|in)(?: an?)? (?:iso|us|eu|european|american|long|short|local)(?: format| style| date)?)?$').exec(t)) || (m = re('^(' + DP + ') in (?:iso|us|eu|european|american|long|short|local) (?:format|style)$').exec(t))
    || (m = re('^(?:iso|us|eu|european|american|local) (?:format|date|style) (?:of|for) (' + DP + ')$').exec(t))) {
    const iso = dayIn(m[1], today);
    if (!iso) return null;
    return ans('format', 'Date formats for ' + iso, [['ISO', M.formatDay(iso, 'iso')], ['Long', M.formatDay(iso, 'long')], ['US (month first)', M.formatDay(iso, 'us')], ['European (day first)', M.formatDay(iso, 'eu')], ['Short', M.formatDay(iso, 'short')]], { note: 'Fixed English names, so the same date reads the same on every device.' });
  }
  // 352: parse a fuzzy date
  if ((m = re('^(?:parse|interpret|decode) (?:the |this )?(?:date )?[:"]?\\s*(.+?)"?$').exec(t))) {
    const raw = m[1], iso = M.parseDayLoose(raw, today);
    if (!iso) return null;
    return ans('parse', 'Read “' + raw + '” as', [['Date', fmt(iso)], ['ISO', iso], ['From today', signed(M.daysBetween(today, iso))]], { note: /\d\/\d/.test(raw) ? 'Slashes are read month first (10/3/2026 is 3 October) unless the first number is above 12.' : '' });
  }

  // 356: business days / weeks between two dates (plain "days between" stays with the calculator)
  if ((m = re('^(?:how many )?(business days?|working days?|weekdays?|weeks?|months?) (?:are there |is there )?(?:between|from) (' + DP + ') (?:and|to|until|till) (' + DP + ')' + SKIP_Q + '$').exec(t))) {
    const a = M.parseDay(m[2], today, true), b = M.parseDay(m[3], today, true), unit = m[1].replace(/s$/, '');
    if (!a || !b) return null;
    const days = M.daysBetween(a, b);
    const rows = [['Calendar days', String(days)]];
    if (/^(business day|working day|weekday)$/.test(unit)) { const hol = holidayList(m[4], today); rows.unshift(['Business days (Mon-Fri)', String(M.businessDaysBetween(a, b, hol))]); }
    else if (unit === 'week') rows.unshift(['Weeks', weeksDays(Math.abs(days))]);
    else { const lo = days >= 0 ? [a, b] : [b, a], ap = M.ageParts(lo[0], lo[1]); rows.unshift(['Months', monthsDays(ap.totalMonths, ap.days)]); }
    return ans('between', fmt(a) + ' to ' + fmt(b), rows, { note: 'The start day is not counted, the end day is.' });
  }
  // 357: do two ranges overlap
  {
    const R = '(' + DP + ') (?:to|through|thru|until|-|–) (' + DP + ')';
    if ((m = re('^(?:do |does |is there (?:an )?)?(?:the )?(?:overlap(?: of| between)? )?' + R + ' (?:and|with|vs\\.?|against) ' + R + '(?: overlap)?$').exec(t)) && /overlap/.test(t)) {
      const [a1, a2, b1, b2] = [m[1], m[2], m[3], m[4]].map((x) => M.parseDay(x, today, true)); // a date with no year is this year's, so "oct 1 to oct 5" stays one range
      if (![a1, a2, b1, b2].every(Boolean)) return null;
      const o = M.rangeOverlap(a1, a2, b1, b2);
      return ans('overlap', o.overlap ? 'Yes, they overlap' : 'No overlap', o.overlap
        ? [['Overlap', fmt(o.start) + (o.start === o.end ? '' : ' to ' + fmt(o.end))], ['Days shared', String(o.days)]]
        : [['Gap between them', plural(o.gap, 'day')]], { note: 'Both ends of each range count.' });
    }
  }

  // 358-360: recurring dates
  if ((m = re('^(?:list |show |make |give )?(?:the )?(?:next )?(?:dates? )?(?:that )?(?:repeat )?every (.+)$').exec(t)) && /^(?:\d+|other|two|three|four|five|six|seven|eight|nine|ten|weekday|workday|work day|day|week|(?:sun|mon|tue|wed|thu|fri|sat))/.test(m[1])) {
    let rest = m[1], count = 6, start = today, hol = [];
    let k;
    if ((k = re(' ?(?:skipping|skip|excluding|except|without|not counting|avoiding|but not|holidays?(?: on)?) (.+)$').exec(rest))) { hol = holidayList(k[1], today); rest = rest.slice(0, k.index).trim(); }
    if ((k = re(' ?(?:for |x ?)(\\d+)(?: times| occurrences| dates| more)?$').exec(rest)) || (k = re(' ?(\\d+) times$').exec(rest))) { count = Math.min(60, +k[1]); rest = rest.slice(0, k.index).trim(); }
    if ((k = re(' ?(?:starting|starts|from|beginning|begins|since|on|after) (' + DP + ')$').exec(rest))) { start = dayIn(k[1], today); rest = rest.slice(0, k.index).trim(); }
    if ((k = re('^(.+?) for (\\d+)(?: times| occurrences| dates)?$').exec(rest))) { count = Math.min(60, +k[2]); rest = k[1].trim(); }
    if (!start || !count) return null;
    let list = null, label = '';
    if ((k = re('^(' + NW + '|other) (days?|weeks?)$').exec(rest)) || (k = re('^(day|week)$').exec(rest))) {
      const n = k[2] ? nOf(k[1]) : 1, u = (k[2] || k[1]).replace(/s$/, '');
      if (!n || n > 400) return null;
      list = M.everyNDays(start, u === 'week' ? 7 * n : n, count, hol); label = 'every ' + (n === 1 ? u : n + ' ' + u + 's');
    } else if (/^(?:weekday|workday|work day)s?$/.test(rest)) {
      const days = M.weeklyDays(start, [1, 2, 3, 4, 5], count + hol.length + 5).filter((d) => !hol.includes(d));
      list = days.slice(0, count); label = 'every weekday';
    } else if ((k = re('^((?:' + WD + ')(?:(?:,| and|,? and|&|\\+) ?(?:' + WD + '))*)$').exec(rest))) {
      const wds = [...k[1].matchAll(re(WD, 'g'))].map((x) => M.wdIdx(x[0]));
      const days = M.weeklyDays(start, wds, count + hol.length + 5).filter((d) => !hol.includes(d));
      list = days.slice(0, count); label = 'every ' + [...new Set(wds)].map((w) => M.DAY_NAMES[w]).join(' and ');
    }
    if (!list || !list.length) return null;
    return ans('recur', list.length + ' dates, ' + label + ' from ' + fmt(start), list.map((d, i) => [String(i + 1), fmt(d)]), { note: hol.length ? 'Left out (your holiday list): ' + hol.join(', ') : 'Add “skipping 2026-12-25, 2027-01-01” to leave out holidays.', list });
  }

  // 361-362: countdown to / count up from a date with a year (named days stay with the countdown skill)
  if ((m = re('^(?:how many )?(?:days|weeks) (?:until|till|to) (' + DP + ')$').exec(t)) && hasYear(m[1]) || (m = re('^(?:a )?count ?down (?:to|until|till) (' + DP + ')$').exec(t)) && hasYear(m[1])) {
    const target = dayIn(m[1], today);
    if (!target) return null;
    const d = M.daysBetween(today, target), a = Math.abs(d);
    return ans('countdown', d >= 0 ? 'Until ' + fmt(target) : 'Since ' + fmt(target), [[d >= 0 ? 'Days to go' : 'Days ago', String(a)], ['Weeks and days', weeksDays(a)], ['Business days', String(Math.abs(M.businessDaysBetween(d >= 0 ? today : target, d >= 0 ? target : today)))]]);
  }
  if ((m = re('^(?:how many )?days (?:since|after) (' + DP + ')$').exec(t)) || (m = re('^(?:how long (?:has it been )?since|count ?up (?:from|since)|days (?:elapsed )?since) (' + DP + ')$').exec(t))) {
    let start = dayIn(m[1], today);
    if (!start) return null;
    if (!hasYear(m[1]) && M.daysBetween(today, start) > 0) start = M.addYears(start, -1);
    const d = M.daysBetween(start, today);
    if (d < 0) return null;
    const ap = M.ageParts(start, today);
    return ans('countup', 'Since ' + fmt(start), [['Days since', String(d)], ['Weeks and days', weeksDays(d)], ['Years, months, days', ap.years + ' y ' + ap.months + ' m ' + ap.days + ' d']]);
  }

  // 363 and 392: next birthday / anniversary
  if ((m = re('^(?:when is |what is |what\'s )?(?:my |the |their |our |her |his )?next (birthday|anniversary)(?: (?:is |if |for |of |on |when |since |from |started |born |i was born |was born |someone was born )*)?(' + DP + ')$').exec(t)) || (m = re('^(?:my |the |our )?(birthday|anniversary) (?:on |of |for |date |is |from |since )?(' + DP + ')(?: next| next time| when)?$').exec(t)) || (m = re('^when is (?:my |the |our )?(birthday|anniversary) (?:if |when )?(?:born |started |it was )?(?:on )?(' + DP + ')$').exec(t))) {
    const raw = m[2], noYear = !hasYear(raw);
    const origin = dayIn(raw, today);
    if (!origin) return null;
    const o = noYear ? M.addYears(origin, M.daysBetween(today, origin) > 0 ? -1 : 0) : origin;
    const n = M.nextAnnual(o, today), word = m[1];
    const rows = [['Next ' + word, fmt(n.date)], ['Days to go', n.days === 0 ? 'today' : String(n.days)]];
    if (!noYear) rows.push([word === 'birthday' ? 'Turning' : 'Years', String(n.years)]);
    return ans('annual', 'Next ' + word + ' from ' + (noYear ? raw : fmt(origin)), rows);
  }
  // 364: age in years and months
  if ((m = re('^(?:exact age|age in (?:years(?: and months)?|months|days)|how many (?:months|days) old(?: is| am i)?|how old in months)\\b.*?(' + DP + ')$').exec(t)) && hasYear(m[1])) {
    const birth = dayIn(m[1], today), a = birth && M.ageParts(birth, today);
    if (!a) return null;
    return ans('age', 'Age from ' + fmt(birth), [['Years, months, days', a.years + ' y ' + a.months + ' m ' + a.days + ' d'], ['Total months', String(a.totalMonths)], ['Total days', String(a.totalDays)]]);
  }

  // 365: zodiac, just for fun
  if ((m = re('\\b(?:zodiac|star|sun) signs?\\b.*?(' + DP + ')$').exec(t)) && !/\b(?:horoscope|forecast|compatib)/.test(t)) {
    const iso = dayIn(m[1], today);
    if (!iso) return null;
    return ans('zodiac', M.zodiac(iso), [['Sun sign', M.zodiac(iso)], ['For', iso.slice(5) === '' ? iso : M.formatDay(iso, 'long').replace(/^[A-Za-z]+, /, '').replace(/, \d{4}$/, '')]], { note: 'For fun only: the usual tropical dates, no forecast.' });
  }
  // 366: moon phase on a named date (tonight's moon stays with its own card)
  if ((m = re('\\bmoon phase\\b.*?\\b(?:on|for|during|at) (' + DP + ')$').exec(t)) || (m = re('^moon phase (' + DP + ')$').exec(t))) {
    const iso = dayIn(m[1], today);
    if (!iso || /^(?:today|tonight)$/.test(m[1])) return null;
    const p = M.moonPhase(iso);
    return ans('moon', p.name, [['Phase', p.name], ['Lit', '~' + p.illumination + '%'], ['Moon age', p.age + ' days since new']], { note: 'Approximate (mean cycle), good to about a day.' });
  }
  // 367: daylight from sunrise and sunset typed by hand
  if ((m = re('^(?:daylight|day length|how long is the day)(?: hours| length)?.*?sunrise(?: at| is)? (' + TM + ').*?sunset(?: at| is)? (' + TM + ')$').exec(t))) {
    const a = M.parseClock(m[1]), b = M.parseClock(m[2]);
    if (a == null || b == null || b <= a) return null;
    return ans('daylight', 'Daylight ' + hm(b - a), [['Sunrise', M.clockText(a)], ['Sunset', M.clockText(b)], ['Daylight', hm(b - a)], ['Middle of the day', M.clockText(Math.round((a + b) / 2))]], { note: 'Times are the ones you typed; nothing is looked up for your place.' });
  }

  // 368-370: time until midnight, workday fraction, billable rounding
  if (re('^(?:how (?:long|much time)|time|how many hours|hours?)(?: is)?(?: left| remaining)?(?: until| till| to| before) midnight$').test(t) || re('^(?:how much )?time (?:is )?left (?:today|in the day)$').test(t) || re('^(?:how many hours|hours) (?:are )?left (?:today|in the day)$').test(t)) {
    const left = M.minutesToMidnight(nowMin);
    return ans('midnight', hm(left) + ' until midnight', [['Now', M.clockText(nowMin)], ['Left today', hm(left)], ['Of the day gone', Math.round(nowMin / 14.4) + '%']]);
  }
  if ((m = re('^(?:how much of (?:the|my) (?:work ?day|working day) (?:is )?(?:done|left|gone|over|remaining|behind me)|work ?day (?:progress|fraction|left|remaining|done))(?: (?:from|between) (' + TM + ') (?:to|and|-|until) (' + TM + '))?(?: (?:at|now at|if it is) (' + TM + '))?$').exec(t))) {
    const s = m[1] ? M.parseClock(m[1]) : 540, e = m[2] ? M.parseClock(m[2]) : 1020, at = m[3] ? M.parseClock(m[3]) : nowMin;
    if (s == null || e == null || at == null || e <= s) return null;
    const f = M.workdayFraction(at, s, e);
    return ans('workday', Math.round(f * 100) + '% of the workday done', [['Workday', M.clockText(s) + ' to ' + M.clockText(e)], ['At', M.clockText(at)], ['Done', Math.round(f * 100) + '%'], ['Left', hm(Math.max(0, e - Math.max(s, at)))]], { note: m[1] ? '' : 'Default workday 9:00 to 17:00; say “from 8am to 4pm” to change it.' });
  }
  if ((m = re('^(?:billable|bill)(?: time| hours)?(?: for| of)? ' + DUR + '(?: (?:rounded )?(?:to|in|by) (?:the nearest )?(\\d+)[ -]?(?:minute|min|m)s?(?: blocks?| steps?| increments?| billing)?)?$').exec(t)) || (m = re('^round ' + DUR + '(?: (up|down))? to (?:the nearest )?(\\d+)[ -]?(?:minute|min|m)s?(?: blocks?| steps?| increments?| billing| up)?$').exec(t)) || (m = re('^round ' + DUR + ' (?:to )?(?:the nearest )?(\\d+)[ -]?(?:minute|min|m)s? (up|nearest)$').exec(t))) {
    const minutes = dur(m[1]);
    const stepRaw = m[3] !== undefined && /^\d+$/.test(m[3]) ? m[3] : /^\d+$/.test(m[2]) ? m[2] : m[3];
    const step = +(/^\d+$/.test(String(m[3])) ? m[3] : /^\d+$/.test(String(m[2])) ? m[2] : 15) || 15;
    if (!minutes || step < 1 || step > 240) return null;
    const mode = /nearest/.test(t) && !/ up\b/.test(t) ? 'nearest' : 'up';
    const r = M.billableRound(minutes, step, mode);
    return ans('billable', hm(r.minutes) + ' billable', [['Worked', hm(minutes)], ['Block', step + ' min, ' + (mode === 'up' ? 'rounded up' : 'to the nearest')], ['Billable', hm(r.minutes) + ' (' + r.hours + ' h)']], { note: 'Hours only; no rates or amounts.' });
  }

  // 387: deadline risk traffic light
  if ((m = re('^(?:deadline (?:risk|traffic light)|traffic light|risk)(?: for| of| on| is| check)*(?: (?:the |my )?deadline)?(?: on)? (' + DP + ')$').exec(t)) || (m = re('^(?:is |how risky is |how safe is )(?:the |my )?deadline(?: on| of| is| for)? (' + DP + ')(?: (?:at risk|risky|safe))?$').exec(t)) || (m = re('^(?:the |my )?deadline (?:on |of |is )?(' + DP + ') (?:risk|traffic light)$').exec(t))) {
    const due = dayIn(m[1], today);
    if (!due) return null;
    const tl = M.trafficLight(today, due);
    return ans('traffic', tl.light.toUpperCase() + ': ' + (tl.days < 0 ? plural(-tl.days, 'day') + ' overdue' : tl.days === 0 ? 'due today' : plural(tl.days, 'day') + ' left'), [['Deadline', fmt(due)], ['Light', lightWord[tl.light]], ['Business days left', tl.days >= 0 ? String(M.businessDaysBetween(today, due)) : '0']], { light: tl.light, note: 'Red: passed or within 2 days · amber: within 7 · green: more.' });
  }

  // 388-390: snooze a reminder time
  if ((m = re('^snooze(?: (?:this|it|the (?:reminder|alarm|task)))?(?: (?:at |from )?(\\d{4}-\\d{2}-\\d{2})[ t](' + TM + '))?(?: by| for)? (one hour|an hour|1 hour|one day|a day|1 day|(?:until|till|to) (?:next )?monday)$').exec(t))) {
    const mins = m[2] ? M.parseClock(m[2]) : nowMin, day = m[1] || today;
    if (mins == null || !M.isDay(day)) return null;
    const from = M.joinDT(day, mins), how = /monday/.test(m[3]) ? 'monday' : /hour/.test(m[3]) ? 'hour' : 'day', to = M.snooze(from, how);
    const s = M.splitDT(to);
    return ans('snooze', 'Snoozed to ' + M.formatDay(s.day, 'short') + ' ' + M.clockText(s.min), [['From', M.formatDay(day, 'short') + ' ' + M.clockText(mins)], ['To', M.formatDay(s.day, 'short') + ' ' + M.clockText(s.min)]], { note: how === 'monday' ? 'Until Monday at 09:00.' : '' });
  }

  // 380-382: appointment conflicts, buffers, travel note
  if (/\b(?:conflicts?|clash(?:es)?|overlap(?:s|ping)?|double[- ]?book(?:ed|ing)?)\b/.test(t)) {
    const ivs = [...t.matchAll(re('(' + TM + ')\\s*(?:-|–|to|until)\\s*(' + TM + ')', 'g'))].map((x) => ({ s: M.parseClock(x[1]), e: M.parseClock(x[2]), said: x[0] })).filter((x) => x.s != null && x.e != null);
    const fixed = ivs.map((x) => (x.e <= x.s && x.e + 720 > x.s && x.e < 13 * 60 && !/am|pm|:/.test(x.said) ? { ...x, e: x.e * 60 > x.s ? x.e * 60 : x.s + 60 } : x));
    if (fixed.length >= 2 && fixed.length <= 8 && fixed.every((x) => x.e > x.s)) {
      const bm = re('(\\d+) ?(?:min(?:ute)?s?) (?:buffer|between|gap|apart)|buffer (?:of )?(\\d+)').exec(t), buffer = bm ? +(bm[1] || bm[2]) : 0;
      const list = fixed.map((x) => ({ start: x.s, end: x.e })), c = M.conflicts(list, buffer);
      const name = (i) => M.clockText(list[i].start) + '-' + M.clockText(list[i].end);
      return ans('conflict', c.length ? plural(c.length, 'conflict') : 'No conflicts', c.length ? c.map((x) => [name(x.a) + ' / ' + name(x.b), x.overlap ? 'overlap by ' + -x.gap + ' min' : 'only ' + x.gap + ' min apart (buffer ' + buffer + ')']) : [['Checked', list.map((_, i) => name(i)).join(', ')]], { note: buffer ? 'Buffer of ' + buffer + ' min needed between appointments.' : 'Back to back counts as fine; add “with a 15 minute buffer” to ask for space.' });
    }
  }
  if ((m = re('^(?:when (?:do|should) i (?:leave|go|set off|depart)|leave by|travel note|what time (?:do|should) i leave)\\b.*?\\b(?:for |at |is at )?(?:an? )?(?:appointment |meeting |call |flight |train |class |event )?(?:at )?(' + TM + ')\\b.*?(\\d+) ?(min(?:ute)?s?|hours?|hrs?|h)\\b ?(?:of )?(?:travel|drive|driving|commute|walk|trip|journey)?(?:.*?(\\d+) ?(?:min(?:ute)?s?) (?:buffer|spare|extra))?$').exec(t)) || (m = re('^(?:an? )?(?:appointment|meeting|call|flight|train|class|event) at (' + TM + ') with (\\d+) ?(min(?:ute)?s?|hours?|hrs?|h) (?:of )?(?:travel|drive|driving|commute|walk|trip)(?: and (\\d+) ?(?:min(?:ute)?s?) (?:buffer|spare|extra))?,? (?:when|what time) (?:do|should) i (?:leave|go|set off)$').exec(t))) {
    const at = M.parseClock(m[1]), travel = +m[2] * (/^h/.test(m[3]) ? 60 : 1), buffer = m[4] ? +m[4] : 10;
    if (at == null || !travel) return null;
    const leave = M.leaveBy(at, travel, buffer), day = leave < 0 ? ' (the day before)' : '';
    return ans('travel', 'Leave by ' + M.clockText(leave) + day, [['Appointment', M.clockText(at)], ['Travel', plural(travel, 'minute')], ['Buffer', plural(buffer, 'minute')], ['Leave by', M.clockText(leave) + day]], { note: 'Travel note: leave ' + M.clockText(leave) + ' for ' + M.clockText(at) + ' (' + travel + ' min travel + ' + buffer + ' min buffer).' });
  }

  // 383-386: time zones, meetings across zones, working / quiet hours
  const zoneKeys = Object.keys(M.ZONES).sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, ' ')).join('|');
  const ZN = '(?:' + zoneKeys + '|[a-z]+/[a-z_]+(?:/[a-z_]+)?)';
  const zlist = (s) => { const parts = s.split(/\s*(?:,|&|\+|\band\b)\s*/).map((x) => x.trim()).filter(Boolean); const z = parts.map(M.zoneOf); return parts.length && z.every(Boolean) ? { names: parts, zones: z } : null; };
  const dtOf = (timeS, dayS) => { const mi = M.parseClock(timeS), d = dayS ? dayIn(dayS, today) : today; return mi == null || !d ? null : M.joinDT(d, mi); };
  if ((m = re('^convert (' + TM + ')(?: on (' + DP + '))? (?:in |from )?(' + ZN + ') (?:to|into|in) (' + ZN + ')(?: time)?(?: on (' + DP + '))?$').exec(t)) || (m = re('^(' + TM + ') on (' + DP + ') (' + ZN + ') (?:time )?(?:in|to|into) (' + ZN + ')(?: time)?$').exec(t))) {
    const from = M.zoneOf(m[3]), to = M.zoneOf(m[4]), dt = dtOf(m[1], m[2] || m[5]);
    if (!from || !to || !dt) return null;
    const out = M.convertZone(dt, from, to), a = M.splitDT(dt), b = M.splitDT(out);
    return ans('zones', M.clockText(a.min) + ' ' + m[3] + ' is ' + M.clockText(b.min) + ' ' + m[4] + (b.day !== a.day ? (b.day > a.day ? ' (next day)' : ' (previous day)') : ''), [[m[3], M.formatDay(a.day, 'short') + ' ' + M.clockText(a.min)], [m[4], M.formatDay(b.day, 'short') + ' ' + M.clockText(b.min)]], { note: 'Uses the zone rules (including daylight saving) for that date.' });
  }
  if ((m = re('^(?:meeting|call|meet)(?: at)? (' + TM + ')(?: on (' + DP + '))?(?: in)? (' + ZN + ')(?: across| for| with| and| plus|,)? ?((?:' + ZN + ')(?:(?:,| and|,? and|&|\\+) ?(?:' + ZN + '))*)$').exec(t))) {
    const first = M.zoneOf(m[3]), others = zlist(m[4]), dt = dtOf(m[1], m[2]);
    if (!first || !others || !dt) return null;
    const names = [m[3], ...others.names], zones = [first, ...others.zones].slice(0, 6);
    const r = M.meetingAcross(dt, zones);
    return ans('meeting', r.allWorking ? 'Works for everyone' : r.anyQuiet ? 'Someone is in quiet hours' : 'Outside someone\'s working hours', r.rows.map((x, i) => { const s = M.splitDT(x.local); return [names[i], M.formatDay(s.day, 'short') + ' ' + M.clockText(s.min) + ' · ' + (x.quiet ? 'quiet hours' : x.working ? 'working hours' : 'outside work hours')]; }), { note: 'Working hours 9:00-17:00, quiet hours 22:00-07:00.' });
  }
  if ((m = re('^(?:best |good )?(?:meeting|call) (?:times?|hours?|slots?) (?:across|for|between) ((?:' + ZN + ')(?:(?:,| and|,? and|&|\\+) ?(?:' + ZN + '))+)(?: on (' + DP + '))?$').exec(t))) {
    const zl = zlist(m[1]), day = m[2] ? dayIn(m[2], today) : today;
    if (!zl || !day || zl.zones.length > 6) return null;
    const hours = [];
    for (let h = 0; h < 24; h++) { const r = M.meetingAcross(M.joinDT(day, h * 60), zl.zones); hours.push({ h, ok: r.allWorking, working: r.rows.filter((x) => x.working).length, quiet: r.rows.filter((x) => x.quiet).length }); }
    let good = hours.filter((x) => x.ok), note = 'Hours when everyone is inside 9:00-17:00 (times in ' + zl.names[0] + ').';
    if (!good.length) { const bestW = Math.max(...hours.filter((x) => !x.quiet).map((x) => x.working), 0); good = hours.filter((x) => !x.quiet && x.working === bestW); note = 'Nobody shares working hours; these hours reach the most people without waking anyone (times in ' + zl.names[0] + ').'; }
    return ans('meeting-best', good.length ? good.map((x) => M.clockText(x.h * 60)).join(', ') : 'No comfortable hour', good.slice(0, 12).map((x) => [M.clockText(x.h * 60), zl.zones.map((z, i) => zl.names[i] + ' ' + M.clockText(M.splitDT(M.convertZone(M.joinDT(day, x.h * 60), zl.zones[0], z)).min)).join(' · ')]), { note });
  }
  if ((m = re('^(?:is |what are |are )?(?:(?:the )?working hours|quiet hours|business hours)\\b.*?(' + TM + ') (?:in |at )?(' + ZN + ')$').exec(t)) || (m = re('^is (' + TM + ') (?:in )?(' + ZN + ') (?:within |inside |during )?(?:working|quiet|business) hours$').exec(t))) {
    const mi = M.parseClock(m[1]), z = M.zoneOf(m[2]);
    if (mi == null || !z) return null;
    const f = M.hourFlags(mi);
    return ans('hours', f.quiet ? 'Quiet hours' : f.working ? 'Working hours' : 'Outside working hours', [[M.clockText(mi) + ' ' + m[2], f.quiet ? 'quiet (22:00-07:00)' : f.working ? 'working (09:00-17:00)' : 'neither']]);
  }

  // 392-400: dated life admin, all manual dates
  const dates = findDates(t, today);
  if ((m = re('^(?:when does |does |is )?(?:my |the |our )?(visa|passport|permit|licen[cs]e|certificate|insurance|registration|id|membership|card|contract|cert) (?:expires?|expiry|expiring|runs out|ends?|valid until|valid till|valid through)(?: on| is| date)? (' + DP + ')$').exec(t)) || (m = re('^(?:days (?:left|remaining) (?:on|until|for) )(?:my |the )?(visa|passport|permit|licen[cs]e|certificate|insurance|registration|id|membership|card|contract|cert)(?: expir(?:y|es|ing))?(?: on| date)? (' + DP + ')$').exec(t))) {
    const due = dayIn(m[2], today);
    if (!due) return null;
    const tl = M.trafficLight(today, due, 90, 30);
    return ans('expiry', m[1] + ' ' + (tl.days < 0 ? 'expired ' + plural(-tl.days, 'day') + ' ago' : plural(tl.days, 'day') + ' left'), [['Expires', fmt(due)], ['Days left', String(tl.days)], ['Light', tl.light + (tl.light === 'red' ? ' (inside 30 days or past)' : tl.light === 'amber' ? ' (inside 90 days)' : ' (over 90 days)')], ['90 days before', fmt(M.addDays(due, -90))], ['30 days before', fmt(M.addDays(due, -30))]], { light: tl.light, note: 'Just the dates: check the real rules with the issuer.' });
  }
  if (/\b(?:subscription|membership|plan|renewal|renews?)\b/.test(t) && dates.length >= 1 && (m = re('(?:renew(?:s|al)?|subscription|membership|plan).*?(?:every (' + NW + ') (months?|years?)|(monthly|yearly|annual(?:ly)?|quarterly|weekly))').exec(t)) && re('(?:from|since|started|first|begun|began|on|starting|anchored)\\s+(?:on )?(' + DP + ')').test(t) && !/\bwarranty|lease\b/.test(t)) {
    const first = dates[0].iso, n = m[1] ? nOf(m[1]) : 1, word = m[2] || m[3] || '';
    const months = m[1] ? (/^year/.test(m[2]) ? 12 * n : n) : /month/.test(word) ? 1 : /quarter/.test(word) ? 3 : /year|annual/.test(word) ? 12 : 0;
    if (/week/.test(word)) {
      const r = M.nextRenewal(first, 1, today); // weekly handled in days below
      let d = first; while (M.daysBetween(today, d) < 0) d = M.addDays(d, 7);
      return ans('renew', 'Next renewal ' + fmt(d), [['Next renewal', fmt(d)], ['Days to go', String(M.daysBetween(today, d))], ['Every', 'week from ' + fmt(first)]], { note: 'Dates only: no prices, no payment.' });
    }
    if (!months || !n) return null;
    const r = M.nextRenewal(first, months, today), after = M.addMonths(first, (r.count + 1) * months);
    return ans('renew', 'Next renewal ' + fmt(r.date), [['Next renewal', fmt(r.date)], ['Days to go', String(r.days)], ['The one after', fmt(after)], ['Every', months % 12 === 0 ? plural(months / 12, 'year') : plural(months, 'month')]], { note: 'Counted from the first day, so 31 January stays 28 February, 31 March. Dates only: no prices, no payment.' });
  }
  if (/\bwarranty\b/.test(t) && dates.length >= 1 && (m = re('(' + NW + ')[ -](months?|years?|days?)(?: of)?(?: warranty)?|warranty (?:of |for |lasting |is )?(' + NW + ')[ -](months?|years?|days?)').exec(t))) {
    const n = nOf(m[1] || m[3]), u = (m[2] || m[4]).replace(/s$/, ''), start = dates[0].iso;
    if (!n) return null;
    const end = M.addDays(u === 'day' ? M.addDays(start, n) : u === 'month' ? M.addMonths(start, n) : M.addYears(start, n), -0), left = M.daysBetween(today, end);
    return ans('warranty', left < 0 ? 'Warranty ended ' + plural(-left, 'day') + ' ago' : 'Warranty ends ' + fmt(end), [['Bought', fmt(start)], ['Covers', plural(n, u)], ['Ends', fmt(end)], ['Days left', String(left)], ['Light', M.trafficLight(today, end, 60, 14).light]], { light: M.trafficLight(today, end, 60, 14).light, note: 'Counted from the date you give; check the paper for when cover really starts.' });
  }
  if (/\bleases?\b/.test(t) && dates.length >= 1 && !/\blease (?:a|an|the) (?:car|house|apartment|flat|truck|van)\b/.test(t)) {
    const nm = re('(?:for|lasting|of|runs?) (' + NW + ') (months?|years?)').exec(t), notice = re('(\\d+) days?(?: of| \'s)? notice').exec(t);
    let end = null, start = null;
    if (nm && dates.length >= 1 && !/\b(?:ends?|expires?|ending|until|through)\b/.test(t.replace(nm[0], ''))) { start = dates[0].iso; const n = nOf(nm[1]); end = M.addDays(/^year/.test(nm[2]) ? M.addYears(start, n) : M.addMonths(start, n), -1); }
    else if (re('(?:ends?|expires?|ending|until|through|up on)').test(t)) end = dates[dates.length - 1].iso;
    if (!end) return null;
    const left = M.daysBetween(today, end), tl = M.trafficLight(today, end, 90, 30);
    const rows = [['Lease ends', fmt(end)], ['Days left', String(left)], ['Light', tl.light]];
    if (start) rows.unshift(['Starts', fmt(start)]);
    if (notice) rows.push(['Last day to give ' + notice[1] + ' days notice', fmt(M.addDays(end, -(+notice[1])))]);
    return ans('lease', left < 0 ? 'Lease ended ' + plural(-left, 'day') + ' ago' : 'Lease ends in ' + plural(left, 'day'), rows, { light: tl.light, note: 'The last day counts as the day before the same date a term later. Just the dates: your contract sets the real notice rules.' });
  }
  if (/\b(?:term|semester|trimester|school year)\b/.test(t) && dates.length >= 2 && re('^(?:school |college )?(?:term|semester|trimester)').test(t)) {
    const s = dates[0].iso, e = dates[1].iso;
    if (M.daysBetween(s, e) < 1) return null;
    const p = M.termProgress(s, e, today);
    return ans('term', p.state === 'in progress' ? p.pct + '% of term done' : 'Term ' + p.state, [['Term', fmt(s) + ' to ' + fmt(e)], ['Length', plural(Math.round(p.totalDays / 7 * 10) / 10, 'week')], ['Done', p.pct + '% (' + p.doneDays + ' of ' + p.totalDays + ' days)'], ['Weeks left', String(p.weeksLeft)]]);
  }
  if ((m = re('\\bpay(?:day|days| cycle| period| dates?|check)?\\b|\\bpaid\\b').exec(t)) && dates.length >= 1 && (m = re('(weekly|bi-?weekly|every (?:other|2|two) weeks?|fortnightly|semi-?monthly|twice a month|monthly|every month)').exec(t)) && !/\b(?:salary|rate|amount|\$)/.test(t)) {
    const w = m[1], cycle = /^bi|other|2|two|fortnight/.test(w) ? 'biweekly' : /^semi|twice/.test(w) ? 'semimonthly' : /^week/.test(w) ? 'weekly' : 'monthly';
    const list = M.payDates(cycle, dates[0].iso, today, 4);
    return ans('pay', 'Next pay days (' + cycle + ')', list.map((d, i) => [i === 0 ? 'Next' : 'Then', fmt(d)]), { note: cycle === 'semimonthly' ? 'The 15th and the last day of each month.' : 'Counted from the pay day you give. Dates only: no amounts.', list });
  }
  if (/\bsprints?\b/.test(t) && dates.length >= 1 && (m = re('(' + NW + ')[ -](days?|weeks?)(?: long)?').exec(t))) {
    const n = nOf(m[1]), len = /^week/.test(m[2]) ? 7 * n : n;
    if (!n || len > 120) return null;
    const sp = M.sprintAt(dates[0].iso, len, today);
    if (sp.notStarted) return ans('sprint', 'Sprint 1 starts in ' + plural(sp.daysToStart, 'day'), [['Sprint 1 starts', fmt(sp.nextStart)], ['Length', plural(len, 'day')], ['Ends', fmt(M.addDays(sp.nextStart, len - 1))]]);
    return ans('sprint', 'Sprint ' + sp.n + ', day ' + sp.dayOf + ' of ' + len, [['This sprint', fmt(sp.start) + ' to ' + fmt(sp.end)], ['Days left', String(sp.daysLeft)], ['Next sprint starts', fmt(sp.next)], ['Next ends', fmt(M.addDays(sp.next, len - 1))]]);
  }
  if ((m = re('\\bfiscal (?:year|yr|fy)\\b.*?(?:start(?:s|ing)?|begin(?:s|ning)?|offset|from|in) (?:in )?(' + MON + ')\\b').exec(t)) || (m = re('\\bfiscal (?:year|yr)\\b.*?\\b(' + MON + ')\\b (?:start|year)').exec(t))) {
    const sm = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].slice(0, 3)) + 1;
    const when = dates.length ? dates[dates.length - 1].iso : today;
    const f = M.fiscalYear(when, sm);
    return ans('fiscal', f.label + ' · Q' + f.quarter, [['Day', fmt(when)], ['Fiscal year', f.label + ' (' + fmt(f.start) + ' to ' + fmt(f.end) + ')'], ['Fiscal quarter', 'Q' + f.quarter], ['Offset from calendar year', sm === 1 ? 'none' : (sm - 1) + ' months later start']], { note: 'Labelled by the year it ends in (a year starting 1 April 2026 is FY2027).' });
  }
  return null;
}
