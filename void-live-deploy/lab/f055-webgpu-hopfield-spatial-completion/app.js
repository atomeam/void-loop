const N = 32, NN = N * N;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = new Float32Array(NN * NN); // weights, symmetric
let spins = new Int8Array(NN).fill(-1);
let patterns = []; // up to 8 stored
let recalling = false;
let energy = 0;
let residual = 1;
const portals = [0,1,2].map(i => document.getElementById('p'+i));

function resize() {
  cv.width = innerWidth; cv.height = innerHeight;
}
addEventListener('resize', resize); resize();

function idx(x, y) { return y * N + x; }
function setSpin(i, v) { spins[i] = v > 0 ? 1 : -1; }

function drawCanvas() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const cell = Math.min(cv.width, cv.height) / (N + 2);
  const ox = (cv.width - cell * N) / 2;
  const oy = (cv.height - cell * N) / 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const s = spins[idx(x, y)];
      ctx.fillStyle = s > 0 ? `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--completion-hue')}, 70%, 55%)` : '#1a1a28';
      ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
    }
  }
  // simple particle overlay on positive spins
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  for (let i = 0; i < NN; i += 7) {
    if (spins[i] > 0) {
      const x = (i % N) * cell + ox + cell/2;
      const y = Math.floor(i / N) * cell + oy + cell/2;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
    }
  }
}

function computeEnergy() {
  let e = 0;
  for (let i = 0; i < NN; i++) {
    let h = 0;
    for (let j = 0; j < NN; j++) h += W[i * NN + j] * spins[j];
    e -= spins[i] * h;
  }
  return e / 2;
}

function hebbianStore() {
  if (patterns.length >= 8) patterns.shift();
  const p = spins.slice();
  patterns.push(p);
  // outer product update (simple, clipped)
  for (let i = 0; i < NN; i++) {
    for (let j = i + 1; j < NN; j++) {
      const d = p[i] * p[j] * 0.05;
      W[i * NN + j] = Math.max(-1, Math.min(1, W[i * NN + j] + d));
      W[j * NN + i] = W[i * NN + j];
    }
  }
  updateStatus();
}

function overlap(a, b) {
  let o = 0;
  for (let i = 0; i < NN; i++) o += a[i] * b[i];
  return o / NN;
}

function bestResidual() {
  if (!patterns.length) return 1;
  let maxO = -1;
  for (const p of patterns) {
    const o = overlap(spins, p);
    if (o > maxO) maxO = o;
  }
  return Math.max(0, 1 - maxO);
}

async function recall() {
  if (recalling) return;
  recalling = true;
  let steps = 0;
  const maxSteps = 400;
  while (steps < maxSteps) {
    // random asynchronous update
    const i = (Math.random() * NN) | 0;
    let h = 0;
    for (let j = 0; j < NN; j++) h += W[i * NN + j] * spins[j];
    const newS = h >= 0 ? 1 : -1;
    if (newS !== spins[i]) spins[i] = newS;
    steps++;
    if (steps % 40 === 0) {
      energy = computeEnergy();
      residual = bestResidual();
      document.documentElement.style.setProperty('--completion-hue', String(180 + residual * 120));
      document.documentElement.style.setProperty('--residual-scale', String(0.8 + residual * 0.6));
      updatePortals();
      drawCanvas();
      updateStatus();
      await new Promise(r => setTimeout(r, 16));
    }
  }
  energy = computeEnergy();
  residual = bestResidual();
  recalling = false;
  updatePortals();
  drawCanvas();
  updateStatus();
}

function updatePortals() {
  // place portals near centroids of active regions (simple thirds)
  const cell = Math.min(cv.width, cv.height) / (N + 2);
  const ox = (cv.width - cell * N) / 2;
  const oy = (cv.height - cell * N) / 2;
  portals.forEach((p, pi) => {
    let cx = 0, cy = 0, cnt = 0;
    const x0 = (pi * N / 3) | 0, x1 = ((pi + 1) * N / 3) | 0;
    for (let y = 0; y < N; y++) for (let x = x0; x < x1; x++) {
      if (spins[idx(x, y)] > 0) { cx += x; cy += y; cnt++; }
    }
    if (cnt) {
      p.style.left = (ox + (cx / cnt) * cell) + 'px';
      p.style.top = (oy + (cy / cnt) * cell) + 'px';
    }
    p.innerHTML = `portal ${pi}<br>res: ${residual.toFixed(2)}`;
  });
}

function updateStatus() {
  document.getElementById('status').textContent =
    `mem:${patterns.length} energy:${energy.toFixed(0)} residual:${residual.toFixed(2)} ${recalling ? 'recalling…' : ''}`;
}

// drawing
let drawing = false;
cv.addEventListener('pointerdown', e => { drawing = true; paint(e); });
cv.addEventListener('pointermove', e => { if (drawing) paint(e); });
addEventListener('pointerup', () => drawing = false);

function paint(e) {
  const rect = cv.getBoundingClientRect();
  const cell = Math.min(cv.width, cv.height) / (N + 2);
  const ox = (cv.width - cell * N) / 2;
  const oy = (cv.height - cell * N) / 2;
  const x = Math.floor((e.clientX - rect.left - ox) / cell);
  const y = Math.floor((e.clientY - rect.top - oy) / cell);
  if (x >= 0 && x < N && y >= 0 && y < N) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < N && yy >= 0 && yy < N) setSpin(idx(xx, yy), 1);
    }
    drawCanvas();
  }
}

// portals drag
portals.forEach(p => {
  let ox, oy;
  p.addEventListener('pointerdown', e => {
    ox = e.clientX - p.offsetLeft; oy = e.clientY - p.offsetTop;
    p.setPointerCapture(e.pointerId);
  });
  p.addEventListener('pointermove', e => {
    if (p.hasPointerCapture(e.pointerId)) {
      p.style.left = (e.clientX - ox) + 'px';
      p.style.top = (e.clientY - oy) + 'px';
    }
  });
  p.addEventListener('click', () => hebbianStore());
});

document.getElementById('store').onclick = hebbianStore;
document.getElementById('recall').onclick = recall;
document.getElementById('clear').onclick = () => { spins.fill(-1); drawCanvas(); residual = 1; updateStatus(); };
document.getElementById('seal').onclick = seal;

// IndexedDB seal
const DB = 'f055-hopfield';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put({ weights: Array.from(W), patterns: patterns.map(p => Array.from(p)), ts: Date.now() }, 'main');
    await new Promise(r => tx.oncomplete = r);
    document.getElementById('status').textContent += ' sealed';
  } catch (e) { console.warn(e); }
}
async function loadSeal() {
  try {
    const db = await openDB();
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('main');
    req.onsuccess = () => {
      const d = req.result;
      if (d && d.weights) {
        W.set(d.weights);
        patterns = (d.patterns || []).map(a => Int8Array.from(a));
        updateStatus();
      }
    };
  } catch (e) {}
}

// init
loadSeal();
drawCanvas();
updatePortals();
updateStatus();

// optional WebGPU note: if navigator.gpu, could offload parallel field updates; pure JS path is the working core.
