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

async function run(text, api) {
  const { showPage, esc } = api;
  const q = loanOf(text);
  if (!q) return 'none';
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
    '$300k mortgage at 6.5% for 30 years with $200 extra a month'
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
