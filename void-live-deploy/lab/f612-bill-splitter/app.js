const STORAGE_KEY = 'verse-bill-splitter-v1';

let state = {
  people: [],
  items: [],
  tax: 8.5,
  tip: 18,
  shareMode: 'proportional'
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) { console.debug("lab f612-bill-splitter:", e); }
  document.getElementById('tax').value = state.tax;
  document.getElementById('tip').value = state.tip;
  document.getElementById('share-mode').value = state.shareMode;
  render();
}

function save() {
  state.tax = parseFloat(document.getElementById('tax').value) || 0;
  state.tip = parseFloat(document.getElementById('tip').value) || 0;
  state.shareMode = document.getElementById('share-mode').value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function addPerson() {
  const input = document.getElementById('new-person');
  const name = input.value.trim();
  if (!name) return;
  if (state.people.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
  state.people.push({ id: uid(), name });
  input.value = '';
  save();
}

function removePerson(id) {
  state.people = state.people.filter(p => p.id !== id);
  state.items.forEach(item => {
    item.who = item.who.filter(w => w !== id);
  });
  save();
}

function addItem() {
  const name = document.getElementById('item-name').value.trim() || 'Item';
  const price = parseFloat(document.getElementById('item-price').value) || 0;
  if (price <= 0 && !name) return;
  state.items.push({ id: uid(), name, price, who: [] });
  document.getElementById('item-name').value = '';
  document.getElementById('item-price').value = '';
  save();
}

function removeItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  save();
}

function toggleWho(itemId, personId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  const idx = item.who.indexOf(personId);
  if (idx === -1) item.who.push(personId);
  else item.who.splice(idx, 1);
  save();
}

function compute() {
  const people = state.people;
  if (!people.length) return { rows: [], grand: 0, subtotal: 0, taxAmt: 0, tipAmt: 0 };

  const subtotals = Object.fromEntries(people.map(p => [p.id, 0]));
  let totalItems = 0;

  state.items.forEach(item => {
    totalItems += item.price;
    if (!item.who.length) return;
    const share = item.price / item.who.length;
    item.who.forEach(pid => {
      if (subtotals[pid] !== undefined) subtotals[pid] += share;
    });
  });

  const assigned = Object.values(subtotals).reduce((a, b) => a + b, 0);
  const taxAmt = totalItems * (state.tax / 100);
  const tipAmt = totalItems * (state.tip / 100);
  const shared = taxAmt + tipAmt;

  const rows = people.map(p => {
    let extra = 0;
    if (state.shareMode === 'equal') {
      extra = shared / people.length;
    } else {
      const base = subtotals[p.id] || 0;
      extra = assigned > 0 ? (base / assigned) * shared : shared / people.length;
    }
    const total = (subtotals[p.id] || 0) + extra;
    return { id: p.id, name: p.name, items: subtotals[p.id] || 0, extra, total };
  });

  // Round to cents and fix residual
  let sum = 0;
  rows.forEach(r => {
    r.total = Math.round(r.total * 100) / 100;
    sum += r.total;
  });
  const expected = Math.round((totalItems + shared) * 100) / 100;
  const diff = Math.round((expected - sum) * 100) / 100;
  if (diff !== 0 && rows.length) {
    const max = rows.reduce((a, b) => a.total > b.total ? a : b);
    max.total = Math.round((max.total + diff) * 100) / 100;
  }

  return { rows, grand: expected, subtotal: totalItems, taxAmt, tipAmt };
}

function formatMoney(n) {
  return '$' + (n || 0).toFixed(2);
}

function render() {
  // People
  const pl = document.getElementById('people-list');
  pl.innerHTML = state.people.length
    ? state.people.map(p => `
        <span class="person-chip">${p.name}
          <button type="button" class="danger" data-remove-person="${p.id}" aria-label="Remove ${p.name}">×</button>
        </span>`).join('')
    : '<span class="empty">No people yet</span>';

  // Items
  const il = document.getElementById('items-list');
  if (!state.items.length) {
    il.innerHTML = '<div class="empty">No items yet</div>';
  } else {
    il.innerHTML = state.items.map(item => `
      <div class="item">
        <div class="item-head">
          <strong>${item.name}</strong>
          <span>${formatMoney(item.price)}
            <button type="button" class="danger" data-remove-item="${item.id}">×</button>
          </span>
        </div>
        <div class="assignees">
          ${state.people.map(p => `
            <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.85rem;cursor:pointer">
              <input type="checkbox" data-toggle="${item.id}" data-person="${p.id}" ${item.who.includes(p.id) ? 'checked' : ''}>
              ${p.name}
            </label>`).join('')}
          ${!state.people.length ? '<span class="empty">Add people first</span>' : ''}
        </div>
      </div>`).join('');
  }

  // Totals
  const { rows, grand, subtotal, taxAmt, tipAmt } = compute();
  const tl = document.getElementById('totals');
  if (!rows.length) {
    tl.innerHTML = '<div class="empty">Add people and items to see totals</div>';
  } else {
    tl.innerHTML = `
      <div class="total-row"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
      <div class="total-row"><span>Tax (${state.tax}%)</span><span>${formatMoney(taxAmt)}</span></div>
      <div class="total-row"><span>Tip (${state.tip}%)</span><span>${formatMoney(tipAmt)}</span></div>
      ${rows.map(r => `
        <div class="total-row">
          <span>${r.name}</span>
          <span>${formatMoney(r.total)}</span>
        </div>`).join('')}
      <div class="total-row grand"><span>Total</span><span>${formatMoney(grand)}</span></div>
    `;
  }
}

function summaryText() {
  const { rows, grand, subtotal, taxAmt, tipAmt } = compute();
  let t = `Bill splitter\nSubtotal: ${formatMoney(subtotal)}\nTax (${state.tax}%): ${formatMoney(taxAmt)}\nTip (${state.tip}%): ${formatMoney(tipAmt)}\n\n`;
  rows.forEach(r => t += `${r.name}: ${formatMoney(r.total)}\n`);
  t += `\nTotal: ${formatMoney(grand)}`;
  return t;
}

function copyBreakdown() {
  const text = summaryText();
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1600);
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1600);
  });
}

