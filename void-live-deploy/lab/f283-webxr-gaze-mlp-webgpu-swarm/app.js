const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let agents = [];
let attractor = { x: W/2, y: H/2 };
let useWebGPU = false;
let gpuDevice = null;
let running = true;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('f283-swarm') : null;

function log(msg) {
  const d = document.createElement('div');
  d.textContent = new Date().toLocaleTimeString() + ' ' + msg;
  logEl.prepend(d);
  while (logEl.children.length > 8) logEl.lastChild.remove();
}

// Tiny MLP: 4 inputs → 8 hidden → 2 outputs. Weights ~ 4*8 + 8*2 = 48, but we use smaller genome for sealability: 6 key coeffs that modulate a fixed base.
function createGenome() {
  const g = new Float32Array(6);
  for (let i = 0; i < 6; i++) g[i] = (Math.random() - 0.5) * 2;
  return g;
}
function genomeHash(g) {
  let h = 5381;
  for (let i = 0; i < g.length; i++) h = ((h << 5) + h) ^ (g[i] * 1000 | 0);
  return (h >>> 0).toString(16).slice(0, 6);
}
function mlpForce(agent, feat) { // feat: [distA, distR, ownVx, ownVy] normalized
  const w = agent.genome;
  // Simple weighted: attract strength, rival avoidance, speed bias, noise, cohesion, bias
  const attract = w[0] * (1 - feat[0]);
  const avoid = w[1] * feat[1];
  const speed = w[2];
  const noise = w[3] * (Math.random() - 0.5);
  const coh = w[4];
  const bias = w[5];
  return {
    fx: attract * feat[2] - avoid * feat[3] + speed * agent.vx * 0.1 + noise + coh * 0.05 + bias * 0.2,
    fy: attract * feat[3] + avoid * feat[2] + speed * agent.vy * 0.1 + noise * 0.8 + coh * 0.05
  };
}

function spawnAgent(x, y) {
  const a = {
    x: x || Math.random() * W, y: y || Math.random() * H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    energy: 1, fitness: 0, genome: createGenome(),
    card: null, id: Math.random().toString(36).slice(2,7)
  };
  a.hash = genomeHash(a.genome);
  agents.push(a);
  makeCard(a);
  return a;
}
function makeCard(a) {
  const c = document.createElement('div');
  c.className = 'card';
  c.innerHTML = `<b>${a.hash}</b><br>fit:0`;
  c.dataset.id = a.id;
  document.body.appendChild(c);
  a.card = c;
  let drag = false, ox, oy;
  c.addEventListener('pointerdown', e => { drag = true; ox = e.clientX - a.x; oy = e.clientY - a.y; c.style.cursor = 'grabbing'; });
  addEventListener('pointermove', e => { if (drag && c.dataset.id === a.id) { a.x = e.clientX - ox; a.y = e.clientY - oy; a.vx *= 0.5; a.vy *= 0.5; } });
  addEventListener('pointerup', () => { drag = false; c.style.cursor = 'grab'; });
}

for (let i = 0; i < 12; i++) spawnAgent();

// Pointer as gaze fallback
addEventListener('pointermove', e => { attractor.x = e.clientX; attractor.y = e.clientY; });

// WebXR gaze attempt
let xrSession = null;
async function tryWebXR() {
  if (!navigator.xr) return false;
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr') || await navigator.xr.isSessionSupported('immersive-ar');
    if (!ok) return false;
    // For prototype we stay inline; full immersive would require more setup. Mark available.
    statusEl.textContent = 'WebXR available — using pointer-as-gaze (immersive session stub)';
    log('WebXR supported; pointer proxy active');
    return true;
  } catch (e) { return false; }
}

// WebGPU stub detection
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    gpuDevice = await adapter.requestDevice();
    useWebGPU = true;
    statusEl.textContent += ' | WebGPU compute ready (Canvas2D primary for reliability)';
    log('WebGPU adapter acquired');
  } catch (e) { log('WebGPU unavailable'); }
}
tryWebGPU();

