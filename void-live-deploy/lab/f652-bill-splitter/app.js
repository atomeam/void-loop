const $ = id => document.getElementById(id);
const KEY = 'verse-f652-bill';

let people = [];
let items = [];

function uid() { return Math.random().toString(36).slice(2, 9); }

function save() {
  const data = { people, items, tax: +$('tax').value || 0, tip: +$('tip').value || 0 };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.debug("lab f652-bill-splitter:", e); }
  updateHash(data);
}

function load() {
  let data = null;
  const hash = location.hash.slice(1);
  if (hash) {
    try { data = JSON.parse(decodeURIComponent(escape(atob(hash)))); } catch (e) { console.debug("lab f652-bill-splitter:", e); }
  }
  if (!data) {
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { console.debug("lab f652-bill-splitter:", e); }
  }
  if (data) {
    people = data.people || [];
    items = data.items || [];
    $('tax').value = data.tax ?? 8;
    $('tip').value = data.tip ?? 18;
  }
  render();
}

function updateHash(data) {
  try {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    history.replaceState(null, '', '#' + b64);
  } catch (e) { console.debug("lab f652-bill-splitter:", e); }
}

function render() {
  const pEl = $('people');
  pEl.innerHTML = people.map(p => `
    <div class="person">
      <strong>${escapeHtml(p.name)}</strong>
      <button class="secondary danger" data-remove-person="${p.id}">Remove</button>
    </div>`).join('');

  const iEl = $('items');
  iEl.innerHTML = items.map(it => `
    <div class="item">
      <span>${escapeHtml(it.desc)} — $${it.price.toFixed(2)}</span>
      <div class="assignees">
        ${people.map(p => `<label><input type="checkbox" data-item="${it.id}" data-person="${p.id}" ${it.assignees.includes(p.id)?'checked':''}> ${escapeHtml(p.name)}</label>`).join('')}
      </div>
      <button class="secondary danger" data-remove-item="${it.id}">Remove</button>
    </div>`).join('');

  calc();
  save();
}

function calc() {
  const taxRate = (+$('tax').value || 0) / 100;
  const tipRate = (+$('tip').value || 0) / 100;
  const shares = {};
  people.forEach(p => shares[p.id] = { name: p.name, sub: 0, tax: 0, tip: 0, total: 0 });

  let grandSub = 0;
  items.forEach(it => {
    const n = it.assignees.length;
    if (n === 0) return;
    const each = it.price / n;
    it.assignees.forEach(pid => {
      if (shares[pid]) shares[pid].sub += each;
    });
    grandSub += it.price;
  });

  const taxTotal = grandSub * taxRate;
  const tipTotal = grandSub * tipRate;

  Object.values(shares).forEach(s => {
    if (grandSub > 0) {
      const prop = s.sub / grandSub;
      s.tax = taxTotal * prop;
      s.tip = tipTotal * prop;
    }
    s.total = s.sub + s.tax + s.tip;
  });

  const tEl = $('totals');
  if (people.length === 0 || items.length === 0) {
    tEl.innerHTML = '<div class="note">Add at least one person and one item.</div>';
    return;
  }
  tEl.innerHTML = Object.values(shares).map(s => 
    `<div class="person-total"><span>${escapeHtml(s.name)}</span><strong>$${s.total.toFixed(2)}</strong></div>`
  ).join('') + `<div class="person-total" style="font-weight:700"><span>Grand total</span><strong>$${(grandSub + taxTotal + tipTotal).toFixed(2)}</strong></div>`;

  window._lastSummary = buildSummary(shares, grandSub, taxTotal, tipTotal);
}

function buildSummary(shares, grandSub, taxTotal, tipTotal) {
  let txt = 'Bill split\n=========\n';
  items.forEach(it => {
    const names = it.assignees.map(id => people.find(p=>p.id===id)?.name || '?').join(', ');
    txt += `${it.desc}: $${it.price.toFixed(2)} (shared by ${names || 'no one'})\n`;
  });
  txt += `\nSubtotal: $${grandSub.toFixed(2)}\nTax: $${taxTotal.toFixed(2)}\nTip: $${tipTotal.toFixed(2)}\nTotal: $${(grandSub+taxTotal+tipTotal).toFixed(2)}\n\n`;
  Object.values(shares).forEach(s => {
    txt += `${s.name}: $${s.total.toFixed(2)}\n`;
  });
  return txt;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

$('addPerson').onclick = () => {
  const name = $('personName').value.trim();
  if (!name) return;
  people.push({ id: uid(), name });
  $('personName').value = '';
  render();
};

$('addItem').onclick = () => {
  const desc = $('itemDesc').value.trim() || 'Item';
  const price = +$('itemPrice').value || 0;
  if (price <= 0) return;
  items.push({ id: uid(), desc, price, assignees: people.map(p=>p.id) });
  $('itemDesc').value = '';
  $('itemPrice').value = '';
  render();
};

document.body.addEventListener('click', e => {
  if (e.target.dataset.removePerson) {
    const id = e.target.dataset.removePerson;
    people = people.filter(p => p.id !== id);
    items.forEach(it => it.assignees = it.assignees.filter(a => a !== id));
    render();
  }
  if (e.target.dataset.removeItem) {
    items = items.filter(it => it.id !== e.target.dataset.removeItem);
    render();
  }
});

document.body.addEventListener('change', e => {
  if (e.target.dataset.item && e.target.dataset.person) {
    const it = items.find(i => i.id === e.target.dataset.item);
    if (!it) return;
    const pid = e.target.dataset.person;
    if (e.target.checked) {
      if (!it.assignees.includes(pid)) it.assignees.push(pid);
    } else {
      it.assignees = it.assignees.filter(a => a !== pid);
    }
    render();
  }
});

['tax','tip'].forEach(id => $(id).addEventListener('input', render));

$('copy').onclick = () => {
  const t = window._lastSummary || 'Nothing to copy yet.';
  navigator.clipboard.writeText(t).then(() => alert('Copied!')).catch(() => alert('Copy failed — select and copy manually.'));
};

$('download').onclick = () => {
  const t = window._lastSummary || 'Empty bill.';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], {type:'text/plain'}));
  a.download = 'bill-split.txt';
  a.click();
};

$('clear').onclick = () => {
  if (!confirm('Clear the whole bill?')) return;
  people = []; items = [];
  $('tax').value = 8; $('tip').value = 18;
  render();
};

load();
