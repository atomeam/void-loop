const NUM_TABLES = 6;
const SEATS_PER = 8;
const STORAGE_KEY = 'verse-f658-seating';

let guests = []; // {id, name}
let assignments = {}; // guestId -> tableIndex or null
let together = []; // [[a,b], ...]
let apart = [];
let dragId = null;

const $ = id => document.getElementById(id);
const guestInput = $('guestInput');
const togetherInput = $('togetherInput');
const apartInput = $('apartInput');
const unassigned = $('unassigned');
const tablesEl = $('tables');
const statusEl = $('status');

function uid() { return Math.random().toString(36).slice(2, 9); }

function parseNames(text) {
  return text.split(/\n/).map(s => s.trim()).filter(Boolean);
}

function parsePairs(text) {
  return text.split(/\n/).map(line => {
    const parts = line.split(/[,|]/).map(s => s.trim()).filter(Boolean);
    return parts.length >= 2 ? [parts[0], parts[1]] : null;
  }).filter(Boolean);
}

function loadState() {
  try {
    const hash = location.hash.slice(1);
    if (hash) {
      const data = JSON.parse(decodeURIComponent(hash));
      applyData(data);
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyData(JSON.parse(saved));
    else seedSample();
  } catch (e) { seedSample(); }
}

function seedSample() {
  guestInput.value = 'Alice\nBob\nCarol\nDave\nEve\nFrank\nGrace\nHank';
  togetherInput.value = 'Alice, Bob';
  apartInput.value = 'Carol, Dave';
  applyList();
}

function applyData(data) {
  guests = data.guests || [];
  assignments = data.assignments || {};
  guestInput.value = guests.map(g => g.name).join('\n');
  togetherInput.value = (data.together || []).map(p => p.join(', ')).join('\n');
  apartInput.value = (data.apart || []).map(p => p.join(', ')).join('\n');
  together = data.together || [];
  apart = data.apart || [];
  render();
}

function saveState() {
  const data = { guests, assignments, together, apart };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.debug("lab f658-spatial-seating-chart:", e); }
  history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(data)));
}

function applyList() {
  const names = parseNames(guestInput.value);
  const nameToId = {};
  guests.forEach(g => { nameToId[g.name] = g.id; });
  const newGuests = [];
  names.forEach(name => {
    let id = nameToId[name];
    if (!id) { id = uid(); }
    newGuests.push({ id, name });
    if (!(id in assignments)) assignments[id] = null;
  });
  const keepIds = new Set(newGuests.map(g => g.id));
  guests = newGuests;
  Object.keys(assignments).forEach(id => { if (!keepIds.has(id)) delete assignments[id]; });
  together = parsePairs(togetherInput.value);
  apart = parsePairs(apartInput.value);
  saveState();
  render();
  statusEl.textContent = 'List applied';
  statusEl.className = 'status ok';
}

function render() {
  unassigned.innerHTML = '';
  guests.filter(g => assignments[g.id] == null).forEach(g => {
    const el = document.createElement('div');
    el.className = 'guest';
    el.textContent = g.name;
    el.draggable = true;
    el.dataset.id = g.id;
    el.addEventListener('dragstart', onDragStart);
    unassigned.appendChild(el);
  });

  tablesEl.innerHTML = '';
  for (let t = 0; t < NUM_TABLES; t++) {
    const table = document.createElement('div');
    table.className = 'table';
    table.dataset.table = t;
    table.innerHTML = `<h3>Table ${t + 1}</h3><div class="seats"></div>`;
    const seats = table.querySelector('.seats');
    guests.filter(g => assignments[g.id] === t).forEach(g => {
      const el = document.createElement('div');
      el.className = 'guest';
      el.textContent = g.name;
      el.draggable = true;
      el.dataset.id = g.id;
      el.addEventListener('dragstart', onDragStart);
      seats.appendChild(el);
    });
    table.addEventListener('dragover', e => { e.preventDefault(); table.classList.add('over'); });
    table.addEventListener('dragleave', () => table.classList.remove('over'));
    table.addEventListener('drop', onDrop);
    tablesEl.appendChild(table);
  }
  unassigned.addEventListener('dragover', e => e.preventDefault());
  unassigned.addEventListener('drop', e => {
    e.preventDefault();
    if (dragId) { assignments[dragId] = null; dragId = null; saveState(); render(); }
  });

  checkConflicts();
}

