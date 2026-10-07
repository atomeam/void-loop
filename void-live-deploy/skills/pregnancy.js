/**
 * pregnancy skill - due date and how far along you are (no key; pure date math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "due date if my last period was march 1", "i conceived on january 10 when is my baby due",
 * "my due date is june 1 how far along am i", "ivf due date 5 day transfer on may 2",
 * "how many weeks pregnant am i if my last period was august 10", "due date calculator".
 * Same rules the big due-date calculators use (BabyCenter, Mayo Clinic, ACOG's own wheel): Naegele's rule, last
 * period + 280 days, shifted by cycle length; conception + 266; IVF transfer + 266 minus the embryo's age. Better than
 * those: one ask in plain words (no form), any of the four starting points, how far along you are today, the
 * trimester, and the dates of the milestones that matter, with the ACOG note that an early ultrasound date wins.
 */
const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const MON = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const D = String.raw`(?:today|yesterday|(?:${MON})\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:${MON})\.?(?:,?\s+\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})`;
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const diff = (a, b) => Math.round((day0(b) - day0(a)) / 86400000);

// a date as typed; with no year, the year that puts it in the window the ask implies ('past' = the most recent one not
// in the future, 'due' = the next one, allowing up to 6 weeks overdue)
function dateOf(s, want, now = new Date()) {
  s = String(s || '').toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const today = day0(now);
  if (s === 'today') return today;
  if (s === 'yesterday') return add(today, -1);
  let y = null, mo = null, d = null, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/))) { mo = +m[1] - 1; d = +m[2]; if (m[3]) y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; }
  else if ((m = s.match(new RegExp(String.raw`^(${MON})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$`)))) { mo = MONTHS[m[1]]; d = +m[2]; if (m[3]) y = +m[3]; }
  else if ((m = s.match(new RegExp(String.raw`^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MON})\.?(?:\s+(\d{4}))?$`)))) { mo = MONTHS[m[2]]; d = +m[1]; if (m[3]) y = +m[3]; }
  else return null;
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  const make = (yy) => { const r = new Date(yy, mo, d, 12); return r.getMonth() === mo ? r : null; };
  if (y != null) return make(y);
  const t = today.getFullYear();
  if (want === 'due') { for (const yy of [t, t + 1]) { const r = make(yy); if (r && diff(today, r) >= -42) return r; } return null; }
  for (const yy of [t, t - 1]) { const r = make(yy); if (r && diff(r, today) >= 0) return r; }
  return null;
}

const PREG = /\b(?:pregnan\w*|period|lmp|menstrua\w*|conceiv\w*|concep\w*|baby|babies|ivf|embryo|transfer|due\s+date|edd|gestation\w*|trimester|how\s+far\s+along)\b/;
const OFF = /\b(?:essay|homework|assignment|paper|project|invoice|bill|rent|tax(?:es)?|library|book|loan|payment|card|credit|car|cat|dog|puppy|kitten|horse|cow|goat|sheep|pig|mare|ewe|game|hockey|class|school|movie|song|lyrics|meaning|define|synonym|translate|spell|test|symptoms?|signs?|remind|reminder|alarm|calendar)\b/;
const CYC = /\b(\d{2})[\s-]*days?\s+(?:menstrual\s+)?cycles?\b|\bcycles?\s+(?:is|of|length\s+(?:is|of)?)?\s*(\d{2})\s*(?:days?)?\b/;
const LMP = String.raw`(?:(?:the\s+)?(?:first\s+day\s+of\s+)?(?:(?:my|her|the)\s+)?last\s+(?:menstrual\s+)?period|lmp|(?:my|her)\s+period)`;

