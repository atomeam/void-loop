/**
 * period skill - a period log kept in your own Void (this browser only), and the predictions it unlocks
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "my period started today", "my period started on october 1", "log my period on sept 3", "show my period log",
 * "how long is my cycle", "is my period late", "remove my last period", "clear my period log".
 * Each logged start is one cycle; the gaps between starts give your own average, shortest and longest cycle, and the
 * ovulation skill then reads this log for "when is my next period" / "when am i ovulating" with no date given.
 * Saved only on this device (localStorage a2m.void.cycle.v1), never sent anywhere and never synced by "remember me".
 * Normal adult cycles run 21-35 days (ACOG); a gap over 60 days is treated as a missed log, not a cycle.
 */
import { dateOf } from './pregnancy.js';
import { cycleAt } from './ovulation.js';

const KEY = 'a2m.void.cycle.v1';
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const diff = (a, b) => Math.round((day0(b) - day0(a)) / 86400000);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fromIso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const MONS = 'jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december';
const D = String.raw`(?:today|yesterday|(?:${MONS})\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:${MONS})\.?(?:,?\s+\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})`;

function bag(store) { if (store) return store; try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } }
function loadLog(store) {
  const b = bag(store); if (!b) return [];
  try { const r = JSON.parse(b.getItem(KEY) || '{}'); return Array.isArray(r.starts) ? r.starts.filter((s) => fromIso(s)).sort() : []; } catch (_) { return []; }
}
function saveLog(starts, store) {
  const b = bag(store); if (!b) return;
  try { if (starts.length) b.setItem(KEY, JSON.stringify({ starts: [...new Set(starts)].sort() })); else b.removeItem(KEY); } catch (_) {}
}

// cycle lengths between logged starts; gaps over 60 days are a missed log, not a cycle
function stats(starts) {
  const ds = starts.map(fromIso), lens = [];
  let gaps = 0;
  for (let i = 1; i < ds.length; i++) { const n = diff(ds[i - 1], ds[i]); if (n >= 15 && n <= 60) lens.push(n); else gaps++; }
  const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : null;
  return { last: ds[ds.length - 1] || null, lens, gaps, avg, lo: lens.length ? Math.min(...lens) : null, hi: lens.length ? Math.max(...lens) : null };
}

// what the ovulation skill asks for when an ask names no date: the last logged start and your own cycle
function fromLog(store) {
  const starts = loadLog(store); if (!starts.length) return null;
  const s = stats(starts), cycle = s.avg && s.avg >= 20 && s.avg <= 45 ? s.avg : 28;
  if (s.lens.length >= 2 && s.hi - s.lo >= 8 && s.lo >= 20 && s.hi <= 45) return { kind: 'range', lmp: s.last, lo: s.lo, hi: s.hi, luteal: 14, fromLog: true, cycles: s.lens.length };
  return { kind: 'cycle', lmp: s.last, cycle, luteal: 14, fromLog: true, cycles: s.lens.length };
}

const OFF = /\b(?:due\s+date|due|pregnan\w*|conceiv\w*|ovulat\w*|fertile|baby|ivf|trimester|weeks|how\s+far|last|cramps?|pain|symptoms?|heavy|spotting|bleeding|clots?|history\s+class|essay|school|class|bell|lesson|game|quarter|half|sentence|punctuation|periodic|table|elements?)\b/;
const MINE = String.raw`(?:my|her|the)\s+period`;