function downloadCSV() {
  const { rows, grand, subtotal, taxAmt, tipAmt } = compute();
  let csv = 'Person,Amount\n';
  rows.forEach(r => csv += `"${r.name}",${r.total.toFixed(2)}\n`);
  csv += `\nSubtotal,${subtotal.toFixed(2)}\nTax,${taxAmt.toFixed(2)}\nTip,${tipAmt.toFixed(2)}\nTotal,${grand.toFixed(2)}\n`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bill-split.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearAll() {
  if (!confirm('Clear the whole bill?')) return;
  state = { people: [], items: [], tax: 8.5, tip: 18, shareMode: 'proportional' };
  document.getElementById('tax').value = 8.5;
  document.getElementById('tip').value = 18;
  document.getElementById('share-mode').value = 'proportional';
  save();
}

// Events
document.getElementById('add-person').onclick = addPerson;
document.getElementById('new-person').onkeydown = e => { if (e.key === 'Enter') addPerson(); };
document.getElementById('add-item').onclick = addItem;
document.getElementById('item-name').onkeydown = e => { if (e.key === 'Enter') addItem(); };
document.getElementById('item-price').onkeydown = e => { if (e.key === 'Enter') addItem(); };
document.getElementById('tax').oninput = save;
document.getElementById('tip').oninput = save;
document.getElementById('share-mode').onchange = save;
document.getElementById('copy').onclick = copyBreakdown;
document.getElementById('csv').onclick = downloadCSV;
document.getElementById('clear').onclick = clearAll;

document.body.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.removePerson) removePerson(t.dataset.removePerson);
  if (t.dataset.removeItem) removeItem(t.dataset.removeItem);
});
document.body.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.toggle && t.dataset.person) toggleWho(t.dataset.toggle, t.dataset.person);
});

load();
