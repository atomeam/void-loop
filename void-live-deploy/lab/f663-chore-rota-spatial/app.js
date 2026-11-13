const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let people = [];
let chores = []; // {id, name, diff}
let assignments = {}; // key: person|day -> choreId
let nextId = 1;

const $ = id => document.getElementById(id);
const peopleEl = $('people'), choresEl = $('chores'), body = $('body'), header = $('header-row');
const pool = $('pool'), stats = $('stats');

function parse() {
  people = peopleEl.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12);
  chores = [];
  nextId = 1;
  choresEl.value.split('\n').forEach(line => {
    const [name, d] = line.split(',').map(s => s.trim());
    if (name) chores.push({ id: nextId++, name, diff: Math.max(1, Math.min(5, parseInt(d) || 1)) });
  });
  chores = chores.slice(0, 40);
}

function loadState() {
  try {
    const hash = location.hash.slice(1);
    if (hash) {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.people) peopleEl.value = data.people.join('\n');
      if (data.chores) choresEl.value = data.chores.map(c => c.diff !== 1 ? `${c.name},${c.diff}` : c.name).join('\n');
      if (data.assignments) assignments = data.assignments;
    } else {
      const saved = localStorage.getItem('verse-f663-rota');
      if (saved) {
        const data = JSON.parse(saved);
        peopleEl.value = data.people.join('\n');
        choresEl.value = data.chores.map(c => c.diff !== 1 ? `${c.name},${c.diff}` : c.name).join('\n');
        assignments = data.assignments || {};
      }
    }
  } catch (e) { console.debug("lab f663-chore-rota-spatial:", e); }
  parse();
  render();
}

function saveState() {
  const data = { people, chores, assignments };
  localStorage.setItem('verse-f663-rota', JSON.stringify(data));
  history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(data)));
}

function getLoad(person) {
  let load = 0;
  days.forEach(d => {
    const cid = assignments[person + '|' + d];
    if (cid) {
      const c = chores.find(x => x.id === cid);
      if (c) load += c.diff;
    }
  });
  return load;
}

