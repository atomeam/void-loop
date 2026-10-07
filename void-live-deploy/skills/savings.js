/**
 * savings skill - what regular saving grows to, how long a goal takes, and what to put away each month (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "how much will i have if i save 200 a month for 20 years at 7%", "how long to save 50000 if i save 500 a month",
 * "how much do i need to save a month to have 1 million in 30 years at 7%", "invest 10k and add 300 a month for 15 years at 6%",
 * "savings calculator". Like the SEC's Investor.gov compound interest calculator (start, monthly add, years, rate,
 * a +/- range), plus the two questions it can't answer in one step: time to a goal and the monthly amount a goal needs.
 * Method: monthly compounding (rate / 12), deposits at the end of each month. No rate given: shows 0% (cash under the
 * mattress) next to 4% and 7% so the difference interest makes is visible. Not financial advice.
 */
const WORDS = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40 };
const PER_YEAR = { day: 365, week: 52, fortnight: 26, month: 12, year: 1 };

function amt(s, unit) {
  const n = parseFloat(String(s).replace(/,/g, ''));
  if (!Number.isFinite(n)) return NaN;
  const u = String(unit || '').toLowerCase().trim();
  if (/^(?:k|thousand|grand)$/.test(u)) return n * 1e3;
  if (/^(?:m|mil|million)$/.test(u)) return n * 1e6;
  if (/^(?:b|billion)$/.test(u)) return n * 1e9;
  return n;
}
const MONEY = '\\$?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|m|mil|million|thousand|grand|billion)?\\b(?:\\s*(?:dollars|bucks|usd))?';
const PERIOD = '(?:a|an|per|each|every)\\s+(day|week|fortnight|month|year)';