function periodOf(text, now = new Date()) {
  const t = String(text || '').toLowerCase().replace(/[?!]+$/, '').replace(/\.$/, '').replace(/[\u2019']/g, '\u0027').replace(/\s+/g, ' ').trim();
  if (!t || !/\b(?:period|periods|cycles?|menstrua\w*)\b/.test(t)) return null;
  let m;
  // show the log / your own cycle
  if (/^(?:show|open|see|view|check)?\s*(?:me\s+)?(?:my\s+)?(?:period|cycle|menstrual)\s+(?:log|history|tracker|diary|journal|calendar)$/.test(t)
    || /^(?:show|list|see)\s+(?:me\s+)?my\s+(?:periods|cycles)$/.test(t) || /^my\s+(?:periods|cycles)$/.test(t)
    || /^(?:how\s+long\s+(?:is|are)|what(?:'s|\s+is|\s+are)?)\s+(?:my\s+)?(?:average\s+)?(?:menstrual\s+)?cycles?(?:\s+length)?$/.test(t)
    || /^(?:how\s+long\s+(?:is|are)|what(?:'s|\s+is)?)\s+my\s+(?:average\s+)?(?:menstrual\s+)?cycle\s+length$/.test(t)
    || /^(?:what(?:'s|\s+is)?\s+)?my\s+(?:average\s+)?(?:menstrual\s+)?cycle(?:\s+length)?$/.test(t) && !/^my\s+(?:menstrual\s+)?cycle$/.test(t)) return { kind: 'show' };
  // late
  if (/^(?:is\s+)?my\s+period\s+(?:is\s+)?late$|^am\s+i\s+late$|^is\s+my\s+period\s+late$|^how\s+late\s+is\s+my\s+period$/.test(t)) return { kind: 'late' };
  // remove
  if (/^(?:clear|delete|erase|reset|forget|wipe)\s+(?:all\s+)?(?:of\s+)?my\s+(?:period|cycle|menstrual)s?(?:\s+(?:log|history|tracker|data))?$/.test(t)) return { kind: 'clear' };
  if ((m = t.match(new RegExp(String.raw`^(?:remove|delete|undo|take\s+off|take\s+out)\s+(?:my\s+|the\s+)?(?:(last|latest|newest)\s+)?(?:logged\s+)?(?:period|entry|period\s+entry|period\s+log\s+entry)(?:\s+(?:on|from|for)\s+(${D}))?(?:\s+from\s+(?:my\s+)?(?:period\s+)?log)?$`)))) {
    if (!m[1] && !m[2]) return /\bperiod\b/.test(t) && /\bmy\b/.test(t) ? { kind: 'remove', which: 'last' } : null;
    if (m[2]) { const d = dateOf(m[2], 'past', now); return d ? { kind: 'remove', which: 'date', date: d } : null; }
    return { kind: 'remove', which: 'last' };
  }
  if (OFF.test(t)) return null;
  // log a start: "my period started today", "i got my period on oct 1", "log my period", "period came yesterday"
  const say = String.raw`(?:started|start(?:s|ing)?|came|began|begun|arrived|showed\s+up|is\s+here|just\s+started|just\s+came)`;
  const pats = [
    new RegExp(String.raw`^(?:(?:so\s+|ok\s+|well\s+)?(?:${MINE}|period)\s+(?:has\s+|just\s+)?${say})(?:\s+(?:on\s+)?(${D}))?$`),
    new RegExp(String.raw`^(?:i\s+)?(?:got|started|have\s+started|just\s+got|just\s+started)\s+my\s+period(?:\s+(?:on\s+)?(${D}))?$`),
    new RegExp(String.raw`^(?:log|record|save|track|add|note)\s+(?:that\s+)?(?:my\s+)?period(?:\s+(?:start(?:ed)?|starting))?(?:\s+(?:on|for|as)\s+|\s+)?(${D})?$`),
    new RegExp(String.raw`^(?:i'm|im|i\s+am)\s+on\s+my\s+period(?:\s+(today))?$`),
    new RegExp(String.raw`^(?:today|(${D}))\s+(?:is|was)\s+(?:the\s+)?(?:first\s+day|day\s+(?:1|one))\s+of\s+my\s+(?:period|cycle)$`),
    new RegExp(String.raw`^(?:${D}\s+)?(?:period\s+)?day\s+(?:1|one)(?:\s+of\s+my\s+(?:period|cycle))?(?:\s+(today))?$`)
  ];
  for (const p of pats) {
    if (!(m = t.match(p))) continue;
    if (p === pats[5] && !/\b(?:period|cycle)\b/.test(t)) return null;
    const ds = (m[1] || '').trim();
    const d = ds ? dateOf(ds, 'past', now) : day0(now);
    if (!d) return null;
    return { kind: 'log', date: d, onPeriod: p === pats[3] };
  }
  return null;
}

const md = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
const short = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const long = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const ask = (a, esc) => '<a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a>';
const SRC = '<div class="src">Cycle = first day of one period to the first day of the next; typical adult cycles run 21\u201335 days \u00b7 <a href="https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding" target="_blank" rel="noopener">ACOG</a> \u00b7 ovulation \u2248 next period \u2212 14 days, fertile window = the 5 days before and the day of ovulation \u00b7 <a href="https://www.nejm.org/doi/full/10.1056/NEJM199512073332301" target="_blank" rel="noopener">Wilcox et al., NEJM 1995</a> \u00b7 not medical advice</div>';

// the log page: every start, the cycle between each, your own average, and what comes next
function logBody(starts, now, esc, head) {
  const s = stats(starts), today = day0(now);
  if (!starts.length) return '<h2>Period log</h2><div class="sub">nothing logged yet \u00b7 saved only in this browser</div>'
    + '<p>Say ' + ask('my period started today', esc) + ' (or a date, like \u201cmy period started on October 1\u201d) on the first day of each period. After two or more I learn your own cycle length, and \u201cwhen is my next period\u201d or \u201cwhen am i ovulating\u201d use it.</p>' + SRC;
  const cyc = s.avg || 28, est = !s.avg;
  const c = cycleAt(s.last, cyc, 14), day = diff(s.last, today) + 1;
  const ahead = diff(today, c.next); // days until the next period; below zero once it is overdue
  const rows = starts.map(fromIso).slice().reverse().map((d, i, arr) => {
    const prev = arr[i + 1], n = prev ? diff(prev, d) : null;
    return '<li>' + esc(short(d)) + (n == null ? '' : n > 60 ? ' <span style="color:#8a8a8a">\u00b7 ' + n + ' days after the one before (a gap, not counted)</span>' : ' \u00b7 <b>' + n + '-day</b> cycle') + '</li>';
  }).join('');
  const irregular = s.lens.length >= 2 && s.hi - s.lo >= 8;
  const outside = s.lens.some((n) => n < 21 || n > 35);
  return '<h2>Period log</h2><div class="sub">' + esc(starts.length + (starts.length === 1 ? ' period' : ' periods') + ' logged \u00b7 saved only in this browser') + '</div>'
    + (head ? '<p style="font-size:17px;margin:8px 0 4px">' + head + '</p>' : '')
    + (s.avg ? '<div style="font-size:34px;font-weight:300;line-height:1.15;margin:6px 0 2px">' + s.avg + '-day cycle</div><div class="sub">' + esc('your average over ' + s.lens.length + (s.lens.length === 1 ? ' cycle' : ' cycles') + (s.lens.length > 1 ? ', shortest ' + s.lo + ', longest ' + s.hi : '')) + '</div>'
      : '<p style="color:#8a8a8a">One period logged, so I count a 28-day cycle for now. Log the next one and I will use your own length.</p>')
    + (day >= 1 ? '<p>Today is <b>day ' + day + '</b> of your cycle. '
      + (ahead > 0 ? 'Your next period is expected <b>' + esc(long(c.next)) + '</b> (in ' + ahead + (ahead === 1 ? ' day' : ' days') + ')' + (est ? ', counting 28 days' : '') + '.'
        : ahead === 0 ? 'Your next period is expected <b>today</b>.'
        : 'Your period was expected ' + esc(md(c.next)) + ', <b>' + (-ahead) + (ahead === -1 ? ' day' : ' days') + ' ago</b>' + (irregular && -ahead <= s.hi - cyc ? ', inside your usual spread of ' + s.lo + '\u2013' + s.hi + ' days' : '') + '.')
      + '</p>' : '')
    + (ahead >= 0 ? '<p>Fertile window this cycle: <b>' + esc(md(c.fertile[0]) + ' \u2013 ' + md(c.fertile[1])) + '</b>, ovulation around <b>' + esc(md(c.ov)) + '</b>.</p>' : '')
    + (irregular ? '<p style="color:#8a8a8a">Your cycles vary by ' + (s.hi - s.lo) + ' days, so I give the fertile window as a range (ACOG\u2019s calendar rule) when you ask about ovulation.</p>' : '')
    + (outside ? '<p style="color:#8a8a8a">Some of your cycles are outside 21\u201335 days. That happens now and then; if it keeps happening, it is worth mentioning to a doctor (ACOG).</p>' : '')
    + '<div class="sub" style="margin-top:10px">Logged</div><ul>' + rows + '</ul>'
    + '<p style="color:#8a8a8a">Next: ' + ask('when am i ovulating', esc) + ' \u00b7 ' + ask('when is my next period', esc) + ' \u00b7 ' + ask('is my period late', esc) + ' \u00b7 ' + ask('remove my last period', esc) + '</p>'
    + SRC;
}

function lateBody(starts, now, esc) {
  const s = stats(starts);
  if (!starts.length) return '<h2>Is my period late?</h2><div class="sub">nothing logged yet</div>'
    + '<p>I can tell once I know when your last period started: say ' + ask('my period started on October 1', esc) + ' (your real date). Cycles often shift by a few days from month to month; a home pregnancy test is most reliable from the day a period is due.</p>' + SRC;
  const cyc = s.avg || 28, exp = add(s.last, cyc), d = diff(exp, now);
  const slack = s.lens.length >= 2 ? Math.max(0, s.hi - cyc) : 0;
  const line = d <= 0 ? 'Not late: your next period is expected ' + (d === 0 ? 'today' : esc(long(exp)) + ', in ' + (-d) + (d === -1 ? ' day' : ' days')) + '.'
    : d <= Math.max(5, slack) ? 'It is ' + d + (d === 1 ? ' day' : ' days') + ' past ' + esc(md(exp)) + ', still within ' + (slack > 5 ? 'your own usual spread (cycles of ' + s.lo + '\u2013' + s.hi + ' days)' : 'the few days cycles often shift by') + '.'
    : '<b>' + d + ' days late</b>: expected ' + esc(md(exp)) + ' from your ' + cyc + '-day ' + (s.avg ? 'average' : 'count') + '.';
  return '<h2>Is my period late?</h2><div class="sub">' + esc('from your period log \u00b7 last period ' + short(s.last)) + '</div>'
    + '<p style="font-size:17px;margin:8px 0">' + line + '</p>'
    + (d > 0 ? '<p style="color:#8a8a8a">If there is any chance of pregnancy, a home pregnancy test is reliable from now. Stress, illness, travel, weight change and some medicines can also delay a period; if periods stop for three months in a row, see a doctor.</p>' : '')
    + '<p style="color:#8a8a8a">When it starts, say ' + ask('my period started today', esc) + '.</p>' + SRC;
}

function apply(q, store, now = new Date()) {
  const starts = loadLog(store);
  if (q.kind === 'log') {
    if (diff(q.date, now) < 0) return { starts, head: 'That date is still ahead, so I left the log as it was.' };
    const near = starts.find((x) => Math.abs(diff(fromIso(x), q.date)) <= 10);
    if (near && iso(q.date) === near) return { starts, head: 'Already logged: your period that started ' + short(q.date) + '.' };
    if (near && q.onPeriod) return { starts, head: 'You are on the period that started ' + short(fromIso(near)) + '; it is already logged.' };
    const next = starts.filter((x) => x !== near).concat(iso(q.date)).sort();
    saveLog(next, store);
    return { starts: next, head: (near ? 'Moved the period that started ' + short(fromIso(near)) + ' to ' : 'Logged: period started ') + short(q.date) + (diff(q.date, now) === 0 ? ' (today)' : '') + '.', saved: true };
  }
  if (q.kind === 'remove') {
    if (!starts.length) return { starts, head: 'Your period log is empty.' };
    const gone = q.which === 'date' ? starts.find((x) => Math.abs(diff(fromIso(x), q.date)) <= 3) : starts[starts.length - 1];
    if (!gone) return { starts, head: 'No period logged around ' + short(q.date) + '.' };
    const next = starts.filter((x) => x !== gone); saveLog(next, store);
    return { starts: next, head: 'Took off the period that started ' + short(fromIso(gone)) + '.', saved: true };
  }
  if (q.kind === 'clear') { saveLog([], store); return { starts: [], head: starts.length ? 'Cleared your period log (' + starts.length + (starts.length === 1 ? ' entry' : ' entries') + ').' : 'Your period log was already empty.', saved: true, cleared: true }; }
  return { starts };
}

async function run(text, api) {
  const { showPage, esc, say } = api;
  const q = periodOf(text);
  if (!q) return 'none';
  const now = new Date();
  if (q.kind === 'late') { showPage((el) => { el.innerHTML = lateBody(loadLog(), now, esc); }); return 'period'; }
  const r = apply(q, null, now);
  const head = r.head ? esc(r.head) : '';
  showPage((el) => { el.innerHTML = r.cleared ? '<h2>Period log</h2><div class="sub">saved only in this browser</div><p style="font-size:17px">' + head + '</p><p style="color:#8a8a8a">Say ' + ask('my period started today', esc) + ' to start again.</p>' : logBody(r.starts, now, esc, head); });
  if (say && r.saved) say(q.kind === 'log' ? 'logged' : 'updated');
  return 'period';
}

export { periodOf, apply, stats, fromLog, loadLog, KEY };
export default {
  name: 'period',
  examples: [
    'my period started today',
    'my period started on october 1',
    'log my period on sept 3',
    'show my period log',
    'how long is my cycle',
    'is my period late',
    'remove my last period'
  ],
  nearMisses: [
    'due date if my last period was march 1',
    'when am i ovulating if my last period was march 1',
    'what period is next at school',
    'periodic table',
    'period cramps'
  ],
  match(lower, text) { return !!periodOf(text); },
  run
};
