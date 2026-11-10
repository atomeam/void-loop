const LS = 'verse-f643-receipt';
let items = [];
let categories = ['food','transport','office','home','health','other'];

function load() {
  try {
    const h = location.hash.slice(1);
    if (h) {
      const data = JSON.parse(decodeURIComponent(escape(atob(h))));
      if (Array.isArray(data.items)) items = data.items;
      if (Array.isArray(data.categories)) categories = [...new Set([...categories, ...data.categories])];
    } else {
      const raw = localStorage.getItem(LS);
      if (raw) {
        const data = JSON.parse(raw);
        items = data.items || [];
        categories = data.categories || categories;
      }
    }
  } catch (e) { console.debug("lab f643-receipt-to-expense:", e); }
  render();
}

function save() {
  const data = { items, categories };
  localStorage.setItem(LS, JSON.stringify(data));
  try {
    const h = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    history.replaceState(null, '', '#' + h);
  } catch (e) { console.debug("lab f643-receipt-to-expense:", e); }
}

function parseLines() {
  const text = document.getElementById('paste').value.trim();
  if (!text) return;
  const lines = text.split(/\n+/);
  let added = 0, skipped = 0;
  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) { skipped++; return; }
    let amt = null, cat = null, descParts = [];
    for (let i = parts.length - 1; i >= 0; i--) {
      const n = parseFloat(parts[i].replace(/[^0-9.-]/g,''));
      if (!isNaN(n) && amt === null) {
        amt = n;
        if (i < parts.length - 1) cat = parts.slice(i+1).join(' ');
        descParts = parts.slice(0, i);
        break;
      }
    }
    if (amt === null || descParts.length === 0) { skipped++; return; }
    const desc = descParts.join(' ');
    const category = (cat || 'other').toLowerCase();
    if (!categories.includes(category)) categories.push(category);
    items.push({ desc, amt, category, id: Date.now() + Math.random() });
    added++;
  });
  document.getElementById('parseNote').textContent = `Added ${added}, skipped ${skipped} unparseable lines.`;
  document.getElementById('paste').value = '';
  save(); render();
}

function addOne() {
  const desc = document.getElementById('desc').value.trim();
  const amt = parseFloat(document.getElementById('amt').value);
  let cat = document.getElementById('newCat').value.trim().toLowerCase() || document.getElementById('cat').value;
  if (!desc || isNaN(amt)) return;
  if (!categories.includes(cat)) categories.push(cat);
  items.push({ desc, amt, category: cat, id: Date.now() + Math.random() });
  document.getElementById('desc').value = '';
  document.getElementById('amt').value = '';
  document.getElementById('newCat').value = '';
  save(); render();
}

function del(id) {
  items = items.filter(i => i.id !== id);
  save(); render();
}

function render() {
  const sel = document.getElementById('cat');
  sel.innerHTML = categories.map(c => `<option>${c}</option>`).join('');
  const wrap = document.getElementById('tableWrap');
  if (!items.length) {
    wrap.innerHTML = '<p class="empty">No items yet. Paste lines or add one above.</p>';
    document.getElementById('totals').innerHTML = '';
    return;
  }
  let html = '<table><thead><tr><th>Description</th><th class="amt">Amount</th><th>Category</th><th></th></tr></thead><tbody>';
  items.forEach(i => {
    html += `<tr><td>${escapeHtml(i.desc)}</td><td class="amt">${i.amt.toFixed(2)}</td><td><span class="cat">${escapeHtml(i.category)}</span></td><td><button class="danger" onclick="del(${i.id})">✕</button></td></tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  const byCat = {};
  let grand = 0;
  items.forEach(i => {
    byCat[i.category] = (byCat[i.category] || 0) + i.amt;
    grand += i.amt;
  });
  let t = `<div class="total-box"><span>Grand total</span><strong>${grand.toFixed(2)}</strong></div>`;
  Object.keys(byCat).sort().forEach(c => {
    t += `<div class="total-box"><span>${escapeHtml(c)}</span><strong>${byCat[c].toFixed(2)}</strong></div>`;
  });
  document.getElementById('totals').innerHTML = t;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function toCSV() {
  const date = new Date().toISOString().slice(0,10);
  let csv = 'Date,Description,Amount,Category\n';
  items.forEach(i => csv += `${date},"${i.desc.replace(/"/g,'""')}",${i.amt.toFixed(2)},${i.category}\n`);
  csv += '\nCategory,Total\n';
  const byCat = {};
  let grand = 0;
  items.forEach(i => { byCat[i.category]=(byCat[i.category]||0)+i.amt; grand+=i.amt; });
  Object.keys(byCat).sort().forEach(c => csv += `${c},${byCat[c].toFixed(2)}\n`);
  csv += `TOTAL,${grand.toFixed(2)}\n`;
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `receipt-${date}.csv`;
  a.click();
}

function copySummary() {
  if (!items.length) return;
  const byCat = {};
  let grand = 0;
  items.forEach(i => { byCat[i.category]=(byCat[i.category]||0)+i.amt; grand+=i.amt; });
  let text = `Receipt summary\nGrand total: ${grand.toFixed(2)}\n\n`;
  Object.keys(byCat).sort().forEach(c => text += `${c}: ${byCat[c].toFixed(2)}\n`);
  text += '\nItems:\n';
  items.forEach(i => text += `- ${i.desc}: ${i.amt.toFixed(2)} (${i.category})\n`);
  navigator.clipboard.writeText(text).then(() => alert('Summary copied'));
}

document.getElementById('parseBtn').onclick = parseLines;
document.getElementById('clearPaste').onclick = () => { document.getElementById('paste').value=''; document.getElementById('parseNote').textContent=''; };
document.getElementById('addBtn').onclick = addOne;
document.getElementById('csvBtn').onclick = toCSV;
document.getElementById('copyBtn').onclick = copySummary;
document.getElementById('clearAll').onclick = () => { if(confirm('Clear all items?')) { items=[]; save(); render(); } };
document.getElementById('desc').onkeydown = e => { if(e.key==='Enter') addOne(); };
document.getElementById('amt').onkeydown = e => { if(e.key==='Enter') addOne(); };

load();
