const $ = id => document.getElementById(id);
const KEY = 'verse-loan-calc-v1';

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const d = JSON.parse(s);
      if (d.amount) $('amount').value = d.amount;
      if (d.rate) $('rate').value = d.rate;
      if (d.years) $('years').value = d.years;
      if (d.extra != null) $('extra').value = d.extra;
    }
  } catch (e) { console.debug("lab f616-loan-mortgage-payment:", e); }
}

function save(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.debug("lab f616-loan-mortgage-payment:", e); }
}

function calc() {
  const P = parseFloat($('amount').value) || 0;
  const annual = parseFloat($('rate').value) || 0;
  const years = parseInt($('years').value) || 0;
  const extra = parseFloat($('extra').value) || 0;

  if (P <= 0 || years <= 0 || annual < 0) {
    return { error: 'Enter a positive amount, non-negative rate, and positive term.' };
  }
  if (years > 50) {
    return { error: 'Term limited to 50 years for this table.' };
  }

  const r = annual / 100 / 12;
  const n = years * 12;
  let monthly;
  if (r === 0) {
    monthly = P / n;
  } else {
    monthly = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  }
  const payment = monthly + extra;

  let balance = P;
  const schedule = [];
  let totalInterest = 0;
  let yearPrincipal = 0, yearInterest = 0, yearPayment = 0;
  let month = 0;
  const maxMonths = n + 600; // safety

  while (balance > 0.01 && month < maxMonths) {
    month++;
    const interest = balance * r;
    let principal = payment - interest;
    if (principal > balance) principal = balance;
    const actualPayment = principal + interest;
    balance -= principal;
    if (balance < 0) balance = 0;

    totalInterest += interest;
    yearPrincipal += principal;
    yearInterest += interest;
    yearPayment += actualPayment;

    if (month % 12 === 0 || balance <= 0.01) {
      const yr = Math.ceil(month / 12);
      schedule.push({
        year: yr,
        payment: yearPayment,
        principal: yearPrincipal,
        interest: yearInterest,
        balance: balance
      });
      yearPrincipal = yearInterest = yearPayment = 0;
    }
  }

  const actualMonths = month;
  const actualYears = (actualMonths / 12).toFixed(1);

  return {
    monthly: monthly,
    payment: payment,
    totalInterest: totalInterest,
    totalPaid: P + totalInterest,
    schedule: schedule,
    actualMonths: actualMonths,
    actualYears: actualYears,
    originalMonths: n
  };
}

function fmt(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render(res) {
  if (res.error) {
    $('results').hidden = false;
    $('summary').innerHTML = '<span class="error">' + res.error + '</span>';
    $('tableWrap').hidden = true;
    return;
  }

  const early = res.actualMonths < res.originalMonths;
  let html = `Monthly payment (incl. extra): <strong>$${fmt(res.payment)}</strong><br>`;
  html += `Base payment: $${fmt(res.monthly)} · Total interest: $${fmt(res.totalInterest)} · Total paid: $${fmt(res.totalPaid)}`;
  if (early) html += `<br>Paid off in ${res.actualYears} years (early by extra payments).`;
  $('summary').innerHTML = html;
  $('results').hidden = false;
  $('note').textContent = 'Standard amortization. Extra payments applied to principal. Not financial advice. Numbers are exact to the cent under the formula used.';

  const tbody = $('table').querySelector('tbody');
  tbody.innerHTML = '';
  res.schedule.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.year}</td><td>${fmt(row.payment)}</td><td>${fmt(row.principal)}</td><td>${fmt(row.interest)}</td><td>${fmt(row.balance)}</td>`;
    tbody.appendChild(tr);
  });
  $('tableWrap').hidden = false;

  window._lastRes = res;
  window._lastInputs = {
    amount: $('amount').value,
    rate: $('rate').value,
    years: $('years').value,
    extra: $('extra').value
  };
  save(window._lastInputs);
}

$('f').addEventListener('submit', e => {
  e.preventDefault();
  render(calc());
});

$('reset').addEventListener('click', () => {
  $('amount').value = 250000;
  $('rate').value = 6.5;
  $('years').value = 30;
  $('extra').value = 0;
  $('results').hidden = true;
  $('tableWrap').hidden = true;
  try { localStorage.removeItem(KEY); } catch (e) { console.debug("lab f616-loan-mortgage-payment:", e); }
});

$('copy').addEventListener('click', () => {
  if (!window._lastRes || window._lastRes.error) return;
  const r = window._lastRes;
  const text = `Loan $${fmt(parseFloat($('amount').value))} at ${$('rate').value}% for ${$('years').value} years` +
    (parseFloat($('extra').value) > 0 ? ` (+$${fmt(parseFloat($('extra').value))} extra/mo)` : '') +
    `: $${fmt(r.payment)}/mo, total interest $${fmt(r.totalInterest)}, total paid $${fmt(r.totalPaid)}` +
    (r.actualMonths < r.originalMonths ? ` (paid off in ${r.actualYears} yrs)` : '');
  navigator.clipboard.writeText(text).then(() => {
    const b = $('copy');
    const o = b.textContent;
    b.textContent = 'Copied';
    setTimeout(() => b.textContent = o, 1500);
  }).catch(() => alert('Copy failed'));
});

$('csv').addEventListener('click', () => {
  if (!window._lastRes || window._lastRes.error) return;
  let csv = 'Year,Payment,Principal,Interest,Balance\n';
  window._lastRes.schedule.forEach(row => {
    csv += `${row.year},${row.payment.toFixed(2)},${row.principal.toFixed(2)},${row.interest.toFixed(2)},${row.balance.toFixed(2)}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'amortization.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

load();
// auto-calc on load if saved
if ($('amount').value) render(calc());