function parse(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase().replace(/\bmonthly\b/g, 'a month').replace(/\bweekly\b/g, 'a week').replace(/\byearly\b|\bannually\b/g, 'a year');
  if (/\b(remind|calendar|schedule|mortgage|loan|payoff|pay off|debt|tip|mpg|gas cost|split|calories|steps|sleep|minutes?|hours?)\b/.test(t)) return null;
  const q = { raw, start: 0, add: NaN, per: 'month', years: NaN, rate: NaN, goal: NaN, want: 'grow' };

  let m = t.match(new RegExp('\\b(?:save|saving|put(?:ting)? away|put aside|set aside|invest(?:ing)?|deposit(?:ing)?|contribut(?:e|ing)|add(?:ing)?|put in)\\s+' + MONEY + '\\s+' + PERIOD))
    || t.match(new RegExp(MONEY + '\\s+' + PERIOD + '\\s+(?:in(?:to)?\\s+)?(?:savings|saved|invested|deposits?|contributions?|into (?:savings|an? (?:account|ira|401k|roth|fund|index fund)))'))
    || t.match(new RegExp('\\b(?:with|and)\\s+' + MONEY + '\\s+' + PERIOD));
  if (m) { q.add = amt(m[1], m[2]); q.per = m[3]; }

  m = t.match(new RegExp('\\b(?:start(?:ing)? with|i have|i\'ve got|already (?:have|saved)|with|initial(?:ly)?(?: deposit(?: of)?)?|invest|deposit|put)\\s+' + MONEY + '(?!\\s+(?:a|an|per|each|every)\\s+(?:day|week|fortnight|month|year))(?:\\s+(?:saved|now|today|already|up front|upfront|to start|in savings))?'));
  if (m && !(m[1] && Number.isFinite(q.add) && amt(m[1], m[2]) === q.add && !/start|have|got|initial|already/.test(m[0]))) q.start = amt(m[1], m[2]);
  if (m && /^(?:invest|deposit|put)\b/.test(m[0]) && Number.isFinite(q.add) && amt(m[1], m[2]) === q.add) q.start = 0;

  m = t.match(/(?:at|@|earning|returns?(?:\s+of)?|interest(?:\s+of)?|growing at|apy(?:\s+of)?)\s+(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)/) || t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\s*(?:a year|apy|apr|interest|returns?|growth|annual)?/);
  if (m) q.rate = parseFloat(m[1]);
  if (Number.isFinite(q.rate) && (q.rate < 0 || q.rate > 50)) return null;

  m = t.match(/\b(?:for|over|in|after)\s+(\d{1,2}|a|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty)\s+(years?|months?)\b/);
  if (m) { const n = WORDS[m[1]] || parseInt(m[1], 10); q.years = /^month/.test(m[2]) ? n / 12 : n; }

  m = t.match(new RegExp('\\b(?:to (?:have|reach|get to|hit|save up|save|build|end up with)|reach|hit|get to|goal of|until i have|for a)\\s+(?:a\\s+)?' + MONEY));
  if (!m && /\bhow long\b/.test(t)) m = t.match(new RegExp('\\bhow long (?:will it take |would it take |does it take |to |till |until )?(?:me )?(?:to )?(?:save|reach|have|get)\\s+(?:up\\s+)?' + MONEY));
  if (m) q.goal = amt(m[1], m[2]);

  const asksHowLong = /\bhow long\b|\bhow many (?:years|months)\b|\bwhen will i (?:have|reach|hit)\b/.test(t);
  const asksMonthly = /\bhow much (?:do|should|would|will|must) i (?:need to |have to )?(?:save|put away|invest|set aside)\b|\bhow much to (?:save|invest|put away)\b|\b(?:save|invest|put away) how much\b/.test(t);
  if (asksHowLong && Number.isFinite(q.goal) && Number.isFinite(q.add)) q.want = 'time';
  else if (asksMonthly && Number.isFinite(q.goal) && Number.isFinite(q.years)) q.want = 'monthly';
  else if (Number.isFinite(q.add) && Number.isFinite(q.years)) q.want = 'grow';
  else return null;
  if (q.want === 'time' && /\bfor\s+\d+\s+years?\b/.test(t) && !asksHowLong) return null;
  for (const v of [q.add, q.goal, q.start]) if (Number.isFinite(v) && (v < 0 || v > 1e10)) return null;
  if (Number.isFinite(q.years) && (q.years <= 0 || q.years > 80)) return null;
  if (q.want !== 'monthly' && !(q.add > 0)) return null;
  if (q.want !== 'grow' && !(q.goal > 0)) return null;
  return q;
}

// monthly compounding, end-of-month deposits; `monthly` is the deposit converted to a monthly amount
function grow(start, monthly, ratePct, months) {
  const r = ratePct / 100 / 12;
  const g = Math.pow(1 + r, months);
  return r === 0 ? start + monthly * months : start * g + monthly * (g - 1) / r;
}
function monthsTo(start, monthly, ratePct, goal) {
  if (start >= goal) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return monthly > 0 ? Math.ceil((goal - start) / monthly) : Infinity;
  const n = Math.log((goal * r + monthly) / (start * r + monthly)) / Math.log(1 + r);
  return Number.isFinite(n) ? Math.ceil(n - 1e-9) : Infinity;
}
function monthlyFor(start, ratePct, months, goal) {
  const r = ratePct / 100 / 12, g = Math.pow(1 + r, months);
  const need = goal - start * g;
  if (need <= 0) return 0;
  return r === 0 ? need / months : need * r / (g - 1);
}
const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n < 1000 && n % 1 ? 2 : 0, maximumFractionDigits: n < 1000 ? 2 : 0 });
const span = (months) => { if (!Number.isFinite(months)) return 'never at this pace'; const y = Math.floor(months / 12), mo = months % 12; return [y ? y + (y === 1 ? ' year' : ' years') : '', mo ? mo + (mo === 1 ? ' month' : ' months') : ''].filter(Boolean).join(' ') || 'right away'; };
const RATES = (rate) => (Number.isFinite(rate) ? [Math.max(0, rate - 2), rate, rate + 2] : [0, 4, 7]);
const SRC = '<div class="src">Monthly compounding (rate \u00f7 12), deposits at the end of each month. Range \u00b12 points like the SEC\u2019s <a href="https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator" target="_blank" rel="noopener">Investor.gov compound interest calculator</a>; no rate given shows 0%, 4% and 7%. Returns aren\u2019t guaranteed, and this is not financial advice. As of Oct 2026.</div>';

