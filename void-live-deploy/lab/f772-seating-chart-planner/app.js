const $ = id => document.getElementById(id);
let guests = []; // {id, name}
let tables = []; // {id, seats, occupants: [guestId]}
let constraints = []; // {type, a, b}
let nextId = 1;
let dragId = null;

function save() {
  const state = { guests, tables, constraints, nextId };
  try { localStorage.setItem('seating-chart', JSON.stringify(state)); } catch (e) { console.debug("lab f772-seating-chart-planner:", e); }
  updateShare();
}
function load() {
  try {
    const raw = localStorage.getItem('seating-chart');
    if (raw) {
      const s = JSON.parse(raw);
      guests = s.guests || [];
      tables = s.tables || [];
      constraints = s.constraints || [];
      nextId = s.nextId || 1;
    }
  } catch (e) { console.debug("lab f772-seating-chart-planner:", e); }
  if (location.hash.length > 1) {
    try {
      const decoded = JSON.parse(atob(location.hash.slice(1)));
      guests = decoded.guests || guests;
      tables = decoded.tables || tables;
      constraints = decoded.constraints || constraints;
      nextId = decoded.nextId || nextId;
    } catch (e) { console.debug("lab f772-seating-chart-planner:", e); }
  }
  render();
}
function updateShare() {
  const state = { guests, tables, constraints, nextId };
  try { history.replaceState(null, '', '#' + btoa(JSON.stringify(state))); } catch (e) { console.debug("lab f772-seating-chart-planner:", e); }
}

function setupTables() {
  const n = Math.max(1, parseInt($('numTables').value) || 2);
  const s = Math.max(1, parseInt($('seatsEach').value) || 4);
  tables = [];
  for (let i = 0; i < n; i++) {
    tables.push({ id: i+1, seats: s, occupants: [] });
  }
  // move all guests back to pool
  tables.forEach(t => t.occupants = []);
  save(); render();
}

function addGuest() {
  const name = $('guestName').value.trim();
  if (!name) return;
  guests.push({ id: nextId++, name });
  $('guestName').value = '';
  save(); render();
}

function addConstraint() {
  const a = parseInt($('cA').value);
  const b = parseInt($('cB').value);
  const type = $('cType').value;
  if (!a || !b || a === b) return;
  constraints.push({ type, a, b });
  save(); render();
}

function guestById(id) { return guests.find(g => g.id === id); }

function render() {
  // guest pool
  const pool = $('guestPool');
  pool.innerHTML = '';
  const placed = new Set(tables.flatMap(t => t.occupants));
  guests.filter(g => !placed.has(g.id)).forEach(g => {
    const el = document.createElement('div');
    el.className = 'guest';
    el.textContent = g.name;
    el.dataset.id = g.id;
    el.draggable = true;
    el.addEventListener('pointerdown', startDrag);
    pool.appendChild(el);
  });

  // tables
  const tDiv = $('tables');
  tDiv.innerHTML = '';
  tables.forEach(t => {
    const box = document.createElement('div');
    box.className = 'table';
    box.dataset.table = t.id;
    box.innerHTML = `<h3>Table ${t.id}</h3><div class="seats"></div>`;
    const seats = box.querySelector('.seats');
    t.occupants.forEach(gid => {
      const g = guestById(gid);
      if (!g) return;
      const el = document.createElement('div');
      el.className = 'guest';
      el.textContent = g.name;
      el.dataset.id = g.id;
      el.addEventListener('pointerdown', startDrag);
      seats.appendChild(el);
    });
    box.addEventListener('pointerup', dropOnTable);
    tDiv.appendChild(box);
  });

  // constraint selects
  const opts = guests.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  $('cA').innerHTML = '<option value="">Guest A</option>' + opts;
  $('cB').innerHTML = '<option value="">Guest B</option>' + opts;

  // constraints list + violations
  const cDiv = $('constraints');
  cDiv.innerHTML = '';
  let violations = 0;
  constraints.forEach((c, i) => {
    const ga = guestById(c.a), gb = guestById(c.b);
    if (!ga || !gb) return;
    const el = document.createElement('span');
    el.className = 'constraint';
    el.textContent = `${ga.name} ${c.type === 'together' ? 'together with' : 'apart from'} ${gb.name}`;
    // check
    const ta = tables.find(t => t.occupants.includes(c.a));
    const tb = tables.find(t => t.occupants.includes(c.b));
    let bad = false;
    if (c.type === 'together') {
      if (!ta || !tb || ta.id !== tb.id) bad = true;
    } else {
      if (ta && tb && ta.id === tb.id) bad = true;
    }
    if (bad) { el.classList.add('bad'); violations++; }
    el.onclick = () => { constraints.splice(i,1); save(); render(); };
    cDiv.appendChild(el);
  });

  // highlight tables with violations
  document.querySelectorAll('.table').forEach(el => {
    const tid = parseInt(el.dataset.table);
    const hasBad = constraints.some(c => {
      const ta = tables.find(t => t.occupants.includes(c.a));
      const tb = tables.find(t => t.occupants.includes(c.b));
      if (!ta || !tb) return false;
      if (c.type === 'together' && ta.id !== tb.id && (ta.id === tid || tb.id === tid)) return true;
      if (c.type === 'apart' && ta.id === tb.id && ta.id === tid) return true;
      return false;
    });
    el.classList.toggle('violation', hasBad);
  });

  $('status').textContent = violations ? `${violations} constraint issue(s)` : 'All constraints satisfied';
}

