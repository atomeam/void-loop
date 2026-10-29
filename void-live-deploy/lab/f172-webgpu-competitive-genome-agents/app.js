const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W, H;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const NUM_AGENTS = 6;
const NUM_FOOD = 40;
const agents = [];
const foods = [];
let pointer = { x: W/2, y: H/2 };
let frame = 0;
let db = null;

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Tiny MLP genome: 6 inputs → 4 hidden → 2 outputs (ax, ay)
function createGenome() {
  return new Float32Array(6*4 + 4*2 + 4 + 2).map(() => rand(-0.5, 0.5));
}
function mlpForward(genome, inputs) {
  const h = 4;
  const w1 = genome.subarray(0, 6*h);
  const b1 = genome.subarray(6*h, 6*h + h);
  const w2 = genome.subarray(6*h + h, 6*h + h + h*2);
  const b2 = genome.subarray(6*h + h + h*2);
  const hidden = new Float32Array(h);
  for (let i = 0; i < h; i++) {
    let s = b1[i];
    for (let j = 0; j < 6; j++) s += inputs[j] * w1[i*6 + j];
    hidden[i] = Math.tanh(s);
  }
  const out = [b2[0], b2[1]];
  for (let i = 0; i < 2; i++) {
    let s = b2[i];
    for (let j = 0; j < h; j++) s += hidden[j] * w2[i*h + j];
    out[i] = Math.tanh(s);
  }
  return out;
}

function init() {
  agents.length = 0;
  foods.length = 0;
  for (let i = 0; i < NUM_AGENTS; i++) {
    agents.push({
      x: rand(50, W-50), y: rand(50, H-50),
      vx: 0, vy: 0,
      energy: 50 + rand(0, 20),
      genome: createGenome(),
      color: `hsl(${i * 60}, 70%, 60%)`,
      id: i
    });
  }
  for (let i = 0; i < NUM_FOOD; i++) {
    foods.push({ x: rand(20, W-20), y: rand(20, H-20), energy: 8 + rand(0, 4) });
  }
}

function update() {
  frame++;
  // Respawn food
  if (foods.length < NUM_FOOD && frame % 30 === 0) {
    foods.push({ x: rand(20, W-20), y: rand(20, H-20), energy: 8 + rand(0, 4) });
  }
  // Agent update
  for (const a of agents) {
    // Features: nearest food dx/dy, nearest other agent dx/dy, energy norm, pointer dx
    let nf = null, nd = 1e9;
    for (const f of foods) {
      const d = Math.hypot(f.x - a.x, f.y - a.y);
      if (d < nd) { nd = d; nf = f; }
    }
    let no = null, nod = 1e9;
    for (const o of agents) if (o !== a) {
      const d = Math.hypot(o.x - a.x, o.y - a.y);
      if (d < nod) { nod = d; no = o; }
    }
    const inputs = [
      nf ? (nf.x - a.x) / 200 : 0,
      nf ? (nf.y - a.y) / 200 : 0,
      no ? (no.x - a.x) / 200 : 0,
      no ? (no.y - a.y) / 200 : 0,
      a.energy / 100,
      (pointer.x - a.x) / 300
    ];
    const [ax, ay] = mlpForward(a.genome, inputs);
    a.vx = a.vx * 0.85 + ax * 1.2;
    a.vy = a.vy * 0.85 + ay * 1.2;
    a.x = clamp(a.x + a.vx, 10, W-10);
    a.y = clamp(a.y + a.vy, 10, H-10);
    a.energy = Math.max(0, a.energy - 0.15);
    // Collect food
    if (nf && nd < 18) {
      a.energy += nf.energy;
      foods.splice(foods.indexOf(nf), 1);
    }
  }
  // Competition / transfer every 180 frames
  if (frame % 180 === 0 && agents.length > 1) {
    const sorted = [...agents].sort((a, b) => b.energy - a.energy);
    const winner = sorted[0];
    for (let i = 2; i < sorted.length; i++) { // transfer to bottom half-ish
      const loser = sorted[i];
      // Sealed transfer: copy genome with mutation
      for (let k = 0; k < loser.genome.length; k++) {
        loser.genome[k] = winner.genome[k] + rand(-0.15, 0.15);
      }
      loser.energy = Math.max(20, loser.energy * 0.5);
    }
    // Mild energy decay for all to keep competition
    for (const a of agents) a.energy *= 0.95;
  }
}

