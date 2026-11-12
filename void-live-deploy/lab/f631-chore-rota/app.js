
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function theme() {
  const key = cssVar('--d-key', '158 178 255');
  return {
    bg: cssVar('--bg', '#050505'),
    ink: cssVar('--d-ink', '#f2f4fb'),
    muted: cssVar('--d-ink-2', '#c3c8d8'),
    line: cssVar('--line', 'rgba(255, 255, 255, 0.12)'),
    head: `rgb(${key} / 0.16)`,
    stripe: `rgb(${key} / 0.08)`,
    key
  };
}
function personTint(i) {
  const keys = [
    cssVar('--d-key', '158 178 255'),
    cssVar('--d-teal', '92 232 205'),
    cssVar('--d-warm', '255 170 214')
  ];
  const shade = 0.7 + (Math.floor(i / keys.length) % 3) * 0.12;
  return `rgb(${keys[i % keys.length]} / ${Math.min(shade, 0.98)})`;
}

const STORAGE_KEY = 'verse-f631-chore-rota';

let people = [];
let chores = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      people = data.people || [];
      chores = data.chores || [];
      if (data.weeks) document.getElementById('weeks').value = data.weeks;
      if (data.offset != null) document.getElementById('offset').value = data.offset;
    }
  } catch (e) { console.debug("lab f631-chore-rota:", e); }
  if (people.length === 0) people = ['Alex', 'Sam', 'Jordan'];
  if (chores.length === 0) chores = ['Dishes', 'Vacuum', 'Trash', 'Bathroom'];
  renderLists();
  renderRota();
}

function save() {
  const data = {
    people,
    chores,
    weeks: +document.getElementById('weeks').value,
    offset: +document.getElementById('offset').value
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function renderLists() {
  const pl = document.getElementById('people-list');
  pl.innerHTML = '';
  people.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<input type="text" value="${escapeHtml(p)}" data-i="${i}" data-kind="person">
                     <button type="button" data-i="${i}" data-kind="person">×</button>`;
    pl.appendChild(div);
  });
  const cl = document.getElementById('chores-list');
  cl.innerHTML = '';
  chores.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<input type="text" value="${escapeHtml(c)}" data-i="${i}" data-kind="chore">
                     <button type="button" data-i="${i}" data-kind="chore">×</button>`;
    cl.appendChild(div);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
}

function renderRota() {
  const container = document.getElementById('rota-container');
  const weeks = Math.max(1, Math.min(12, +document.getElementById('weeks').value || 4));
  const offset = Math.max(0, +document.getElementById('offset').value || 0);
  if (people.length === 0 || chores.length === 0) {
    container.innerHTML = '<div class="empty">Add at least one person and one chore to see the rota.</div>';
    return;
  }
  const colors = people.map((_, i) => personTint(i));
  let html = '<table><thead><tr><th>Week</th>';
  chores.forEach(c => { html += `<th>${escapeHtml(c)}</th>`; });
  html += '</tr></thead><tbody>';
  for (let w = 0; w < weeks; w++) {
    html += `<tr><td><strong>Week ${w + 1}</strong></td>`;
    for (let c = 0; c < chores.length; c++) {
      const pi = (w + c + offset) % people.length;
      const person = people[pi];
      const col = colors[pi % colors.length];
      html += `<td class="person" style="border-left: 4px solid ${col}">${escapeHtml(person)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function bind() {
  document.getElementById('add-person').onclick = () => {
    people.push('Person ' + (people.length + 1));
    renderLists(); renderRota(); save();
  };
  document.getElementById('add-chore').onclick = () => {
    chores.push('Chore ' + (chores.length + 1));
    renderLists(); renderRota(); save();
  };
  document.body.addEventListener('input', e => {
    if (e.target.matches('.list-item input')) {
      const i = +e.target.dataset.i;
      const kind = e.target.dataset.kind;
      if (kind === 'person') people[i] = e.target.value;
      else chores[i] = e.target.value;
      renderRota(); save();
    }
  });
  document.body.addEventListener('click', e => {
    if (e.target.matches('.list-item button')) {
      const i = +e.target.dataset.i;
      const kind = e.target.dataset.kind;
      if (kind === 'person') people.splice(i, 1);
      else chores.splice(i, 1);
      renderLists(); renderRota(); save();
    }
  });
  document.getElementById('weeks').oninput = () => { renderRota(); save(); };
  document.getElementById('offset').oninput = () => { renderRota(); save(); };
  document.getElementById('reset').onclick = () => {
    if (confirm('Clear all people and chores?')) {
      people = []; chores = [];
      renderLists(); renderRota(); save();
    }
  };
  document.getElementById('print').onclick = () => window.print();
  document.getElementById('download').onclick = downloadPNG;
}

function downloadPNG() {
  const weeks = Math.max(1, Math.min(12, +document.getElementById('weeks').value || 4));
  const offset = Math.max(0, +document.getElementById('offset').value || 0);
  if (people.length === 0 || chores.length === 0) {
    alert('Add people and chores first.');
    return;
  }
  const canvas = document.getElementById('export-canvas');
  const ctx = canvas.getContext('2d');
  const cellW = 140, cellH = 36, pad = 24, titleH = 40;
  const cols = chores.length + 1;
  const rows = weeks + 1;
  canvas.width = pad * 2 + cols * cellW;
  canvas.height = pad * 2 + titleH + rows * cellH;
  const pal = theme();
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = pal.ink;
  ctx.font = 'bold 22px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Chore rota', pad, pad + 22);
  ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
  // header
  ctx.fillStyle = pal.head;
  ctx.fillRect(pad, pad + titleH, cols * cellW, cellH);
  ctx.fillStyle = pal.ink;
  ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Week', pad + 8, pad + titleH + 24);
  chores.forEach((c, i) => {
    ctx.fillText(c.slice(0, 16), pad + (i + 1) * cellW + 8, pad + titleH + 24);
  });
  // rows
  ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
  for (let w = 0; w < weeks; w++) {
    const y = pad + titleH + (w + 1) * cellH;
    if (w % 2 === 0) { ctx.fillStyle = pal.stripe; ctx.fillRect(pad, y, cols * cellW, cellH); }
    ctx.fillStyle = pal.ink;
    ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Week ' + (w + 1), pad + 8, y + 24);
    ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
    for (let c = 0; c < chores.length; c++) {
      const pi = (w + c + offset) % people.length;
      ctx.fillText(people[pi].slice(0, 16), pad + (c + 1) * cellW + 8, y + 24);
    }
  }
  // borders
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(pad, pad + titleH + r * cellH); ctx.lineTo(pad + cols * cellW, pad + titleH + r * cellH); ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(pad + c * cellW, pad + titleH); ctx.lineTo(pad + c * cellW, pad + titleH + rows * cellH); ctx.stroke();
  }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'chore-rota.png';
  a.click();
}

load();
bind();