function pregOf(text, now = new Date()) {
  const t = String(text || '').toLowerCase().replace(/[?!]+$/, '').replace(/\.$/, '').replace(/[\u2019']/g, '\u0027').replace(/\s+/g, ' ').trim();
  if (!t || !PREG.test(t) || OFF.test(t)) return null;
  let cycle = 28; const c = t.match(CYC);
  if (c) { cycle = +(c[1] || c[2]); if (cycle < 20 || cycle > 45) return null; }
  const s = t.replace(CYC, ' ').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ' ').replace(/\s+(?:and|with)\s*$/, '').trim();
  if (/^(?:(?:a|an|open\s+(?:a|the)|show\s+(?:me\s+)?(?:a|the))\s+)?(?:pregnancy\s+)?(?:due\s+date|pregnancy|conception|ivf\s+due\s+date|weeks?\s+pregnant|gestational\s+age)\s+calculator$/.test(s)
    || /^(?:how\s+many\s+weeks\s+pregnant\s+am\s+i|how\s+far\s+along\s+am\s+i\s+in\s+my\s+pregnancy|when\s+is\s+my\s+(?:baby|due\s+date)(?:\s+due)?|calculate\s+my\s+due\s+date|what\s+is\s+my\s+due\s+date)$/.test(s)) return { kind: 'calc' };
  let m;
  // IVF transfer: "ivf due date 5 day transfer on may 2", "5 day embryo transfer on may 2 when am i due"
  m = s.match(new RegExp(String.raw`\b([356])[\s-]*day\s+(?:embryo\s+|blastocyst\s+|frozen\s+|fresh\s+)?(?:embryo\s+)?transfer\s+(?:was\s+)?(?:on\s+)?(${D})\b`))
    || s.match(new RegExp(String.raw`\btransfer(?:red)?\s+(?:was\s+|a\s+)?(?:on\s+)?(${D})\b.*?\b([356])[\s-]*day\b`));
  if (m && /\b(?:due|ivf|pregnan|weeks|far\s+along|transfer)/.test(s)) {
    const [age, ds] = /^\d$/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
    const at = dateOf(ds, 'past', now); if (!at) return null;
    return { kind: 'ivf', at, age, due: add(at, 266 - age) };
  }
  // conception: "i conceived on january 10 when is my baby due", "due date if conceived jan 10", "conception date jan 10"
  m = s.match(new RegExp(String.raw`\b(?:conceived|conception(?:\s+date)?(?:\s+(?:was|is))?|got\s+pregnant)\s+(?:on\s+|around\s+|about\s+)?(${D})\b`));
  if (m) { const at = dateOf(m[1], 'past', now); if (!at) return null; return { kind: 'conception', at, due: add(at, 266) }; }
  // last period: "due date if my last period was march 1", "lmp march 1", "how many weeks pregnant am i if my last period was aug 10"
  m = s.match(new RegExp(String.raw`\b${LMP}\s+(?:was|is|started|began|start\s+date\s+(?:was|is))?\s*(?:on\s+|around\s+|about\s+)?(${D})\b`))
    || s.match(new RegExp(String.raw`^(${D})\s+(?:lmp|last\s+period)\b`));
  if (m && (/\b(?:due|pregnan|weeks|far\s+along|baby|edd|trimester|gestation|lmp)\b/.test(s) || /^(?:my\s+)?last\s+(?:menstrual\s+)?period\s+(?:was|started)/.test(s))) {
    const at = dateOf(m[1], 'past', now); if (!at) return null;
    return { kind: 'lmp', at, cycle, due: add(at, 280 + cycle - 28) };
  }
  // a known due date: "my due date is june 1 how far along am i", "due june 1 how many weeks am i"
  m = s.match(new RegExp(String.raw`\b(?:my\s+|our\s+|her\s+)?(?:due\s+date\s+(?:is|was)|edd\s+(?:is|was)?|(?:i\s+am|i'm|im|she's|she\s+is)\s+due(?:\s+on)?|due\s+on|due)\s+(${D})\b`));
  if (m && /\b(?:how\s+far\s+along|how\s+many\s+weeks|weeks\s+pregnant|what\s+week|which\s+trimester|what\s+trimester|when\s+did\s+i\s+conceive|conceiv|conception|trimester|pregnan)\b/.test(s)) {
    const due = dateOf(m[1], 'due', now); if (!due) return null;
    return { kind: 'due', due };
  }
  return null;
}

function weeksOf(days) { return { w: Math.floor(days / 7), d: days % 7 }; }
function waText(days) { const { w, d } = weeksOf(days); return w + (w === 1 ? ' week' : ' weeks') + (d ? ', ' + d + (d === 1 ? ' day' : ' days') : ''); }
function trimester(days) { return days < 98 ? 'First trimester' : days < 196 ? 'Second trimester' : 'Third trimester'; }
const long = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const short = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// everything a page shows, from the due date: start of pregnancy dating (LMP-equivalent) is due - 280
function plan(due, now = new Date()) {
  const start = add(due, -280), ga = diff(start, now);
  const at = (w, d = 0) => add(start, w * 7 + d);
  const miles = [
    { w: 4, label: 'A home test can turn positive', when: short(at(4)) },
    { w: 8, label: 'First prenatal visit, often with a dating ultrasound (8\u201312 weeks)', when: short(at(8)) + ' \u2013 ' + short(at(12)) },
    { w: 10, label: 'Cell-free DNA screening can start (10 weeks on)', when: short(at(10)) },
    { w: 14, label: 'Second trimester begins (14 weeks)', when: short(at(14)) },
    { w: 18, label: 'Anatomy ultrasound (18\u201322 weeks)', when: short(at(18)) + ' \u2013 ' + short(at(22)) },
    { w: 24, label: 'Glucose screening for gestational diabetes (24\u201328 weeks)', when: short(at(24)) + ' \u2013 ' + short(at(28)) },
    { w: 28, label: 'Third trimester begins (28 weeks)', when: short(at(28)) },
    { w: 36, label: 'Group B strep test (36 0/7\u201337 6/7 weeks)', when: short(at(36)) + ' \u2013 ' + short(at(37, 6)) },
    { w: 39, label: 'Full term (39 0/7\u201340 6/7 weeks)', when: short(at(39)) + ' \u2013 ' + short(at(40, 6)) }
  ];
  return { start, due, ga, conceive: add(start, 14), left: diff(now, due), miles, wa: ga >= 0 && ga <= 44 * 7 ? waText(ga) : null, tri: ga >= 0 && ga < 42 * 7 ? trimester(ga) : null };
}

const NOTE = 'An estimate: only a few babies arrive on the day itself, and full term runs from 39 weeks 0 days to 40 weeks 6 days. Weeks are counted from the first day of the last period, about two weeks before conception. If you have had an early ultrasound, its date is the more accurate one, so go by what your doctor or midwife gives you (ACOG).';
const SRC = '<div class="src">Method: Naegele\u2019s rule (last period + 280 days, adjusted for cycle length), conception + 266, IVF transfer + 266 \u2212 embryo age \u00b7 <a href="https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date" target="_blank" rel="noopener">ACOG, Methods for Estimating the Due Date</a> \u00b7 <a href="https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2013/11/definition-of-term-pregnancy" target="_blank" rel="noopener">ACOG, Definition of Term Pregnancy</a> \u00b7 not medical advice</div>';

function body(q, p, esc) {
  const from = q.kind === 'lmp' ? 'last period ' + short(q.at) + (q.cycle !== 28 ? ' (' + q.cycle + '-day cycle)' : '')
    : q.kind === 'conception' ? 'conception ' + short(q.at)
    : q.kind === 'ivf' ? q.age + '-day embryo transfer ' + short(q.at) : 'due date ' + short(q.due);
  let now = '';
  if (p.wa) now = '<p style="font-size:18px;margin:10px 0 2px">Today: <b>' + esc(p.wa) + '</b> pregnant' + (p.tri ? ' \u00b7 ' + esc(p.tri) : '') + '</p>'
    + '<p style="color:#8a8a8a;margin:0 0 6px">' + esc(p.left > 0 ? p.left + ' days to the due date' : p.left === 0 ? 'the due date is today' : -p.left + ' days past the due date') + '</p>';
  else if (p.ga < 0) now = '<p style="color:#8a8a8a">That date is still ahead, so these are the dates to expect from it.</p>';
  else now = '<p style="color:#8a8a8a">That due date has passed.</p>';
  const next = p.ga >= 0 ? p.miles.filter((m) => m.w * 7 >= p.ga - 21) : p.miles;
  return '<h2>' + (q.kind === 'due' ? 'How far along' : 'Due date') + '</h2><div class="sub">' + esc('from ' + from) + '</div>'
    + '<div style="font-size:40px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(q.kind === 'due' && p.wa ? p.wa : long(p.due)) + '</div>'
    + (q.kind === 'due' && p.wa ? '<div class="sub">due ' + esc(long(p.due)) + '</div>' : '')
    + now + (q.kind !== 'conception' && q.kind !== 'ivf' ? '<p style="color:#8a8a8a;margin:0 0 6px">Likely conceived around ' + esc(short(p.conceive)) + '.</p>' : '')
    + (next.length ? '<div class="sub">Coming up</div><ul>' + next.map((m) => '<li>' + esc(m.label) + ': <b>' + esc(m.when) + '</b></li>').join('') + '</ul>' : '')
    + '<p style="color:#8a8a8a">' + esc(NOTE) + '</p>' + SRC;
}

function runCalc(api) {
  const { showPage, esc } = api;
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const el = showPage((p) => { p.innerHTML = '<h2>Due date calculator</h2>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0">'
    + '<select id="pg-mode" aria-label="what the date is"><option value="lmp">First day of my last period</option><option value="conception">Date I conceived</option><option value="ivf5">5-day IVF transfer</option><option value="ivf3">3-day IVF transfer</option><option value="due">My due date</option></select>'
    + '<input id="pg-date" type="date" value="' + iso(add(new Date(), -56)) + '" aria-label="date">'
    + '<label id="pg-cyc-l">cycle <input id="pg-cyc" type="number" min="20" max="45" value="28" style="width:4em" aria-label="cycle length in days"> days</label></div>'
    + '<div id="pg-out" aria-live="polite"></div>'; });
  const q = (id) => el.querySelector('#' + id), out = q('pg-out');
  const upd = () => {
    const v = q('pg-date').value, mode = q('pg-mode').value;
    q('pg-cyc-l').style.display = mode === 'lmp' ? '' : 'none';
    const parts = (v || '').split('-');
    if (parts.length !== 3) { out.textContent = 'pick a date'; return; }
    const d = new Date(+parts[0], +parts[1] - 1, +parts[2], 12);
    const cyc = Math.min(45, Math.max(20, +q('pg-cyc').value || 28));
    const qq = mode === 'lmp' ? { kind: 'lmp', at: d, cycle: cyc, due: add(d, 280 + cyc - 28) }
      : mode === 'conception' ? { kind: 'conception', at: d, due: add(d, 266) }
      : mode === 'due' ? { kind: 'due', due: d } : { kind: 'ivf', at: d, age: mode === 'ivf5' ? 5 : 3, due: add(d, 266 - (mode === 'ivf5' ? 5 : 3)) };
    out.innerHTML = body(qq, plan(qq.due), esc).replace(/^<h2>[^<]*<\/h2>/, '');
  };
  for (const id of ['pg-mode', 'pg-date', 'pg-cyc']) q(id).addEventListener('input', upd);
  q('pg-mode').addEventListener('change', upd); upd();
  return 'pregnancy';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = pregOf(text);
  if (!q) return 'none';
  if (q.kind === 'calc') return runCalc(api);
  const p = plan(q.due);
  showPage((el) => { el.innerHTML = body(q, p, esc); });
  return 'pregnancy';
}

export { pregOf, plan, dateOf, waText };
export default {
  name: 'pregnancy',
  examples: [
    'due date if my last period was march 1',
    'i conceived on january 10 when is my baby due',
    'my due date is june 1 how far along am i',
    'ivf due date 5 day transfer on may 2',
    'how many weeks pregnant am i if my last period was august 10',
    'due date calculator'
  ],
  nearMisses: [
    'due date for my essay is friday',
    'when is my rent due',
    'what are the signs of pregnancy',
    'remind me about my due date',
    'how long is a cat pregnant',
    'define trimester'
  ],
  match(lower, text) { return !!pregOf(text); },
  run
};