function render(q, api) {
  const { showPage, esc } = api;
  const monthly = Number.isFinite(q.add) ? q.add * PER_YEAR[q.per] / 12 : NaN;
  const rate = Number.isFinite(q.rate) ? q.rate : 0;
  const assumed = !Number.isFinite(q.rate);
  const months = Math.round(q.years * 12);
  const big = (v, tail) => '<div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(v) + '<span style="font-size:18px;color:#8a8a8a"> ' + esc(tail) + '</span></div>';
  const row = (cells, head) => '<tr>' + cells.map((c) => (head ? '<th style="text-align:left;padding:2px 10px 2px 0">' : '<td style="padding:2px 10px 2px 0">') + esc(c) + (head ? '</th>' : '</td>')).join('') + '</tr>';
  let html, sub;
  if (q.want === 'grow') {
    const total = grow(q.start, monthly, rate, months), paid = q.start + monthly * months;
    sub = [q.start ? money(q.start) + ' to start' : '', money(q.add) + ' a ' + q.per, span(months), rate + '% a year' + (assumed ? ' (no rate given)' : '')].filter(Boolean).join(' \u00b7 ');
    html = '<h2>Savings growth</h2><div class="sub">' + esc(sub) + '</div>' + big(money(total), 'after ' + span(months))
      + '<ul><li><b>You put in</b> ' + esc(money(paid)) + '</li><li><b>Growth</b> ' + esc(money(total - paid)) + '</li></ul>'
      + '<table style="border-collapse:collapse;margin:8px 0">' + row(['Rate', 'You\u2019d have', 'Growth'], true)
      + RATES(q.rate).map((r) => { const v = grow(q.start, monthly, r, months); return row([r + '%', money(v), money(v - paid)]); }).join('') + '</table>';
    const steps = [1, 5, 10, 20, 30, 40].filter((y) => y * 12 < months).slice(-4).concat([q.years]);
    if (steps.length > 1) html += '<table style="border-collapse:collapse;margin:8px 0">' + row(['After', 'Put in', 'Balance'], true) + steps.map((y) => { const n = Math.round(y * 12); return row([span(n), money(q.start + monthly * n), money(grow(q.start, monthly, rate, n))]); }).join('') + '</table>';
  } else if (q.want === 'time') {
    const n = monthsTo(q.start, monthly, rate, q.goal);
    sub = [money(q.goal) + ' goal', q.start ? money(q.start) + ' to start' : '', money(q.add) + ' a ' + q.per, rate + '% a year' + (assumed ? ' (no rate given)' : '')].filter(Boolean).join(' \u00b7 ');
    html = '<h2>Time to your goal</h2><div class="sub">' + esc(sub) + '</div>' + big(span(n), 'to ' + money(q.goal));
    if (Number.isFinite(n) && n > 0) { const d = new Date(); d.setMonth(d.getMonth() + n); html += '<ul><li><b>Around</b> ' + esc(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })) + '</li><li><b>You put in</b> ' + esc(money(Math.min(q.goal, q.start + monthly * n))) + '</li></ul>'; }
    html += '<table style="border-collapse:collapse;margin:8px 0">' + row(['Rate', 'Time', 'Saving ' + money(q.add * 1.5) + ' a ' + q.per], true)
      + RATES(q.rate).map((r) => row([r + '%', span(monthsTo(q.start, monthly, r, q.goal)), span(monthsTo(q.start, monthly * 1.5, r, q.goal))])).join('') + '</table>';
  } else {
    const need = monthlyFor(q.start, rate, months, q.goal);
    sub = [money(q.goal) + ' goal', span(months), q.start ? money(q.start) + ' to start' : '', rate + '% a year' + (assumed ? ' (no rate given)' : '')].filter(Boolean).join(' \u00b7 ');
    html = '<h2>Monthly savings needed</h2><div class="sub">' + esc(sub) + '</div>' + big(money(need), 'a month')
      + '<ul><li><b>About</b> ' + esc(money(need * 12 / 52)) + ' a week</li><li><b>You put in</b> ' + esc(money(q.start + need * months)) + '</li><li><b>Growth does</b> ' + esc(money(Math.max(0, q.goal - q.start - need * months))) + '</li></ul>'
      + '<table style="border-collapse:collapse;margin:8px 0">' + row(['Rate', 'A month', 'Start 5 years later'], true)
      + RATES(q.rate).map((r) => row([r + '%', money(monthlyFor(q.start, r, months, q.goal)), months > 60 ? money(monthlyFor(q.start, r, months - 60, q.goal)) : '\u2013'])).join('') + '</table>';
  }
  showPage((el) => { el.innerHTML = html + SRC; });
  return 'savings';
}

