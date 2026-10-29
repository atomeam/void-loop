const N = 32;           // reservoir size
const NUM_ANCHORS = 7;
const LR = 0.012;
const REST = 90;
const BASE_K = 0.06;
const DAMP = 0.88;

const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d', { alpha: false });
const chainEl = document.getElementById('chain');
const statusEl = document.getElementById('status');
const modeEl = document.getElementById('mode');

let w = 0, h = 0;
function resize() {
  w = canvas.width = innerWidth;
  h = canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// --- Input state ---
let pointer = { x: innerWidth/2, y: innerHeight/2, vx: 0, vy: 0, px: innerWidth/2, py: innerHeight/2 };
let orient = { beta: 0, gamma: 0 };
let hasOrient = false;
let dragIdx = -1;
let dragOff = { x: 0, y: 0 };

// --- Anchors ---
const anchors = [];
for (let i = 0; i < NUM_ANCHORS; i++) {
  const el = document.createElement('div');
  el.className = 'anchor';
  el.dataset.i = i;
  chainEl.appendChild(el);
  anchors.push({
    el,
    x: innerWidth * (0.2 + 0.6 * i / (NUM_ANCHORS-1)),
    y: innerHeight * 0.5 + (Math.random()-0.5)*40,
    vx: 0, vy: 0,
    tx: 0, ty: 0   // target offset from residual/state
  });
  el.addEventListener('pointerdown', e => {
    dragIdx = i;
    dragOff.x = e.clientX - anchors[i].x;
    dragOff.y = e.clientY - anchors[i].y;
    el.setPointerCapture(e.pointerId);
  });
}
addEventListener('pointermove', e => {
  pointer.px = pointer.x; pointer.py = pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.vx = pointer.x - pointer.px;
  pointer.vy = pointer.y - pointer.py;
  if (dragIdx >= 0) {
    const a = anchors[dragIdx];
    a.x = e.clientX - dragOff.x;
    a.y = e.clientY - dragOff.y;
    a.vx = 0; a.vy = 0;
  }
});
addEventListener('pointerup', () => { dragIdx = -1; });

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      orient.beta = e.beta;
      orient.gamma = e.gamma;
      hasOrient = true;
      modeEl.textContent = 'orient+pointer';
    }
  });
  modeEl.textContent = 'requesting orient…';
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS
    document.body.addEventListener('click', async () => {
      try {
        const p = await DeviceOrientationEvent.requestPermission();
        if (p === 'granted') modeEl.textContent = 'orient+pointer';
      } catch {}
    }, { once: true });
  }
}

