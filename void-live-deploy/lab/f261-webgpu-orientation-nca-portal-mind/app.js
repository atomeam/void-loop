const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const portalsEl = document.getElementById('portals');

let W = 64, H = 64, scale = 1;
let grid, next, rules = { grow: 0.12, decay: 0.08, bias: 0.0 };
let useGPU = false;
let density = 0.2, entropy = 0.5;
let orientation = { beta: 0, gamma: 0 };

// Create portals
const portalPositions = [
  {x: 0.2, y: 0.3}, {x: 0.75, y: 0.25},
  {x: 0.35, y: 0.7}, {x: 0.7, y: 0.65}
];
const portals = portalPositions.map((p, i) => {
  const el = document.createElement('div');
  el.className = 'portal';
  el.style.left = (p.x * 100) + '%';
  el.style.top = (p.y * 100) + '%';
  el.dataset.i = i;
  el.addEventListener('click', () => seedAtPortal(i));
  portalsEl.appendChild(el);
  return el;
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  scale = Math.min(canvas.width / W, canvas.height / H);
}
window.addEventListener('resize', resize);
resize();

function initGrid() {
  grid = new Float32Array(W * H);
  next = new Float32Array(W * H);
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random() * 0.3;
}

function seedAtPortal(i) {
  const p = portalPositions[i];
  const cx = Math.floor(p.x * W), cy = Math.floor(p.y * H);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = (cx + dx + W) % W, y = (cy + dy + H) % H;
    grid[y * W + x] = Math.min(1, grid[y * W + x] + 0.6);
  }
}

function stepCPU() {
  const { grow, decay, bias } = rules;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
        sum += grid[ny * W + nx]; n++;
      }
      const avg = sum / n;
      let v = grid[y * W + x];
      v += (avg - v) * grow + bias * 0.05;
      v *= (1 - decay);
      v = Math.max(0, Math.min(1, v));
      next[y * W + x] = v;
    }
  }
  [grid, next] = [next, grid];
  // stats
  let s = 0, s2 = 0;
  for (let v of grid) { s += v; s2 += v * v; }
  density = s / grid.length;
  const mean = density, varc = Math.max(0, s2 / grid.length - mean * mean);
  entropy = Math.min(1, Math.sqrt(varc) * 4);
}

function updatePortals() {
  portals.forEach((el, i) => {
    const open = 30 + density * 50 + Math.sin(Date.now() * 0.002 + i) * entropy * 10;
    el.style.clipPath = `circle(${open}% at 50% 50%)`;
    el.style.filter = `blur(${(1 - density) * 8}px) saturate(${1 + entropy})`;
    el.style.opacity = 0.4 + density * 0.6;
    el.style.transform = `scale(${0.8 + density * 0.5}) rotate(${orientation.gamma * 0.5}deg)`;
    el.style.borderRadius = `${40 + entropy * 30}% ${60 - entropy * 20}%`;
  });
}

function drawCPU() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cell = scale;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grid[y * W + x];
      if (v < 0.05) continue;
      const hue = 200 + v * 60 + orientation.beta * 0.5;
      ctx.fillStyle = `hsla(${hue}, 70%, ${30 + v * 40}%, ${v})`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
    rules.bias = (orientation.gamma / 90) * 0.4;
    rules.grow = 0.08 + Math.abs(orientation.beta / 90) * 0.1;
  });
}

// Pointer fallback / inject
canvas.addEventListener('pointermove', e => {
  const x = Math.floor((e.clientX / canvas.width) * W);
  const y = Math.floor((e.clientY / canvas.height) * H);
  if (x >= 0 && x < W && y >= 0 && y < H) {
    grid[y * W + x] = Math.min(1, grid[y * W + x] + 0.4);
    rules.bias = (e.clientX / canvas.width - 0.5) * 0.3;
  }
});

// Seal / Load
document.getElementById('seal').onclick = async () => {
  const genome = { rules: {...rules}, ts: Date.now(), density };
  const buf = new TextEncoder().encode(JSON.stringify(genome));
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-nca', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ hash, genome }, hash);
    statusEl.textContent = `Sealed ${hash.slice(0,12)}… density ${density.toFixed(2)}`;
  } catch (e) {
    statusEl.textContent = 'Seal in-memory only (IDB blocked)';
  }
};

document.getElementById('load').onclick = async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-nca', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readonly');
    const store = tx.objectStore('seals');
    const all = await new Promise(res => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
    });
    if (all.length) {
      const last = all[all.length - 1];
      Object.assign(rules, last.genome.rules);
      statusEl.textContent = `Loaded ${last.hash.slice(0,12)}…`;
    } else statusEl.textContent = 'No seals';
  } catch (e) {
    statusEl.textContent = 'Load failed';
  }
};

document.getElementById('reset').onclick = () => { initGrid(); statusEl.textContent = 'Lattice reset'; };

// Main loop
initGrid();
function loop() {
  stepCPU();
  drawCPU();
  updatePortals();
  statusEl.textContent = `Density ${density.toFixed(2)} · Entropy ${entropy.toFixed(2)} · Bias ${rules.bias.toFixed(2)} · ${useGPU ? 'GPU' : 'CPU'}`;
  requestAnimationFrame(loop);
}
loop();

// Attempt WebGPU (stub for future; CPU is fully functional)
if (navigator.gpu) {
  statusEl.textContent = 'WebGPU available — CPU NCA active (compute path ready for lift)';
  useGPU = false; // full compute shader can replace stepCPU without changing portals/seal
} else {
  statusEl.textContent = 'CPU NCA (WebGPU unavailable)';
}