function render() {
  // header
  header.innerHTML = '<th>Person</th>' + days.map(d => `<th>${d}</th>`).join('');
  body.innerHTML = '';
  people.forEach(p => {
    const tr = document.createElement('tr');
    const load = getLoad(p);
    const max = Math.max(1, ...people.map(getLoad));
    tr.innerHTML = `<td class="person">${p}<div class="load-bar"><div class="load-fill" style="width:${(load/max)*100}%"></div></div><small>${load}</small></td>`;
    days.forEach(d => {
      const td = document.createElement('td');
      td.className = 'cell';
      td.dataset.person = p;
      td.dataset.day = d;
      const cid = assignments[p + '|' + d];
      if (cid) {
        const c = chores.find(x => x.id === cid);
        if (c) {
          const card = document.createElement('div');
          card.className = 'chore-card';
          card.draggable = true;
          card.textContent = c.name + (c.diff > 1 ? ` (${c.diff})` : '');
          card.dataset.id = c.id;
          card.addEventListener('dragstart', onDragStart);
          td.appendChild(card);
        }
      }
      td.addEventListener('dragover', e => e.preventDefault());
      td.addEventListener('drop', onDrop);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  // pool
  pool.innerHTML = '';
  const assigned = new Set(Object.values(assignments));
  const free = chores.filter(c => !assigned.has(c.id));
  if (free.length === 0) pool.innerHTML = '<em>All chores assigned. Drag from cells to reassign or unassign.</em>';
  free.forEach(c => {
    const card = document.createElement('div');
    card.className = 'chore-card';
    card.draggable = true;
    card.textContent = c.name + (c.diff > 1 ? ` (${c.diff})` : '');
    card.dataset.id = c.id;
    card.addEventListener('dragstart', onDragStart);
    pool.appendChild(card);
  });
  // stats
  if (people.length) {
    const loads = people.map(getLoad);
    const avg = loads.reduce((a,b)=>a+b,0)/loads.length;
    const maxDiff = Math.max(...loads) - Math.min(...loads);
    stats.textContent = `People: ${people.length} · Chores: ${chores.length} · Avg load: ${avg.toFixed(1)} · Max difference: ${maxDiff}`;
  } else stats.textContent = 'Add people and chores above.';
}

let dragId = null;
function onDragStart(e) {
  dragId = e.target.dataset.id;
  e.dataTransfer.setData('text/plain', dragId);
  e.dataTransfer.effectAllowed = 'move';
}
function onDrop(e) {
  e.preventDefault();
  const id = parseInt(e.dataTransfer.getData('text/plain') || dragId);
  const cell = e.currentTarget;
  const person = cell.dataset.person;
  const day = cell.dataset.day;
  if (!person || !day) return;
  // remove from wherever it was
  for (const k in assignments) if (assignments[k] == id) delete assignments[k];
  assignments[person + '|' + day] = id;
  saveState();
  render();
}
// allow drop on pool to unassign
pool.addEventListener('dragover', e => e.preventDefault());
pool.addEventListener('drop', e => {
  e.preventDefault();
  const id = parseInt(e.dataTransfer.getData('text/plain') || dragId);
  for (const k in assignments) if (assignments[k] == id) delete assignments[k];
  saveState();
  render();
});

function balance() {
  parse();
  assignments = {};
  if (!people.length || !chores.length) { render(); return; }
  // simple: distribute chores across days and people by lowest load
  const queue = [...chores];
  days.forEach(day => {
    // for this day, assign remaining chores preferring low load
    const dayChores = queue.splice(0, Math.ceil(queue.length / (days.length - days.indexOf(day)) || 1));
    dayChores.forEach(c => {
      let best = people[0];
      let bestLoad = Infinity;
      people.forEach(p => {
        const l = getLoad(p); // current including previous days
        if (l < bestLoad) { bestLoad = l; best = p; }
      });
      assignments[best + '|' + day] = c.id;
    });
  });
  // leftover to lowest
  queue.forEach(c => {
    let best = people[0];
    let bestLoad = Infinity;
    people.forEach(p => {
      const l = getLoad(p);
      if (l < bestLoad) { bestLoad = l; best = p; }
    });
    // put on first free day or Mon
    const day = days.find(d => !assignments[best + '|' + d]) || 'Mon';
    assignments[best + '|' + day] = c.id;
  });
  saveState();
  render();
}

function clearAssign() {
  assignments = {};
  saveState();
  render();
}

function downloadPNG() {
  const canvas = $('export');
  const w = 800, h = 40 + people.length * 50;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1115'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#e6e6e6'; ctx.font = '14px system-ui';
  ctx.fillText('Weekly Chore Rota', 20, 25);
  const colW = (w - 120) / 7;
  days.forEach((d, i) => {
    ctx.fillStyle = '#888';
    ctx.fillText(d, 120 + i * colW + 10, 25);
  });
  people.forEach((p, pi) => {
    const y = 50 + pi * 50;
    ctx.fillStyle = '#4a9eff';
    ctx.fillText(p, 10, y + 20);
    days.forEach((d, di) => {
      const cid = assignments[p + '|' + d];
      if (cid) {
        const c = chores.find(x => x.id === cid);
        if (c) {
          ctx.fillStyle = '#2a3a4a';
          ctx.fillRect(120 + di * colW, y, colW - 4, 40);
          ctx.fillStyle = '#e6e6e6';
          ctx.font = '12px system-ui';
          ctx.fillText(c.name.slice(0, 12), 120 + di * colW + 6, y + 22);
        }
      }
    });
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'chore-rota.png';
  a.click();
}

function copyList() {
  let text = 'Weekly Chore Rota\n\n';
  people.forEach(p => {
    text += p + ':\n';
    days.forEach(d => {
      const cid = assignments[p + '|' + d];
      const c = chores.find(x => x.id === cid);
      text += `  ${d}: ${c ? c.name : '-'}\n`;
    });
    text += '\n';
  });
  navigator.clipboard.writeText(text).then(() => alert('Copied assignment list')).catch(() => prompt('Copy:', text));
}

function share() {
  saveState();
  navigator.clipboard.writeText(location.href).then(() => alert('Share link copied')).catch(() => prompt('Share this link:', location.href));
}

peopleEl.addEventListener('input', () => { parse(); saveState(); render(); });
choresEl.addEventListener('input', () => { parse(); saveState(); render(); });
$('balance').addEventListener('click', balance);
$('clear').addEventListener('click', clearAssign);
$('png').addEventListener('click', downloadPNG);
$('copy').addEventListener('click', copyList);
$('share').addEventListener('click', share);

loadState();
