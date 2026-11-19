const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let state = { weeks: {}, current: null };
let selectedDay = 0;
const board = document.getElementById('board');
const totalsEl = document.getElementById('totals');
const status = document.getElementById('status');
const otThresh = document.getElementById('otThresh');
const breakMin = document.getElementById('breakMin');

function getWeekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(),0,1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
  return `${d.getFullYear()}-W${week}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem('verse-f811-timecard');
    if (raw) state = JSON.parse(raw);
  } catch (e) { console.debug("lab f811-spatial-weekly-timecard:", e); }
  if (!state.weeks) state.weeks = {};
  state.current = getWeekKey();
  if (!state.weeks[state.current]) {
    state.weeks[state.current] = days.map(() => ({ blocks: [], notes: '' }));
  }
}

function saveState() {
  try { localStorage.setItem('verse-f811-timecard', JSON.stringify(state)); } catch (e) { console.debug("lab f811-spatial-weekly-timecard:", e); }
}

function minutesToPct(mins) { return (mins / (24*60)) * 100; }
function pctToMinutes(pct) { return Math.round((pct / 100) * 24*60 / 15) * 15; } // snap 15

function render() {
  board.innerHTML = '';
  const week = state.weeks[state.current];
  days.forEach((name, i) => {
    const col = document.createElement('div');
    col.className = 'day';
    col.innerHTML = `<h3>${name}</h3><div class="timeline"></div>`;
    const tl = col.querySelector('.timeline');
    week[i].blocks.forEach((b, bi) => {
      const div = document.createElement('div');
      div.className = 'block';
      const top = minutesToPct(b.start);
      const h = minutesToPct(b.end - b.start);
      div.style.top = top + '%';
      div.style.height = Math.max(4, h) + '%';
      div.textContent = `${fmt(b.start)}–${fmt(b.end)}`;
      div.dataset.day = i;
      div.dataset.bi = bi;
      makeDraggable(div, i, bi);
      tl.appendChild(div);
    });
    col.addEventListener('click', (e) => { if (e.target === tl || e.target === col) selectedDay = i; status.textContent = `Selected ${name}`; });
    board.appendChild(col);
  });
  updateTotals();
  saveState();
}

function fmt(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function makeDraggable(el, day, bi) {
  let startY, startTop, startH, mode = 'move';
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const rect = el.parentElement.getBoundingClientRect();
    startY = e.clientY;
    startTop = parseFloat(el.style.top);
    startH = parseFloat(el.style.height);
    const rel = (e.clientY - rect.top) / rect.height * 100;
    mode = rel < startTop + 8 ? 'top' : rel > startTop + startH - 8 ? 'bot' : 'move';
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const dy = ((e.clientY - startY) / el.parentElement.getBoundingClientRect().height) * 100;
    let newTop = startTop, newH = startH;
    if (mode === 'move') newTop = Math.max(0, Math.min(100 - startH, startTop + dy));
    else if (mode === 'top') { newTop = Math.max(0, startTop + dy); newH = Math.max(4, startH - dy); }
    else if (mode === 'bot') newH = Math.max(4, startH + dy);
    el.style.top = newTop + '%';
    el.style.height = newH + '%';
    const week = state.weeks[state.current];
    const b = week[day].blocks[bi];
    b.start = pctToMinutes(newTop);
    b.end = pctToMinutes(newTop + newH);
    el.textContent = `${fmt(b.start)}–${fmt(b.end)}`;
  });
  el.addEventListener('pointerup', () => { el.releasePointerCapture(el.dataset.pointerId || 0); render(); });
}

function updateTotals() {
  const thresh = parseFloat(otThresh.value) || 8;
  const brk = parseInt(breakMin.value) || 0;
  const week = state.weeks[state.current];
  let totalH = 0, totalOT = 0;
  let html = '';
  week.forEach((d, i) => {
    let dayH = 0;
    d.blocks.forEach(b => { dayH += Math.max(0, (b.end - b.start - brk) / 60); });
    const ot = Math.max(0, dayH - thresh);
    totalH += dayH;
    totalOT += ot;
    html += `<div>${days[i]}: ${dayH.toFixed(1)}h (OT ${ot.toFixed(1)})</div>`;
  });
  html += `<div><strong>Week: ${totalH.toFixed(1)}h · OT ${totalOT.toFixed(1)}h</strong></div>`;
  totalsEl.innerHTML = html;
}

document.getElementById('addBlock').onclick = () => {
  const week = state.weeks[state.current];
  const start = 9*60; // 9:00 default
  const end = 17*60;
  week[selectedDay].blocks.push({ start, end });
  render();
};

document.getElementById('clearAll').onclick = () => {
  if (confirm('Clear this week?')) {
    state.weeks[state.current] = days.map(() => ({ blocks: [], notes: '' }));
    render();
  }
};

document.getElementById('exportCsv').onclick = () => {
  const week = state.weeks[state.current];
  const brk = parseInt(breakMin.value) || 0;
  let csv = 'Day,Start,End,BreakMin,Hours,OTHours\n';
  const thresh = parseFloat(otThresh.value) || 8;
  week.forEach((d, i) => {
    d.blocks.forEach(b => {
      const hrs = Math.max(0, (b.end - b.start - brk)/60);
      const ot = Math.max(0, hrs - thresh);
      csv += `${days[i]},${fmt(b.start)},${fmt(b.end)},${brk},${hrs.toFixed(2)},${ot.toFixed(2)}\n`;
    });
  });
  const blob = new Blob([csv], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `timecard-${state.current}.csv`;
  a.click();
  status.textContent = 'CSV downloaded';
};

document.getElementById('copySummary').onclick = async () => {
  const text = totalsEl.innerText;
  try { await navigator.clipboard.writeText(text); status.textContent = 'Summary copied'; }
  catch { status.textContent = 'Copy failed'; }
};

otThresh.onchange = breakMin.onchange = render;
loadState();
render();
status.textContent = `Week ${state.current} loaded. Data stays on this device.`;
