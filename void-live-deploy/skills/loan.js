/**
 * loan skill - monthly payment for mortgages, car loans, and personal loans (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "monthly payment on a $250000 mortgage at 6.5% for 30 years",
 * "car loan $20000 at 7% for 5 years",
 * "loan payment $15000 at 5.9% over 36 months",
 * "what's the payment on a $300k mortgage 6% 30 year".
 * Shows monthly payment, total paid, and total interest. Not advice; standard amortizing formula.
 */
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
  if (!/\b(mortgage|loan|car\s+loan|auto\s+loan|home\s+loan|personal\s+loan|monthly\s+payment|loan\s+payment|mortgage\s+payment)\b/.test(l)) return null;
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

  return { principal: amt, apr, months, kind };
}

function payment(p, apr, n) {
  const r = apr / 100 / 12;
  if (r === 0) return p / n;
  const f = Math.pow(1 + r, n);
  return p * r * f / (f - 1);
}

function moneyFmt(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = loanOf(text);
  if (!q) return 'none';
  const pay = payment(q.principal, q.apr, q.months);
  const total = pay * q.months;
  const interest = total - q.principal;
  const years = q.months % 12 === 0 ? (q.months / 12) + (q.months / 12 === 1 ? ' year' : ' years') : q.months + ' months';
  const title = q.kind.charAt(0).toUpperCase() + q.kind.slice(1);
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(title) + ' payment</h2>'
      + '<div class="sub">' + esc(moneyFmt(q.principal)) + ' at ' + esc(String(q.apr)) + '% for ' + esc(years) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(moneyFmt(pay)) + '<span style="font-size:18px;color:#8a8a8a"> / month</span></div>'
      + '<ul>'
      + '<li><b>Total paid</b> ' + esc(moneyFmt(total)) + '</li>'
      + '<li><b>Total interest</b> ' + esc(moneyFmt(interest)) + '</li>'
      + '<li><b>Payments</b> ' + esc(String(q.months)) + '</li>'
      + '</ul>'
      + '<p style="color:#8a8a8a">Standard amortizing loan (fixed rate, monthly). Not a quote or advice — lenders add fees and insurance.</p>'
      + '<div class="src">Formula: M = P · r(1+r)^n / ((1+r)^n − 1)</div>';
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
    'personal loan $8000 at 9.5% for 4 years'
  ],
  nearMisses: [
    'what is a mortgage',
    'student loan forgiveness',
    'mortgage rates today',
    '20% tip on 45',
    'split 120 between 4 people',
    'how much is a loan'
  ],
  match(lower, text) { return !!loanOf(text); },
  run
};
