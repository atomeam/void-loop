/**
 * loan skill - monthly payment for mortgages, car loans, and personal loans (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "monthly payment on a $250000 mortgage at 6.5% for 30 years",
 * "car loan $20000 at 7% for 5 years",
 * "loan payment $15000 at 5.9% over 36 months",
 * "what's the payment on a $300k mortgage 6% 30 year",
 * "$300k mortgage 6.5% 30 years with $200 extra a month".
 * Shows monthly payment, total paid, total interest, first-year principal vs interest,
 * and (when asked) how much earlier + how much interest an extra monthly payment saves.
 * Not advice; standard amortizing formula. Better than a bare payment number: visitors see the payoff path.
 * Since 2026-10-30 it also answers the other way round, how long a payment takes: "how long to pay off 1000 at 5% paying 200 a month",
 * "how many months to pay off a $5000 credit card at 22% paying $150 a month". The card counts the months, the last payment and the
 * interest, and opens the payoff-time calculator of /calculators/ with the same numbers (lib/calculators.js runs the same sum).
 */
import { yearsMonths } from '../lib/fincalc.js';

function money(s) {
  if (!s) return NaN;
  s = String(s).trim().toLowerCase().replace(/[$,\s]/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return NaN;
  let n = +m[1];
  if (m[2] === 'k') n *= 1e3;
  if (m[2] === 'm') n *= 1e6;
  return n;
}

function loanOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const l = t.toLowerCase();
  if (!/\b(mortgage|loan|car\s+loan|auto\s+loan|home\s+loan|personal\s+loan|monthly\s+payment|loan\s+payment|mortgage\s+payment|car\s+payment|auto\s+payment)\b/.test(l)) return null;
  if (/\b(forgive|forgiveness|refinance\s+rates?|interest\s+rates?\s+today|what\s+is\s+a\s+mortgage|what\s+is\s+a\s+loan|student\s+loan\s+news)\b/.test(l)) return null;

  // k/m must stick to the digits (300k). A space before "mortgage" must not count as millions.
  let m = t.match(/(?:mortgage|loan|payment)\s+(?:of\s+|for\s+|on\s+(?:a\s+)?)?\$?\s*([\d,]+(?:\.\d+)?)(k|m)?\b/i)
    || t.match(/\$\s*([\d,]+(?:\.\d+)?)(k|m)?\b\s*(?:mortgage|loan|car|auto|home)/i)
    || t.match(/\b(?:a|an)\s+\$?\s*([\d,]+(?:\.\d+)?)(k|m)?\b\s+(?:mortgage|loan|car\s+loan|auto\s+loan)/i)
    || t.match(/\$\s*([\d,]+(?:\.\d+)?)(k|m)?\b/i);
  if (!m) return null;
  const amt = money(m[1] + (m[2] || ''));
  if (!Number.isFinite(amt) || amt <= 0) return null;

  m = t.match(/(\d+(?:\.\d+)?)\s*%/) || t.match(/at\s+(\d+(?:\.\d+)?)\s*(?:percent|per\s*cent)/i);
  if (!m) return null;
  const apr = +m[1];
  if (!(apr > 0 && apr < 100)) return null;

  let months = null;
  m = t.match(/(\d{1,3})\s*(?:year|yr)s?\b/i);
  if (m) months = +m[1] * 12;
  if (months == null) {
    m = t.match(/(?:over|for|in)\s+(\d{1,4})\s*(?:month|mo)s?\b/i) || t.match(/(\d{1,4})\s*(?:month|mo)s?\b/i);
    if (m) months = +m[1];
  }
  if (!Number.isFinite(months) || months < 1 || months > 600) return null;

  let kind = 'loan';
  if (/\bmortgage|home\s+loan\b/.test(l)) kind = 'mortgage';
  else if (/\b(car|auto)\s+loan\b/.test(l)) kind = 'car loan';
  else if (/\bpersonal\s+loan\b/.test(l)) kind = 'personal loan';

  let extra = 0;
  m = t.match(/(?:with|plus|\+)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(?:extra|more|additional)?\s*(?:a\s+|per\s+)?(?:month|mo)\b/i)
    || t.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(?:extra|more|additional)\s*(?:a\s+|per\s+)?(?:month|mo)\b/i);
  if (m) {
    extra = +String(m[1]).replace(/,/g, '');
    if (!Number.isFinite(extra) || extra < 0) extra = 0;
  }

  return { principal: amt, apr, months, kind, extra };
}

