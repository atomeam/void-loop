/**
 * sleep skill - bedtime and wake-up times by sleep cycles, plus how much sleep each age needs (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "if i wake up at 7am when should i go to sleep", "what time should i go to bed to wake up at 6:30",
 * "if i go to bed at 11pm when should i wake up", "when should i wake up if i go to sleep now",
 * "sleep calculator", "how much sleep does a teenager need".
 * Same method as the popular sleep calculators (sleepyti.me and the like): about 15 minutes to fall asleep, then
 * 90-minute cycles, so you wake between cycles instead of in deep sleep. Better than those: one ask in plain words,
 * the right answer picked out against the CDC's hours for your age, and an honest note that cycles vary.
 */
const FALL_ASLEEP = 15, CYCLE = 90;
const NEED = [ // CDC "About Sleep" table (built on the AASM 2016 pediatric consensus and AASM/SRS 2015 adult statement)
  { re: /\bnew\s?borns?\b|\b(?:[0-3])\s*(?:-|to)?\s*(?:month|mo)s?\b/, who: 'Newborn (0\u20133 months)', hours: '14\u201317 hours', lo: 14, note: 'counted over the whole day' },
  { re: /\binfants?\b|\bbab(?:y|ies)\b|\b(?:[4-9]|1[0-2])\s*(?:month|mo)s?\b/, who: 'Infant (4\u201312 months)', hours: '12\u201316 hours', lo: 12, note: 'including naps' },
  { re: /\btoddlers?\b|\b(?:1|2|one|two)\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?\b/, who: 'Toddler (1\u20132 years)', hours: '11\u201314 hours', lo: 11, note: 'including naps' },
  { re: /\bpre-?school(?:er)?s?\b|\b(?:[3-5]|three|four|five)\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?\b/, who: 'Preschool (3\u20135 years)', hours: '10\u201313 hours', lo: 10, note: 'including naps' },
  { re: /\bteen(?:ager)?s?\b|\bhigh\s+school(?:er)?s?\b|\b1[3-7]\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?\b/, who: 'Teen (13\u201318 years)', hours: '8\u201310 hours', lo: 8, note: 'every 24 hours' },
  { re: /\b(?:kids?|child(?:ren)?|school-?age(?:d)?|[6-9]|1[0-2])\s*(?:(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?)?\b/, who: 'School age (6\u201312 years)', hours: '9\u201312 hours', lo: 9, note: 'every 24 hours' },
  { re: /\b(?:seniors?|elderly|older\s+adults?|retirees?|6[5-9]|[7-9]\d)\b/, who: 'Adult 65 and older', hours: '7\u20138 hours', lo: 7, note: 'a night' },
  { re: /\b6[1-4]\b/, who: 'Adult 61\u201364', hours: '7\u20139 hours', lo: 7, note: 'a night' },
  { re: /\b(?:adults?|grown-?ups?|i|me|we|people|someone|a\s+person|1[89]|[2-5]\d|60)\b/, who: 'Adult 18\u201360', hours: '7 or more hours', lo: 7, note: 'a night' }
];
const OFF = /\b(?:remind|reminder|alarm|timer|apnea|apnoea|paralysis|walking|talking|disorder|study|mode|button|pc|computer|laptop|mac|windows|iphone|phone|song|lyrics|movie|film|meaning|define|synonym|translate|spell)\b/;

// "7", "7am", "7:30 a.m.", "06:45", "noon", "midnight", "now"; part = 'am' | 'pm' when the ask gave no am/pm
function timeOf(s, part) {
  s = String(s || '').trim().toLowerCase();
  if (/^(?:right\s+)?now$/.test(s)) { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), now: true }; }
  if (s === 'noon' || s === 'midday') return { h: 12, m: 0 };
  if (s === 'midnight') return { h: 0, m: 0 };
  const m = s.match(/^(\d{1,2})(?::|\.)?(\d{2})?\s*(a\.?m\.?|p\.?m\.?|in\s+the\s+morning|at\s+night|tonight|this\s+evening)?$/);
  if (!m) return null;
  let h = +m[1]; const mi = +(m[2] || 0); const ap = (m[3] || '').replace(/\./g, '');
  if (mi > 59 || h > 23) return null;
  const pm = /^pm|night|tonight|evening/.test(ap), am = /^am|morning/.test(ap);
  if (h > 12) { if (am) return null; return { h, m: mi }; }
  if (pm) h = h === 12 ? 12 : h + 12;
  else if (am) h = h === 12 ? 0 : h;
  else if (part === 'pm') h = h === 12 ? 0 : h <= 5 ? h : h + 12; // bedtime with no am/pm: "11" = 11 pm, "12" = midnight, "1" to "5" = the small hours
  // a wake-up time with no am/pm stays as said: "6:30" = 6:30 am, "12" = noon
  return { h, m: mi };
}
const T = String.raw`(?:right\s+now|now|noon|midday|midnight|\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|in\s+the\s+morning|at\s+night|tonight|this\s+evening)?)`;
const BED = String.raw`(?:go\s+to\s+(?:bed|sleep)|get\s+(?:in|into)\s+bed|fall\s+asleep|hit\s+the\s+(?:sack|hay)|sleep|be\s+in\s+bed|turn\s+in)`;
const WAKE = String.raw`(?:wake\s*(?:up)?|get\s+up|be\s+up|rise)`;
const NEED_RE = /^(?:how\s+(?:much|many\s+hours\s+(?:of)?)\s*sleep|how\s+many\s+hours\s+(?:should|do|does|must)\s+.+\s+sleep|how\s+long\s+should\s+.+\s+sleep)\b/;

function sleepOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/[\u2019']/g, '\u0027').replace(/\s+/g, ' ').trim();
  if (!t || OFF.test(t)) return null;
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:sleep(?:\s+cycle)?|bedtime|wake[\s-]?up(?:\s+time)?|rem(?:\s+sleep)?)\s+calculator$/.test(t)) return { kind: 'calc' };
  let m;
  // a wake-up time given: when to go to bed
  m = t.match(new RegExp(String.raw`^(?:if\s+)?i\s+(?:need\s+to\s+|have\s+to\s+|want\s+to\s+|must\s+|gotta\s+|got\s+to\s+)?${WAKE}\s+(?:at\s+)?(${T})(?:\s+(?:tomorrow|in\s+the\s+morning))?,?\s+(?:then\s+)?(?:what\s+time|when)\s+should\s+i\s+${BED}(?:\s+tonight)?$`))
    || t.match(new RegExp(String.raw`^(?:what\s+time|when)\s+(?:should|do|must)\s+i\s+${BED}(?:\s+tonight)?\s+(?:to|if\s+i\s+(?:need\s+to\s+|have\s+to\s+|want\s+to\s+|must\s+)?|so\s+(?:that\s+)?i\s+(?:can\s+)?|in\s+order\s+to)\s*${WAKE}\s+(?:at\s+)?(${T})(?:\s+(?:tomorrow|in\s+the\s+morning))?$`))
    || t.match(new RegExp(String.raw`^(?:best\s+)?(?:bedtime|bed\s+time|time\s+to\s+(?:go\s+to\s+)?(?:bed|sleep))\s+(?:for|to|if\s+i)\s+${WAKE}\s+(?:at\s+)?(${T})$`))
    || t.match(new RegExp(String.raw`^(?:best\s+)?(?:bedtime|bed\s+time)\s+for\s+(?:a\s+)?(${T})\s+(?:wake[\s-]?up|alarm)$`));
  if (m) { const w = timeOf(m[1], 'am'); return w && !w.now ? { kind: 'bed', at: w } : null; }
  // a bedtime given: when to wake up
  m = t.match(new RegExp(String.raw`^(?:if\s+)?i\s+(?:${BED}|went\s+to\s+(?:bed|sleep)|fell\s+asleep)\s+(?:at\s+)?(${T})(?:\s+tonight)?,?\s+(?:then\s+)?(?:what\s+time|when)\s+should\s+i\s+${WAKE}$`))
    || t.match(new RegExp(String.raw`^(?:what\s+time|when)\s+should\s+i\s+(?:set\s+my\s+alarm|${WAKE})(?:\s+up)?\s+if\s+i\s+(?:${BED}|go\s+to\s+(?:bed|sleep))\s+(?:at\s+)?(${T})(?:\s+tonight)?$`))
    || t.match(new RegExp(String.raw`^(?:best\s+)?(?:wake[\s-]?up\s+times?|time\s+to\s+wake\s+up)\s+if\s+i\s+(?:${BED}|go\s+to\s+(?:bed|sleep))\s+(?:at\s+)?(${T})$`));
  if (m) { const b = timeOf(m[1], 'pm'); return b ? { kind: 'wake', at: b } : null; }
  // how much sleep someone needs
  if (NEED_RE.test(t) || /^(?:recommended|ideal|normal)\s+(?:hours\s+of\s+)?sleep\b/.test(t)) {
    const rest = t.replace(NEED_RE, ' ').replace(/^(?:recommended|ideal|normal)\s+(?:hours\s+of\s+)?sleep/, ' ');
    const row = NEED.find((r) => r.re.test(rest)) || NEED[NEED.length - 1];
    return { kind: 'need', row };
  }
  return null;
}