// --- Worker: Echo State Network ---
const workerCode = `
const N = ${N};
let W_in = new Float32Array(N * 5);
let W_res = new Float32Array(N * N);
let state = new Float32Array(N);
let readout = new Float32Array(N * 2); // predict vx, vy
let bias = new Float32Array(2);
const leak = 0.28;
const lr = ${LR};

function init() {
  for (let i = 0; i < W_in.length; i++) W_in[i] = (Math.random() - 0.5) * 0.8;
  // sparse random reservoir, then scale spectral radius approx
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (Math.random() < 0.15) W_res[i*N+j] = (Math.random()-0.5);
    }
  }
  // rough spectral radius scaling (one power iteration)
  let v = new Float32Array(N);
  for (let i = 0; i < N; i++) v[i] = Math.random();
  for (let iter = 0; iter < 12; iter++) {
    const nv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < N; j++) s += W_res[i*N+j] * v[j];
      nv[i] = s;
    }
    let norm = 0;
    for (let i = 0; i < N; i++) norm += nv[i]*nv[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < N; i++) v[i] = nv[i] / norm;
  }
  let rad = 0;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = 0; j < N; j++) s += W_res[i*N+j] * v[j];
    rad = Math.max(rad, Math.abs(s));
  }
  const scale = 0.92 / (rad || 1);
  for (let i = 0; i < W_res.length; i++) W_res[i] *= scale;
}

init();

function tanh(x) { return Math.tanh(x); }

self.onmessage = function(e) {
  const { type, input, target, weights } = e.data;
  if (type === 'step') {
    // input: [beta, gamma, vx, vy, speed] normalized roughly
    const u = input;
    const pre = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < 5; j++) s += W_in[i*5+j] * u[j];
      for (let j = 0; j < N; j++) s += W_res[i*N+j] * state[j];
      pre[i] = s;
    }
    for (let i = 0; i < N; i++) {
      state[i] = (1-leak)*state[i] + leak*tanh(pre[i]);
    }
    // readout predict
    let px = bias[0], py = bias[1];
    for (let i = 0; i < N; i++) {
      px += readout[i] * state[i];
      py += readout[N+i] * state[i];
    }
    // LMS update if target provided
    if (target) {
      const ex = target[0] - px;
      const ey = target[1] - py;
      for (let i = 0; i < N; i++) {
        readout[i] += lr * ex * state[i];
        readout[N+i] += lr * ey * state[i];
      }
      bias[0] += lr * ex;
      bias[1] += lr * ey;
    }
    const residual = Math.hypot(target ? target[0]-px : 0, target ? target[1]-py : 0);
    let energy = 0;
    for (let i = 0; i < N; i++) energy += state[i]*state[i];
    energy = Math.sqrt(energy / N);
    self.postMessage({ residual, energy, pred: [px, py], state: Array.from(state).slice(0,8) });
  } else if (type === 'getWeights') {
    self.postMessage({ readout: Array.from(readout), bias: Array.from(bias) });
  } else if (type === 'setWeights') {
    if (weights.readout) readout.set(weights.readout);
    if (weights.bias) bias.set(weights.bias);
    self.postMessage({ ok: true });
  } else if (type === 'reset') {
    state.fill(0);
    readout.fill(0);
    bias.fill(0);
    self.postMessage({ ok: true });
  }
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

let lastResidual = 0;
let lastEnergy = 0;
let lastTarget = [0, 0];

worker.onmessage = e => {
  if (e.data.residual != null) {
    lastResidual = e.data.residual;
    lastEnergy = e.data.energy;
  }
};

// --- Simulation loop ---
let lastStep = 0;
function step(ts) {
  // input vector
  const speed = Math.hypot(pointer.vx, pointer.vy);
  const u = [
    hasOrient ? orient.beta / 90 : 0,
    hasOrient ? orient.gamma / 90 : 0,
    pointer.vx / 20,
    pointer.vy / 20,
    speed / 30
  ];
  // target = current velocity (predict next ≈ current for smooth)
  const target = [pointer.vx / 20, pointer.vy / 20];
  if (ts - lastStep > 25) {
    worker.postMessage({ type: 'step', input: u, target });
    lastStep = ts;
    lastTarget = target;
  }

  // stiffness from residual
  const k = BASE_K + Math.min(0.5, lastResidual * 0.35);
  document.documentElement.style.setProperty('--stiff', k.toFixed(2));

  // update anchors with springs
  for (let i = 0; i < NUM_ANCHORS; i++) {
    const a = anchors[i];
    if (dragIdx === i) continue;
    // target position: base line + energy bias + residual jitter
    const baseX = w * (0.15 + 0.7 * i / (NUM_ANCHORS-1));
    const baseY = h * 0.48 + Math.sin(ts*0.001 + i) * 20 * lastEnergy;
    a.tx = baseX;
    a.ty = baseY;
    // spring to neighbors
    let fx = (a.tx - a.x) * 0.02;
    let fy = (a.ty - a.y) * 0.02;
    if (i > 0) {
      const b = anchors[i-1];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      const stretch = dist - REST;
      fx -= (dx / dist) * stretch * k;
      fy -= (dy / dist) * stretch * k;
    }
    if (i < NUM_ANCHORS-1) {
      const b = anchors[i+1];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      const stretch = dist - REST;
      fx -= (dx / dist) * stretch * k;
      fy -= (dy / dist) * stretch * k;
    }
    a.vx = (a.vx + fx) * DAMP;
    a.vy = (a.vy + fy) * DAMP;
    a.x += a.vx;
    a.y += a.vy;
    // bounds
    a.x = Math.max(20, Math.min(w-20, a.x));
    a.y = Math.max(20, Math.min(h-20, a.y));
    a.el.style.transform = `translate(${a.x-14}px, ${a.y-14}px)`;
  }

  // draw connecting lines
  // (simple: recreate or use existing — for demo we use canvas for bg only)
  // background trail
  ctx.fillStyle = 'rgba(10,12,16,0.12)';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 4 + speed*0.3, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(110,231,183,0.7)';
  ctx.fill();
  // faint lines on canvas for chain
  ctx.strokeStyle = 'rgba(110,231,183,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < NUM_ANCHORS; i++) {
    if (i === 0) ctx.moveTo(anchors[i].x, anchors[i].y);
    else ctx.lineTo(anchors[i].x, anchors[i].y);
  }
  ctx.stroke();

  statusEl.textContent = `residual: ${lastResidual.toFixed(3)} | stiff: ${k.toFixed(2)} | E: ${lastEnergy.toFixed(2)}`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// --- IndexedDB seal ---
const DB_NAME = 'f274-reservoir';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('weights');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('seal').onclick = async () => {
  worker.postMessage({ type: 'getWeights' });
  const weights = await new Promise(r => {
    const h = e => { if (e.data.readout) { worker.removeEventListener('message', h); r(e.data); } };
    worker.addEventListener('message', h);
  });
  try {
    const db = await openDB();
    const tx = db.transaction('weights', 'readwrite');
    tx.objectStore('weights').put(weights, 'readout');
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    statusEl.textContent = 'sealed';
  } catch (err) { statusEl.textContent = 'seal failed'; }
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('weights', 'readonly');
    const req = tx.objectStore('weights').get('readout');
    const weights = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    if (weights) {
      worker.postMessage({ type: 'setWeights', weights });
      statusEl.textContent = 'loaded';
    } else statusEl.textContent = 'nothing sealed';
  } catch { statusEl.textContent = 'load failed'; }
};
document.getElementById('reset').onclick = () => {
  worker.postMessage({ type: 'reset' });
  lastResidual = 0;
  statusEl.textContent = 'reset';
};

// initial positions
anchors.forEach((a, i) => {
  a.el.style.transform = `translate(${a.x-14}px, ${a.y-14}px)`;
});
