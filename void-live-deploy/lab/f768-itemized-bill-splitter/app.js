let people = [];
let items = []; // {name, price, assignees: Set of names}

function load() {
  try {
    const raw = localStorage.getItem('verse-bill-splitter');
    if (raw) {
      const data = JSON.parse(raw);
      people = data.people || [];
      items = (data.items || []).map(it => ({...it, assignees: new Set(it.assignees || [])}));
      document.getElementById('tax-pct').value = data.tax || 8;
      document.getElementById('tip-pct').value = data.tip || 18;
    }
    const hash = location.hash.slice(1);
    if (hash) {
      try {
        const data = JSON.parse(decodeURIComponent(escape(atob(hash))));
        people = data.people || people;
        items = (data.items || []).map(it => ({...it, assignees: new Set(it.assignees || [])}));
        if (data.tax != null) document.getElementById('tax-pct').value = data.tax;
        if (data.tip != null) document.getElementById('tip-pct').value = data.tip;
      } catch (e) { console.debug("lab f768-itemized-bill-splitter:", e); }
    }
  } catch (e) { console.debug("lab f768-itemized-bill-splitter:", e); }
  render();
  renderHistory();
}

function saveState() {
  const data = {
    people,
    items: items.map(it => ({...it, assignees: [...it.assignees]})),
    tax: +document.getElementById('tax-pct').value,
    tip: +document.getElementById('tip-pct').value
  };
  try { localStorage.setItem('verse-bill-splitter', JSON.stringify(data)); } catch (e) { console.debug("lab f768-itemized-bill-splitter:", e); }
  // update hash for share
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  history.replaceState(null, '', '#' + b64);
}

function addPerson() {
  const name = document.getElementById('new-person').value.trim();
  if (name && !people.includes(name)) {
    people.push(name);
    document.getElementById('new-person').value = '';
    render();
    saveState();
  }
}

function addItem() {
  const name = document.getElementById('new-item-name').value.trim();
  const price = parseFloat(document.getElementById('new-item-price').value);
  if (name && price > 0) {
    items.push({name, price, assignees: new Set(people)}); // default all
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-price').value = '';
    render();
    saveState();
  }
}

function render() {
  const pl = document.getElementById('people-list');
  pl.innerHTML = people.map((p, i) => `<div class="person-row"><span>${p}</span> <button onclick="removePerson(${i})" class="secondary">×</button></div>`).join('');
  const il = document.getElementById('items-list');
  il.innerHTML = items.map((it, i) => {
    const checks = people.map(p => `<label><input type="checkbox" ${it.assignees.has(p) ? 'checked' : ''} onchange="toggleAssign(${i}, '${p}')"> ${p}</label>`).join(' ');
    return `<div class="item-row"><strong>${it.name}</strong> $${it.price.toFixed(2)} ${checks} <button onclick="removeItem(${i})" class="secondary">×</button></div>`;
  }).join('');
  calc();
}

function removePerson(i) {
  const name = people[i];
  people.splice(i, 1);
  items.forEach(it => it.assignees.delete(name));
  render(); saveState();
}

function removeItem(i) {
  items.splice(i, 1);
  render(); saveState();
}

function toggleAssign(i, p) {
  if (items[i].assignees.has(p)) items[i].assignees.delete(p);
  else items[i].assignees.add(p);
  calc(); saveState();
}

function calc() {
  const taxPct = parseFloat(document.getElementById('tax-pct').value) || 0;
  const tipPct = parseFloat(document.getElementById('tip-pct').value) || 0;
  const tipFixed = parseFloat(document.getElementById('tip-fixed').value) || 0;
  const personItems = {};
  people.forEach(p => personItems[p] = 0);
  let subtotal = 0;
  items.forEach(it => {
    const n = it.assignees.size || 1;
    const share = it.price / n;
    it.assignees.forEach(p => {
      if (personItems[p] != null) personItems[p] += share;
    });
    subtotal += it.price;
  });
  const tax = subtotal * taxPct / 100;
  const tip = tipFixed > 0 ? tipFixed : subtotal * tipPct / 100;
  const grand = subtotal + tax + tip;
  const tbody = document.querySelector('#breakdown tbody');
  let html = '';
  people.forEach(p => {
    const itemShare = personItems[p] || 0;
    const ratio = subtotal > 0 ? itemShare / subtotal : 0;
    const pTax = tax * ratio;
    const pTip = tip * ratio;
    const total = itemShare + pTax + pTip;
    html += `<tr><td>${p}</td><td>$${itemShare.toFixed(2)}</td><td>$${pTax.toFixed(2)}</td><td>$${pTip.toFixed(2)}</td><td class="totals">$${total.toFixed(2)}</td></tr>`;
  });
  tbody.innerHTML = html;
  document.getElementById('grand').textContent = `Grand total: $${grand.toFixed(2)} (items $${subtotal.toFixed(2)} + tax $${tax.toFixed(2)} + tip $${tip.toFixed(2)})`;
  const summary = people.map(p => {
    const itemShare = personItems[p] || 0;
    const ratio = subtotal > 0 ? itemShare / subtotal : 0;
    const total = itemShare + tax * ratio + tip * ratio;
    return `${p}: $${total.toFixed(2)}`;
  }).join('\n') + `\n\nGrand: $${grand.toFixed(2)}`;
  document.getElementById('summary').textContent = summary;
}

function copySummary() {
  const text = document.getElementById('summary').textContent;
  navigator.clipboard.writeText(text).then(() => alert('Copied!')).catch(() => alert('Copy failed'));
}

function saveBill() {
  const name = prompt('Name this bill?', 'Dinner ' + new Date().toLocaleDateString()) || 'Bill';
  let history = [];
  try { history = JSON.parse(localStorage.getItem('verse-bill-history') || '[]'); } catch (e) { console.debug("lab f768-itemized-bill-splitter:", e); }
  const data = {
    name,
    people,
    items: items.map(it => ({...it, assignees: [...it.assignees]})),
    tax: +document.getElementById('tax-pct').value,
    tip: +document.getElementById('tip-pct').value,
    date: new Date().toISOString()
  };
  history.unshift(data);
  if (history.length > 20) history.length = 20;
  try { localStorage.setItem('verse-bill-history', JSON.stringify(history)); } catch (e) { console.debug("lab f768-itemized-bill-splitter:", e); }
  renderHistory();
  alert('Saved');
}

function renderHistory() {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('verse-bill-history') || '[]'); } catch (e) { console.debug("lab f768-itemized-bill-splitter:", e); }
  document.getElementById('history').innerHTML = history.map((h, i) => `<div><button onclick="loadHistory(${i})">${h.name} (${new Date(h.date).toLocaleDateString()})</button></div>`).join('') || 'None yet';
}

function loadHistory(i) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('verse-bill-history') || '[]'); } catch (e) { console.debug("lab f768-itemized-bill-splitter:", e); }
  const h = history[i];
  if (h) {
    people = h.people || [];
    items = (h.items || []).map(it => ({...it, assignees: new Set(it.assignees || [])}));
    document.getElementById('tax-pct').value = h.tax || 8;
    document.getElementById('tip-pct').value = h.tip || 18;
    render();
    saveState();
  }
}

load();
