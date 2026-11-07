/**
 * fuel skill - trip fuel cost from distance, efficiency, and price (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "gas cost for 320 miles at 28 mpg $3.59 a gallon",
 * "how much fuel for a 500 mile trip at 30 mpg gas is $3.40",
 * "trip fuel 280 miles 32 mpg $3.25/gal",
 * "fuel for 400 km at 7 L/100km 1.85 per liter".
 * Shows gallons or liters needed, total cost, and cost per mile or km.
 * Better than a bare gallons number: visitors see the full trip cost in one ask.
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

function qtyFmt(n, unit) {
  const v = Math.round(n * 100) / 100;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + unit;
}

function fuelOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase();
  if (!/\b(gas|fuel|petrol|diesel|gasoline)\b/.test(t) && !/\b(mpg|l\/100\s*km|liters?\s*per\s*100)\b/.test(t)) return null;
  if (/\b(gas\s+station|petrol\s+station|fuel\s+station|near\s+me|gas\s+prices?\s+in|what\s+is\s+(?:mpg|a\s+gallon)|define\s+mpg|mortgage|loan\s+payment|tip\s+on)\b/.test(t)) return null;

  let distance = NaN, distUnit = null;
  let m = t.match(/(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|kilometres?|kms?)\b/);
  if (m) {
    distance = num(m[1]);
    distUnit = /^mi/.test(m[2]) ? 'mi' : 'km';
  }
  if (!Number.isFinite(distance) || distance <= 0 || distance > 50000) return null;

  let mpg = NaN, lp100 = NaN;
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:mpg|miles?\s+per\s+gallon)\b/);
  if (m) mpg = num(m[1]);
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:l\/100\s*km|liters?\s*per\s*100\s*k(?:m|ilometers?|ilometres?)|l\s*per\s*100\s*km)\b/);
  if (m) lp100 = num(m[1]);
  if (!Number.isFinite(mpg) && !Number.isFinite(lp100)) return null;
  if (Number.isFinite(mpg) && (mpg < 1 || mpg > 200)) return null;
  if (Number.isFinite(lp100) && (lp100 < 0.5 || lp100 > 50)) return null;

  let price = NaN, currency = 'USD', priceUnit = null;
  m = t.match(/(?:\$|usd\s*)(\d+(?:\.\d+)?)\s*(?:\/\s*|\s+per\s+|\s+a\s+|\s+an\s+)?(?:gal(?:lon)?s?)?\b/)
    || t.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*gal(?:lon)?|per\s+gal(?:lon)?|a\s+gal(?:lon)?|an?\s+gal(?:lon)?)\b/)
    || t.match(/gas(?:oline)?\s+is\s+\$?\s*(\d+(?:\.\d+)?)/)
    || t.match(/(?:€|eur\s*)(\d+(?:\.\d+)?)\s*(?:\/\s*|\s+per\s+|\s+a\s+)?(?:l|liters?|litres?)?\b/)
    || t.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*l(?:iter|itre)?|per\s+l(?:iter|itre)?|a\s+l(?:iter|itre)?)\b/)
    || t.match(/(?:£|gbp\s*)(\d+(?:\.\d+)?)/);
  if (m) {
    price = num(m[1]);
    // the unit written right after the price ("£6.50 a gallon", "1.85 per liter") wins over a guess from the whole ask ("fuel" has an l in it)
    const after = t.slice(m.index + m[0].indexOf(m[1]) + m[1].length, m.index + m[0].indexOf(m[1]) + m[1].length + 16);
    const near = /^\s*(?:\/\s*|per\s+|an?\s+)?gal/.test(after) ? 'gal' : /^\s*(?:\/\s*|per\s+|an?\s+)?(?:l|ltr|liters?|litres?)\b/.test(after) ? 'L' : null;
    if (/€|eur/.test(t) && /€|eur|per\s+l|\/\s*l|liter|litre/.test(t)) { currency = 'EUR'; priceUnit = 'L'; }
    else if (/£|gbp/.test(t)) { currency = 'GBP'; priceUnit = 'L'; } // UK pumps price by the litre: a bare £ price is per litre
    else if (/per\s+l|\/\s*l|liter|litre/.test(t) && !/gallon|\/\s*gal/.test(t)) { priceUnit = 'L'; if (/€|eur/.test(t)) currency = 'EUR'; }
    else { priceUnit = 'gal'; }
    if (near) priceUnit = near;
  }
  // no price (2026-11-06, docs/GAPS.md row 15: "fuel cost for 300 miles at 30 mpg" got only 300 miles in km): the fuel needed, and a box for the price
  if (Number.isFinite(price) && (price <= 0 || price > 50)) return null;
  if (!priceUnit) priceUnit = Number.isFinite(lp100) ? 'L' : 'gal';

  return { distance, distUnit, mpg, lp100, price, currency, priceUnit, raw };
}

function compute(q) {
  let gallons = NaN, liters = NaN;
  if (Number.isFinite(q.mpg)) {
    const miles = q.distUnit === 'km' ? q.distance * 0.621371 : q.distance;
    gallons = miles / q.mpg;
    liters = gallons * 3.785411784;
  } else {
    const km = q.distUnit === 'mi' ? q.distance * 1.609344 : q.distance;
    liters = (q.lp100 / 100) * km;
    gallons = liters / 3.785411784;
  }
  const amount = q.priceUnit === 'L' ? liters : gallons;
  const cost = amount * q.price;
  const perDist = cost / q.distance;
  return { gallons, liters, cost, perDist };
}

// the fuel needed from distance and efficiency alone; the cost follows when a price per gallon (or per litre) is typed in the box, worked out here
function noPrice(q, r, api) {
  const { showPage, esc } = api;
  if (!Number.isFinite(r.gallons) || r.gallons <= 0) return 'none';
  const metric = Number.isFinite(q.lp100), distLabel = q.distUnit === 'km' ? 'km' : (q.distance === 1 ? 'mile' : 'miles');
  const eff = Number.isFinite(q.mpg) ? (Math.round(q.mpg * 10) / 10) + ' mpg' : (Math.round(q.lp100 * 10) / 10) + ' L/100km';
  const lead = metric ? qtyFmt(r.liters, 'L') : qtyFmt(r.gallons, 'gal'), other = metric ? qtyFmt(r.gallons, 'gal') : qtyFmt(r.liters, 'L');
  const el = showPage((p) => {
    p.innerHTML = '<h2>Trip fuel</h2><div class="sub">' + esc(String(q.distance)) + ' ' + esc(distLabel) + ' · ' + esc(eff) + '</div>'
      + '<div class="fuel-need" style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(lead) + '</div>'
      + '<ul><li><b>Fuel needed</b> ' + esc(lead + ' (' + other + ')') + '</li></ul>'
      + '<label style="display:flex;gap:8px;align-items:center;margin:8px 0">Price per ' + (metric ? 'litre' : 'gallon') + ' <input class="fuel-price" type="number" min="0" max="50" step="0.01" inputmode="decimal" placeholder="3.50" aria-label="Price per ' + (metric ? 'litre' : 'gallon') + '" style="width:7em"></label>'
      + '<div class="fuel-cost" aria-live="polite" style="font-size:24px;line-height:1.5"></div>'
      + '<p style="color:#8a8a8a">Estimate from the numbers you gave. Real trips vary with traffic, hills, load, and the pump price.</p>'
      + '<div class="src">Formula: fuel = distance ÷ efficiency (mpg or L/100km); cost = fuel × price · worked out on this device</div>';
  });
  const box = el && el.querySelector && el.querySelector('.fuel-price'), out = el && el.querySelector && el.querySelector('.fuel-cost');
  const paint = () => { if (!box || !out) return; const p = num(box.value); if (!Number.isFinite(p) || p <= 0 || p > 50) { out.textContent = ''; return; } const cost = (metric ? r.liters : r.gallons) * p; out.textContent = moneyFmt(cost, 'USD') + ' for the trip · ' + moneyFmt(cost / q.distance, 'USD') + ' per ' + (q.distUnit === 'km' ? 'km' : 'mile'); };
  if (box) box.addEventListener('input', paint);
  return 'fuel';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = fuelOf(text);
  if (!q) return 'none';
  const r = compute(q);
  if (!Number.isFinite(q.price)) return noPrice(q, r, api);
  if (!Number.isFinite(r.cost)) return 'none';
  const distLabel = q.distUnit === 'km' ? 'km' : (q.distance === 1 ? 'mile' : 'miles');
  const eff = Number.isFinite(q.mpg)
    ? (Math.round(q.mpg * 10) / 10) + ' mpg'
    : (Math.round(q.lp100 * 10) / 10) + ' L/100km';
  const priceLabel = moneyFmt(q.price, q.currency) + ' / ' + (q.priceUnit === 'L' ? 'L' : 'gal');
  const need = q.priceUnit === 'L'
    ? qtyFmt(r.liters, 'L') + ' (' + qtyFmt(r.gallons, 'gal') + ')'
    : qtyFmt(r.gallons, 'gal') + ' (' + qtyFmt(r.liters, 'L') + ')';
  showPage((el) => {
    el.innerHTML = '<h2>Trip fuel</h2>'
      + '<div class="sub">' + esc(String(q.distance)) + ' ' + esc(distLabel)
      + ' · ' + esc(eff) + ' · ' + esc(priceLabel) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">'
      + esc(moneyFmt(r.cost, q.currency)) + '</div>'
      + '<ul>'
      + '<li><b>Fuel needed</b> ' + esc(need) + '</li>'
      + '<li><b>Per ' + esc(q.distUnit === 'km' ? 'km' : 'mile') + '</b> '
      + esc(moneyFmt(r.perDist, q.currency)) + '</li>'
      + '</ul>'
      + '<p style="color:#8a8a8a">Estimate from the numbers you gave. Real trips vary with traffic, hills, load, and the pump price.</p>'
      + '<div class="src">Formula: fuel = distance ÷ efficiency (mpg or L/100km); cost = fuel × price · as of Oct 2026</div>';
  });
  return 'fuel';
}

export default {
  name: 'fuel',
  examples: [
    'gas cost for 320 miles at 28 mpg $3.59 a gallon',
    'how much fuel for a 500 mile trip at 30 mpg gas is $3.40',
    'trip fuel 280 miles 32 mpg $3.25/gal',
    'fuel for 400 km at 7 L/100km 1.85 per liter',
    'gasoline for 180 miles at 35 mpg $3.10 per gallon',
    'fuel cost for 300 miles at 30 mpg'
  ],
  nearMisses: [
    'gas stations near me',
    'gas prices in California',
    'what is mpg',
    '20% tip on 45',
    'monthly payment on a $250000 mortgage at 6.5% for 30 years',
    '100 usd in eur'
  ],
  match(lower, text) { return !!fuelOf(text); },
  run
};
