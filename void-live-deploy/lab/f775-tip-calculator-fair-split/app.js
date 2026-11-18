const $ = id => document.getElementById(id);
const inputs = ['bill','tip','tax','people','round'];

function loadFromURL() {
  const p = new URLSearchParams(location.search);
  inputs.forEach(k => { if (p.has(k)) $(k).value = p.get(k); });
}
function saveToURL() {
  const p = new URLSearchParams();
  inputs.forEach(k => p.set(k, $(k).value));
  const url = location.pathname + '?' + p.toString();
  history.replaceState(null, '', url);
  $('share').textContent = 'Share link: ' + location.href;
}
function roundVal(n, mode) {
  if (mode === 'none') return n;
  if (mode === 'nearest') return Math.round(n * 100) / 100;
  if (mode === 'up') return Math.ceil(n * 100) / 100;
  return n;
}
function calculate() {
  const bill = +$('bill').value || 0;
  const tipPct = +$('tip').value || 0;
  const taxPct = +$('tax').value || 0;
  const people = Math.max(1, +$('people').value || 1);
  const mode = $('round').value;
  const tax = bill * (taxPct / 100);
  const tip = bill * (tipPct / 100);
  const sub = bill + tax;
  const total = sub + tip;
  const per = total / people;
  const perR = roundVal(per, mode);
  const tipPer = roundVal(tip / people, mode);
  const out = `Bill: $${bill.toFixed(2)}\nTax: $${tax.toFixed(2)}\nTip: $${tip.toFixed(2)}\nTotal: $${total.toFixed(2)}\n\nPer person (${people}): $${perR.toFixed(2)}\nTip each: $${tipPer.toFixed(2)}`;
  $('out').textContent = out;
  saveToURL();
  localStorage.setItem('tipcalc', JSON.stringify({bill, tipPct, taxPct, people, mode}));
}
function copy() {
  const t = $('out').textContent;
  if (!t) return;
  navigator.clipboard.writeText(t).then(() => {
    const b = $('copy');
    const old = b.textContent;
    b.textContent = 'Copied';
    setTimeout(() => b.textContent = old, 1200);
  });
}
$('calc').onclick = calculate;
$('copy').onclick = copy;
inputs.forEach(k => $(k).addEventListener('input', calculate));
loadFromURL();
try {
  const s = JSON.parse(localStorage.getItem('tipcalc') || '{}');
  if (s.bill != null && !location.search) {
    $('bill').value = s.bill;
    $('tip').value = s.tipPct;
    $('tax').value = s.taxPct;
    $('people').value = s.people;
    $('round').value = s.mode || 'none';
  }
} catch (e) { console.debug("lab f775-tip-calculator-fair-split:", e); }
calculate();
