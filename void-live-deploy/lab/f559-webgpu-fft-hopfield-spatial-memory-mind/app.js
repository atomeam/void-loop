const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 32; // spectrum bins / Hopfield neurons
let patterns = []; // stored spectra
let weights = new Float32Array(N * N); // Hopfield weights
let state = new Float32Array(N).fill(0);
let traj = []; // recent velocity samples
const TRAJ_LEN = 128;

const particles = [];
const PCOUNT = 800;
for (let i = 0; i < PCOUNT; i++) {
  particles.push({
    x: Math.random() * W, y: Math.random() * H,
    vx: 0, vy: 0, hue: Math.random() * 360
  });
}

function hebbianAdd(pat) {
  // outer product, zero diagonal
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i !== j) weights[i * N + j] += pat[i] * pat[j];
    }
  }
  // normalize roughly
  let max = 0;
  for (let v of weights) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < weights.length; i++) weights[i] /= max;
}

function hopfieldStep() {
  const next = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) sum += weights[i * N + j] * state[j];
    next[i] = Math.tanh(sum);
  }
  state.set(next);
}

function simpleFFT(samples) {
  // naive DFT for magnitude spectrum, real input
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const len = Math.min(samples.length, TRAJ_LEN);
  for (let k = 0; k < N; k++) {
    let r = 0, imv = 0;
    for (let n = 0; n < len; n++) {
      const ang = -2 * Math.PI * k * n / len;
      r += samples[n] * Math.cos(ang);
      imv += samples[n] * Math.sin(ang);
    }
    re[k] = r; im[k] = imv;
  }
  const mag = new Float32Array(N);
  let max = 0;
  for (let k = 0; k < N; k++) {
    mag[k] = Math.sqrt(re[k]*re[k] + im[k]*im[k]);
    max = Math.max(max, mag[k]);
  }
  if (max > 0) for (let k = 0; k < N; k++) mag[k] = mag[k] / max * 2 - 1; // to [-1,1]
  return mag;
}

let lastX = 0, lastY = 0, drawing = false;
canvas.addEventListener('pointerdown', e => { drawing = true; lastX = e.clientX; lastY = e.clientY; traj = []; });
canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  const speed = Math.hypot(dx, dy);
  traj.push(speed);
  if (traj.length > TRAJ_LEN) traj.shift();
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => {
  drawing = false;
  if (traj.length > 16) {
    const spec = simpleFFT(traj);
    patterns.push(spec);
    if (patterns.length > 8) patterns.shift();
    // rebuild weights from all patterns
    weights.fill(0);
    for (const p of patterns) hebbianAdd(p);
    statusEl.textContent = `Stored spectral memory #${patterns.length}. Total patterns: ${patterns.length}`;
  }
});

document.getElementById('recall').onclick = () => {
  if (patterns.length === 0) return;
  const p = patterns[Math.floor(Math.random() * patterns.length)];
  state.set(p);
  statusEl.textContent = 'Forced recall of a stored spectrum';
};
document.getElementById('clear').onclick = () => {
  patterns = []; weights.fill(0); state.fill(0);
  statusEl.textContent = 'Memory cleared';
};

const DB_NAME = 'f559-hopfield-memory';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('mem');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('mem', 'readwrite');
    tx.objectStore('mem').put({ weights: Array.from(weights), patterns: patterns.map(p => Array.from(p)), ts: Date.now() }, 'main');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (in-memory only)'; }
}
document.getElementById('seal').onclick = seal;

async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction('mem', 'readonly');
    const req = tx.objectStore('mem').get('main');
    await new Promise(r => req.onsuccess = r);
    if (req.result) {
      weights.set(req.result.weights);
      patterns = req.result.patterns.map(p => new Float32Array(p));
      statusEl.textContent = `Loaded ${patterns.length} memories from IndexedDB`;
    }
  } catch (e) { console.warn('f559-webgpu-fft-hopfield-spatial-memory-mind:', e); }
}
load();

let idle = 0;
function loop() {
  requestAnimationFrame(loop);
  if (!drawing) idle++;
  else idle = 0;
  if (idle > 60 && patterns.length > 0 && Math.random() < 0.02) {
    hopfieldStep();
  }
  // drive particles from state
  const energy = state.reduce((s, v) => s + v*v, 0) / N;
  const hueBias = state[0] * 60;
  const speedBias = 0.5 + energy * 2;
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    const ang = Math.atan2(p.vy, p.vx) + state[Math.floor(Math.random()*N)] * 0.3;
    p.vx = Math.cos(ang) * speedBias + (Math.random()-0.5)*0.5;
    p.vy = Math.sin(ang) * speedBias + (Math.random()-0.5)*0.5;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    p.hue = (p.hue + hueBias * 0.1) % 360;
    ctx.fillStyle = `hsla(${p.hue},70%,60%,0.7)`;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}
loop();

// Optional WebGPU probe (particles remain Canvas2D for reliability)
if (navigator.gpu) {
  statusEl.textContent += ' | WebGPU available (fallback path active)';
}