function draw() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, W, H);
  // Food
  ctx.fillStyle = '#ffcc44';
  for (const f of foods) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, 4, 0, Math.PI*2);
    ctx.fill();
  }
  // Agents
  for (const a of agents) {
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 8 + a.energy / 20, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Energy bar
    ctx.fillStyle = '#333';
    ctx.fillRect(a.x - 15, a.y - 18, 30, 4);
    ctx.fillStyle = a.color;
    ctx.fillRect(a.x - 15, a.y - 18, Math.min(30, a.energy / 3), 4);
  }
  // Pointer hint
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI*2);
  ctx.stroke();
}

function loop() {
  update();
  draw();
  // Status
  if (frame % 10 === 0) {
    const sorted = [...agents].sort((a, b) => b.energy - a.energy);
    let s = `Frame ${frame}\n`;
    sorted.forEach((a, i) => {
      s += `#${a.id} E:${a.energy.toFixed(1)} G:${hashGenome(a.genome).slice(0,6)}\n`;
    });
    statusEl.textContent = s + (db ? 'IDB ready' : 'IDB pending');
  }
  requestAnimationFrame(loop);
}

function hashGenome(g) {
  let h = 0;
  for (let i = 0; i < g.length; i++) h = ((h << 5) - h + Math.floor(g[i]*1000)) | 0;
  return Math.abs(h).toString(16);
}

// IndexedDB
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('void-f172-genomes', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('genomes')) db.createObjectStore('genomes', { keyPath: 'id' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej(req.error);
  });
}
async function sealBest() {
  if (!db) return;
  const best = agents.reduce((a, b) => a.energy > b.energy ? a : b);
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({
    id: 'best',
    genome: Array.from(best.genome),
    energy: best.energy,
    hash: hashGenome(best.genome),
    ts: Date.now()
  });
  statusEl.textContent += '\nSealed best genome.';
}
async function loadSealed() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const req = tx.objectStore('genomes').get('best');
  req.onsuccess = () => {
    if (req.result && agents.length) {
      const g = new Float32Array(req.result.genome);
      // Seed one agent with sealed
      agents[0].genome.set(g);
      statusEl.textContent += '\nLoaded sealed genome into agent 0.';
    }
  };
}

canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
});
canvas.addEventListener('pointerdown', e => {
  // Spawn food or boost nearest agent
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  foods.push({ x, y, energy: 15 });
  // Boost nearest
  let best = null, bd = 1e9;
  for (const a of agents) {
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < bd) { bd = d; best = a; }
  }
  if (best && bd < 80) best.energy += 20;
});

document.getElementById('seal').onclick = sealBest;
document.getElementById('reset').onclick = () => { init(); statusEl.textContent = 'Reset.'; };
document.getElementById('transfer').onclick = () => {
  if (agents.length < 2) return;
  const sorted = [...agents].sort((a, b) => b.energy - a.energy);
  const w = sorted[0], l = sorted[sorted.length-1];
  for (let k = 0; k < l.genome.length; k++) l.genome[k] = w.genome[k] + rand(-0.1, 0.1);
  statusEl.textContent += '\nForced transfer to lowest.';
};

// WebGPU probe (optional path note; main loop is Canvas2D for reliability)
if (navigator.gpu) {
  statusEl.textContent = 'WebGPU available (compute path reserved for next iteration). Canvas2D active.';
} else {
  statusEl.textContent = 'Canvas2D mode.';
}

openDB().then(d => { db = d; loadSealed(); }).catch(() => { statusEl.textContent += '\nIDB unavailable.'; });
init();
loop();
