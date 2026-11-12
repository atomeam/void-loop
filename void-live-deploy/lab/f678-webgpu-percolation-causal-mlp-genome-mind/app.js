const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, GW = 64, GH = 48;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  GW = Math.min(80, Math.floor(W / 10));
  GH = Math.min(60, Math.floor(H / 10));
}
resize(); addEventListener('resize', resize);

// Grid: 0 empty, 1 occupied
let grid = new Float32Array(GW * GH);
let density = new Float32Array(GW * GH);

// MLPs: 4 agents, inputs [tiltX, tiltY, pointerNorm, localDens] → [pGrowth, seedBias]
const N_AGENTS = 4;
let agents = [];
function randW() { return (Math.random() * 2 - 1) * 0.8; }
function makeMLP() {
  return {
    w1: Array.from({length: 4*4}, randW), // 4in → 4hid
    b1: Array.from({length: 4}, randW),
    w2: Array.from({length: 4*2}, randW), // 4hid → 2out
    b2: Array.from({length: 2}, randW),
    score: 0
  };
}
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function forward(mlp, inp) {
  const h = new Array(4).fill(0);
  for (let i = 0; i < 4; i++) {
    let s = mlp.b1[i];
    for (let j = 0; j < 4; j++) s += inp[j] * mlp.w1[i*4 + j];
    h[i] = Math.tanh(s);
  }
  const o = new Array(2).fill(0);
  for (let i = 0; i < 2; i++) {
    let s = mlp.b2[i];
    for (let j = 0; j < 4; j++) s += h[j] * mlp.w2[i*4 + j];
    o[i] = sigmoid(s);
  }
  return o; // [pGrowth 0-1, seedBias 0-1]
}
function cloneMLP(m) {
  return { w1: m.w1.slice(), b1: m.b1.slice(), w2: m.w2.slice(), b2: m.b2.slice(), score: m.score };
}
for (let i = 0; i < N_AGENTS; i++) agents.push(makeMLP());

// Sensors
let tiltX = 0, tiltY = 0;
let pointerX = 0.5, pointerY = 0.5;
let hasOrient = false;
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) {
    tiltX = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
    tiltY = Math.max(-1, Math.min(1, (e.beta || 0) / 45));
    hasOrient = true;
  }
});
canvas.addEventListener('pointermove', e => {
  pointerX = e.clientX / W;
  pointerY = e.clientY / H;
});

// Portals
const portals = [];
for (let i = 0; i < 6; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `Portal ${i+1}\nDrag to seed`;
  el.style.left = (20 + i*15) + '%';
  el.style.top = (30 + (i%3)*20) + '%';
  document.body.appendChild(el);
  portals.push({ el, x: 0.2 + i*0.1, y: 0.3 + (i%3)*0.15, vx: 0, vy: 0 });
  // Drag
  let dragging = false, ox, oy;
  el.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - parseFloat(el.style.left); oy = e.clientY - parseFloat(el.style.top); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
    const px = (e.clientX / W), py = (e.clientY / H);
    // Inject seed
    const gx = Math.floor(px * GW), gy = Math.floor(py * GH);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const ix = gx+dx, iy = gy+dy;
      if (ix>=0 && ix<GW && iy>=0 && iy<GH) grid[iy*GW + ix] = 1;
    }
  });
  el.addEventListener('pointerup', () => dragging = false);
}

// Persistence
const DB_NAME = 'f678-percolation';
let db;
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('f678-genome') : null;
async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function saveGenome(mlp) {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ id: 'best', mlp: { w1: mlp.w1, b1: mlp.b1, w2: mlp.w2, b2: mlp.b2 }, t: Date.now() });
}
async function loadGenome() {
  if (!db) return null;
  return new Promise(res => {
    const tx = db.transaction('genomes', 'readonly');
    const g = tx.objectStore('genomes').get('best');
    g.onsuccess = () => res(g.result ? g.result.mlp : null);
    g.onerror = () => res(null);
  });
}
if (bc) bc.onmessage = e => {
  if (e.data && e.data.type === 'genome') {
    const m = e.data.mlp;
    // Adopt into agent 0
    agents[0].w1 = m.w1; agents[0].b1 = m.b1; agents[0].w2 = m.w2; agents[0].b2 = m.b2;
    status('Genome received from other tab');
  }
};