const isCalcAsk = (text) => /^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:savings?|compound\s+interest|investment|retirement\s+savings|savings\s+goal)\s+calculator$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
function runCalc(api) {
  const el = api.showPage((p) => { p.innerHTML = '<h2>Savings calculator</h2>'
    + '<div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;max-width:340px;margin:10px 0">'
    + '<label for="sv-start">Start with</label><input id="sv-start" type="number" inputmode="decimal" min="0" value="1000">'
    + '<label for="sv-add">Add each month</label><input id="sv-add" type="number" inputmode="decimal" min="0" value="200">'
    + '<label for="sv-years">Years</label><input id="sv-years" type="number" inputmode="numeric" min="1" max="80" value="20">'
    + '<label for="sv-rate">Rate % a year</label><input id="sv-rate" type="number" inputmode="decimal" min="0" max="50" step="0.1" value="7">'
    + '<label for="sv-goal">Goal (optional)</label><input id="sv-goal" type="number" inputmode="decimal" min="0" placeholder="100000"></div>'
    + '<div id="sv-out" aria-live="polite" style="font-size:20px;line-height:1.5"></div>' + SRC; });
  const v = (id) => Math.max(0, +el.querySelector('#' + id).value || 0), out = el.querySelector('#sv-out');
  const upd = () => {
    const s = v('sv-start'), a = v('sv-add'), n = Math.round(Math.min(80, v('sv-years')) * 12), r = Math.min(50, v('sv-rate')), g = v('sv-goal');
    const total = grow(s, a, r, n), paid = s + a * n;
    let txt = 'Balance: ' + money(total) + '\nYou put in ' + money(paid) + ' \u00b7 growth ' + money(total - paid);
    if (g > 0) txt += '\nGoal ' + money(g) + ': ' + span(monthsTo(s, a, r, g)) + ' at this pace, or ' + money(monthlyFor(s, r, n, g)) + ' a month to get there in ' + span(n);
    out.textContent = txt; out.style.whiteSpace = 'pre-line';
  };
  el.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd)); upd();
  return 'savings';
}

async function run(text, api) {
  if (isCalcAsk(text)) return runCalc(api);
  const q = parse(text);
  return q ? render(q, api) : 'none';
}

export const _test = { parse, grow, monthsTo, monthlyFor };
export default {
  name: 'savings',
  examples: [
    'how much will i have if i save 200 a month for 20 years at 7%',
    'how long to save 50000 if i save 500 a month',
    'how much do i need to save a month to have 1 million in 30 years at 7%',
    'invest 10k and add 300 a month for 15 years at 6%',
    'savings calculator'
  ],
  nearMisses: [
    'compound interest on 10000 at 5% for 10 years',
    'monthly payment on a $250000 mortgage at 6.5% for 30 years',
    'remind me to save 50 dollars every week',
    'what is a savings account',
    'save this note',
    'how much is 5 dollars a day for a year'
  ],
  match(lower, text) { return isCalcAsk(text) || !!parse(text); },
  run
};