function startDrag(e) {
  e.preventDefault();
  dragId = parseInt(e.currentTarget.dataset.id);
  e.currentTarget.classList.add('dragging');
  document.addEventListener('pointerup', endDrag);
}
function endDrag(e) {
  document.removeEventListener('pointerup', endDrag);
  document.querySelectorAll('.guest.dragging').forEach(el => el.classList.remove('dragging'));
  if (dragId == null) return;
  // find drop target
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const tableEl = el && el.closest('.table');
  const poolEl = el && el.closest('.guest-pool');
  if (tableEl) {
    const tid = parseInt(tableEl.dataset.table);
    moveGuest(dragId, tid);
  } else if (poolEl) {
    moveGuest(dragId, null);
  }
  dragId = null;
}
function dropOnTable(e) { /* handled in endDrag */ }
function moveGuest(gid, toTableId) {
  // remove from current
  tables.forEach(t => {
    t.occupants = t.occupants.filter(id => id !== gid);
  });
  if (toTableId != null) {
    const t = tables.find(x => x.id === toTableId);
    if (t && t.occupants.length < t.seats) {
      t.occupants.push(gid);
    }
  }
  save(); render();
}

function downloadPNG() {
  const canvas = $('exportCanvas');
  const ctx = canvas.getContext('2d');
  const w = 800, h = 600;
  canvas.width = w; canvas.height = h;
  ctx.fillStyle = '#0f1115';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#e8eaed';
  ctx.font = '24px system-ui';
  ctx.fillText('Seating Chart', 20, 40);
  let y = 80;
  tables.forEach(t => {
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(20, y, 760, 80);
    ctx.strokeStyle = '#3a3f4a';
    ctx.strokeRect(20, y, 760, 80);
    ctx.fillStyle = '#4a9eff';
    ctx.font = '18px system-ui';
    ctx.fillText(`Table ${t.id}`, 30, y+25);
    ctx.fillStyle = '#e8eaed';
    ctx.font = '16px system-ui';
    const names = t.occupants.map(id => guestById(id)?.name || '').join(', ');
    ctx.fillText(names || '(empty)', 30, y+50);
    y += 90;
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'seating-chart.png';
  a.click();
}

function downloadCSV() {
  let csv = 'Table,Guest\n';
  tables.forEach(t => {
    t.occupants.forEach(id => {
      const g = guestById(id);
      if (g) csv += `${t.id},"${g.name.replace(/"/g,'""')}"\n`;
    });
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'seating-chart.csv';
  a.click();
}

function copySummary() {
  let text = 'Seating Chart\n\n';
  tables.forEach(t => {
    text += `Table ${t.id}: ${t.occupants.map(id => guestById(id)?.name).join(', ') || '(empty)'}\n`;
  });
  navigator.clipboard.writeText(text).then(() => {
    $('status').textContent = 'Summary copied';
  }).catch(() => {
    $('status').textContent = 'Copy failed';
  });
}

$('setupTables').onclick = setupTables;
$('addGuest').onclick = addGuest;
$('guestName').onkeydown = e => { if (e.key === 'Enter') addGuest(); };
$('addConstraint').onclick = addConstraint;
$('downloadPNG').onclick = downloadPNG;
$('downloadCSV').onclick = downloadCSV;
$('copySummary').onclick = copySummary;
$('clearAll').onclick = () => {
  if (confirm('Clear everything?')) {
    guests = []; tables = []; constraints = []; nextId = 1;
    localStorage.removeItem('seating-chart');
    render();
  }
};

// init
setupTables();
load();
