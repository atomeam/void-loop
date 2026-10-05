/**
 * tip skill - tip amount and bill split from the numbers in the ask (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "20% tip on 45", "tip on $67.50 at 18%", "split 120 between 4 people",
 * "split $85 three ways with 20% tip", "how much tip for a $52 bill at 15%".
 * Shows tip, total, and per-person when split. Better than a bare tip number:
 * one ask covers tip + split with clear math and a short customary range note.
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
    return (c === 'EUR' ? '\u20ac' : c === 'GBP' ? '\u00a3' : '$') + n.toFixed(2);
  }
}

function tipOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase();
  if (/\b(mortgage|loan\s+payment|gas\s+cost|fuel\s+for|mpg|interest\s+rate|tip\s+of\s+the\s+(?:day|ice)|taxi\s+tip\s+culture|what\s+is\s+a\s+tip)\b/.test(t)) return null;

  const wantsTip = /\btip\b/.test(t) || /\bgratuity\b/.test(t);
  const wantsSplit = /\bsplit\b/.test(t) || /\bbetween\s+\d+\s+people\b/.test(t) || /\b(?:two|three|four|five|six)\s+ways?\b/.test(t) || /\bper\s+person\b/.test(t);
  if (!wantsTip && !wantsSplit) return null;

  let pct = NaN;
  let m = t.match(/(\d+(?:\.\d+)?)\s*%/)
    || t.match(/(?:at|@)\s+(\d+(?:\.\d+)?)\s*(?:percent|per\s*cent)\b/)
    || t.match(/\b(\d+(?:\.\d+)?)\s*(?:percent|per\s*cent)\s+(?:tip|gratuity)\b/)
    || t.match(/(?:tip|gratuity)\s+(?:of\s+|at\s+|@\s+)?(\d+(?:\.\d+)?)\s*(?:percent|per\s*cent|%)?/);
  if (m) pct = num(m[1]);
  if (wantsTip && !Number.isFinite(pct)) pct = 20;
  if (Number.isFinite(pct) && (pct < 0 || pct > 100)) return null;

  let bill = NaN, currency = 'USD';
  m = t.match(/(?:\$|usd\s*)(\d+(?:\.\d+)?)/)
    || t.match(/(?:\u20ac|eur\s*)(\d+(?:\.\d+)?)/)
    || t.match(/(?:\u00a3|gbp\s*)(\d+(?:\.\d+)?)/)
    || t.match(/(?:on|for|of|bill(?:\s+of)?|check(?:\s+of)?|total(?:\s+of)?)\s+\$?\s*(\d+(?:\.\d+)?)\b/)
    || t.match(/\bsplit\s+\$?\s*(\d+(?:\.\d+)?)\b/)
    || t.match(/\b(\d+(?:\.\d+)?)\s+(?:between|among|with|for)\b/);
  if (m) {
    bill = num(m[1]);
    if (/\u20ac|\beur\b/.test(t)) currency = 'EUR';
    else if (/\u00a3|\bgbp\b/.test(t)) currency = 'GBP';
  }
  if (!Number.isFinite(bill) || bill <= 0 || bill > 1e6) return null;

  let people = NaN;
  m = t.match(/\b(?:between|among|for)\s+(\d{1,3})\s*(?:people|persons|guests|of\s+us|ways?)?\b/)
    || t.match(/\bsplit\s+(?:it\s+)?(?:by|into|across)\s+(\d{1,3})\b/)
    || t.match(/\b(\d{1,3})\s*(?:people|persons|guests|ways?)\b/)
    || t.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+ways?\b/);
  if (m) {
    const words = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    people = words[m[1]] || num(m[1]);
  }
  if (wantsSplit && !Number.isFinite(people)) return null;
  if (Number.isFinite(people) && (people < 2 || people > 100 || !Number.isInteger(people))) return null;
  if (!wantsTip && !Number.isFinite(people)) return null;
  if (wantsTip && !Number.isFinite(pct)) return null;

  return {
    bill,
    pct: Number.isFinite(pct) ? pct : 0,
    people: Number.isFinite(people) ? people : 1,
    currency,
    wantsTip: !!wantsTip || (Number.isFinite(pct) && pct > 0),
    wantsSplit: Number.isFinite(people) && people >= 2,
    raw
  };
}

function compute(q) {
  const tip = q.bill * (q.pct / 100);
  const total = q.bill + tip;
  const per = total / q.people;
  const billEach = q.bill / q.people;
  const tipEach = tip / q.people;
  return { tip, total, per, billEach, tipEach };
}

// "tip calculator": a small live calculator (bill, tip %, people) when no bill was given
const isCalcAsk = (text) => /^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:tip|bill\s+split(?:ting)?|split\s+the\s+bill)\s+calculator$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
function runCalc(api) {
  const { showPage } = api, f = (n) => '$' + n.toFixed(2);
  const el = showPage((p) => { p.innerHTML = '<h2>Tip calculator</h2>'
    + '<div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;max-width:320px;margin:10px 0">'
    + '<label for="tc-bill">Bill</label><input id="tc-bill" type="number" inputmode="decimal" min="0" step="0.01" placeholder="64.50">'
    + '<label for="tc-pct">Tip %</label><input id="tc-pct" type="number" inputmode="decimal" min="0" max="100" value="20">'
    + '<label for="tc-n">People</label><input id="tc-n" type="number" inputmode="numeric" min="1" max="99" value="1"></div>'
    + '<div id="tc-out" aria-live="polite" style="font-size:22px;line-height:1.5"></div>'; });
  const q = (id) => el.querySelector('#' + id), out = q('tc-out');
  const upd = () => { const b = +q('tc-bill').value, pc = +q('tc-pct').value, n = Math.max(1, Math.round(+q('tc-n').value || 1));
    if (!(b > 0)) { out.textContent = 'type the bill'; return; }
    const tip = b * pc / 100, tot = b + tip; out.innerHTML = 'Tip ' + f(tip) + '<br>Total ' + f(tot) + (n > 1 ? '<br>Each ' + f(tot / n) : ''); };
  ['tc-bill', 'tc-pct', 'tc-n'].forEach((id) => q(id).addEventListener('input', upd)); upd(); setTimeout(() => q('tc-bill').focus(), 50);
  return 'tip';
}
async function run(text, api) {
  if (isCalcAsk(text)) return runCalc(api);
  const { showPage, esc } = api;
  const q = tipOf(text);
  if (!q) return 'none';
  const r = compute(q);
  if (!Number.isFinite(r.total)) return 'none';
  const title = q.wantsSplit && q.wantsTip ? 'Tip and split'
    : q.wantsSplit ? 'Split the bill'
    : 'Tip';
  const subBits = [moneyFmt(q.bill, q.currency)];
  if (q.pct > 0) subBits.push((Math.round(q.pct * 10) / 10) + '% tip');
  if (q.people >= 2) subBits.push(q.people + ' people');
  showPage((el) => {
    let html = '<h2>' + esc(title) + '</h2>'
      + '<div class="sub">' + esc(subBits.join(' \u00b7 ')) + '</div>';
    if (q.wantsSplit) {
      html += '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">'
        + esc(moneyFmt(r.per, q.currency))
        + '<span style="font-size:18px;color:#8a8a8a"> / person</span></div>';
    } else {
      html += '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">'
        + esc(moneyFmt(r.tip, q.currency))
        + '<span style="font-size:18px;color:#8a8a8a"> tip</span></div>';
    }
    html += '<ul>';
    if (q.pct > 0) html += '<li><b>Tip</b> ' + esc(moneyFmt(r.tip, q.currency)) + '</li>';
    html += '<li><b>Total</b> ' + esc(moneyFmt(r.total, q.currency)) + '</li>';
    if (q.wantsSplit) {
      html += '<li><b>Bill each</b> ' + esc(moneyFmt(r.billEach, q.currency)) + '</li>';
      if (q.pct > 0) html += '<li><b>Tip each</b> ' + esc(moneyFmt(r.tipEach, q.currency)) + '</li>';
    }
    html += '</ul>';
    if (q.pct > 0) {
      html += '<p style="color:#8a8a8a">US sit-down service often lands around 15\u201320% before tax; use whatever fits the place and service. Not a rule.</p>';
    } else {
      html += '<p style="color:#8a8a8a">Even split of the bill you gave. Add a tip percent if you want that included.</p>';
    }
    html += '<div class="src">Formula: tip = bill \u00d7 pct / 100; total = bill + tip; per person = total \u00f7 people \u00b7 as of Oct 2026</div>';
    el.innerHTML = html;
  });
  return 'tip';
}

export default {
  name: 'tip',
  examples: [
    '20% tip on 45',
    'tip on $67.50 at 18%',
    'split 120 between 4 people',
    'split $85 three ways with 20% tip',
    'how much tip for a $52 bill at 15%'
  ],
  nearMisses: [
    'what is a tip',
    'tip of the day',
    'monthly payment on a $250000 mortgage at 6.5% for 30 years',
    'gas cost for 320 miles at 28 mpg $3.59 a gallon',
    '100 usd in eur'
  ],
  match(lower, text) { return !!tipOf(text) || isCalcAsk(text); },
  run
};