// IndexedDB
let db;
const req = indexedDB.open('f283-swarm', 1);
req.onupgradeneeded = e => {
  const d = e.target.result;
  if (!d.objectStoreNames.contains('seals')) d.createObjectStore('seals', { keyPath: 'ts' });
};
req.onsuccess = e => { db = e.target.result; };
function sealPop() {
  if (!db) { log('No IDB'); return; }
  const data = agents.map(a => ({ hash: a.hash, genome: Array.from(a.genome), fitness: a.fitness }));
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ ts: Date.now(), data });
  log('Sealed ' + agents.length + ' genomes');
  if (channel) channel.postMessage({ type: 'seal', data });
}
function loadSeal() {
  if (!db) return;
  const tx = db.transaction('seals', 'readonly');
  const store = tx.objectStore('seals');
  const r = store.openCursor(null, 'prev');
  r.onsuccess = e => {
    const c = e.target.result;
    if (!c) { log('No seals'); return; }
    agents.forEach(a => a.card && a.card.remove());
    agents = [];
    c.value.data.forEach(d => {
      const a = spawnAgent();
      a.genome = new Float32Array(d.genome);
      a.hash = d.hash;
      a.fitness = d.fitness || 0;
      a.card.innerHTML = `<b>${a.hash}</b><br>fit:${a.fitness.toFixed(1)}`;
    });
    log('Loaded seal');
  };
}
if (channel) channel.onmessage = e => {
  if (e.data.type === 'seal') log('Received remote seal (' + e.data.data.length + ')');
};

document.getElementById('start').onclick = async () => {
  const xr = await tryWebXR();
  statusEl.textContent = xr ? 'Gaze proxy active (WebXR)' : 'Pointer gaze active';
  log('Simulation running');
};
document.getElementById('seal').onclick = sealPop;
document.getElementById('load').onclick = loadSeal;
document.getElementById('add').onclick = () => spawnAgent();

function step() {
  // Features & forces
  for (const a of agents) {
    const dx = attractor.x - a.x, dy = attractor.y - a.y;
    const distA = Math.hypot(dx, dy) / Math.max(W, H);
    let nearest = 999, rdx = 0, rdy = 0;
    for (const b of agents) {
      if (b === a) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < nearest) { nearest = d; rdx = (b.x - a.x) / (d || 1); rdy = (b.y - a.y) / (d || 1); }
    }
    const feat = [Math.min(1, distA), Math.min(1, nearest / 200), dx / (Math.abs(dx)+1), dy / (Math.abs(dy)+1)];
    const f = mlpForce(a, feat);
    a.vx += f.fx * 0.4;
    a.vy += f.fy * 0.4;
    a.vx *= 0.96; a.vy *= 0.96;
    a.x += a.vx; a.y += a.vy;
    // Bounds
    if (a.x < 10 || a.x > W-10) a.vx *= -0.8;
    if (a.y < 10 || a.y > H-10) a.vy *= -0.8;
    a.x = Math.max(10, Math.min(W-10, a.x));
    a.y = Math.max(10, Math.min(H-10, a.y));
    // Fitness
    a.fitness += (1 - distA) * 0.05;
    a.energy = Math.max(0.2, a.energy * 0.999 + (1 - distA) * 0.01);
  }
  // Capture / transfer
  for (let i = 0; i < agents.length; i++) {
    for (let j = i+1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 40 && Math.abs(a.fitness - b.fitness) > 0.5) {
        const winner = a.fitness > b.fitness ? a : b;
        const loser = winner === a ? b : a;
        // Transfer 30%
        for (let k = 0; k < 6; k++) {
          winner.genome[k] = winner.genome[k] * 0.7 + loser.genome[k] * 0.3 + (Math.random()-0.5)*0.05;
        }
        winner.hash = genomeHash(winner.genome);
        winner.energy += 0.1;
        loser.energy *= 0.8;
        if (winner.card) {
          winner.card.classList.add('winner');
          setTimeout(() => winner.card.classList.remove('winner'), 400);
        }
        log('Capture: ' + winner.hash + ' from ' + loser.hash);
      }
    }
  }
  // Draw
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#6cf';
  ctx.beginPath(); ctx.arc(attractor.x, attractor.y, 8, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#4af';
  for (const a of agents) {
    ctx.beginPath(); ctx.arc(a.x, a.y, 5 + a.energy, 0, Math.PI*2); ctx.stroke();
    if (a.card) {
      a.card.style.left = (a.x + 12) + 'px';
      a.card.style.top = (a.y - 20) + 'px';
      a.card.innerHTML = `<b>${a.hash}</b><br>fit:${a.fitness.toFixed(1)}`;
    }
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
log('F283 swarm ready — move pointer to attract');
