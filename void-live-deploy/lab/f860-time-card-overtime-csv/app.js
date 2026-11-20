const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const KEY = 'verse-f860-timecard';

const rowsEl = document.getElementById('rows');
const otInput = document.getElementById('ot');
const totalEl = document.getElementById('total');
const regEl = document.getElementById('reg');
const otoutEl = document.getElementById('otout');
const statusEl = document.getElementById('status');

function parseTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToHours(min) {
  return Math.round((min / 60) * 100) / 100;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.debug("lab f860-time-card-overtime-csv:", e); }
  return { ot: 40, days: DAYS.map(() => ({ in: '', out: '', br: 0 })) };
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    statusEl.textContent = 'Saved on this device.';
  } catch (e) {
    statusEl.textContent = 'Could not save (storage blocked). Session only.';
  }
}

function render() {
  const state = load();
  otInput.value = state.ot;
  rowsEl.innerHTML = '';
  state.days.forEach((d, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="day">${DAYS[i]}</td>
      <td><input type="time" data-i="${i}" data-f="in" value="${d.in}"></td>
      <td><input type="time" data-i="${i}" data-f="out" value="${d.out}"></td>
      <td><input type="number" data-i="${i}" data-f="br" value="${d.br}" min="0" step="5" style="width:80px"></td>
      <td class="hrs" data-i="${i}">0.00</td>
    `;
    rowsEl.appendChild(tr);
  });
  compute();
}

function compute() {
  const state = { ot: parseFloat(otInput.value) || 40, days: [] };
  let totalMin = 0;
  const warnings = [];
  document.querySelectorAll('#rows tr').forEach((tr, i) => {
    const inEl = tr.querySelector('[data-f="in"]');
    const outEl = tr.querySelector('[data-f="out"]');
    const brEl = tr.querySelector('[data-f="br"]');
    const hrsEl = tr.querySelector('.hrs');
    const inMin = parseTime(inEl.value);
    const outMin = parseTime(outEl.value);
    const br = parseFloat(brEl.value) || 0;
    let worked = 0;
    if (inMin != null && outMin != null) {
      let diff = outMin - inMin;
      if (diff < 0) { diff += 24*60; warnings.push(DAYS[i] + ' spans midnight'); }
      worked = Math.max(0, diff - br);
    }
    totalMin += worked;
    hrsEl.textContent = minutesToHours(worked).toFixed(2);
    state.days.push({ in: inEl.value, out: outEl.value, br });
  });
  const totalH = minutesToHours(totalMin);
  const otThresh = state.ot;
  const otH = Math.max(0, totalH - otThresh);
  const regH = totalH - otH;
  totalEl.textContent = totalH.toFixed(2);
  regEl.textContent = regH.toFixed(2);
  otoutEl.textContent = otH.toFixed(2);
  save(state);
  if (warnings.length) statusEl.innerHTML = '<span class="warn">' + warnings.join('; ') + '</span>';
}

function toCSV() {
  const state = load();
  let csv = 'Day,In,Out,BreakMin,Hours\n';
  let totalMin = 0;
  state.days.forEach((d, i) => {
    const inMin = parseTime(d.in);
    const outMin = parseTime(d.out);
    let worked = 0;
    if (inMin != null && outMin != null) {
      let diff = outMin - inMin;
      if (diff < 0) diff += 24*60;
      worked = Math.max(0, diff - (d.br||0));
    }
    totalMin += worked;
    csv += `${DAYS[i]},${d.in},${d.out},${d.br||0},${minutesToHours(worked).toFixed(2)}\n`;
  });
  const totalH = minutesToHours(totalMin);
  const otH = Math.max(0, totalH - (state.ot||40));
  csv += `\nTotalHours,${totalH.toFixed(2)}\nRegular,${(totalH-otH).toFixed(2)}\nOvertime,${otH.toFixed(2)}\nThreshold,${state.ot||40}\n`;
  return csv;
}

document.getElementById('rows').addEventListener('input', compute);
otInput.addEventListener('input', compute);

document.getElementById('download').addEventListener('click', () => {
  const csv = toCSV();
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'timecard-week.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('copy').addEventListener('click', async () => {
  const total = totalEl.textContent;
  const reg = regEl.textContent;
  const ot = otoutEl.textContent;
  const text = `Weekly time card\nTotal: ${total} h\nRegular: ${reg} h\nOvertime: ${ot} h\n(threshold ${otInput.value} h)`;
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'Summary copied.';
  } catch (e) {
    statusEl.textContent = 'Copy failed — use download instead.';
  }
});

document.getElementById('clear').addEventListener('click', () => {
  if (confirm('Clear this week?')) {
    localStorage.removeItem(KEY);
    render();
    statusEl.textContent = 'Cleared.';
  }
});

render();
