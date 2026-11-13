const KEY = 'verse-subs-v1';
let subs = [];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) subs = JSON.parse(raw);
  } catch (e) { console.debug("lab f718-subscription-tracker:", e); }
  render();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(subs)); } catch (e) { console.debug("lab f718-subscription-tracker:", e); }
}

function monthlyOf(s) {
  return s.period === 'monthly' ? s.price : s.price / 12;
}

function render() {
  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  tbody.innerHTML = '';
  let mon = 0, yr = 0;
  subs.forEach((s, i) => {
    const m = monthlyOf(s);
    mon += m;
    yr += m * 12;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escape(s.name)}</td>
      <td>$${s.price.toFixed(2)}</td>
      <td>${s.period}</td>
      <td>${s.date}</td>
      <td><button type="button" data-i="${i}" style="width:auto;padding:0.3rem 0.6rem;background:#da3633;color:#fff">×</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('monthly').textContent = '$' + mon.toFixed(2);
  document.getElementById('yearly').textContent = '$' + yr.toFixed(2);
  empty.style.display = subs.length ? 'none' : 'block';
  tbody.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      subs.splice(+btn.dataset.i, 1);
      save();
      render();
    };
  });
}

function escape(t) {
  return String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.getElementById('form').onsubmit = e => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const price = parseFloat(document.getElementById('price').value);
  const period = document.getElementById('period').value;
  const date = document.getElementById('date').value;
  if (!name || isNaN(price) || !date) return;
  subs.push({ name, price, period, date });
  save();
  render();
  e.target.reset();
  document.getElementById('name').focus();
};

document.getElementById('copy').onclick = () => {
  let mon = 0;
  const lines = subs.map(s => {
    const m = monthlyOf(s);
    mon += m;
    return `${s.name}: $${s.price.toFixed(2)} / ${s.period} (next ${s.date})`;
  });
  const text = `Subscriptions\n\n${lines.join('\n')}\n\nMonthly: $${mon.toFixed(2)}\nYearly: $${(mon*12).toFixed(2)}`;
  navigator.clipboard.writeText(text).then(() => alert('Summary copied')).catch(() => {
    prompt('Copy this:', text);
  });
};

document.getElementById('ics').onclick = () => {
  if (!subs.length) return alert('Add some subscriptions first');
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Verse//Subscription Tracker//EN\r\n';
  subs.forEach((s, i) => {
    const d = s.date.replace(/-/g, '');
    const freq = s.period === 'monthly' ? 'MONTHLY' : 'YEARLY';
    ics += `BEGIN:VEVENT\r\nUID:sub-${i}-${Date.now()}@verse\r\nDTSTART:${d}\r\nRRULE:FREQ=${freq}\r\nSUMMARY:Renew ${s.name} ($${s.price.toFixed(2)})\r\nDESCRIPTION:Subscription renewal reminder\r\nEND:VEVENT\r\n`;
  });
  ics += 'END:VCALENDAR\r\n';
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'subscription-reminders.ics';
  a.click();
  URL.revokeObjectURL(a.href);
};

document.getElementById('clear').onclick = () => {
  if (confirm('Clear all subscriptions?')) {
    subs = [];
    save();
    render();
  }
};

// Set default date to today
document.getElementById('date').valueAsDate = new Date();
load();
