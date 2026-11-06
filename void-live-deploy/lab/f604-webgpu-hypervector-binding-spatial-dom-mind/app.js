const DIM = 256;
const cards = [];
let bound = []; // {vec, label, id}
let nextId = 1;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function randBipolar() {
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) v[i] = Math.random() < 0.5 ? 1 : -1;
  return v;
}
function bind(a, b) {
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) v[i] = a[i] * b[i];
  return v;
}
function similarity(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s / DIM;
}
function normalize(v) {
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i]*v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

function spawnCard(label, vec, x, y) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = label;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.dataset.id = nextId++;
  document.body.appendChild(el);
  const card = { el, vec, label, x, y, vx:0, vy:0, id: el.dataset.id };
  cards.push(card);
  makeDraggable(card);
  return card;
}

function makeDraggable(card) {
  let dragging = false, ox=0, oy=0;
  card.el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - card.x;
    oy = e.clientY - card.y;
    card.el.setPointerCapture(e.pointerId);
  });
  card.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    card.x = e.clientX - ox;
    card.y = e.clientY - oy;
    card.el.style.left = card.x + 'px';
    card.el.style.top = card.y + 'px';
  });
  card.el.addEventListener('pointerup', e => {
    dragging = false;
    // check proximity for binding
    cards.forEach(other => {
      if (other === card) return;
      const dx = card.x - other.x, dy = card.y - other.y;
      if (dx*dx + dy*dy < 120*120) {
        const bv = bind(card.vec, other.vec);
        const blabel = card.label + '⊗' + other.label;
        bound.push({vec: bv, label: blabel, id: nextId++});
        spawnCard(blabel, bv, (card.x+other.x)/2, (card.y+other.y)/2 + 40);
        card.el.classList.add('bound');
        other.el.classList.add('bound');
        status.textContent = `Bound ${blabel}`;
      }
    });
  });
  card.el.addEventListener('dblclick', () => {
    let best = 0, bestL = 'none';
    bound.forEach(b => {
      const s = similarity(card.vec, b.vec);
      if (s > best) { best = s; bestL = b.label; }
    });
    status.textContent = `Query ${card.label} → ${bestL} (${best.toFixed(2)})`;
  });
}

// Initial concepts
const atoms = ['void','verse','mind','bind','space','time','flow','seed'];
atoms.forEach((a,i) => {
  spawnCard(a, randBipolar(), 80 + (i%4)*140, 80 + Math.floor(i/4)*90);
});

document.getElementById('add').onclick = () => {
  const lab = prompt('Concept label:') || 'anon';
  spawnCard(lab, randBipolar(), 200, 200);
};

// Simple attractor: cards move toward high similarity regions (simulated)
function step() {
  // lightweight spatial attraction based on pairwise sim
  cards.forEach(c => {
    let fx=0, fy=0;
    cards.forEach(o => {
      if (o===c) return;
      const s = similarity(c.vec, o.vec);
      const dx = o.x - c.x, dy = o.y - c.y;
      const d = Math.hypot(dx,dy) || 1;
      if (s > 0.1) {
        fx += (dx/d) * s * 0.4;
        fy += (dy/d) * s * 0.4;
      }
    });
    c.vx = c.vx*0.9 + fx;
    c.vy = c.vy*0.9 + fy;
    c.x += c.vx;
    c.y += c.vy;
    c.el.style.left = c.x+'px';
    c.el.style.top = c.y+'px';
  });

  // Canvas2D field visualization (fallback / always)
  canvas.width = innerWidth; canvas.height = innerHeight;
  ctx.fillStyle = '#0c0c14';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // draw soft connections
  ctx.strokeStyle = 'rgba(100,160,255,.25)';
  cards.forEach((c,i) => {
    cards.slice(i+1).forEach(o => {
      const s = similarity(c.vec, o.vec);
      if (s > 0.15) {
        ctx.globalAlpha = s;
        ctx.beginPath();
        ctx.moveTo(c.x+40, c.y+20);
        ctx.lineTo(o.x+40, o.y+20);
        ctx.stroke();
      }
    });
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Seal / restore (simplified)
document.getElementById('seal').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f604',1);
      r.onupgradeneeded = () => r.result.createObjectStore('bound');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('bound','readwrite');
    tx.objectStore('bound').put(bound.map(b=>({label:b.label, vec:Array.from(b.vec)})), 'latest');
    status.textContent = `Sealed ${bound.length} composites`;
  } catch(e) { status.textContent = 'Seal failed (private?)'; }
};
document.getElementById('restore').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f604',1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('bound','readonly');
    const req = tx.objectStore('bound').get('latest');
    req.onsuccess = () => {
      if (req.result) {
        req.result.forEach(b => spawnCard(b.label, new Float32Array(b.vec), 300+Math.random()*200, 300+Math.random()*100));
        status.textContent = `Restored ${req.result.length}`;
      }
    };
  } catch(e) { status.textContent = 'No sealed data'; }
};

// WebGPU stub: if available, we could upload vectors and compute lattice similarity; here Canvas2D is primary for reliability
if (navigator.gpu) {
  status.textContent += ' · WebGPU present (Canvas2D primary)';
}
