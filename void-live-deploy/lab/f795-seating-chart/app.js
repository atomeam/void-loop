const $ = id => document.getElementById(id);
const namesEl = $('names'), numEl = $('numTables'), togetherEl = $('together'), apartEl = $('apart');
const pool = $('pool'), tablesEl = $('tables');
let guests = [], tables = [];

function load() {
  try {
    const s = localStorage.getItem('verse-seating-f795');
    if (s) {
      const d = JSON.parse(s);
      namesEl.value = d.names || '';
      numEl.value = d.num || 4;
      togetherEl.value = d.together || '';
      apartEl.value = d.apart || '';
    }
  } catch (e) { console.debug("lab f795-seating-chart:", e); }
}
function saveState() {
  const data = {
    names: namesEl.value,
    num: numEl.value,
    together: togetherEl.value,
    apart: apartEl.value,
    seating: tables.map(t => t.map(g => g))
  };
  localStorage.setItem('verse-seating-f795', JSON.stringify(data));
}

function parsePairs(text) {
  return text.split('\n').map(l => l.split(',').map(s => s.trim()).filter(Boolean)).filter(p => p.length === 2);
}

function generate() {
  const lines = namesEl.value.split('\n').map(s => s.trim()).filter(Boolean);
  guests = [...new Set(lines)];
  const n = Math.max(1, Math.min(20, parseInt(numEl.value) || 4));
  tables = Array.from({length: n}, () => []);
  guests.forEach((g, i) => tables[i % n].push(g));
  render();
  checkConstraints();
  saveState();
}

function render() {
  pool.innerHTML = '';
  const seated = new Set(tables.flat());
  guests.filter(g => !seated.has(g)).forEach(g => {
    const el = document.createElement('div');
    el.className = 'seat';
    el.textContent = g;
    el.draggable = true;
    el.dataset.guest = g;
    el.addEventListener('dragstart', onDragStart);
    pool.appendChild(el);
  });
  tablesEl.innerHTML = '';
  tables.forEach((seats, i) => {
    const t = document.createElement('div');
    t.className = 'table';
    t.dataset.table = i;
    t.innerHTML = `<h3>Table ${i+1}</h3>`;
    seats.forEach(g => {
      const el = document.createElement('div');
      el.className = 'seat';
      el.textContent = g;
      el.draggable = true;
      el.dataset.guest = g;
      el.addEventListener('dragstart', onDragStart);
      t.appendChild(el);
    });
    t.addEventListener('dragover', e => e.preventDefault());
    t.addEventListener('drop', onDrop);
    tablesEl.appendChild(t);
  });
  pool.addEventListener('dragover', e => e.preventDefault());
  pool.addEventListener('drop', onDropPool);
}

let dragGuest = null, dragFrom = null;
function onDragStart(e) {
  dragGuest = e.target.dataset.guest;
  dragFrom = e.target.closest('.table') ? parseInt(e.target.closest('.table').dataset.table) : -1;
  e.target.classList.add('dragging');
}
function onDrop(e) {
  e.preventDefault();
  const to = parseInt(e.currentTarget.dataset.table);
  if (dragGuest == null) return;
  if (dragFrom >= 0) tables[dragFrom] = tables[dragFrom].filter(g => g !== dragGuest);
  if (!tables[to].includes(dragGuest)) tables[to].push(dragGuest);
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  render();
  saveState();
  dragGuest = null;
}
function onDropPool(e) {
  e.preventDefault();
  if (dragGuest == null || dragFrom < 0) return;
  tables[dragFrom] = tables[dragFrom].filter(g => g !== dragGuest);
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  render();
  saveState();
  dragGuest = null;
}

function checkConstraints() {
  const tog = parsePairs(togetherEl.value);
  const apa = parsePairs(apartEl.value);
  const warnings = [];
  tog.forEach(([a,b]) => {
    const ta = tables.findIndex(t => t.includes(a));
    const tb = tables.findIndex(t => t.includes(b));
    if (ta >= 0 && tb >= 0 && ta !== tb) warnings.push(`${a} and ${b} are on different tables`);
  });
  apa.forEach(([a,b]) => {
    const ta = tables.findIndex(t => t.includes(a));
    const tb = tables.findIndex(t => t.includes(b));
    if (ta >= 0 && ta === tb) warnings.push(`${a} and ${b} are on the same table`);
  });
  if (warnings.length) alert('Constraint notes:\n' + warnings.join('\n'));
}

$('generate').onclick = generate;
$('save').onclick = () => { saveState(); alert('Saved on this device.'); };
$('csv').onclick = () => {
  let csv = 'Table,Guest\n';
  tables.forEach((seats, i) => seats.forEach(g => csv += `${i+1},"${g}"\n`));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'seating-chart.csv';
  a.click();
};
$('png').onclick = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 600;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1419'; ctx.fillRect(0,0,800,600);
  ctx.fillStyle = '#e7e9ea'; ctx.font = '16px system-ui';
  ctx.fillText('Seating Chart', 20, 30);
  tables.forEach((seats, i) => {
    const x = 20 + (i % 4) * 190;
    const y = 50 + Math.floor(i / 4) * 160;
    ctx.strokeStyle = '#38444d'; ctx.strokeRect(x, y, 170, 140);
    ctx.fillText(`Table ${i+1}`, x+10, y+25);
    seats.slice(0, 6).forEach((g, j) => ctx.fillText(g, x+10, y+50 + j*18));
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'seating-chart.png';
  a.click();
};

load();
if (namesEl.value) generate();