// "how long to pay off ...": the asking words, then a monthly payment. The payment comes off the text first, then the rate,
// so the amount left is the balance.
const PAYOFF_ASK = /\b(?:how\s+(?:long|many\s+(?:months|years|payments))|when\s+(?:will|would|do|does|can)\b[^?]*\bpaid\s+off|time\s+to\s+pay\s*off|payoff\s+time)\b/i;
const PAY = [
  /(?:paying|pay|payments?\s+of|with|at)\s+\$?\s*([\d,]+(?:\.\d+)?)(k)?\s*(?:a|per|each|every|\/)\s*(?:month|mo)\b/i,
  /\$?\s*([\d,]+(?:\.\d+)?)(k)?\s*(?:a|per|each|\/)\s*(?:month|mo)\b/i,
  /(?:paying|pay|with)\s+\$?\s*([\d,]+(?:\.\d+)?)(k)?\s+(?:monthly|a\s+month)\b/i,
  /monthly\s+payments?\s+(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)(k)?\b/i,
  /\$?\s*([\d,]+(?:\.\d+)?)(k)?\s+monthly\b/i
];
/** a payoff-time ask as { principal, apr, pay, kind }: the balance, the yearly rate and the monthly payment. Null otherwise. Pure. */
export function payoffOf(text) {
  let t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!PAYOFF_ASK.test(t) || !/\bpa(?:y|id)\s*off|\bpayoff|\brepay/i.test(t)) return null;
  let pay = NaN;
  for (const re of PAY) { const m = t.match(re); if (m) { pay = money(m[1] + (m[2] || '')); t = t.replace(m[0], ' '); break; } }
  if (!(pay > 0)) return null;
  const r = t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b|per\s*cent\b)/i);
  if (!r) return null;
  const apr = +r[1];
  if (!(apr >= 0 && apr < 100)) return null;
  t = t.replace(r[0], ' ');
  const a = t.match(/\$\s*([\d,]+(?:\.\d+)?)(k|m)?\b/i) || t.match(/\b([\d,]*\d(?:\.\d+)?)(k|m)?\b/i);
  if (!a) return null;
  const principal = money(a[1] + (a[2] || ''));
  if (!(principal > 0)) return null;
  const l = t.toLowerCase();
  const kind = /\bcredit\s*cards?\b/.test(l) ? 'credit card' : /\bmortgage|home\s+loan\b/.test(l) ? 'mortgage' : /\b(?:car|auto)\s+loan\b/.test(l) ? 'car loan'
    : /\bstudent\s+loans?\b/.test(l) ? 'student loan' : /\bloan\b/.test(l) ? 'loan' : 'debt';
  return { principal, apr, pay, kind };
}
/** paying a fixed amount each month: the months, the last payment and the interest; never when the payment does not cover the interest. Pure. */
export function payoff(p, apr, pay) {
  const r = apr / 100 / 12;
  if (r > 0 && pay <= p * r) return { never: true, firstInterest: p * r };
  let bal = p, interest = 0, months = 0, last = 0;
  while (bal > 0.005 && months < 1200) {
    const i = bal * r;
    interest += i;
    last = Math.min(pay, bal + i);
    bal = bal + i - last;
    months += 1;
  }
  return { never: false, months, last, interest, total: p + interest };
}

function payment(p, apr, n) {
  const r = apr / 100 / 12;
  if (r === 0) return p / n;
  const f = Math.pow(1 + r, n);
  return p * r * f / (f - 1);
}

function schedule(p, apr, n, extra) {
  const r = apr / 100 / 12;
  const base = payment(p, apr, n);
  const pay = base + (extra || 0);
  let bal = p, interest = 0, months = 0, y1P = 0, y1I = 0;
  const max = n + 1200;
  while (bal > 0.005 && months < max) {
    const i = r === 0 ? 0 : bal * r;
    let prin = pay - i;
    if (prin > bal) prin = bal;
    if (prin <= 0 && r > 0) break;
    bal -= prin;
    interest += i;
    months += 1;
    if (months <= 12) { y1P += prin; y1I += i; }
  }
  return { base, pay, months, interest, total: p + interest, y1P, y1I, paidOff: bal <= 0.005 };
}

