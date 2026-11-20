const $ = id => document.getElementById(id);
let guests = [], assignment = [], constraints = { together: [], apart: [] };
let dragSrc = null;

function parse() {
  guests = $('names').value.split('\n').map(s => s.trim()).filter(Boolean);
  const parsePairs = txt => txt.split('\n').map(l => l.split(',').map(s => s.trim())).filter(p => p.length === 2 && p[0] && p[1]);
  constraints.together = parsePairs($('together').value);
  constraints.apart = parsePairs($('apart').value);
  const nT = +$('tables').value || 1;
  const cap = +$('seats').value || 4;
  return { nT, cap };
}

function fitness(asg, nT, cap) {
  let score = 0;
  const tables = Array.from({length: nT}, () => []);
  asg.forEach((t, i) => { if (t >= 0 && t < nT) tables[t].push(i); });
  tables.forEach(t => { if (t.length > cap) score -= (t.length - cap) * 10; });
  const ideal = guests.length / nT;
  tables.forEach(t => score -= Math.abs(t.length - ideal) * 2);
  constraints.together.forEach(([a,b]) => {
    const ia = guests.indexOf(a), ib = guests.indexOf(b);
    if (ia >= 0 && ib >= 0 && asg[ia] === asg[ib]) score += 20;
  });
  constraints.apart.forEach(([a,b]) => {
    const ia = guests.indexOf(a), ib = guests.indexOf(b);
    if (ia >= 0 && ib >= 0 && asg[ia] !== asg[ib]) score += 15;
  });
  return score;
}

function randomAsg(n, nT) {
  return Array.from({length: n}, () => Math.floor(Math.random() * nT));
}

function evolve(nT, cap, gens = 40, popSize = 30) {
  if (!guests.length) return [];
  let pop = Array.from({length: popSize}, () => randomAsg(guests.length, nT));
  for (let g = 0; g < gens; g++) {
    pop.sort((a,b) => fitness(b, nT, cap) - fitness(a, nT, cap));
    const next = pop.slice(0, 4);
    while (next.length < popSize) {
      const p1 = pop[Math.floor(Math.random()*10)];
      const p2 = pop[Math.floor(Math.random()*10)];
      const child = p1.map((v,i) => Math.random() < 0.5 ? v : p2[i]);
      if (Math.random() < 0.15) child[Math.floor(Math.random()*child.length)] = Math.floor(Math.random()*nT);
      next.push(child);
    }
    pop = next;
  }
  pop.sort((a,b) => fitness(b, nT, cap) - fitness(a, nT, cap));
  return pop[0];
}

function render() {
  const nT = +$('tables').value || 1;
  const board = $('board');
  board.innerHTML = '';
  const tables = Array.from({length: nT}, () => []);
  assignment.forEach((t, i) => { if (t >= 0 && t < nT) tables[t].push(i); });
  tables.forEach((idxs, ti) => {
    const div = document.createElement('div');
    div.className = 'table';
    div.dataset.table = ti;
    div.innerHTML = `<h3>Table ${ti+1} (${idxs.length})</h3>`;
    idxs.forEach(i => {
      const g = document.createElement('div');
      g.className = 'guest';
      g.draggable = true;
      g.textContent = guests[i];
      g.dataset.idx = i;
      g.addEventListener('dragstart', e => { dragSrc = i; g.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      g.addEventListener('dragend', () => g.classList.remove('dragging'));
      div.appendChild(g);
    });
    div.addEventListener('dragover', e => e.preventDefault());
    div.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc != null) {
        assignment[dragSrc] = ti;
        dragSrc = null;
        render();
        save();
      }
    });
    board.appendChild(div);
  });
  const sc = fitness(assignment, nT, +$('seats').value || 4);
  $('score').innerHTML = `Fitness: <span class="${sc > 0 ? 'ok' : 'bad'}">${sc}</span> (higher is better)`;
}

function save() {
  const data = { names: $('names').value, together: $('together').value, apart: $('apart').value, tables: $('tables').value, seats: $('seats').value, assignment };
  try { localStorage.setItem('seating-v1', JSON.stringify(data)); } catch (e) { console.debug("lab f807-local-ga-seating-chart:", e); }
  if (window.indexedDB) {
    const req = indexedDB.open('verse-seating', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('plans');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('plans', 'readwrite');
      tx.objectStore('plans').put(data, 'current');
    };
  }
}

function load() {
  try {
    const raw = localStorage.getItem('seating-v1');
    if (raw) {
      const d = JSON.parse(raw);
      $('names').value = d.names || '';
      $('together').value = d.together || '';
      $('apart').value = d.apart || '';
      $('tables').value = d.tables || 3;
      $('seats').value = d.seats || 4;
      if (d.assignment) assignment = d.assignment;
    }
  } catch (e) { console.debug("lab f807-local-ga-seating-chart:", e); }
}

$('arrange').onclick = () => {
  const { nT, cap } = parse();
  assignment = evolve(nT, cap);
  render();
  save();
};
$('reset').onclick = () => {
  parse();
  assignment = guests.map(() => 0);
  render();
  save();
};
$('download').onclick = () => {
  const nT = +$('tables').value || 1;
  let csv = 'Table,Guest\n';
  assignment.forEach((t, i) => { csv += `${t+1},"${guests[i]}"\n`; });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'seating.csv';
  a.click();
};
$('copy').onclick = () => {
  const lines = assignment.map((t,i) => `Table ${t+1}: ${guests[i]}`).join('\n');
  navigator.clipboard.writeText(lines).then(() => alert('Copied'));
};

load();
if (guests.length === 0) parse();
if (assignment.length !== guests.length) assignment = guests.map(() => 0);
render();