// UI agents
const agentsDiv = document.getElementById('agents');
function renderAgents() {
  agentsDiv.innerHTML = '';
  agents.forEach((a, i) => {
    const b = document.createElement('button');
    b.textContent = `Prefer Agent ${i+1}`;
    b.onclick = () => seal(i);
    agentsDiv.appendChild(b);
  });
}
renderAgents();
function status(msg) { document.getElementById('status').textContent = msg; }

function seal(idx) {
  const m = cloneMLP(agents[idx]);
  saveGenome(m);
  if (bc) bc.postMessage({ type: 'genome', mlp: m });
  status(`Sealed agent ${idx+1}. Broadcast + saved.`);
}

document.getElementById('btnOrient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') status('Orientation granted'); });
  } else status('Orientation available (or use pointer)');
};
document.getElementById('btnSeed').onclick = () => {
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(Math.random()*GW), y = Math.floor(Math.random()*GH);
    grid[y*GW + x] = 1;
  }
  status('Random seeds placed');
};
document.getElementById('btnReset').onclick = () => {
  grid.fill(0);
  status('Field reset');
};
document.getElementById('btnExport').onclick = () => {
  const data = { agents: agents.map(a => ({w1:a.w1,b1:a.b1,w2:a.w2,b2:a.b2})), occupied: Array.from(grid).filter(v=>v>0.5).length };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f678-percolation-genome.json';
  a.click();
};

// Simulation
function step() {
  // Compute local influence
  const pMap = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const idx = y*GW + x;
      const px = x / GW, py = y / GH;
      const dist = Math.hypot(px - pointerX, py - pointerY);
      const inp = [tiltX, tiltY, Math.min(1, dist*2), density[idx] || 0];
      // Blend agents by proximity to pointer (simple)
      let best = 0, bd = 1e9;
      for (let a = 0; a < N_AGENTS; a++) {
        const ad = Math.abs(a/N_AGENTS - pointerX);
        if (ad < bd) { bd = ad; best = a; }
      }
      const out = forward(agents[best], inp);
      pMap[idx] = out[0] * 0.15 + 0.02; // growth probability
    }
  }
  // Percolation growth
  const next = new Float32Array(grid);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const idx = y*GW + x;
      if (grid[idx] > 0.5) continue;
      let neigh = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx===0 && dy===0) continue;
        const nx = x+dx, ny = y+dy;
        if (nx>=0 && nx<GW && ny>=0 && ny<GH && grid[ny*GW+nx] > 0.5) neigh++;
      }
      if (neigh > 0 && Math.random() < pMap[idx] * (1 + neigh*0.3)) {
        next[idx] = 1;
      }
    }
  }
  grid = next;
  // Density (simple blur)
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x+dx, ny = y+dy;
      if (nx>=0 && nx<GW && ny>=0 && ny<GH) { s += grid[ny*GW+nx]; c++; }
    }
    density[y*GW+x] = s / c;
  }
  // Move portals toward high density
  for (const p of portals) {
    let bestD = 0, bx = p.x, by = p.y;
    for (let i = 0; i < 8; i++) {
      const sx = Math.floor(Math.random()*GW), sy = Math.floor(Math.random()*GH);
      const d = density[sy*GW+sx];
      if (d > bestD) { bestD = d; bx = sx/GW; by = sy/GH; }
    }
    p.vx += (bx - p.x) * 0.02;
    p.vy += (by - p.y) * 0.02;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(0.05, Math.min(0.95, p.x));
    p.y = Math.max(0.05, Math.min(0.95, p.y));
    p.el.style.left = (p.x * W - 60) + 'px';
    p.el.style.top = (p.y * H - 40) + 'px';
    p.el.textContent = `Portal\n dens ${(bestD*100).toFixed(0)}%`;
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const cw = W / GW, ch = H / GH;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const v = grid[y*GW + x];
      if (v > 0.5) {
        const d = density[y*GW + x];
        ctx.fillStyle = `hsl(${200 + d*80}, 70%, ${40 + d*40}%)`;
        ctx.fillRect(x*cw, y*ch, cw+1, ch+1);
      }
    }
  }
}

async function init() {
  try { db = await openDB(); const saved = await loadGenome(); if (saved) { agents[0].w1 = saved.w1; agents[0].b1 = saved.b1; agents[0].w2 = saved.w2; agents[0].b2 = saved.b2; status('Restored sealed genome'); } } catch(e) { status('IDB unavailable'); }
  // Initial seeds
  for (let i = 0; i < 5; i++) grid[Math.floor(Math.random()*GW*GH)] = 1;
  function loop() {
    step();
    render();
    requestAnimationFrame(loop);
  }
  loop();
}
init();