function onDragStart(e) {
  dragId = e.target.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
}

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('over');
  if (!dragId) return;
  const tableIdx = parseInt(e.currentTarget.dataset.table, 10);
  const currentCount = guests.filter(g => assignments[g.id] === tableIdx).length;
  if (currentCount >= SEATS_PER && assignments[dragId] !== tableIdx) {
    statusEl.textContent = `Table ${tableIdx + 1} is full`;
    statusEl.className = 'status warn';
    return;
  }
  assignments[dragId] = tableIdx;
  dragId = null;
  saveState();
  render();
}

function checkConflicts() {
  document.querySelectorAll('.guest').forEach(el => el.classList.remove('conflict'));
  let issues = [];
  together.forEach(([a, b]) => {
    const ga = guests.find(g => g.name === a);
    const gb = guests.find(g => g.name === b);
    if (!ga || !gb) return;
    if (assignments[ga.id] != null && assignments[gb.id] != null && assignments[ga.id] !== assignments[gb.id]) {
      issues.push(`${a} and ${b} should be together`);
      document.querySelectorAll(`.guest`).forEach(el => {
        if (el.textContent === a || el.textContent === b) el.classList.add('conflict');
      });
    }
  });
  apart.forEach(([a, b]) => {
    const ga = guests.find(g => g.name === a);
    const gb = guests.find(g => g.name === b);
    if (!ga || !gb) return;
    if (assignments[ga.id] != null && assignments[ga.id] === assignments[gb.id]) {
      issues.push(`${a} and ${b} should be apart`);
      document.querySelectorAll(`.guest`).forEach(el => {
        if (el.textContent === a || el.textContent === b) el.classList.add('conflict');
      });
    }
  });
  if (issues.length) {
    statusEl.textContent = issues.join('; ');
    statusEl.className = 'status warn';
  } else if (guests.length) {
    statusEl.textContent = 'No conflicts';
    statusEl.className = 'status ok';
  }
}

function getAssignmentsText() {
  let lines = [];
  for (let t = 0; t < NUM_TABLES; t++) {
    const names = guests.filter(g => assignments[g.id] === t).map(g => g.name);
    if (names.length) lines.push(`Table ${t + 1}: ${names.join(', ')}`);
  }
  const un = guests.filter(g => assignments[g.id] == null).map(g => g.name);
  if (un.length) lines.push(`Unassigned: ${un.join(', ')}`);
  return lines.join('\n') || 'No assignments yet';
}

$('applyBtn').onclick = applyList;
$('copyBtn').onclick = () => {
  navigator.clipboard.writeText(getAssignmentsText()).then(() => {
    statusEl.textContent = 'Assignments copied';
    statusEl.className = 'status ok';
  });
};
$('shareBtn').onclick = () => {
  navigator.clipboard.writeText(location.href).then(() => {
    statusEl.textContent = 'Share link copied';
    statusEl.className = 'status ok';
  });
};
$('pngBtn').onclick = downloadPNG;

function downloadPNG() {
  const canvas = $('exportCanvas');
  const w = 800, h = 600;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1419';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8eef6';
  ctx.font = 'bold 24px system-ui';
  ctx.fillText('Seating Chart', 30, 40);
  ctx.font = '16px system-ui';
  let y = 80;
  for (let t = 0; t < NUM_TABLES; t++) {
    const names = guests.filter(g => assignments[g.id] === t).map(g => g.name);
    if (!names.length) continue;
    ctx.fillStyle = '#3d8bfd';
    ctx.fillText(`Table ${t + 1}`, 30, y);
    ctx.fillStyle = '#e8eef6';
    ctx.fillText(names.join(', '), 140, y);
    y += 36;
  }
  const un = guests.filter(g => assignments[g.id] == null).map(g => g.name);
  if (un.length) {
    ctx.fillStyle = '#e05d44';
    ctx.fillText('Unassigned', 30, y);
    ctx.fillStyle = '#e8eef6';
    ctx.fillText(un.join(', '), 140, y);
  }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'seating-chart.png';
  a.click();
  statusEl.textContent = 'PNG downloaded';
  statusEl.className = 'status ok';
}

document.addEventListener('touchstart', e => {
  const t = e.target.closest('.guest');
  if (t) dragId = t.dataset.id;
}, { passive: true });

loadState();
