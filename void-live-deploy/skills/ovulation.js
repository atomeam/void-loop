/**
 * ovulation skill - fertile window, ovulation day and next period (no key; pure date math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "when am i ovulating if my last period was march 1", "fertile window if my last period was sept 20 and my cycle is 30 days",
 * "when is my next period if my last period was sept 20", "my cycle is 26 to 32 days and my last period was oct 1",
 * "my next period is due nov 3 when do i ovulate", "ovulation calculator".
 * Same rules the big ovulation calculators use (Flo, Clue, BabyCenter, Clearblue): ovulation about 14 days before the
 * next period (luteal phase), and the six-day fertile window that ends on ovulation day (Wilcox, NEJM 1995). Better
 * than those: one ask in plain words (no form, no account), any cycle length, your own luteal phase, irregular cycles
 * as a range (ACOG's calendar rule: shortest cycle - 18 to longest - 11), the cycle rolled forward to today, the next
 * three windows, a colored month view, and the day a home pregnancy test is most reliable.
 */
import { dateOf } from './pregnancy.js';

const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const diff = (a, b) => Math.round((day0(b) - day0(a)) / 86400000);
const MONS = 'jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december';
const D = String.raw`(?:today|yesterday|(?:${MONS})\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:${MONS})\.?(?:,?\s+\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})`;

const OV = /\b(?:ovulat\w*|fertile|fertility\s+(?:window|calculator|days?)|most\s+fertile|next\s+period|period\s+(?:is\s+)?(?:due|calculator|tracker|predictor)|when\s+(?:will|should|does|do|is)\s+(?:i\s+get\s+)?my\s+(?:next\s+)?period|when\s+(?:will|should)\s+i\s+(?:get|start)\s+my\s+period|best\s+(?:time|days?)\s+to\s+(?:get\s+pregnant|conceive|try\s+for\s+a\s+baby)|trying\s+to\s+conceive|ttc|chances?\s+of\s+(?:getting\s+)?pregnant|(?:menstrual\s+)?cycle\s+calculator|luteal)\b/;
const OFF = /\b(?:fertili[sz]\w*|soil|plant|plants|lawn|garden|crops?|land|crescent|rate|population|country|chickens?|hens?|cat|cats|dog|dogs|mare|horse|cow|cattle|goat|sheep|pig|fish|class|school|lesson|bell|period\s+of\s+history|essay|define|definition|meaning|synonym|translate|spell|remind|reminder|alarm|pain|cramps?|symptoms?|signs?|discharge|bleeding|spotting|due\s+date|weeks\s+pregnant|how\s+far\s+along|trimester)\b/;
const LMP = String.raw`(?:(?:the\s+)?(?:first\s+day\s+of\s+)?(?:(?:my|her|the)\s+)?(?:last\s+(?:menstrual\s+)?)?period|lmp)`;
const RANGE = /\b(?:cycles?\s+(?:is|are|run|runs|vary|varies|lasts?|range|ranges)?\s*(?:anywhere\s+)?(?:from\s+|between\s+)?(\d{2})\s*(?:-|\u2013|to|and)\s*(\d{2})(?:\s*days?)?|(\d{2})\s*(?:-|\u2013|to)\s*(\d{2})[\s-]*days?\s+(?:menstrual\s+)?cycles?)\b/;
const CYC = /\b(\d{2})[\s-]*days?\s+(?:menstrual\s+)?cycles?\b|\bcycles?(?:\s+length)?\s+(?:is|are|of|lasts?|runs?)?\s*(?:about\s+|around\s+|usually\s+)?(\d{2})(?:\s*days?)?\b/;
const LUT = /\bluteal(?:\s+phase)?(?:\s+(?:is|of|lasts?))?\s*(?:about\s+)?(\d{1,2})(?:\s*days?)?\b|\b(\d{1,2})[\s-]*days?\s+luteal(?:\s+phase)?\b/;

