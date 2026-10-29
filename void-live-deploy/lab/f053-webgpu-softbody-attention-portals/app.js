const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const N = 384;
const portals = [];
let particles = [];
let mindWeights = null;
let history = [];
let animId = null;
let gpu = null;
let fallback = true;

function rand(a, b) { return a + Math.random() * (b - a); }

function initParticles() {
  particles = Array.from({ length: N }, () => ({
    x: rand(0.2, 0.8), y: rand(0.2, 0.8),
    vx: 0, vy: 0,
    ax: 0, ay: 0
  }));
}

// Tiny MLP: 6 in → 8 hidden → 4 out (cluster biases)
function initMind() {
  mindWeights = {
    w1: Array.from({ length: 8 * 6 }, () => rand(-0.3, 0.3)),
    b1: Array(8).fill(0),
    w2: Array.from({ length: 4 * 8 }, () => rand(-0.3, 0.3)),
    b2: Array(4).fill(0)
  };
}

function mlpForward(input) {
  const h = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    let s = mindWeights.b1[i];
    for (let j = 0; j < 6; j++) s += mindWeights.w1[i * 6 + j] * input[j];
    h[i] = Math.tanh(s);
  }
  const out = new Array(4).fill(0);
  for (let i = 0; i < 4; i++) {
    let s = mindWeights.b2[i];
    for (let j = 0; j < 8; j++) s += mindWeights.w2[i * 8 + j] * h[j];
    out[i] = Math.tanh(s);
  }
  return out;
}

function updateMind(input) {
  history.push(input.slice());
  if (history.length > 8) history.shift();
  if (history.length > 2) {
    const pred = mlpForward(history[history.length - 2]);
    const target = history[history.length - 1].slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const err = target[i] - pred[i];
      mindWeights.b2[i] += 0.002 * err;
    }
  }
  return mlpForward(input);
}

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    gpu = { device, context, format };
    statusEl.textContent = 'WebGPU available — compute path noted (CPU sim active)';
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

function stepPhysics(dt, biases) {
  const clusters = [
    { x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 },
    { x: 0.3, y: 0.7 }, { x: 0.7, y: 0.7 }
  ];
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    let fx = 0, fy = 0;
    if (i % 4 === 0) {
      for (let j = i + 1; j < Math.min(i + 12, N); j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d2 = dx * dx + dy * dy + 0.0001;
        const f = 0.0004 / d2;
        fx += dx * f; fy += dy * f;
      }
    }
    for (let c = 0; c < 4; c++) {
      const cl = clusters[c];
      const dx = cl.x - p.x, dy = cl.y - p.y;
      const k = 0.8 + biases[c] * 1.5;
      fx += dx * k * 0.02;
      fy += dy * k * 0.02;
    }
    if (window._pointer) {
      const dx = window._pointer.x - p.x, dy = window._pointer.y - p.y;
      const d = Math.hypot(dx, dy) + 0.01;
      const f = Math.max(0, 0.15 - d) * 0.4;
      fx += (dx / d) * f; fy += (dy / d) * f;
    }
    p.vx = (p.vx + fx * dt) * 0.96;
    p.vy = (p.vy + fy * dt) * 0.96;
    p.x = Math.max(0.02, Math.min(0.98, p.x + p.vx * dt));
    p.y = Math.max(0.02, Math.min(0.98, p.y + p.vy * dt));
  }
}

function draw(ctx, biases) {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    const c = Math.floor(i / (N / 4));
    const hue = (200 + biases[c] * 60 + c * 40) % 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createPortals() {
  const container = document.getElementById('portals');
  const labels = ['Cluster A', 'Cluster B', 'Cluster C', 'Cluster D'];
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.innerHTML = `<h4>${labels[i]}</h4><div class="stats">—</div>`;
    el.style.left = (20 + i * 160) + 'px';
    el.style.top = (window.innerHeight - 120) + 'px';
    container.appendChild(el);
    let dragging = false, ox = 0, oy = 0;
    el.addEventListener('pointerdown', e => {
      dragging = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
      const px = (e.clientX) / window.innerWidth;
      const py = (e.clientY) / window.innerHeight;
      for (let k = 0; k < 20; k++) {
        const p = particles[(i * 90 + k) % N];
        p.vx += (px - p.x) * 0.05;
        p.vy += (py - p.y) * 0.05;
      }
    });
    el.addEventListener('pointerup', () => { dragging = false; });
    portals.push({ el, cluster: i });
  }
}

function updatePortals(biases) {
  portals.forEach((p, i) => {
    const stats = p.el.querySelector('.stats');
    const start = i * Math.floor(N / 4);
    let vx = 0, vy = 0, dens = 0;
    for (let k = 0; k < 30; k++) {
      const pt = particles[start + k];
      vx += pt.vx; vy += pt.vy;
      dens += 1;
    }
    stats.textContent = `att ${(biases[i] * 100).toFixed(0)}%  v ${(Math.hypot(vx, vy) / dens * 100).toFixed(1)}`;
  });
}

async function loop() {
  const dt = 0.016;
  const px = window._pointer ? window._pointer.x : 0.5;
  const py = window._pointer ? window._pointer.y : 0.5;
  const input = [px, py, window._pointer?.vx || 0, window._pointer?.vy || 0, window._orient?.beta || 0, window._orient?.gamma || 0];
  const biases = updateMind(input.map(v => Math.tanh(v)));
  stepPhysics(dt, biases);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw(ctx, biases);
  updatePortals(biases);
  document.documentElement.style.setProperty('--attention-hue', 180 + biases[0] * 80);
  document.documentElement.style.setProperty('--portal-scale', 1 + Math.abs(biases[1]) * 0.3);
  animId = requestAnimationFrame(loop);
}

window.addEventListener('pointermove', e => {
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  const prev = window._pointer || { x, y };
  window._pointer = { x, y, vx: x - prev.x, vy: y - prev.y };
});
window.addEventListener('deviceorientation', e => {
  window._orient = { beta: (e.beta || 0) / 90, gamma: (e.gamma || 0) / 90 };
}, { passive: true });

const DB_NAME = 'void-f053';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('seal').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put({
      weights: mindWeights,
      portals: portals.map(p => ({ left: p.el.style.left, top: p.el.style.top })),
      t: Date.now()
    }, 'latest');
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed'; }
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('latest');
    req.onsuccess = () => {
      if (req.result) {
        mindWeights = req.result.weights;
        req.result.portals?.forEach((pos, i) => {
          if (portals[i]) {
            portals[i].el.style.left = pos.left;
            portals[i].el.style.top = pos.top;
          }
        });
        statusEl.textContent = 'Loaded sealed mind';
      }
    };
  } catch (e) { statusEl.textContent = 'Load failed'; }
};
document.getElementById('reset').onclick = () => { initParticles(); initMind(); statusEl.textContent = 'Reset'; };

async function boot() {
  initParticles();
  initMind();
  createPortals();
  const hasGPU = await tryWebGPU();
  fallback = !hasGPU;
  if (!hasGPU) statusEl.textContent = 'Canvas2D fallback active';
  loop();
}
boot();