function moneyFmt(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function termLabel(months) {
  if (months % 12 === 0) {
    const y = months / 12;
    return y + (y === 1 ? ' year' : ' years');
  }
  return months + ' months';
}

function payoffCard(q, api) {
  const { showPage, esc } = api, o = payoff(q.principal, q.apr, q.pay);
  const href = '/calculators/?calc=payoff-time&P=' + encodeURIComponent(q.principal) + '&rate=' + encodeURIComponent(q.apr) + '&pay=' + encodeURIComponent(q.pay);
  const title = q.kind.charAt(0).toUpperCase() + q.kind.slice(1);
  showPage((el) => {
    el.dataset.page = '/calculators/';
    let html = '<h2>' + esc(title) + ' payoff</h2>'
      + '<div class="sub">' + esc(moneyFmt(q.principal)) + ' at ' + esc(String(q.apr)) + '% a year, paying ' + esc(moneyFmt(q.pay)) + ' a month</div>';
    if (o.never) {
      html += '<p>This payment never pays it off. The first month alone adds ' + esc(moneyFmt(o.firstInterest)) + ' of interest, and '
        + esc(moneyFmt(q.pay)) + ' does not cover it, so the balance does not go down. Pay more than ' + esc(moneyFmt(o.firstInterest)) + ' a month to start to pay it off.</p>';
    } else {
      const evenly = o.months === 1 || Math.abs(o.last - q.pay) < 0.005;
      html += '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(yearsMonths(o.months)) + '</div>'
        + '<ul>'
        + '<li><b>Payments</b> ' + esc(evenly ? o.months + ' of ' + moneyFmt(o.last) : (o.months - 1) + ' of ' + moneyFmt(q.pay) + ', then a last one of ' + moneyFmt(o.last)) + '</li>'
        + '<li><b>Total interest</b> ' + esc(moneyFmt(o.interest)) + '</li>'
        + '<li><b>Total paid</b> ' + esc(moneyFmt(o.total)) + '</li>'
        + '</ul>';
    }
    html += '<p style="color:#8a8a8a">Fixed rate, interest added each month, the same payment each month. Not a quote or advice: lenders and card issuers add fees.</p>'
      + '<p><a href="' + esc(href) + '">Open it in the payoff calculator</a>: change the payment and see the months move</p>'
      + '<div class="src">Each month: interest = balance × rate ÷ 12, then the payment comes off · same sum as the payoff-time calculator of /calculators/</div>';
    el.innerHTML = html; // void-review: ok, every value above goes through esc()
  });
  return 'loan';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = loanOf(text);
  if (!q) { const p = payoffOf(text); return p ? payoffCard(p, api) : 'none'; }
  const base = schedule(q.principal, q.apr, q.months, 0);
  const withX = q.extra > 0 ? schedule(q.principal, q.apr, q.months, q.extra) : null;
  // When no extra is asked, still show a $100/mo illustration so visitors see the lever (2026 calculators lead with this).
  const demoExtra = q.extra > 0 ? q.extra : 100;
  const demo = q.extra > 0 ? withX : schedule(q.principal, q.apr, q.months, demoExtra);
  const savedInterest = Math.max(0, base.interest - demo.interest);
  const monthsSooner = Math.max(0, base.months - demo.months);
  const years = termLabel(q.months);
  const title = q.kind.charAt(0).toUpperCase() + q.kind.slice(1);
  const payShown = withX ? withX.pay : base.base;
  showPage((el) => {
    let html = '<h2>' + esc(title) + ' payment</h2>'
      + '<div class="sub">' + esc(moneyFmt(q.principal)) + ' at ' + esc(String(q.apr)) + '% for ' + esc(years)
      + (q.extra > 0 ? ' · ' + esc(moneyFmt(q.extra)) + ' extra / month' : '')
      + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(moneyFmt(payShown))
      + '<span style="font-size:18px;color:#8a8a8a"> / month</span></div>'
      + '<ul>'
      + '<li><b>Total paid</b> ' + esc(moneyFmt(withX ? withX.total : base.total)) + '</li>'
      + '<li><b>Total interest</b> ' + esc(moneyFmt(withX ? withX.interest : base.interest)) + '</li>'
      + '<li><b>Payments</b> ' + esc(String(withX ? withX.months : base.months)) + '</li>'
      + '<li><b>First year</b> ' + esc(moneyFmt(base.y1I)) + ' interest · ' + esc(moneyFmt(base.y1P)) + ' principal</li>'
      + '</ul>';
    if (demo.paidOff && savedInterest > 0) {
      const label = q.extra > 0
        ? ('With ' + moneyFmt(q.extra) + ' extra each month')
        : ('If you added ' + moneyFmt(demoExtra) + ' extra each month');
      html += '<p><b>' + esc(label) + '</b>: pay off ' + esc(String(monthsSooner)) + ' months sooner and save '
        + esc(moneyFmt(savedInterest)) + ' in interest.</p>';
    }
    html += '<p style="color:#8a8a8a">Standard amortizing loan (fixed rate, monthly). Not a quote or advice — lenders add fees and insurance.</p>'
      + '<div class="src">Formula: M = P · r(1+r)^n / ((1+r)^n − 1) · Sources: standard amortization; extra-payment payoff modeled month by month (as of Oct 2026)</div>';
    el.innerHTML = html;
  });
  return 'loan';
}

export default {
  name: 'loan',
  examples: [
    'monthly payment on a $250000 mortgage at 6.5% for 30 years',
    'car loan $20000 at 7% for 5 years',
    'loan payment $15000 at 5.9% over 36 months',
    'what\'s the payment on a $300k mortgage 6% 30 year',
    'personal loan $8000 at 9.5% for 4 years',
    '$300k mortgage at 6.5% for 30 years with $200 extra a month',
    'how long to pay off 1000 at 5% paying 200 a month',
    'how many months to pay off a $5000 credit card at 22% paying $150 a month'
  ],
  nearMisses: [
    'what is a mortgage',
    'student loan forgiveness',
    'mortgage rates today',
    '20% tip on 45',
    'split 120 between 4 people',
    'how much is a loan',
    'how long does it take to pay off a mortgage',
    'how long to save 1000 at 200 a month'
  ],
  match(lower, text) { return !!(loanOf(text) || payoffOf(text)); },
  run
};
