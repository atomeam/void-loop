const KEY = 'verse-f641-subs';
let items = [];
let editing = null;

function load() {
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { items = []; }
  render();
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(items));
  render();
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function monthlyEq(item) {
  if (item.status !== 'active') return 0;
  return item.cycle === 'monthly' ? Number(item.price) : Number(item.price) / 12;
}

function render() {
  const tbody = document.getElementById('tbody');
  const table = document.getElementById('table');
  const empty = document.getElementById('empty');
  tbody.innerHTML = '';
  const active = items.filter(i => i.status === 'active');
  const monthly = active.reduce((s, i) => s + monthlyEq(i), 0);
  const yearly = monthly * 12;
  document.getElementById('monthlyTotal').textContent = monthly.toFixed(2);
  document.getElementById('yearlyTotal').textContent = yearly.toFixed(2);
  document.getElementById('count').textContent = active.length;

  if (!items.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';
  const sorted = [...items].sort((a,b) => (a.renewal || '').localeCompare(b.renewal || ''));
  sorted.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(item.name)}${item.notes ? '<br><small style="color:var(--muted)">'+esc(item.notes)+'</small>' : ''}</td>
      <td>${Number(item.price).toFixed(2)}</td>
      <td>${item.cycle}</td>
      <td>${item.renewal || '—'}</td>
      <td class="status-${item.status}">${item.status}</td>
      <td>
        <button type="button" data-edit="${item.id}" style="width:auto;padding:0.3rem 0.6rem;margin:0;background:#333">Edit</button>
        <button type="button" data-del="${item.id}" class="danger" style="width:auto;padding:0.3rem 0.6rem;margin:0">Del</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

document.getElementById('form').onsubmit = e => {
  e.preventDefault();
  const data = {
    id: editing || uid(),
    name: document.getElementById('name').value.trim(),
    price: parseFloat(document.getElementById('price').value) || 0,
    cycle: document.getElementById('cycle').value,
    renewal: document.getElementById('renewal').value,
    status: document.getElementById('status').value,
    notes: document.getElementById('notes').value.trim()
  };
  if (!data.name || data.price < 0) return;
  if (editing) {
    const idx = items.findIndex(i => i.id === editing);
    if (idx >= 0) items[idx] = data;
  } else {
    items.push(data);
  }
  editing = null;
  document.getElementById('form').reset();
  document.getElementById('editId').value = '';
  document.getElementById('saveBtn').textContent = 'Add subscription';
  document.getElementById('cancelEdit').style.display = 'none';
  save();
};

document.getElementById('cancelEdit').onclick = () => {
  editing = null;
  document.getElementById('form').reset();
  document.getElementById('saveBtn').textContent = 'Add subscription';
  document.getElementById('cancelEdit').style.display = 'none';
};

document.getElementById('tbody').onclick = e => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) {
    const item = items.find(i => i.id === edit.dataset.edit);
    if (!item) return;
    editing = item.id;
    document.getElementById('name').value = item.name;
    document.getElementById('price').value = item.price;
    document.getElementById('cycle').value = item.cycle;
    document.getElementById('renewal').value = item.renewal;
    document.getElementById('status').value = item.status;
    document.getElementById('notes').value = item.notes || '';
    document.getElementById('saveBtn').textContent = 'Update';
    document.getElementById('cancelEdit').style.display = 'block';
    window.scrollTo(0,0);
  }
  if (del) {
    if (confirm('Delete this subscription?')) {
      items = items.filter(i => i.id !== del.dataset.del);
      save();
    }
  }
};

function download(filename, text, type='text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('csvBtn').onclick = () => {
  const headers = ['Name','Price','Cycle','Next Renewal','Status','Notes','Monthly Eq'];
  const rows = items.map(i => [
    `"${i.name.replace(/"/g,'""')}"`,
    i.price,
    i.cycle,
    i.renewal,
    i.status,
    `"${(i.notes||'').replace(/"/g,'""')}"`,
    monthlyEq(i).toFixed(2)
  ].join(','));
  const monthly = items.filter(i=>i.status==='active').reduce((s,i)=>s+monthlyEq(i),0);
  const summary = `\nTOTALS,,Monthly equivalent,${monthly.toFixed(2)},Yearly,${(monthly*12).toFixed(2)}`;
  download('subscriptions.csv', [headers.join(','), ...rows, summary].join('\n'), 'text/csv');
};

document.getElementById('icsBtn').onclick = () => {
  const now = new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Verse//Subscription Tracker//EN\r\n';
  items.filter(i => i.status === 'active' && i.renewal).forEach(item => {
    const dt = item.renewal.replace(/-/g,'');
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${item.id}@verse\r\n`;
    ics += `DTSTAMP:${now}\r\n`;
    ics += `DTSTART;VALUE=DATE:${dt}\r\n`;
    ics += `SUMMARY:${item.name} renewal (${item.price} ${item.cycle})\r\n`;
    if (item.notes) ics += `DESCRIPTION:${item.notes.replace(/\n/g,' ')}\r\n`;
    if (item.cycle === 'yearly') ics += 'RRULE:FREQ=YEARLY\r\n';
    else ics += 'RRULE:FREQ=MONTHLY\r\n';
    ics += 'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  download('subscription-reminders.ics', ics, 'text/calendar');
};

load();
