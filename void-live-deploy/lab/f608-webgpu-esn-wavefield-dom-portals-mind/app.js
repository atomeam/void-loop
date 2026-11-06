const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const sealBtn = document.getElementById('seal');

let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// --- Echo State Network ---
const R = 64; // reservoir size
const I = 4;  // inputs: vx, vy, tiltX, tiltY
let Win = new Float32Array(R * I);
let Wres = new Float32Array(R * R);
let Wout = new Float32Array(3 * R); // outputs: c, gamma, forceAmp
let state = new Float32Array(R);
let leak = 0.3;
let spectral = 0.85;

function rand(n) { return (Math.random() * 2 - 1) * n; }
function initESN() {
  for (let i = 0; i < Win.length; i++) Win[i] = rand(0.5);
  for (let i = 0; i < Wres.length; i++) Wres[i] = rand(0.2);
  // rough spectral radius scaling (simple)
  for (let i = 0; i < Wres.length; i++) Wres[i] *= spectral;
  for (let i = 0; i < Wout.length; i++) Wout[i] = rand(0.01);
}

function esnStep(input) {
  const next = new Float32Array(R);
  for (let i = 0; i < R; i++) {
    let s = 0;
    for (let j = 0; j < I; j++) s += Win[i * I + j] * input[j];
    for (let j = 0; j < R; j++) s += Wres[i * R + j] * state[j];
    next[i] = Math.tanh(s);
  }
  for (let i = 0; i < R; i++) state[i] = (1 - leak) * state[i] + leak * next[i];
  // readout
  const out = [0, 0, 0];
  for (let o = 0; o < 3; o++) {
    for (let j = 0; j < R; j++) out[o] += Wout[o * R + j] * state[j];
  }
  return out.map(v => Math.tanh(v));
}

// simple online LMS-ish on energy prediction (very light)
function updateReadout(targetEnergy) {
  const pred = state.reduce((a, b) => a + b * b, 0) / R;
  const err = targetEnergy - pred;
  const lr = 0.001;
  for (let j = 0; j < R; j++) Wout[j] += lr * err * state[j]; // only first output for demo
}

// --- Wave field (CPU fallback; WebGPU stub noted) ---
const GRID = 96;
let u = new Float32Array(GRID * GRID);
let uprev = new Float32Array(GRID * GRID);
let unext = new Float32Array(GRID * GRID);
let c = 0.6, gamma = 0.02, forceAmp = 0.1;

function idx(x, y) { return y * GRID + x; }
function waveStep() {
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const i = idx(x, y);
      const lap = u[idx(x-1,y)] + u[idx(x+1,y)] + u[idx(x,y-1)] + u[idx(x,y+1)] - 4 * u[i];
      unext[i] = (2 - gamma) * u[i] - (1 - gamma) * uprev[i] + c * c * lap;
      // soft clamp
      unext[i] = Math.max(-2, Math.min(2, unext[i]));
    }
  }
  // swap
  [uprev, u, unext] = [u, unext, uprev];
}

function inject(gx, gy, amp) {
  const x = Math.floor(gx * GRID);
  const y = Math.floor(gy * GRID);
  if (x > 1 && x < GRID-2 && y > 1 && y < GRID-2) {
    u[idx(x, y)] += amp;
  }
}

// --- Portals ---
const portals = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal ' + (i+1);
  el.style.left = (20 + i * 15) + '%';
  el.style.top = (30 + (i % 2) * 20) + '%';
  document.body.appendChild(el);
  portals.push({ el, x: 0.2 + i * 0.15, y: 0.3 + (i % 2) * 0.2, dragging: false });
}

let dragPortal = null;
document.addEventListener('pointerdown', e => {
  for (const p of portals) {
    const r = p.el.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      dragPortal = p;
      p.dragging = true;
      break;
    }
  }
});
document.addEventListener('pointermove', e => {
  if (!dragPortal) return;
  dragPortal.x = e.clientX / W;
  dragPortal.y = e.clientY / H;
  inject(dragPortal.x, dragPortal.y, forceAmp * 2);
});
document.addEventListener('pointerup', () => { if (dragPortal) dragPortal.dragging = false; dragPortal = null; });

// orientation
let tiltX = 0, tiltY = 0;
window.addEventListener('deviceorientation', e => {
  tiltX = (e.gamma || 0) / 45;
  tiltY = (e.beta || 0) / 45;
});

let lastX = 0, lastY = 0, vx = 0, vy = 0;
document.addEventListener('pointermove', e => {
  if (!dragPortal) {
    vx = (e.clientX - lastX) / 20;
    vy = (e.clientY - lastY) / 20;
    lastX = e.clientX; lastY = e.clientY;
  }
});

// seal
sealBtn.onclick = async () => {
  const data = { state: Array.from(state), Wout: Array.from(Wout), c, gamma };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f608', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put(data, 'main');
    status.textContent = 'Sealed to IndexedDB';
  } catch (err) { status.textContent = 'Seal failed (session only)'; }
};

// restore attempt
(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f608', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('main');
    req.onsuccess = () => {
      if (req.result) {
        state.set(req.result.state);
        Wout.set(req.result.Wout);
        status.textContent = 'Restored sealed mind';
      }
    };
  } catch {}
})();

initESN();

function draw() {
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, W, H);
  const cellW = W / GRID, cellH = H / GRID;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const v = u[idx(x, y)];
      const a = Math.min(1, Math.abs(v) * 0.8);
      ctx.fillStyle = `hsla(${200 + v * 40}, 70%, ${40 + a * 30}%, ${a})`;
      ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
    }
  }
}

function loop() {
  const input = [vx * 0.5, vy * 0.5, tiltX, tiltY];
  const out = esnStep(input);
  c = 0.4 + (out[0] + 1) * 0.3;
  gamma = 0.01 + (out[1] + 1) * 0.04;
  forceAmp = 0.05 + (out[2] + 1) * 0.15;

  // occasional force from reservoir activity
  if (Math.random() < 0.05) inject(0.5 + Math.sin(Date.now() * 0.001) * 0.3, 0.5, forceAmp);

  waveStep();

  // update portals toward high energy
  let maxE = 0;
  for (let i = 0; i < u.length; i++) maxE = Math.max(maxE, Math.abs(u[i]));
  document.documentElement.style.setProperty('--energy', Math.min(1, maxE));
  document.documentElement.style.setProperty('--hue', 180 + maxE * 60);

  for (const p of portals) {
    if (!p.dragging) {
      // sample local and drift toward higher
      const gx = Math.floor(p.x * GRID), gy = Math.floor(p.y * GRID);
      let best = 0, bx = p.x, by = p.y;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = Math.max(0, Math.min(GRID-1, gx + dx));
        const ny = Math.max(0, Math.min(GRID-1, gy + dy));
        const e = Math.abs(u[idx(nx, ny)]);
        if (e > best) { best = e; bx = nx / GRID; by = ny / GRID; }
      }
      p.x += (bx - p.x) * 0.05;
      p.y += (by - p.y) * 0.05;
    }
    p.el.style.left = (p.x * 100) + '%';
    p.el.style.top = (p.y * 100) + '%';
    p.el.style.transform = `scale(${0.8 + Math.abs(u[idx(Math.floor(p.x*GRID), Math.floor(p.y*GRID))]) * 0.4})`;
  }

  const energy = u.reduce((a, b) => a + b * b, 0) / u.length;
  updateReadout(energy);
  status.textContent = `ESN | c=${c.toFixed(2)} γ=${gamma.toFixed(3)} E=${energy.toFixed(3)} WebGPU:stub`;

  draw();
  requestAnimationFrame(loop);
}
loop();
