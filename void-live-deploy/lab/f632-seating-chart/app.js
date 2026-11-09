const STORAGE_KEY = 'verse-f632-seating-chart';
let guests = [];
let tables = [];
let positions = {}; // guest -> {table, seat}
let drag = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      guests = data.guests || [];
      document.getElementById('table-count').value = data.tableCount || 4;
      document.getElementById('seats-each').value = data.seatsEach || 6;
      document.getElementById('together').value = data.together || '';
      document.getElementById('apart').value = data.apart || '';
      positions = data.positions || {};
    }
  } catch (e) { console.debug("lab f632-seating-chart:", e); }
  renderGuests();
  rebuildTables();
}

function save() {
  const data = {
    guests,
    tableCount: +document.getElementById('table-count').value,
    seatsEach: +document.getElementById('seats-each').value,
    together: document.getElementById('together').value,
    apart: document.getElementById('apart').value,
    positions
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function renderGuests() {
  const ul = document.getElementById('guest-list');
  ul.innerHTML = '';
  guests.forEach((g, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${g}</span><button class="remove" data-i="${i}">×</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.remove').forEach(btn => {
    btn.onclick = () => {
      guests.splice(+btn.dataset.i, 1);
      delete positions[btn.previousElementSibling.textContent];
      renderGuests();
      save();
      draw();
    };
  });
}

function rebuildTables() {
  const count = Math.max(1, +document.getElementById('table-count').value || 1);
  const seats = Math.max(2, +document.getElementById('seats-each').value || 4);
  tables = Array.from({length: count}, (_, i) => ({
    id: i + 1,
    seats,
    x: 80 + (i % 4) * 220,
    y: 80 + Math.floor(i / 4) * 220
  }));
  save();
  draw();
}

function parsePairs(text) {
  return text.split('\n').map(l => l.split(',').map(s => s.trim()).filter(Boolean)).filter(p => p.length === 2);
}

function autoPlace() {
  positions = {};
  const together = parsePairs(document.getElementById('together').value);
  const apart = parsePairs(document.getElementById('apart').value);
  const free = [];
  tables.forEach(t => {
    for (let s = 0; s < t.seats; s++) free.push({table: t.id, seat: s});
  });
  // Place together pairs first
  together.forEach(([a, b]) => {
    if (!guests.includes(a) || !guests.includes(b)) return;
    const slot = free.shift();
    if (slot) {
      positions[a] = slot;
      const next = free.shift();
      if (next && next.table === slot.table) positions[b] = next;
      else if (next) { positions[b] = next; free.unshift(next); } // best effort
    }
  });
  // Fill rest
  guests.forEach(g => {
    if (!positions[g] && free.length) positions[g] = free.shift();
  });
  checkWarnings();
  save();
  draw();
}

function checkWarnings() {
  const together = parsePairs(document.getElementById('together').value);
  const apart = parsePairs(document.getElementById('apart').value);
  const msgs = [];
  together.forEach(([a, b]) => {
    const pa = positions[a], pb = positions[b];
    if (pa && pb && pa.table !== pb.table) msgs.push(`${a} and ${b} are not at the same table`);
  });
  apart.forEach(([a, b]) => {
    const pa = positions[a], pb = positions[b];
    if (pa && pb && pa.table === pb.table) msgs.push(`${a} and ${b} are at the same table`);
  });
  document.getElementById('warnings').textContent = msgs.join(' · ') || '';
}

function draw() {
  const wrap = document.getElementById('canvas-wrap');
  wrap.innerHTML = '';
  const placed = new Set(Object.keys(positions));
  tables.forEach(t => {
    const el = document.createElement('div');
    el.className = 'table';
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.style.width = '140px';
    el.style.height = '140px';
    el.textContent = `Table ${t.id}`;
    wrap.appendChild(el);
    // seats around
    for (let s = 0; s < t.seats; s++) {
      const ang = (s / t.seats) * Math.PI * 2 - Math.PI / 2;
      const sx = t.x + 70 + Math.cos(ang) * 90 - 35;
      const sy = t.y + 70 + Math.sin(ang) * 90 - 14;
      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.style.left = sx + 'px';
      seat.style.top = sy + 'px';
      seat.dataset.table = t.id;
      seat.dataset.seat = s;
      wrap.appendChild(seat);
    }
  });
  // guests
  guests.forEach(g => {
    const chip = document.createElement('div');
    chip.className = 'guest';
    chip.textContent = g;
    chip.dataset.guest = g;
    const pos = positions[g];
    if (pos) {
      const t = tables.find(tt => tt.id === pos.table);
      if (t) {
        const ang = (pos.seat / t.seats) * Math.PI * 2 - Math.PI / 2;
        chip.style.left = (t.x + 70 + Math.cos(ang) * 90 - 30) + 'px';
        chip.style.top = (t.y + 70 + Math.sin(ang) * 90 - 12) + 'px';
      }
    } else {
      chip.style.left = '20px';
      chip.style.top = (20 + guests.indexOf(g) * 32) + 'px';
    }
    chip.onpointerdown = startDrag;
    wrap.appendChild(chip);
  });
  checkWarnings();
}

function startDrag(e) {
  e.preventDefault();
  const chip = e.currentTarget;
  drag = { chip, guest: chip.dataset.guest, ox: e.clientX - chip.offsetLeft, oy: e.clientY - chip.offsetTop };
  chip.classList.add('dragging');
  chip.setPointerCapture(e.pointerId);
  chip.onpointermove = moveDrag;
  chip.onpointerup = endDrag;
}

function moveDrag(e) {
  if (!drag) return;
  drag.chip.style.left = (e.clientX - drag.ox) + 'px';
  drag.chip.style.top = (e.clientY - drag.oy) + 'px';
}

function endDrag(e) {
  if (!drag) return;
  const chip = drag.chip;
  chip.classList.remove('dragging');
  // snap to nearest seat
  const seats = document.querySelectorAll('.seat');
  let best = null, bestD = 80;
  seats.forEach(seat => {
    const r = seat.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width/2);
    const dy = e.clientY - (r.top + r.height/2);
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = seat; }
  });
  if (best) {
    const table = +best.dataset.table;
    const seat = +best.dataset.seat;
    // free previous occupant of that seat
    Object.keys(positions).forEach(g => {
      if (positions[g].table === table && positions[g].seat === seat && g !== drag.guest) delete positions[g];
    });
    positions[drag.guest] = { table, seat };
  }
  drag = null;
  save();
  draw();
}

