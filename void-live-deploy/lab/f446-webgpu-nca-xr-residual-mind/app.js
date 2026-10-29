const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const energyEl = document.getElementById('energy');
const resEl = document.getElementById('res');
const fitEl = document.getElementById('fit');
const probesEl = document.getElementById('probes');

let W = 128, H = 128;
let field = new Float32Array(W * H);
let next = new Float32Array(W * H);
let energy = 0;
let residual = 0;
let fitness = 0;

// Pointer history for residual predictor
const hist = [];
let lastX = 0, lastY = 0;
let tiltX = 0, tiltY = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Simple evolved MLP reaction: weights [bias, neighAvg, self, energyScale]
let bestWeights = [0.02, 0.35, -0.1, 0.4];

// Worker for evolutionary hill-climb / GA on MLP weights
const workerCode = `
let pop = [];
const POP = 8;
function init() {
  for (let i = 0; i < POP; i++) {
    pop.push([0.02 + Math.random()*0.1, 0.3 + Math.random()*0.2, -0.15 + Math.random()*0.1, 0.3 + Math.random()*0.3]);
  }
}
function mutate(w) {
  return w.map(v => v + (Math.random()-0.5)*0.08);
}
function fitness(weights, stats) {
  // Prefer moderate energy, low residual, some diversity
  const e = stats.energy || 0;
  const r = stats.residual || 1;
  return Math.max(0, 1.2 - Math.abs(e - 0.45) * 2 - r * 1.5 + (stats.diversity || 0)*0.3);
}
init();
self.onmessage = (e) => {
  const stats = e.data;
  // Evaluate, keep best, mutate
  let scores = pop.map(w => fitness(w, stats));
  let bestIdx = scores.indexOf(Math.max(...scores));
  let best = pop[bestIdx].slice();
  // Elitism + mutate
  pop = [best];
  for (let i = 1; i < POP; i++) pop.push(mutate(best));
  self.postMessage({ best, fitness: scores[bestIdx] });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  bestWeights = e.data.best;
  fitness = e.data.fitness;
  fitEl.textContent = fitness.toFixed(2);
};

function step() {
  // Residual from simple linear predictor of pointer velocity
  if (hist.length > 2) {
    const dx = hist[hist.length-1].x - hist[hist.length-2].x;
    const dy = hist[hist.length-1].y - hist[hist.length-2].y;
    const predDx = hist.length > 3 ? (hist[hist.length-2].x - hist[hist.length-3].x) : 0;
    const predDy = hist.length > 3 ? (hist[hist.length-2].y - hist[hist.length-3].y) : 0;
    residual = Math.min(1, Math.hypot(dx - predDx, dy - predDy) * 0.05);
  }
  resEl.textContent = residual.toFixed(2);

  // NCA-like step: diffusion + MLP reaction
  const [bias, neighW, selfW, eScale] = bestWeights;
  const inject = residual * 0.15 + energy * 0.02;
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      const i = y * W + x;
      const self = field[i];
      const neigh = (field[i-1] + field[i+1] + field[i-W] + field[i+W]) * 0.25;
      let val = self * (1 - selfW) + neigh * neighW + bias + inject * eScale;
      // Soft clamp + decay
      val = Math.max(0, Math.min(1, val * 0.98 + (Math.random()-0.5)*0.01));
      next[i] = val;
    }
  }
  // Swap
  const tmp = field; field = next; next = tmp;

  // Energy as mean activity
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += field[i];
  energy = sum / field.length;
  energyEl.textContent = energy.toFixed(3);

  // Send stats to worker occasionally
  if (Math.random() < 0.05) {
    worker.postMessage({ energy, residual, diversity: Math.random() });
  }

  // Morph chrome
  const hue = 200 + energy * 80 + residual * 40;
  const sat = 40 + energy * 40;
  document.documentElement.style.setProperty('--hue', hue);
  document.body.style.filter = `hue-rotate(${(energy*40)|0}deg) saturate(${sat}%)`;
  document.body.style.background = `hsl(${hue|0}, 30%, ${8 + energy*6}%)`;
}

function render() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const scaleX = canvas.width / W;
  const scaleY = canvas.height / H;
  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const x = Math.min(W-1, (px / scaleX)|0);
      const y = Math.min(H-1, (py / scaleY)|0);
      const v = field[y * W + x];
      const idx = (py * canvas.width + px) * 4;
      img.data[idx] = v * 180 + 20;
      img.data[idx+1] = v * 120 + residual * 40;
      img.data[idx+2] = 180 + v * 75;
      img.data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Probes
let probes = [];
function spawnProbe(x, y) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  probesEl.appendChild(el);
  const p = { el, x, y, vx: 0, vy: 0 };
  probes.push(p);
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const startX = ev.clientX - p.x;
    const startY = ev.clientY - p.y;
    const move = (e) => {
      p.x = e.clientX - startX;
      p.y = e.clientY - startY;
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      // Inject into field
      const gx = Math.min(W-1, Math.max(0, (p.x / canvas.width) * W | 0));
      const gy = Math.min(H-1, Math.max(0, (p.y / canvas.height) * H | 0));
      field[gy * W + gx] = Math.min(1, field[gy * W + gx] + 0.3);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

// Pointer seeding
canvas.addEventListener('pointermove', (e) => {
  const x = e.clientX, y = e.clientY;
  hist.push({ x, y });
  if (hist.length > 8) hist.shift();
  lastX = x; lastY = y;
  const gx = Math.min(W-1, Math.max(0, (x / canvas.width) * W | 0));
  const gy = Math.min(H-1, Math.max(0, (y / canvas.height) * H | 0));
  field[gy * W + gx] = Math.min(1, field[gy * W + gx] + 0.25);
  if (Math.random() < 0.02 && probes.length < 6) spawnProbe(x, y);
});

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (e) => {
    tiltX = (e.gamma || 0) / 90;
    tiltY = (e.beta || 0) / 90;
  });
}

// Seal
document.getElementById('seal').onclick = async () => {
  const data = { weights: bestWeights, energy, residual, fitness, ts: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f314', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals', { autoIncrement: true });
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').add(data);
    statusEl.textContent = 'sealed ' + bestWeights.map(w => w.toFixed(2)).join(',');
  } catch (err) {
    statusEl.textContent = 'seal failed (IDB)';
  }
};

document.getElementById('reset').onclick = () => {
  field.fill(0);
  statusEl.textContent = 'reset';
};

// Init some noise
for (let i = 0; i < field.length; i++) field[i] = Math.random() * 0.1;

statusEl.textContent = 'running (Canvas2D NCA + Worker MLP residual)';

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}
loop();
