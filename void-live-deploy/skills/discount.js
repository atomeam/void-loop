/**
 * discount skill — sale price after a percent off (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "20% off 80", "30 percent off $45.99", "sale 15% off 120",
 * "what's 25% off $200".
 * Shows original, amount off, and sale price. Empty stage stays empty.
 */
function num(s) {
  if (s == null) return NaN;
  return parseFloat(String(s).replace(/,/g, ''));
}

function moneyFmt(n, currency) {
  const c = currency || 'USD';
  try {
    return n.toLocaleString(undefined, { style: 'currency', currency: c, maximumFractionDigits: 2 });
  } catch (_) {
    return (c === 'EUR' ? '€' : c === 'GBP' ? '£' : '$') + n.toFixed(2);
  }
}

function discountOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase();
  if (!/\b(off|discount|sale)\b/.test(t) && !/\d+\s*%\s*off/.test(t)) return null;
  if (/\b(tip|gratuity|mortgage|loan|fuel|gas|what\s+is\s+a\s+discount|percentage\s+change)\b/.test(t)) return null;

  let pct = NaN;
  let m = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:off|discount)/) ||
          t.match(/(\d+(?:\.\d+)?)\s*(?:percent|per\s*cent)\s*(?:off|discount)/);
  if (m) pct = num(m[1]);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;

  let price = NaN, currency = 'USD';
  m = t.match(/(?:\$|usd\s*)(\d+(?:\.\d+)?)/) ||
      t.match(/(?:€|eur\s*)(\d+(?:\.\d+)?)/) ||
      t.match(/(?:£|gbp\s*)(\d+(?:\.\d+)?)/) ||
      t.match(/(?:off|of|on|for)\s+\$?\s*(\d+(?:\.\d+)?)/) ||
      t.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:dollars|usd|euros?)?/);
  if (m) {
    price = num(m[1]);
    if (/€|eur/.test(t)) currency = 'EUR';
    else if (/£|gbp/.test(t)) currency = 'GBP';
  }
  if (!Number.isFinite(price) || price <= 0 || price > 1e6) return null;

  return { pct, price, currency, raw };
}

function compute(q) {
  const off = q.price * (q.pct / 100);
  const sale = q.price - off;
  return { off, sale };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = discountOf(text);
  if (!q) return 'none';
  const r = compute(q);
  if (!Number.isFinite(r.sale)) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>Discount</h2>'
      + '<div class="sub">' + esc(q.pct + '% off ' + moneyFmt(q.price, q.currency)) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">'
      + esc(moneyFmt(r.sale, q.currency)) + '<span style="font-size:18px;color:#8a8a8a"> sale</span></div>'
      + '<ul>'
      + '<li><b>Amount off</b> ' + esc(moneyFmt(r.off, q.currency)) + '</li>'
      + '<li><b>Original</b> ' + esc(moneyFmt(q.price, q.currency)) + '</li>'
      + '</ul>'
      + '<p style="color:#8a8a8a">Sale price from the percent and original you gave. Check the store for the real deal.</p>'
      + '<div class="src">Formula: off = price × pct / 100; sale = price − off · as of Oct 2026</div>';
  });
  return 'discount';
}

export default {
  name: 'discount',
  examples: [
    '20% off 80',
    '30 percent off $45.99',
    'sale 15% off 120',
    'what\'s 25% off $200',
    '10% off €50'
  ],
  nearMisses: [
    '20% tip on 45',
    'what is a discount',
    'percentage change from 50 to 75',
    'monthly payment on a mortgage',
    'gas cost for 320 miles'
  ],
  match(lower, text) { return !!discountOf(text); },
  run
};
