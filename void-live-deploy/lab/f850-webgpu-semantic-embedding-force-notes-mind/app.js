const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const notesEl = document.getElementById('notes');
const status = document.getElementById('status');
let notes = [];
let mlp = { w1: Array(8).fill(0).map(()=>Math.random()*0.2-0.1), b1: Array(8).fill(0), w2: Array(2).fill(0).map(()=>Math.random()*0.1), b2:[0.5,0.3] }; // tiny
let dragReward = 0;
let animId;

function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

function addNote(text = '', x = Math.random()* (innerWidth-180)+20, y = Math.random()*(innerHeight-100)+60) {
  const id = Date.now() + Math.random();
  const el = document.createElement('div');
  el.className = 'note';
  el.innerHTML = `<textarea>${text}</textarea>`;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  notesEl.appendChild(el);
  const note = { id, el, x, y, vx:0, vy:0, text, emb: null };
  notes.push(note);
  el.querySelector('textarea').addEventListener('input', e => { note.text = e.target.value; updateEmbeddings(); });
  makeDraggable(note);
  updateEmbeddings();
  return note;
}

function makeDraggable(note) {
  let ox, oy, dragging = false;
  note.el.addEventListener('pointerdown', e => {
    dragging = true; ox = e.clientX - note.x; oy = e.clientY - note.y;
    note.el.setPointerCapture(e.pointerId);
  });
  note.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    note.x = e.clientX - ox; note.y = e.clientY - oy;
    note.el.style.left = note.x + 'px'; note.el.style.top = note.y + 'px';
    dragReward = Math.min(1, dragReward + 0.05); // reward for correction
  });
  note.el.addEventListener('pointerup', () => { dragging = false; });
}

function tokenize(t) { return (t.toLowerCase().match(/\w+/g) || []); }
function updateEmbeddings() {
  const allWords = new Set();
  notes.forEach(n => tokenize(n.text).forEach(w => allWords.add(w)));
  const vocab = [...allWords];
  notes.forEach(n => {
    const counts = {};
    tokenize(n.text).forEach(w => counts[w] = (counts[w]||0)+1);
    const vec = vocab.map(w => counts[w]||0);
    const norm = Math.sqrt(vec.reduce((s,v)=>s+v*v,0)) || 1;
    n.emb = vec.map(v => v/norm);
  });
}

function cosine(a,b) { if (!a||!b) return 0; return a.reduce((s,v,i)=>s+v*(b[i]||0),0); }

function mlpForward(inputs) { // simple 4->8->2
  const h = mlp.w1.map((_,i) => Math.tanh(inputs.reduce((s,x,j)=>s + x*(mlp.w1[i*4+j]||0), mlp.b1[i]||0)));
  return [0,1].map(k => Math.tanh(h.reduce((s,v,i)=>s + v*(mlp.w2[k*8+i]||0), mlp.b2[k]||0)));
}

function step() {
  const gains = mlpForward([dragReward, notes.length/10, Math.random()*0.1, 0.5]);
  const attGain = 0.8 + gains[0]*0.4;
  const repGain = 0.3 + gains[1]*0.2;
  // forces
  notes.forEach(n => { n.fx=0; n.fy=0; });
  for (let i=0; i<notes.length; i++) {
    for (let j=i+1; j<notes.length; j++) {
      const a = notes[i], b = notes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx*dx + dy*dy + 100;
      const d = Math.sqrt(d2);
      const sim = cosine(a.emb, b.emb);
      const f = (sim * attGain - 0.2) * 40 / d; // attraction if similar
      const fx = dx/d * f, fy = dy/d * f;
      a.fx += fx; a.fy += fy;
      b.fx -= fx; b.fy -= fy;
      // repulsion
      const rf = repGain * 800 / d2;
      a.fx -= dx/d * rf; a.fy -= dy/d * rf;
      b.fx += dx/d * rf; b.fy += dy/d * rf;
    }
  }
  notes.forEach(n => {
    n.vx = (n.vx + n.fx * 0.05) * 0.85;
    n.vy = (n.vy + n.fy * 0.05) * 0.85;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(10, Math.min(innerWidth-170, n.x));
    n.y = Math.max(50, Math.min(innerHeight-80, n.y));
    n.el.style.left = n.x + 'px';
    n.el.style.top = n.y + 'px';
  });
  dragReward *= 0.98;
  // draw field
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(100,150,255,0.15)';
  ctx.lineWidth = 1;
  notes.forEach(n => {
    if (n.emb) {
      ctx.beginPath();
      ctx.arc(n.x+80, n.y+30, 40 + Math.abs(n.fx)*2, 0, Math.PI*2);
      ctx.stroke();
    }
  });
  // light reward update on mlp (simple)
  if (dragReward > 0.1) {
    mlp.b2[0] += (dragReward - 0.3) * 0.01;
  }
  animId = requestAnimationFrame(step);
}

document.getElementById('add').onclick = () => addNote(prompt('Note text:') || 'New idea');
document.getElementById('seal').onclick = async () => {
  const data = { notes: notes.map(n=>({text:n.text, x:n.x, y:n.y})), mlp, ts:Date.now() };
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f850',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('mind'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('mind','readwrite');
    tx.objectStore('mind').put(data, 'current');
    await new Promise(r=>tx.oncomplete=r);
    status.textContent = 'Mind sealed to IndexedDB';
  } catch(e) { status.textContent = 'Seal failed (private mode?)'; }
};
document.getElementById('reset').onclick = () => { notes.forEach(n=>n.el.remove()); notes=[]; updateEmbeddings(); };

async function load() {
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f850',1); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('mind','readonly');
    const req = tx.objectStore('mind').get('current');
    req.onsuccess = () => {
      if (req.result) {
        req.result.notes.forEach(n => addNote(n.text, n.x, n.y));
        if (req.result.mlp) mlp = req.result.mlp;
        status.textContent = 'Restored sealed mind';
      } else {
        addNote('WebGPU compute shaders', 100, 100);
        addNote('Local AI agents on canvas', 300, 150);
        addNote('Spatial Verse portals', 200, 250);
        addNote('IndexedDB sealed genomes', 400, 300);
      }
    };
  } catch(e) {
    addNote('Demo: semantic clustering', 150, 120);
    addNote('Drag notes to teach forces', 350, 200);
  }
  step();
}
load();