const mins = (at) => at.h * 60 + at.m;
function clock(total) { const d = new Date(2026, 0, 1, 0, 0); d.setMinutes(((total % 1440) + 1440) % 1440);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
const hrs = (n) => (n * CYCLE / 60) + ' h';
// cycles shown: 6, 5, 4 (9, 7.5 and 6 hours of sleep); the CDC's adult 7 hours makes 5 the one to aim for
function plan(kind, at) {
  const base = mins(at), rows = [];
  for (const n of kind === 'bed' ? [6, 5, 4] : [4, 5, 6]) {
    const tm = kind === 'bed' ? base - FALL_ASLEEP - n * CYCLE : base + FALL_ASLEEP + n * CYCLE;
    rows.push({ n, time: clock(tm), sleep: hrs(n), best: n === 5 || n === 6, short: n < 5 });
  }
  return rows;
}

function rowsHtml(rows, esc) {
  return '<ul>' + rows.map((r) => '<li><b>' + esc(r.time) + '</b> \u00b7 ' + r.n + ' cycles, ' + esc(r.sleep) + ' of sleep'
    + (r.short ? ' <span style="color:#8a8a8a">(short: under the 7 hours adults need)</span>' : r.n === 5 ? ' <span style="color:#8a8a8a">(the one to aim for)</span>' : '') + '</li>').join('') + '</ul>';
}
const NOTE = 'Counts about 15 minutes to fall asleep, then 90-minute cycles, so you wake between cycles instead of out of deep sleep. Cycles really run about 70\u2013120 minutes, so treat these as a guide, not a rule. Adults need 7 or more hours (CDC).';
const SRC = '<div class="src">Method: 90-minute sleep cycles + 15 min to fall asleep \u00b7 hours: <a href="https://www.cdc.gov/sleep/about/index.html" target="_blank" rel="noopener">CDC, About Sleep</a> \u00b7 not medical advice</div>';

function runCalc(api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Sleep calculator</h2>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0">'
    + '<select id="sl-mode" aria-label="what the time is"><option value="bed">I want to wake up at</option><option value="wake">I am going to bed at</option></select>'
    + '<input id="sl-time" type="time" value="07:00" aria-label="time"></div>'
    + '<div id="sl-out" aria-live="polite"></div><p style="color:#8a8a8a">' + esc(NOTE) + '</p>' + SRC; });
  const q = (id) => el.querySelector('#' + id), out = q('sl-out');
  const upd = () => { const v = (q('sl-time').value || '').split(':'), mode = q('sl-mode').value;
    if (v.length < 2) { out.textContent = 'pick a time'; return; }
    const rows = plan(mode, { h: +v[0], m: +v[1] });
    out.innerHTML = '<div class="sub">' + (mode === 'bed' ? 'Go to bed at' : 'Wake up at') + '</div>' + rowsHtml(rows, esc); };
  q('sl-mode').addEventListener('change', () => { if (q('sl-mode').value === 'wake' && q('sl-time').value === '07:00') q('sl-time').value = '23:00'; upd(); });
  q('sl-time').addEventListener('input', upd); upd();
  return 'sleep';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = sleepOf(text);
  if (!q) return 'none';
  if (q.kind === 'calc') return runCalc(api);
  if (q.kind === 'need') {
    const r = q.row;
    showPage((el) => { el.innerHTML = '<h2>How much sleep</h2><div class="sub">' + esc(r.who) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(r.hours) + '</div>'
      + '<p style="color:#8a8a8a">' + esc(r.note) + '. ' + (r.lo <= 8 && /Adult/.test(r.who) ? 'Regularly getting less is linked with heart disease, diabetes, depression and slower reactions. ' : '')
      + 'Other ages: newborns 14\u201317 h, infants 12\u201316 h, toddlers 11\u201314 h, ages 3\u20135 10\u201313 h, 6\u201312 9\u201312 h, teens 8\u201310 h, adults 7+ h, 65 and up 7\u20138 h. Ask "if i wake up at 7am when should i go to sleep" for bedtimes.</p>'
      + '<div class="src">Source: <a href="https://www.cdc.gov/sleep/about/index.html" target="_blank" rel="noopener">CDC, About Sleep</a> (AASM 2016 pediatric consensus; AASM/SRS 2015 adult statement) \u00b7 not medical advice</div>'; });
    return 'sleep';
  }
  const rows = plan(q.kind, q.at), aim = rows.find((r) => r.n === 5);
  const atTxt = q.at.now ? 'now (' + clock(mins(q.at)) + ')' : clock(mins(q.at));
  showPage((el) => { el.innerHTML = '<h2>' + (q.kind === 'bed' ? 'Bedtime' : 'Wake-up time') + '</h2>'
    + '<div class="sub">' + esc(q.kind === 'bed' ? 'to wake up at ' + atTxt : 'going to bed ' + (q.at.now ? '' : 'at ') + atTxt) + '</div>'
    + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(aim.time) + '</div>'
    + rowsHtml(rows, esc) + '<p style="color:#8a8a8a">' + esc(NOTE) + '</p>' + SRC; });
  return 'sleep';
}

export { sleepOf, plan, timeOf };
export default {
  name: 'sleep',
  examples: [
    'if i wake up at 7am when should i go to sleep',
    'what time should i go to bed to wake up at 6:30',
    'if i go to bed at 11pm when should i wake up',
    'when should i wake up if i go to sleep now',
    'sleep calculator',
    'how much sleep does a teenager need'
  ],
  nearMisses: [
    'set an alarm for 7am',
    'remind me to go to bed at 11pm',
    'what is sleep apnea',
    'how many sleeps until christmas',
    'define sleep'
  ],
  match(lower, text) { return !!sleepOf(text); },
  run
};
