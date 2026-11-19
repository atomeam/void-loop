const DIM = 16;
const MAX_NOTES = 12;
let notes = [];
let attention = [];
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const notesEl = document.getElementById('notes');
const status = document.getElementById('status');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function hashToken(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h % DIM;
}

function embed(text) {
  const v = new Float32Array(DIM);
  const tokens = (text || '').toLowerCase().match(/\w+/g) || [];
  tokens.forEach(t => { v[hashToken(t)] += 1; });
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i]*v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i]*b[i];
  return s;
}

class Note {
  constructor(x, y, text = 'New note') {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.el = document.createElement('div');
    this.el.className = 'note';
    this.el.contentEditable = true;
    this.el.textContent = text;
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
    notesEl.appendChild(this.el);
    this.embedding = embed(text);
    this.dragging = false;
    let sx, sy, ox, oy;
    this.el.addEventListener('pointerdown', e => {
      this.dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = this.x; oy = this.y;
      this.el.setPointerCapture(e.pointerId);
    });
    this.el.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      this.x = ox + (e.clientX - sx);
      this.y = oy + (e.clientY - sy);
      this.el.style.left = this.x + 'px';
      this.el.style.top = this.y + 'px';
    });
    this.el.addEventListener('pointerup', () => { this.dragging = false; });
    this.el.addEventListener('input', () => {
      this.embedding = embed(this.el.textContent);
    });
  }
  update() {
    if (this.dragging) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.92;
    this.vy *= 0.92;
    // bounds
    this.x = Math.max(10, Math.min(innerWidth - 190, this.x));
    this.y = Math.max(10, Math.min(innerHeight - 100, this.y));
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
  }
  remove() { this.el.remove(); }
}

function addNote(x = innerWidth/2 - 90, y = innerHeight/2 - 40, text) {
  if (notes.length >= MAX_NOTES) return;
  notes.push(new Note(x, y, text));
}

function computeAttention() {
  const n = notes.length;
  attention = Array.from({length: n}, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const sim = cosine(notes[i].embedding, notes[j].embedding);
      const dx = notes[i].x - notes[j].x;
      const dy = notes[i].y - notes[j].y;
      const dist = Math.hypot(dx, dy) || 1;
      attention[i][j] = Math.max(0, sim) * Math.exp(-dist / 300);
    }
  }
}

function applyForces() {
  const n = notes.length;
  for (let i = 0; i < n; i++) {
    let fx = 0, fy = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = notes[j].x - notes[i].x;
      const dy = notes[j].y - notes[i].y;
      const dist = Math.hypot(dx, dy) || 1;
      const att = attention[i][j];
      // attraction
      fx += (dx / dist) * att * 0.8;
      fy += (dy / dist) * att * 0.8;
      // soft repulsion
      if (dist < 120) {
        const rep = (120 - dist) * 0.05;
        fx -= (dx / dist) * rep;
        fy -= (dy / dist) * rep;
      }
    }
    // weak center
    fx += (innerWidth/2 - notes[i].x) * 0.001;
    fy += (innerHeight/2 - notes[i].y) * 0.001;
    notes[i].vx += fx;
    notes[i].vy += fy;
  }
}

function drawEdges() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const n = notes.length;
  for (let i = 0; i < n; i++) {
    for (let j = i+1; j < n; j++) {
      const a = (attention[i][j] + attention[j][i]) / 2;
      if (a < 0.05) continue;
      ctx.beginPath();
      ctx.moveTo(notes[i].x + 90, notes[i].y + 40);
      ctx.lineTo(notes[j].x + 90, notes[j].y + 40);
      ctx.strokeStyle = `rgba(100,180,255,${Math.min(0.6, a)})`;
      ctx.lineWidth = 1 + a * 2;
      ctx.stroke();
    }
  }
}

function loop() {
  if (notes.length > 1) {
    computeAttention();
    applyForces();
  }
  notes.forEach(n => n.update());
  drawEdges();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('add').onclick = () => addNote(100 + Math.random()*200, 100 + Math.random()*200, 'Type a note…');
document.getElementById('clear').onclick = () => {
  notes.forEach(n => n.remove());
  notes = [];
  status.textContent = 'Cleared';
};

function exportMD() {
  const md = notes.map((n, i) => `## Note ${i+1}\n${n.el.textContent.trim()}\n`).join('\n');
  const blob = new Blob([md], {type:'text/markdown'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spatial-notes.md';
  a.click();
}
function exportJSON() {
  const data = notes.map(n => ({x:n.x, y:n.y, text:n.el.textContent, emb:Array.from(n.embedding)}));
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spatial-notes.json';
  a.click();
}
document.getElementById('export-md').onclick = exportMD;
document.getElementById('export-json').onclick = exportJSON;

async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f813', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('notes');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('notes', 'readwrite');
    const data = notes.map(n => ({x:n.x, y:n.y, text:n.el.textContent}));
    tx.objectStore('notes').put(data, 'board');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'Sealed to IndexedDB';
  } catch(e) {
    status.textContent = 'Seal failed (private mode?)';
  }
}
document.getElementById('seal').onclick = seal;

async function restore() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f813', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej();
    });
    const tx = db.transaction('notes', 'readonly');
    const req = tx.objectStore('notes').get('board');
    req.onsuccess = () => {
      const data = req.result;
      if (data && Array.isArray(data)) {
        notes.forEach(n => n.remove());
        notes = [];
        data.forEach(d => addNote(d.x, d.y, d.text));
        status.textContent = 'Restored ' + data.length + ' notes';
      }
    };
  } catch (e) { console.debug("lab f813-content-attention-spatial-note-canvas:", e); }
}
restore();

// seed examples
setTimeout(() => {
  if (notes.length === 0) {
    addNote(200, 150, 'Groceries: milk, bread, eggs');
    addNote(400, 200, 'Shopping list for the week');
    addNote(300, 350, 'Project ideas: spatial canvas');
  }
}, 500);
