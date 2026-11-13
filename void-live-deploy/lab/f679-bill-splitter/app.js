const $ = id => document.getElementById(id);
const STORAGE_KEY = 'verse-bill-splitter-v1';

let state = {
  people: [],
  items: [],
  taxPct: 8.5,
  tipPct: 18
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) { console.debug("lab f679-bill-splitter:", e); }
  render();
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.debug("lab f679-bill-splitter:", e); }
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function addPerson(name) {
  name = (name || '').trim();
  if (!name || state.people.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
  state.people.push({ id: uid(), name });
  save(); render();
}

function removePerson(id) {
  state.people = state.people.filter(p => p.id !== id);
  state.items.forEach(it => { it.assignees = it.assignees.filter(a => a !== id); });
  save(); render();
}

function addItem(name, price) {
  name = (name || '').trim();
  price = parseFloat(price) || 0;
  if (!name || price < 0) return;
  state.items.push({ id: uid(), name, price, assignees: state.people.map(p => p.id) });
  save(); render();
}

function removeItem(id) {
  state.items = state.items.filter(it => it.id !== id);
  save(); render();
}

function toggleAssignee(itemId, personId) {
  const item = state.items.find(it => it.id === itemId);
  if (!item) return;
  if (item.assignees.includes(personId)) {
    item.assignees = item.assignees.filter(a => a !== personId);
  } else {
    item.assignees.push(personId);
  }
  if (item.assignees.length === 0) item.assignees = [personId]; // at least one
  save(); render();
}

function compute() {
  const tax = (parseFloat($('taxPct').value) || 0) / 100;
  const tip = (parseFloat($('tipPct').value) || 0) / 100;
  state.taxPct = parseFloat($('taxPct').value) || 0;
  state.tipPct = parseFloat($('tipPct').value) || 0;

  let grandSub = 0;
  const personSub = {};
  state.people.forEach(p => personSub[p.id] = 0);

  state.items.forEach(it => {
    grandSub += it.price;
    const n = it.assignees.length || 1;
    const share = it.price / n;
    it.assignees.forEach(pid => {
      if (personSub[pid] !== undefined) personSub[pid] += share;
    });
  });

  const taxTotal = grandSub * tax;
  const tipTotal = grandSub * tip;
  const results = state.people.map(p => {
    const sub = personSub[p.id] || 0;
    const ratio = grandSub > 0 ? sub / grandSub : 0;
    const taxShare = taxTotal * ratio;
    const tipShare = tipTotal * ratio;
    const total = sub + taxShare + tipShare;
    return { ...p, sub, taxShare, tipShare, total };
  });

  return { results, grandSub, taxTotal, tipTotal, grandTotal: grandSub + taxTotal + tipTotal };
}

function render() {
  // People
  $('peopleList').innerHTML = state.people.map(p =>
    `<div class="chip">${p.name} <button onclick="removePerson('${p.id}')" title="Remove">×</button></div>`
  ).join('') || '<span style="color:#666">No people yet</span>';

  // Items
  $('itemsList').innerHTML = state.items.map(it => `
    <div class="item">
      <div class="row">
        <strong>${escapeHtml(it.name)}</strong>
        <span>$${it.price.toFixed(2)}</span>
        <button class="secondary" onclick="removeItem('${it.id}')">Remove</button>
      </div>
      <div class="assignees">
        ${state.people.map(p => `
          <label>
            <input type="checkbox" ${it.assignees.includes(p.id) ? 'checked' : ''}
              onchange="toggleAssignee('${it.id}','${p.id}')"> ${escapeHtml(p.name)}
          </label>
        `).join('') || '<em>Add people first</em>'}
      </div>
    </div>
  `).join('') || '<p style="color:#666">No items yet</p>';

  // Totals
  const { results, grandSub, taxTotal, tipTotal, grandTotal } = compute();
  $('totals').innerHTML = results.map(r => `
    <div class="person-total">
      <div>${escapeHtml(r.name)}</div>
      <div>Items: $${r.sub.toFixed(2)} · Tax: $${r.taxShare.toFixed(2)} · Tip: $${r.tipShare.toFixed(2)}</div>
      <strong>$${r.total.toFixed(2)}</strong>
    </div>
  `).join('') || '<p>Add people and items to see totals</p>';

  if (results.length) {
    $('totals').innerHTML += `<div class="person-total" style="background:#2a2a2a">
      <div>Group</div>
      <div>Subtotal: $${grandSub.toFixed(2)} · Tax: $${taxTotal.toFixed(2)} · Tip: $${tipTotal.toFixed(2)}</div>
      <strong>$${grandTotal.toFixed(2)}</strong>
    </div>`;
  }

  save();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function copySummary() {
  const { results, grandSub, taxTotal, tipTotal, grandTotal } = compute();
  if (!results.length) return;
  let text = `Bill split\nSubtotal: $${grandSub.toFixed(2)}\nTax (${state.taxPct}%): $${taxTotal.toFixed(2)}\nTip (${state.tipPct}%): $${tipTotal.toFixed(2)}\nTotal: $${grandTotal.toFixed(2)}\n\n`;
  results.forEach(r => {
    text += `${r.name}: $${r.total.toFixed(2)} (items $${r.sub.toFixed(2)} + tax $${r.taxShare.toFixed(2)} + tip $${r.tipShare.toFixed(2)})\n`;
  });
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('copyBtn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 1500);
  }).catch(() => alert('Copy failed — select and copy manually'));
}

function downloadCSV() {
  const { results, grandSub, taxTotal, tipTotal, grandTotal } = compute();
  let csv = 'Person,Items Subtotal,Tax Share,Tip Share,Total\n';
  results.forEach(r => {
    csv += `"${r.name}",${r.sub.toFixed(2)},${r.taxShare.toFixed(2)},${r.tipShare.toFixed(2)},${r.total.toFixed(2)}\n`;
  });
  csv += `\nGroup subtotal,${grandSub.toFixed(2)}\nTax,${taxTotal.toFixed(2)}\nTip,${tipTotal.toFixed(2)}\nGrand total,${grandTotal.toFixed(2)}\n`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bill-split.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearAll() {
  if (confirm('Clear everyone and everything?')) {
    state = { people: [], items: [], taxPct: 8.5, tipPct: 18 };
    $('taxPct').value = 8.5;
    $('tipPct').value = 18;
    save(); render();
  }
}

$('addPerson').onclick = () => { addPerson($('personName').value); $('personName').value = ''; };
$('personName').onkeydown = e => { if (e.key === 'Enter') { addPerson(e.target.value); e.target.value = ''; } };
$('addItem').onclick = () => { addItem($('itemName').value, $('itemPrice').value); $('itemName').value = ''; $('itemPrice').value = ''; };
$('itemName').onkeydown = $('itemPrice').onkeydown = e => { if (e.key === 'Enter') { addItem($('itemName').value, $('itemPrice').value); $('itemName').value = ''; $('itemPrice').value = ''; } };
$('taxPct').oninput = $('tipPct').oninput = () => { state.taxPct = parseFloat($('taxPct').value)||0; state.tipPct = parseFloat($('tipPct').value)||0; render(); };
$('copyBtn').onclick = copySummary;
$('csvBtn').onclick = downloadCSV;
$('clearBtn').onclick = clearAll;

load();
