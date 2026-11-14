(function () {
  const STORAGE_KEY = 'verse-f748-debt-plan';

  let method = 'snowball'; // or 'avalanche'
  let lastSchedule = null;
  let lastMeta = null;

  const debtsEl = document.getElementById('debts');
  const resultsEl = document.getElementById('results');
  const compareResultsEl = document.getElementById('compareResults');

  function money(n) {
    return '$' + (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function addDebtRow(data = { name: '', balance: '', rate: '', min: '' }) {
    const div = document.createElement('div');
    div.className = 'debt-item';
    div.innerHTML = `
      <button type="button" class="remove" aria-label="Remove">×</button>
      <div class="row3">
        <div class="span2">
          <label>Name</label>
          <input type="text" class="d-name" placeholder="Credit card" value="${escapeAttr(data.name)}">
        </div>
        <div>
          <label>Balance ($)</label>
          <input type="number" class="d-bal" min="0" step="0.01" placeholder="2500" value="${data.balance}">
        </div>
        <div>
          <label>APR (%)</label>
          <input type="number" class="d-rate" min="0" step="0.01" placeholder="22.9" value="${data.rate}">
        </div>
        <div>
          <label>Min payment ($)</label>
          <input type="number" class="d-min" min="0" step="0.01" placeholder="50" value="${data.min}">
        </div>
      </div>
    `;
    div.querySelector('.remove').onclick = () => div.remove();
    debtsEl.appendChild(div);
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  function readDebts() {
    const items = [];
    debtsEl.querySelectorAll('.debt-item').forEach(el => {
      const name = el.querySelector('.d-name').value.trim() || 'Debt';
      const balance = parseFloat(el.querySelector('.d-bal').value) || 0;
      const rate = parseFloat(el.querySelector('.d-rate').value) || 0;
      const min = parseFloat(el.querySelector('.d-min').value) || 0;
      if (balance > 0) {
        items.push({ name, balance, rate, min });
      }
    });
    return items;
  }

  function simulate(debtsIn, extra, order) {
    // Deep copy
    let debts = debtsIn.map(d => ({
      name: d.name,
      balance: d.balance,
      rate: d.rate / 100 / 12, // monthly rate
      min: d.min,
      original: d.balance
    })).filter(d => d.balance > 0.005);

    if (order === 'snowball') {
      debts.sort((a, b) => a.balance - b.balance);
    } else {
      debts.sort((a, b) => b.rate - a.rate);
    }

    const schedule = [];
    let month = 0;
    let totalInterest = 0;
    const maxMonths = 600; // safety

    while (debts.some(d => d.balance > 0.005) && month < maxMonths) {
      month++;
      let availableExtra = extra;
      let monthInterest = 0;
      let focusName = '';
      let focusPayment = 0;

      // Apply interest and minimums
      for (const d of debts) {
        if (d.balance <= 0.005) continue;
        const interest = d.balance * d.rate;
        d.balance += interest;
        monthInterest += interest;
        totalInterest += interest;

        const pay = Math.min(d.min, d.balance);
        d.balance -= pay;
        if (d.balance < 0.005) d.balance = 0;
      }

      // Find current focus (first with remaining balance in current order)
      let focus = debts.find(d => d.balance > 0.005);
      if (focus) {
        focusName = focus.name;
        const extraPay = Math.min(availableExtra, focus.balance);
        focus.balance -= extraPay;
        if (focus.balance < 0.005) focus.balance = 0;
        focusPayment = (focus.min || 0) + extraPay;
        availableExtra -= extraPay;
      }

      // Any leftover extra cascades to next debts
      if (availableExtra > 0.005) {
        for (const d of debts) {
          if (d.balance <= 0.005) continue;
          const extraPay = Math.min(availableExtra, d.balance);
          d.balance -= extraPay;
          if (d.balance < 0.005) d.balance = 0;
          availableExtra -= extraPay;
          if (availableExtra <= 0.005) break;
        }
      }

      const remaining = debts.reduce((s, d) => s + d.balance, 0);
      schedule.push({
        month,
        focus: focusName,
        payment: focusPayment,
        interest: monthInterest,
        remaining
      });

      // Drop paid-off debts for next ordering stability (keep order fixed after initial sort)
      debts = debts.filter(d => d.balance > 0.005);
    }

    return {
      schedule,
      months: month,
      totalInterest,
      totalPaid: debtsIn.reduce((s, d) => s + d.balance, 0) + totalInterest,
      payoffDate: addMonths(new Date(), month)
    };
  }

  function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function formatDate(d) {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  }

  function runCalc() {
    const debts = readDebts();
    const extra = parseFloat(document.getElementById('extra').value) || 0;
    if (debts.length === 0) {
      alert('Add at least one debt with a balance.');
      return;
    }
    const result = simulate(debts, extra, method);
    lastSchedule = result.schedule;
    lastMeta = {
      method,
      debts,
      extra,
      months: result.months,
      totalInterest: result.totalInterest,
      totalPaid: result.totalPaid,
      payoffDate: result.payoffDate
    };
    renderResults(result);
    compareResultsEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResults(result) {
    const sum = document.getElementById('summary');
    sum.innerHTML = `
      <div class="stat">
        <div class="label">Debt-free in</div>
        <div class="value good">${result.months} months</div>
        <div class="label">${formatDate(result.payoffDate)}</div>
      </div>
      <div class="stat">
        <div class="label">Total interest</div>
        <div class="value">${money(result.totalInterest)}</div>
      </div>
      <div class="stat">
        <div class="label">Total paid</div>
        <div class="value">${money(result.totalPaid)}</div>
      </div>
      <div class="stat">
        <div class="label">Method</div>
        <div class="value" style="font-size:1rem">${method === 'snowball' ? 'Snowball' : 'Avalanche'}</div>
      </div>
    `;

    const body = document.getElementById('scheduleBody');
    body.innerHTML = '';
    // Show every month, but for long plans show all (scrollable)
    result.schedule.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.month}</td>
        <td>${row.focus || '—'}</td>
        <td>${money(row.payment)}</td>
        <td>${money(row.interest)}</td>
        <td>${money(row.remaining)}</td>
      `;
      body.appendChild(tr);
    });
  }

  function runCompare() {
    const debts = readDebts();
    const extra = parseFloat(document.getElementById('extra').value) || 0;
    if (debts.length === 0) {
      alert('Add at least one debt with a balance.');
      return;
    }
    const snow = simulate(debts, extra, 'snowball');
    const aval = simulate(debts, extra, 'avalanche');
    const cards = document.getElementById('compareCards');
    cards.innerHTML = `
      <div class="card">
        <h3>Snowball (lowest balance)</h3>
        <p><strong>${snow.months}</strong> months · ${formatDate(snow.payoffDate)}</p>
        <p>Interest: ${money(snow.totalInterest)}</p>
        <p>Total paid: ${money(snow.totalPaid)}</p>
      </div>
      <div class="card">
        <h3>Avalanche (highest rate)</h3>
        <p><strong>${aval.months}</strong> months · ${formatDate(aval.payoffDate)}</p>
        <p>Interest: ${money(aval.totalInterest)}</p>
        <p>Total paid: ${money(aval.totalPaid)}</p>
      </div>
    `;
    compareResultsEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
    compareResultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function downloadCsv() {
    if (!lastSchedule) return;
    const lines = ['Month,Focus debt,Payment,Interest that month,Total remaining'];
    lastSchedule.forEach(r => {
      lines.push([
        r.month,
        `"${(r.focus || '').replace(/"/g, '""')}"`,
        r.payment.toFixed(2),
        r.interest.toFixed(2),
        r.remaining.toFixed(2)
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `debt-plan-${method}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copySummary() {
    if (!lastMeta) return;
    const m = lastMeta;
    const text = [
      `Debt payoff plan (${m.method})`,
      `Extra monthly: ${money(m.extra)}`,
      `Debt-free in ${m.months} months (${formatDate(m.payoffDate)})`,
      `Total interest: ${money(m.totalInterest)}`,
      `Total paid: ${money(m.totalPaid)}`,
      '',
      'Debts:',
      ...m.debts.map(d => `- ${d.name}: ${money(d.balance)} @ ${d.rate}% (min ${money(d.min)})`)
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copySummary');
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => btn.textContent = old, 1500);
    }).catch(() => alert('Could not copy'));
  }

  function savePlan() {
    const data = {
      debts: readDebts(),
      extra: document.getElementById('extra').value,
      method,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const btn = document.getElementById('savePlan');
      const old = btn.textContent;
      btn.textContent = 'Saved';
      setTimeout(() => btn.textContent = old, 1500);
    } catch (e) {
      alert('Could not save');
    }
  }

  function loadPlan() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.debts) && data.debts.length) {
        debtsEl.innerHTML = '';
        data.debts.forEach(d => addDebtRow(d));
      }
      if (data.extra != null) document.getElementById('extra').value = data.extra;
      if (data.method === 'avalanche' || data.method === 'snowball') {
        method = data.method;
        document.getElementById('btnSnowball').classList.toggle('active', method === 'snowball');
        document.getElementById('btnAvalanche').classList.toggle('active', method === 'avalanche');
      }
    } catch (e) { console.debug("lab f748-debt-snowball-planner:", e); }
  }

  // Events
  document.getElementById('addDebt').onclick = () => addDebtRow();
  document.getElementById('calc').onclick = runCalc;
  document.getElementById('compare').onclick = runCompare;
  document.getElementById('downloadCsv').onclick = downloadCsv;
  document.getElementById('copySummary').onclick = copySummary;
  document.getElementById('savePlan').onclick = savePlan;

  document.getElementById('btnSnowball').onclick = () => {
    method = 'snowball';
    document.getElementById('btnSnowball').classList.add('active');
    document.getElementById('btnAvalanche').classList.remove('active');
  };
  document.getElementById('btnAvalanche').onclick = () => {
    method = 'avalanche';
    document.getElementById('btnAvalanche').classList.add('active');
    document.getElementById('btnSnowball').classList.remove('active');
  };

  // Start with two example debts if empty
  loadPlan();
  if (debtsEl.children.length === 0) {
    addDebtRow({ name: 'Credit card', balance: '3200', rate: '22.9', min: '75' });
    addDebtRow({ name: 'Personal loan', balance: '4800', rate: '11.5', min: '120' });
    addDebtRow({ name: 'Store card', balance: '650', rate: '27.9', min: '30' });
  }
})();
