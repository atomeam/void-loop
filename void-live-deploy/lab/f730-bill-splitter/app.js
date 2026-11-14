const $ = id => document.getElementById(id);
let people = [];
let items = [];
let taxPct = 8.5;
let tipPct = 18;

function load() {
  try {
    const raw = localStorage.getItem('verse-bill-splitter');
    if (raw) {
      const data = JSON.parse(raw);
      people = data.people || [];
      items = data.items || [];
      taxPct = data.taxPct ?? 8.5;
      tipPct = data.tipPct ?? 18;
    }
  } catch (e) { console.debug("lab f730-bill-splitter:", e); }
  $('taxPct').value = taxPct;
  $('tipPct').value = tipPct;
  render();
}

function save() {
  try {
    localStorage.setItem('verse-bill-splitter', JSON.stringify({ people, items, taxPct, tipPct }));
  } catch (e) { console.debug("lab f730-bill-splitter:", e); }
}

function renderPeople() {
  const el = $('peopleList');
  el.innerHTML = people.map((p, i) =>
    `<span class="chip">${p} <button data-i="${i}" class="rm-person">×</button></span>`
  ).join('');
  el.querySelectorAll('.rm-person').forEach(btn => {
    btn.onclick = () => { 
      const removed = people[+btn.dataset.i];
      people.splice(+btn.dataset.i, 1); 
      items.forEach(it => it.shares = it.shares.filter(s => s !== removed)); 
      save(); render(); 
    };
  });
}

function renderItems() {
  const el = $('itemsList');
  el.innerHTML = items.map((it, idx) => `
    <div class="item">
      <div class="row">
        <strong>${it.name}</strong> $${it.price.toFixed(2)}
        <button data-i="${idx}" class="rm-item">Remove</button>
      </div>
      <div class="shares">
        ${people.map(p => `<label><input type="checkbox" data-item="${idx}" data-person="${p}" ${it.shares.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}
      </div>
    </div>
  `).join('');
  el.querySelectorAll('.rm-item').forEach(btn => {
    btn.onclick = () => { items.splice(+btn.dataset.i, 1); save(); render(); };
  });
  el.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = () => {
      const item = items[+cb.dataset.item];
      const p = cb.dataset.person;
      if (cb.checked) {
        if (!item.shares.includes(p)) item.shares.push(p);
      } else {
        item.shares = item.shares.filter(s => s !== p);
      }
      save(); render();
    };
  });
}

function compute() {
  const subtotal = items.reduce((s, it) => s + it.price, 0);
  const tax = subtotal * (taxPct / 100);
  const tip = (subtotal + tax) * (tipPct / 100);
  const grand = subtotal + tax + tip;
  const shares = {};
  people.forEach(p => shares[p] = 0);
  items.forEach(it => {
    const n = it.shares.length || 1;
    const each = it.price / n;
    it.shares.forEach(p => { if (shares[p] !== undefined) shares[p] += each; });
  });
  const itemTotal = Object.values(shares).reduce((a, b) => a + b, 0);
  const scale = itemTotal > 0 ? subtotal / itemTotal : 1;
  Object.keys(shares).forEach(p => shares[p] *= scale);
  const taxShare = tax / Math.max(people.length, 1);
  const tipShare = tip / Math.max(people.length, 1);
  Object.keys(shares).forEach(p => shares[p] += taxShare + tipShare);
  return { subtotal, tax, tip, grand, shares };
}

function render() {
  renderPeople();
  renderItems();
  const { subtotal, tax, tip, grand, shares } = compute();
  $('summary').innerHTML = `
    Subtotal: $${subtotal.toFixed(2)} · Tax: $${tax.toFixed(2)} · Tip: $${tip.toFixed(2)} · <strong>Total: $${grand.toFixed(2)}</strong>
  `;
  const max = Math.max(...Object.values(shares), 1);
  $('bars').innerHTML = Object.entries(shares).map(([p, amt]) => `
    <div class="bar-row">
      <span class="person-name">${p}</span>
      <div class="bar" style="width:${(amt / max) * 70}%"></div>
      <span>$${amt.toFixed(2)}</span>
    </div>
  `).join('');
}

$('addPerson').onclick = () => {
  const name = $('personInput').value.trim();
  if (name && !people.includes(name)) {
    people.push(name);
    $('personInput').value = '';
    save(); render();
  }
};
$('personInput').onkeydown = e => { if (e.key === 'Enter') $('addPerson').click(); };

$('addItem').onclick = () => {
  const name = $('itemName').value.trim() || 'Item';
  const price = parseFloat($('itemPrice').value) || 0;
  if (price > 0) {
    items.push({ name, price, shares: [...people] });
    $('itemName').value = '';
    $('itemPrice').value = '';
    save(); render();
  }
};

$('taxPct').onchange = $('tipPct').onchange = () => {
  taxPct = parseFloat($('taxPct').value) || 0;
  tipPct = parseFloat($('tipPct').value) || 0;
  save(); render();
};

$('copyBtn').onclick = () => {
  const { shares, grand } = compute();
  const text = Object.entries(shares).map(([p, a]) => `${p}: $${a.toFixed(2)}`).join('\n') + `\nTotal: $${grand.toFixed(2)}`;
  navigator.clipboard.writeText(text).then(() => alert('Copied'));
};

$('csvBtn').onclick = () => {
  const { shares, subtotal, tax, tip, grand } = compute();
  let csv = 'Person,Amount\n';
  Object.entries(shares).forEach(([p, a]) => csv += `"${p}",${a.toFixed(2)}\n`);
  csv += `\nSubtotal,${subtotal.toFixed(2)}\nTax,${tax.toFixed(2)}\nTip,${tip.toFixed(2)}\nTotal,${grand.toFixed(2)}\n`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bill-split.csv';
  a.click();
};

$('clearBtn').onclick = () => {
  if (confirm('Clear everyone and everything?')) {
    people = []; items = [];
    localStorage.removeItem('verse-bill-splitter');
    render();
  }
};

load();
