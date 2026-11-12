const KEY = 'verse-f655-subs';
let subs = [];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) subs = JSON.parse(raw);
  } catch (e) { console.debug("lab f655-subscription-tracker:", e); }
  // also check hash
  if (location.hash.length > 1) {
    try {
      const decoded = JSON.parse(atob(location.hash.slice(1)));
      if (Array.isArray(decoded)) subs = decoded;
    } catch (e) { console.debug("lab f655-subscription-tracker:", e); }
  }
  if (subs.length === 0) {
    subs = [{ name: 'Example', price: 9.99, cycle: 'monthly', next: new Date(Date.now() + 86400000 * 7).toISOString().slice(0,10) }];
  }
  render();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(subs)); } catch (e) { console.debug("lab f655-subscription-tracker:", e); }
  history.replaceState(null, '', '#' + btoa(JSON.stringify(subs)));
}

function monthlyEq(s) {
  const p = parseFloat(s.price) || 0;
  if (s.cycle === 'yearly') return p / 12;
  if (s.cycle === 'weekly') return p * 52 / 12;
  return p;
}

function render() {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  subs.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${s.name||''}" data-i="${i}" data-f="name"></td>
      <td><input type="number" step="0.01" value="${s.price||0}" data-i="${i}" data-f="price"></td>
      <td><select data-i="${i}" data-f="cycle">
        <option ${s.cycle==='monthly'?'selected':''}>monthly</option>
        <option ${s.cycle==='yearly'?'selected':''}>yearly</option>
        <option ${s.cycle==='weekly'?'selected':''}>weekly</option>
      </select></td>
      <td><input type="date" value="${s.next||''}" data-i="${i}" data-f="next"></td>
      <td><button data-del="${i}">×</button></td>`;
    tbody.appendChild(tr);
  });
  // totals
  let m = 0, y = 0, soon = 0;
  const now = Date.now();
  const horizon = now + 90 * 86400000;
  subs.forEach(s => {
    m += monthlyEq(s);
    y += monthlyEq(s) * 12;
    if (s.next) {
      const d = new Date(s.next).getTime();
      if (d >= now && d <= horizon) soon++;
    }
  });
  document.getElementById('monthly').textContent = m.toFixed(2);
  document.getElementById('yearly').textContent = y.toFixed(2);
  document.getElementById('soon').textContent = soon;
  drawTimeline();
  save();
}

function drawTimeline() {
  const c = document.getElementById('timeline');
  const ctx = c.getContext('2d');
  const w = c.width = c.clientWidth;
  const h = c.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0,0,w,h);
  const now = Date.now();
  const span = 90 * 86400000;
  ctx.strokeStyle = '#444';
  ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
  subs.forEach(s => {
    if (!s.next) return;
    const t = new Date(s.next).getTime();
    if (t < now || t > now + span) return;
    const x = ((t - now) / span) * w;
    ctx.fillStyle = '#0af';
    ctx.beginPath();
    ctx.arc(x, h/2, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#eee';
    ctx.font = '10px system-ui';
    ctx.fillText(s.name.slice(0,10), x - 20, h/2 - 12);
  });
}

document.getElementById('add').onclick = () => {
  subs.push({ name: 'New', price: 0, cycle: 'monthly', next: new Date().toISOString().slice(0,10) });
  render();
};

document.getElementById('tbody').addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.i) return;
  const i = +el.dataset.i;
  const f = el.dataset.f;
  subs[i][f] = el.type === 'number' ? parseFloat(el.value) || 0 : el.value;
  render();
});
document.getElementById('tbody').addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset.i) return;
  const i = +el.dataset.i;
  const f = el.dataset.f;
  subs[i][f] = el.value;
  render();
});
document.getElementById('tbody').addEventListener('click', e => {
  if (e.target.dataset.del != null) {
    subs.splice(+e.target.dataset.del, 1);
    render();
  }
});

document.getElementById('copy').onclick = () => {
  const text = `Monthly: $${document.getElementById('monthly').textContent}\nYearly: $${document.getElementById('yearly').textContent}\n\n` +
    subs.map(s => `${s.name}: $${s.price} ${s.cycle} next ${s.next||'?'}`).join('\n');
  navigator.clipboard.writeText(text).then(() => alert('Copied'));
};

document.getElementById('csv').onclick = () => {
  const rows = ['Name,Price,Cycle,Next'];
  subs.forEach(s => rows.push(`"${s.name}",${s.price},${s.cycle},${s.next||''}`));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'subscriptions.csv';
  a.click();
};

document.getElementById('ics').onclick = () => {
  let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Verse//Subscription Tracker//EN\n';
  subs.forEach(s => {
    if (!s.next) return;
    const d = s.next.replace(/-/g, '');
    const freq = s.cycle === 'yearly' ? 'YEARLY' : s.cycle === 'weekly' ? 'WEEKLY' : 'MONTHLY';
    ics += `BEGIN:VEVENT\nDTSTART:${d}\nSUMMARY:${s.name} $${s.price}\nRRULE:FREQ=${freq}\nEND:VEVENT\n`;
  });
  ics += 'END:VCALENDAR';
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'subscriptions.ics';
  a.click();
};

document.getElementById('share').onclick = () => {
  navigator.clipboard.writeText(location.href).then(() => alert('Share link copied'));
};

window.addEventListener('resize', drawTimeline);
load();