function downloadPNG() {
  const wrap = document.getElementById('canvas-wrap');
  const c = document.createElement('canvas');
  c.width = wrap.offsetWidth || 800;
  c.height = wrap.offsetHeight || 500;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#555';
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '14px system-ui';
  tables.forEach(t => {
    ctx.beginPath();
    ctx.arc(t.x + 70, t.y + 70, 70, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillText(`Table ${t.id}`, t.x + 40, t.y + 74);
  });
  ctx.fillStyle = '#6ee7b7';
  guests.forEach(g => {
    const pos = positions[g];
    if (!pos) return;
    const t = tables.find(tt => tt.id === pos.table);
    if (!t) return;
    const ang = (pos.seat / t.seats) * Math.PI * 2 - Math.PI / 2;
    const x = t.x + 70 + Math.cos(ang) * 90;
    const y = t.y + 70 + Math.sin(ang) * 90;
    ctx.fillText(g, x - 20, y);
  });
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = 'seating-chart.png';
  a.click();
}

function downloadCSV() {
  let csv = 'Table,Seat,Guest\n';
  guests.forEach(g => {
    const p = positions[g];
    csv += `${p ? p.table : ''},${p ? p.seat + 1 : ''},"${g.replace(/"/g, '""')}"\n`;
  });
  const blob = new Blob([csv], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'seating-chart.csv';
  a.click();
}

document.getElementById('add-guest').onclick = () => {
  const v = document.getElementById('guest-input').value.trim();
  if (v && !guests.includes(v)) {
    guests.push(v);
    document.getElementById('guest-input').value = '';
    renderGuests();
    save();
    draw();
  }
};
document.getElementById('guest-input').onkeydown = e => { if (e.key === 'Enter') document.getElementById('add-guest').click(); };
document.getElementById('rebuild').onclick = rebuildTables;
document.getElementById('auto-place').onclick = autoPlace;
document.getElementById('download-png').onclick = downloadPNG;
document.getElementById('download-csv').onclick = downloadCSV;
document.getElementById('clear').onclick = () => {
  if (confirm('Clear everything?')) {
    guests = []; positions = {};
    document.getElementById('together').value = '';
    document.getElementById('apart').value = '';
    renderGuests();
    save();
    draw();
  }
};
['together','apart'].forEach(id => document.getElementById(id).oninput = () => { save(); checkWarnings(); });

load();
