const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const KEY = 'verse-f630-timecard';
const daysEl = document.getElementById('days');
const weekStartEl = document.getElementById('weekStart');
const otModeEl = document.getElementById('otMode');
const dailyThEl = document.getElementById('dailyTh');
const rateEl = document.getElementById('rate');
const summaryEl = document.getElementById('summary');

function todayISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0,10);
}

function minsFromTime(t) {
  if (!t) return null;
  const [h,m] = t.split(':').map(Number);
  return h*60 + m;
}

function formatH(mins) {
  if (mins == null || isNaN(mins)) return '—';
  const h = mins / 60;
  return h.toFixed(2) + 'h';
}

function renderDays(data = {}) {
  daysEl.innerHTML = '';
  DAYS.forEach((name, i) => {
    const d = data.days?.[i] || {};
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span>${name}</span>
      <input type="time" class="start" data-i="${i}" value="${d.start||''}">
      <input type="time" class="end" data-i="${i}" value="${d.end||''}">
      <input type="number" class="brk" data-i="${i}" value="${d.break||0}" min="0" step="1" placeholder="brk min" title="Break minutes">
      <div class="timeline" data-i="${i}"><div class="bar"></div></div>
    `;
    daysEl.appendChild(row);
  });
  daysEl.querySelectorAll('input').forEach(inp => inp.addEventListener('input', recalc));
}

function collect() {
  const days = [];
  DAYS.forEach((_, i) => {
    const start = daysEl.querySelector(`.start[data-i="${i}"]`)?.value || '';
    const end = daysEl.querySelector(`.end[data-i="${i}"]`)?.value || '';
    const brk = Number(daysEl.querySelector(`.brk[data-i="${i}"]`)?.value) || 0;
    days.push({ start, end, break: brk });
  });
  return {
    weekStart: weekStartEl.value,
    otMode: otModeEl.value,
    dailyTh: Number(dailyThEl.value) || 8,
    rate: Number(rateEl.value) || 0,
    days
  };
}

function calcDay(d) {
  const s = minsFromTime(d.start);
  let e = minsFromTime(d.end);
  if (s == null || e == null) return { worked: 0, regular: 0, ot: 0 };
  if (e < s) e += 24*60;
  let worked = Math.max(0, e - s - (d.break||0));
  return { worked, raw: e - s };
}

function recalc() {
  const data = collect();
  let totalWorked = 0;
  const dayResults = data.days.map(d => {
    const c = calcDay(d);
    totalWorked += c.worked;
    return c;
  });

  const dailyThMins = data.dailyTh * 60;
  let regular = 0, ot = 0;
  if (data.otMode === 'daily') {
    dayResults.forEach(c => {
      regular += Math.min(c.worked, dailyThMins);
      ot += Math.max(0, c.worked - dailyThMins);
    });
  } else {
    const weekTh = 40 * 60;
    regular = Math.min(totalWorked, weekTh);
    ot = Math.max(0, totalWorked - weekTh);
  }

  data.days.forEach((d, i) => {
    const bar = daysEl.querySelector(`.timeline[data-i="${i}"] .bar`);
    const s = minsFromTime(d.start);
    let e = minsFromTime(d.end);
    if (s == null || e == null) { bar.style.width = '0'; return; }
    if (e < s) e += 24*60;
    const left = (s / (24*60)) * 100;
    const width = ((e - s) / (24*60)) * 100;
    bar.style.left = left + '%';
    bar.style.width = Math.min(100 - left, width) + '%';
    bar.classList.toggle('ot', data.otMode === 'daily' && (e - s - (d.break||0)) > dailyThMins);
  });

  const pay = data.rate ? ((regular/60)*data.rate + (ot/60)*data.rate*1.5) : 0;
  const weekLabel = data.weekStart || 'this week';
  const line = `Week of ${weekLabel}: ${(totalWorked/60).toFixed(2)}h total (${(regular/60).toFixed(2)} regular + ${(ot/60).toFixed(2)} OT)` +
    (data.rate ? ` · est. $${pay.toFixed(2)}` : '');
  summaryEl.textContent = line + (data.rate ? '\n(OT at 1.5× is an estimate only)' : '');

  localStorage.setItem(KEY, JSON.stringify(data));
  const hash = btoa(JSON.stringify(data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  history.replaceState(null, '', '#' + hash);
}

function load() {
  let data = {};
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) data = JSON.parse(stored);
  } catch (e) { console.debug("lab f630-time-card:", e); }
  if (location.hash.length > 1) {
    try {
      const b64 = location.hash.slice(1).replace(/-/g,'+').replace(/_/g,'/');
      const pad = b64.length % 4 ? '='.repeat(4 - b64.length % 4) : '';
      data = JSON.parse(atob(b64 + pad));
    } catch (e) { console.debug("lab f630-time-card:", e); }
  }
  if (!data.weekStart) data.weekStart = todayISO();
  weekStartEl.value = data.weekStart || todayISO();
  otModeEl.value = data.otMode || 'daily';
  dailyThEl.value = data.dailyTh || 8;
  rateEl.value = data.rate || '';
  renderDays(data);
  recalc();
}

document.getElementById('copyBtn').onclick = () => {
  const t = summaryEl.textContent.split('\n')[0];
  navigator.clipboard?.writeText(t).then(() => alert('Copied')).catch(() => prompt('Copy:', t));
};

document.getElementById('csvBtn').onclick = () => {
  const data = collect();
  let csv = 'Day,Start,End,Break min,Hours,Regular h,OT h\n';
  data.days.forEach((d, i) => {
    const c = calcDay(d);
    const dailyThMins = data.dailyTh * 60;
    let reg = c.worked, ot = 0;
    if (data.otMode === 'daily') {
      reg = Math.min(c.worked, dailyThMins);
      ot = Math.max(0, c.worked - dailyThMins);
    }
    csv += `${DAYS[i]},${d.start||''},${d.end||''},${d.break||0},${(c.worked/60).toFixed(2)},${(reg/60).toFixed(2)},${(ot/60).toFixed(2)}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `timecard-${data.weekStart||'week'}.csv`;
  a.click();
};

document.getElementById('clearBtn').onclick = () => {
  if (confirm('Clear this week?')) {
    localStorage.removeItem(KEY);
    location.hash = '';
    load();
  }
};

[weekStartEl, otModeEl, dailyThEl, rateEl].forEach(el => el.addEventListener('input', recalc));
load();