function ovOf(text, now = new Date()) {
  let t = String(text || '').toLowerCase().replace(/[?!]+$/, '').replace(/\.$/, '').replace(/[\u2019']/g, '\u0027').replace(/\s+/g, ' ').trim();
  if (!t || !OV.test(t) || OFF.test(t)) return null;
  if (/^(?:what|who)\s+(?:is|are|does)\s+(?:an?\s+|the\s+)?(?:ovulation|ovulating|fertile|fertility|luteal)\b/.test(t)) return null;
  let cycle = 28, lo = null, hi = null, luteal = 14, m;
  if ((m = t.match(RANGE))) {
    lo = +(m[1] || m[3]); hi = +(m[2] || m[4]);
    if (lo > hi) [lo, hi] = [hi, lo];
    if (lo < 20 || hi > 45) return null;
    if (lo === hi) { cycle = lo; lo = hi = null; }
    t = t.replace(RANGE, ' ');
  } else if ((m = t.match(CYC))) { cycle = +(m[1] || m[2]); if (cycle < 20 || cycle > 45) return null; t = t.replace(CYC, ' '); }
  if ((m = t.match(LUT))) { luteal = +(m[1] || m[2]); if (luteal < 9 || luteal > 17) return null; t = t.replace(LUT, ' '); }
  const s = t.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').replace(/\s+(?:and|with)\s*$/, '').trim();
  // a known next period: "my next period is due nov 3 when do i ovulate", "period due on nov 3 when am i fertile"
  m = s.match(new RegExp(String.raw`\b(?:next\s+period|period)\s+(?:is\s+|should\s+be\s+|will\s+be\s+)?(?:due|expected|coming|starts?)\s+(?:on\s+|around\s+)?(${D})\b`));
  if (m && /\b(?:ovulat|fertile|conceive|pregnant|luteal)/.test(s)) {
    const next = dateOf(m[1], 'due', now); if (!next) return null;
    return { kind: 'next', lmp: add(next, -(lo ? lo : cycle)), cycle: lo ? lo : cycle, luteal };
  }
  m = s.match(new RegExp(String.raw`\b${LMP}\s+(?:was|is|started|starts|began|came|start\s+date\s+(?:was|is))?\s*(?:on\s+|around\s+|about\s+)?(${D})\b`))
    || s.match(new RegExp(String.raw`^(${D})\s+(?:lmp|last\s+period)\b`))
    || s.match(new RegExp(String.raw`\b(?:i\s+)?(?:started|got)\s+my\s+(?:last\s+)?period\s+(?:on\s+)?(${D})\b`));
  if (m) {
    const lmp = dateOf(m[1], 'past', now); if (!lmp) return null;
    if (lo) return { kind: 'range', lmp, lo, hi, luteal };
    return { kind: 'cycle', lmp, cycle, luteal };
  }
  // no date yet: a calculator, as long as the ask is about the asker's own cycle
  if (/\b(?:calculator|tracker|predictor)\b/.test(s) || /\b(?:my|i|i'm|im|am\s+i|me|we)\b/.test(s) || /^(?:fertile|fertility)\s+window$/.test(s)) return { kind: 'calc', cycle, luteal, lo, hi };
  return null;
}

// one cycle from its first day: ovulation = next period - luteal; fertile window = the 5 days before and the day of ovulation
function cycleAt(start, cycle, luteal) {
  const next = add(start, cycle), ov = add(next, -luteal);
  return { start, next, ov, fertile: [add(ov, -5), ov], peak: [add(ov, -2), ov], lh: add(ov, -4), test: next };
}

function plan(q, now = new Date()) {
  if (q.kind === 'range') {
    const { lmp, lo, hi, luteal } = q;
    return { range: true, lmp, today: day0(now), day: diff(lmp, now) + 1,
      fertile: [add(lmp, lo - 19), add(lmp, hi - 12)], ov: [add(lmp, lo - luteal), add(lmp, hi - luteal)], next: [add(lmp, lo), add(lmp, hi)] };
  }
  const { lmp, cycle, luteal } = q, given = cycleAt(lmp, cycle, luteal);
  const since = diff(lmp, now), k = since >= cycle ? Math.floor(since / cycle) : 0;
  // the window to lead with: the first one from the current cycle on that has not ended yet
  let j = k; while (diff(now, cycleAt(add(lmp, j * cycle), cycle, luteal).ov) < 0) j++;
  const lead = cycleAt(add(lmp, j * cycle), cycle, luteal);
  const cur = cycleAt(add(lmp, k * cycle), cycle, luteal);
  const upcoming = [0, 1, 2].map((i) => cycleAt(add(lmp, (j + i) * cycle), cycle, luteal));
  return { range: false, given, lead, cur, upcoming, rolled: k > 0, today: day0(now), day: since >= 0 ? since - k * cycle + 1 : null, cycle, luteal };
}

const long = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const short = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const md = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
const span = (a, b) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  ? a.toLocaleDateString('en-US', { month: 'long' }) + ' ' + a.getDate() + '\u2013' + b.getDate() + ', ' + a.getFullYear()
  : md(a) + ' \u2013 ' + md(b) + ', ' + b.getFullYear();
const inR = (d, a, b) => diff(a, d) >= 0 && diff(d, b) >= 0;

function status(p) {
  const t = p.today, c = p.cur;
  if (p.day == null) return 'That period start is still ahead.';
  if (diff(c.ov, t) === 0) return 'Today is your likely ovulation day, the most fertile day of the cycle.';
  if (inR(t, c.peak[0], c.peak[1])) return 'Today is one of your most fertile days.';
  if (inR(t, c.fertile[0], c.fertile[1])) return 'Today is in your fertile window.';
  const toF = diff(t, c.fertile[0]);
  if (toF > 0) return 'Your fertile window opens in ' + toF + (toF === 1 ? ' day' : ' days') + '.';
  const toP = diff(t, c.next);
  return 'The fertile window has passed for this cycle; your next period is expected in ' + toP + (toP === 1 ? ' day' : ' days') + '.';
}

// a small month view: period (about 5 days), fertile window, ovulation day, today
function monthView(c, today, esc) {
  const first = new Date(c.start.getFullYear(), c.start.getMonth(), 1, 12);
  const last = add(c.next, 4), months = [];
  for (let m = first; diff(m, last) >= 0; m = new Date(m.getFullYear(), m.getMonth() + 1, 1, 12)) months.push(m);
  const kind = (d) => diff(d, c.ov) === 0 ? 'ov' : inR(d, c.fertile[0], c.fertile[1]) ? 'fe' : (inR(d, c.start, add(c.start, 4)) || inR(d, c.next, add(c.next, 4))) ? 'pe' : '';
  const bg = { ov: '#3fb27f', fe: 'rgba(63,178,127,.28)', pe: 'rgba(214,92,120,.32)', '': 'transparent' };
  return '<div style="display:flex;gap:18px;flex-wrap:wrap;margin:8px 0">' + months.slice(0, 2).map((m0) => {
    const y = m0.getFullYear(), mo = m0.getMonth(), n = new Date(y, mo + 1, 0).getDate(), pad = new Date(y, mo, 1).getDay();
    let cells = '';
    for (let i = 0; i < pad; i++) cells += '<span></span>';
    for (let d = 1; d <= n; d++) {
      const dt = new Date(y, mo, d, 12), k = kind(dt), isT = diff(dt, today) === 0;
      cells += '<span title="' + esc(md(dt)) + '" style="text-align:center;padding:2px 0;border-radius:6px;background:' + bg[k] + (isT ? ';outline:1px solid currentColor' : '') + (k === 'ov' ? ';color:#fff;font-weight:600' : '') + '">' + d + '</span>';
    }
    return '<div style="min-width:196px"><div class="sub">' + esc(m0.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })) + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(7,26px);gap:2px;font-size:12px">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => '<span style="text-align:center;color:#8a8a8a">' + w + '</span>').join('') + cells + '</div></div>';
  }).join('') + '</div><div style="font-size:12px;color:#8a8a8a"><span style="background:' + bg.pe + ';padding:0 6px;border-radius:4px">period</span> <span style="background:' + bg.fe + ';padding:0 6px;border-radius:4px">fertile</span> <span style="background:' + bg.ov + ';color:#fff;padding:0 6px;border-radius:4px">ovulation</span></div>';
}

const NOTE = 'An estimate from the calendar: ovulation usually comes about 14 days before the next period, but it can shift from cycle to cycle, so ovulation (LH) tests, cervical mucus or a temperature chart pin it down better. Don\u2019t rely on these dates as birth control. If cycles are often shorter than 21 or longer than 35 days, or you have been trying for a year (six months if you are 35 or older), talk to a doctor (ACOG).';
const SRC = '<div class="src">Method: next period \u2212 luteal phase = ovulation; fertile window = the 5 days before and the day of ovulation \u00b7 <a href="https://www.nejm.org/doi/full/10.1056/NEJM199512073332301" target="_blank" rel="noopener">Wilcox, Weinberg &amp; Baird, NEJM 1995</a> \u00b7 <a href="https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning" target="_blank" rel="noopener">ACOG, Fertility awareness-based methods</a> \u00b7 not medical advice</div>';

function body(q, p, esc) {
  if (p.range) {
    return '<h2>Fertile window</h2><div class="sub">' + esc('from your last period ' + short(p.lmp) + ', cycles of ' + q.lo + '\u2013' + q.hi + ' days') + '</div>'
      + '<div style="font-size:34px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(span(p.fertile[0], p.fertile[1])) + '</div>'
      + '<p>Ovulation likely between <b>' + esc(md(p.ov[0])) + '</b> and <b>' + esc(md(p.ov[1])) + '</b>; next period between <b>' + esc(md(p.next[0])) + '</b> and <b>' + esc(md(p.next[1])) + '</b>.</p>'
      + (p.day >= 1 && p.day <= q.hi + 7 ? '<p style="color:#8a8a8a">Today is day ' + p.day + ' of this cycle' + (inR(p.today, p.fertile[0], p.fertile[1]) ? ', inside the possible fertile days.' : '.') + '</p>' : '')
      + '<p style="color:#8a8a8a">With cycles that vary, the calendar rule counts from your shortest cycle minus 18 days to your longest minus 11, so the window is wider. Ovulation tests narrow it down.</p>'
      + '<p style="color:#8a8a8a">' + esc(NOTE) + '</p>' + SRC;
  }
  const L = p.lead, from = q.kind === 'next' ? 'next period due ' + short(q.lmp && add(q.lmp, q.cycle)) : 'last period ' + short(q.lmp);
  const rows = (p.rolled || diff(p.given.start, L.start) !== 0 ? [p.given] : []).concat(p.upcoming);
  return '<h2>Fertile window</h2><div class="sub">' + esc('from ' + from + ' \u00b7 ' + q.cycle + '-day cycle' + (q.luteal !== 14 ? ', ' + q.luteal + '-day luteal phase' : '')) + '</div>'
    + '<div class="sub" style="margin-top:8px">' + (diff(p.cur.start, L.start) === 0 ? 'This cycle' : 'Next cycle') + '</div>'
    + '<div style="font-size:34px;font-weight:300;line-height:1.15;margin:2px 0 4px">' + esc(span(L.fertile[0], L.fertile[1])) + '</div>'
    + '<p style="font-size:17px;margin:6px 0 2px">Ovulation: <b>' + esc(long(L.ov)) + '</b></p>'
    + '<p style="margin:0 0 6px">Most fertile: <b>' + esc(md(L.peak[0]) + ' \u2013 ' + md(L.peak[1])) + '</b> \u00b7 next period: <b>' + esc(md(L.next)) + '</b></p>'
    + '<p style="color:#8a8a8a;margin:0 0 6px">' + esc((p.day != null ? 'Today is day ' + p.day + ' of your cycle. ' : '') + status(p)) + (p.rolled ? esc(' Counted forward from ' + short(q.lmp) + ', assuming your cycles have stayed at ' + q.cycle + ' days.') : '') + '</p>'
    + monthView(L, p.today, esc)
    + '<div class="sub" style="margin-top:10px">Next windows</div><ul>' + rows.map((c) => '<li>Period ' + esc(md(c.start)) + ': fertile <b>' + esc(md(c.fertile[0]) + ' \u2013 ' + md(c.fertile[1])) + '</b>, ovulation <b>' + esc(md(c.ov)) + '</b>, next period ' + esc(md(c.next)) + '</li>').join('') + '</ul>'
    + '<p style="color:#8a8a8a">Start daily ovulation (LH) tests around ' + esc(md(L.lh)) + '. If you are trying to get pregnant, a home pregnancy test is most reliable from the day your period is due: ' + esc(md(L.test)) + '.</p>'
    + '<p style="color:#8a8a8a">' + esc(NOTE) + '</p>' + SRC;
}

function runCalc(q0, api) {
  const { showPage, esc } = api;
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const el = showPage((p) => { p.innerHTML = '<h2>Ovulation calculator</h2>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0">'
    + '<label>first day of last period <input id="ov-date" type="date" value="' + iso(add(new Date(), -10)) + '" aria-label="first day of last period"></label>'
    + '<label>cycle <input id="ov-cyc" type="number" min="20" max="45" value="' + (q0.cycle || 28) + '" style="width:4em" aria-label="cycle length in days"> days</label>'
    + '<label>luteal phase <input id="ov-lut" type="number" min="9" max="17" value="' + (q0.luteal || 14) + '" style="width:4em" aria-label="luteal phase in days"> days</label></div>'
    + '<div id="ov-out" aria-live="polite"></div>'; });
  const g = (id) => el.querySelector('#' + id), out = g('ov-out');
  const upd = () => {
    const parts = (g('ov-date').value || '').split('-');
    if (parts.length !== 3) { out.textContent = 'pick a date'; return; }
    const lmp = new Date(+parts[0], +parts[1] - 1, +parts[2], 12);
    const cycle = Math.min(45, Math.max(20, +g('ov-cyc').value || 28)), luteal = Math.min(17, Math.max(9, +g('ov-lut').value || 14));
    const q = { kind: 'cycle', lmp, cycle, luteal };
    out.innerHTML = body(q, plan(q), esc).replace(/^<h2>[^<]*<\/h2>/, '');
  };
  for (const id of ['ov-date', 'ov-cyc', 'ov-lut']) g(id).addEventListener('input', upd);
  upd();
  return 'ovulation';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = ovOf(text);
  if (!q) return 'none';
  if (q.kind === 'calc') return runCalc(q, api);
  const p = plan(q);
  showPage((el) => { el.innerHTML = body(q, p, esc); });
  return 'ovulation';
}

export { ovOf, plan, cycleAt };
export default {
  name: 'ovulation',
  examples: [
    'when am i ovulating if my last period was march 1',
    'fertile window if my last period was sept 20 and my cycle is 30 days',
    'when is my next period if my last period was sept 20',
    'my cycle is 26 to 32 days and my last period was oct 1 when am i fertile',
    'my next period is due nov 3 when do i ovulate',
    'ovulation calculator'
  ],
  nearMisses: [
    'what is ovulation',
    'ovulation pain',
    'best fertilizer for tomatoes',
    'fertility rate in japan',
    'due date if my last period was march 1',
    'what period is next at school'
  ],
  match(lower, text) { return !!ovOf(text); },
  run
};
