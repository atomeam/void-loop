const canvas = document.getElementById('canvas');
const input = document.getElementById('input');
const status = document.getElementById('status');
let items = [];
let centroids = {};
let dragging = null;
let offset = {x:0,y:0};
const DB_NAME = 'verse-f694';
const STORE = 'packing';

async function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('state');
    req.onsuccess = () => {
      if (req.result) {
        items = req.result.items || [];
        input.value = items.map(i => i.category !== 'misc' ? `${i.text}:${i.category}` : i.text).join('\n');
        render();
        status.textContent = 'Restored from device';
      }
    };
  } catch(e) { status.textContent = 'Session only'; }
}

async function save() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({items}, 'state');
    status.textContent = 'Saved on device';
  } catch(e) { status.textContent = 'Save failed'; }
}

function parse() {
  const lines = input.value.split('\n').map(l => l.trim()).filter(Boolean);
  const newItems = [];
  lines.forEach(line => {
    const [text, cat] = line.split(':').map(s => s.trim());
    newItems.push({
      id: Math.random().toString(36).slice(2),
      text: text || line,
      category: cat || 'misc',
      x: Math.random() * (window.innerWidth - 100),
      y: Math.random() * (window.innerHeight - 100) + 100,
      vx: 0, vy: 0
    });
  });
  items = newItems;
  render();
}

function render() {
  canvas.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item';
    el.textContent = item.text;
    el.dataset.id = item.id;
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    canvas.appendChild(el);
  });
  updateCentroids();
}

function updateCentroids() {
  const cats = {};
  items.forEach(i => {
    if (!cats[i.category]) cats[i.category] = {x:0,y:0,n:0};
    cats[i.category].x += i.x; cats[i.category].y += i.y; cats[i.category].n++;
  });
  Object.keys(centroids).forEach(k => centroids[k].el?.remove());
  centroids = {};
  Object.keys(cats).forEach(cat => {
    const c = cats[cat];
    const el = document.createElement('div');
    el.className = 'centroid';
    el.style.left = (c.x/c.n) + 'px';
    el.style.top = (c.y/c.n) + 'px';
    canvas.appendChild(el);
    centroids[cat] = {x: c.x/c.n, y: c.y/c.n, el};
  });
}

function physics() {
  if (dragging) return;
  items.forEach(item => {
    const c = centroids[item.category];
    if (c) {
      item.vx += (c.x - item.x) * 0.01;
      item.vy += (c.y - item.y) * 0.01;
    }
    items.forEach(other => {
      if (other === item) return;
      const dx = item.x - other.x, dy = item.y - other.y;
      const d2 = dx*dx + dy*dy + 100;
      const f = 200 / d2;
      item.vx += dx * f; item.vy += dy * f;
    });
    item.vx *= 0.9; item.vy *= 0.9;
    item.x += item.vx; item.y += item.vy;
    item.x = Math.max(10, Math.min(window.innerWidth - 100, item.x));
    item.y = Math.max(80, Math.min(window.innerHeight - 40, item.y));
  });
  updateCentroids();
  document.querySelectorAll('.item').forEach(el => {
    const item = items.find(i => i.id === el.dataset.id);
    if (item) { el.style.left = item.x + 'px'; el.style.top = item.y + 'px'; }
  });
  requestAnimationFrame(physics);
}

function exportList() {
  const groups = {};
  items.forEach(i => {
    if (!groups[i.category]) groups[i.category] = [];
    groups[i.category].push(i.text);
  });
  let text = '';
  Object.keys(groups).sort().forEach(cat => {
    text += `# ${cat}\n` + groups[cat].sort().join('\n') + '\n\n';
  });
  return text.trim();
}

document.getElementById('add').onclick = parse;
document.getElementById('clear').onclick = () => { items = []; input.value = ''; render(); };
document.getElementById('export').onclick = () => {
  const t = exportList();
  navigator.clipboard.writeText(t).then(() => status.textContent = 'Copied!');
};
document.getElementById('download').onclick = () => {
  const t = exportList();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], {type:'text/plain'}));
  a.download = 'packing-list.txt';
  a.click();
};
document.getElementById('save').onclick = save;

canvas.addEventListener('pointerdown', e => {
  if (!e.target.classList.contains('item')) return;
  dragging = items.find(i => i.id === e.target.dataset.id);
  if (!dragging) return;
  e.target.classList.add('dragging');
  offset.x = e.clientX - dragging.x;
  offset.y = e.clientY - dragging.y;
  e.target.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  dragging.x = e.clientX - offset.x;
  dragging.y = e.clientY - offset.y;
  const el = document.querySelector(`[data-id="${dragging.id}"]`);
  if (el) { el.style.left = dragging.x + 'px'; el.style.top = dragging.y + 'px'; }
});
canvas.addEventListener('pointerup', e => {
  if (!dragging) return;
  document.querySelector(`[data-id="${dragging.id}"]`)?.classList.remove('dragging');
  let nearest = 'misc', minD = Infinity;
  Object.keys(centroids).forEach(cat => {
    const c = centroids[cat];
    const d = Math.hypot(dragging.x - c.x, dragging.y - c.y);
    if (d < minD) { minD = d; nearest = cat; }
  });
  if (minD < 120) dragging.category = nearest;
  dragging = null;
  updateCentroids();
});

load();
requestAnimationFrame(physics);
