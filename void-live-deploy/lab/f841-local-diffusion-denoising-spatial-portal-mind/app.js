const N = 7;
const LATENT_DIM = 4; // x, y, scale, hue
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const hudInfo = document.getElementById('info');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Tiny MLP: 4 -> 16 -> 16 -> 4 score estimator
class TinyMLP {
  constructor() {
    this.w1 = new Float32Array(4 * 16).map(() => (Math.random()-0.5)*0.2);
    this.b1 = new Float32Array(16);
    this.w2 = new Float32Array(16 * 16).map(() => (Math.random()-0.5)*0.2);
    this.b2 = new Float32Array(16);
    this.w3 = new Float32Array(16 * 4).map(() => (Math.random()-0.5)*0.2);
    this.b3 = new Float32Array(4);
  }
  forward(x) { // x: Float32Array[4]
    const h1 = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      let s = this.b1[i];
      for (let j = 0; j < 4; j++) s += x[j] * this.w1[j*16 + i];
      h1[i] = Math.max(0, s); // ReLU
    }
    const h2 = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      let s = this.b2[i];
      for (let j = 0; j < 16; j++) s += h1[j] * this.w2[j*16 + i];
      h2[i] = Math.max(0, s);
    }
    const out = new Float32Array(4);
    for (let i = 0; i < 4; i++) {
      let s = this.b3[i];
      for (let j = 0; j < 16; j++) s += h2[j] * this.w3[j*4 + i];
      out[i] = s;
    }
    return out;
  }
  // Simple online update on score residual (very light)
  update(x, targetScore, lr = 0.001) {
    const pred = this.forward(x);
    // Approximate gradient step on output weights only for stability
    for (let i = 0; i < 4; i++) {
      const err = pred[i] - targetScore[i];
      this.b3[i] -= lr * err;
      // rough weight nudge
      for (let j = 0; j < 16; j++) this.w3[j*4 + i] -= lr * err * 0.1;
    }
  }
  serialize() {
    return { w1: Array.from(this.w1), b1: Array.from(this.b1), w2: Array.from(this.w2), b2: Array.from(this.b2), w3: Array.from(this.w3), b3: Array.from(this.b3) };
  }
  load(data) {
    this.w1.set(data.w1); this.b1.set(data.b1);
    this.w2.set(data.w2); this.b2.set(data.b2);
    this.w3.set(data.w3); this.b3.set(data.b3);
  }
}

const mlp = new TinyMLP();
let latents = Array.from({length: N}, () => new Float32Array([Math.random(), Math.random(), 0.6 + Math.random()*0.4, Math.random()]));
let portals = [];
let noiseScale = 0.15;
let orient = { beta: 0, gamma: 0 };
let dragging = null;
let dragOffset = {x:0, y:0};

// Create portals
for (let i = 0; i < N; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `Portal ${i+1}`;
  el.dataset.i = i;
  document.body.appendChild(el);
  portals.push(el);
  el.addEventListener('pointerdown', (e) => {
    dragging = i;
    const r = el.getBoundingClientRect();
    dragOffset.x = e.clientX - r.left;
    dragOffset.y = e.clientY - r.top;
    el.setPointerCapture(e.pointerId);
  });
}

addEventListener('pointermove', (e) => {
  if (dragging !== null) {
    const x = (e.clientX - dragOffset.x) / innerWidth;
    const y = (e.clientY - dragOffset.y) / innerHeight;
    latents[dragging][0] = Math.max(0.05, Math.min(0.95, x));
    latents[dragging][1] = Math.max(0.05, Math.min(0.95, y));
  } else {
    // pointer velocity proxy for noise
    noiseScale = Math.min(0.4, Math.max(0.05, Math.hypot(e.movementX, e.movementY) * 0.01 + noiseScale * 0.95));
  }
});
addEventListener('pointerup', (e) => {
  if (dragging !== null) {
    // Treat as clean sample: update score network toward zero residual at clean
    const clean = latents[dragging];
    const zeroScore = new Float32Array(4);
    mlp.update(clean, zeroScore, 0.005);
    statusEl.textContent = `Taught portal ${dragging+1}. Coherence rising.`;
    dragging = null;
  }
});

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', (e) => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
    noiseScale = 0.1 + Math.abs(orient.beta)/180 * 0.25 + Math.abs(orient.gamma)/90 * 0.15;
  });
}

// Diffusion step
function diffusionStep() {
  for (let i = 0; i < N; i++) {
    const lat = latents[i];
    // Estimate score (noise gradient)
    const score = mlp.forward(lat);
    // Reverse step: move toward lower noise (simplified)
    const step = 0.02;
    for (let d = 0; d < 4; d++) {
      lat[d] += score[d] * step * (1 - noiseScale) - (Math.random()-0.5) * noiseScale * 0.05;
      lat[d] = Math.max(0.02, Math.min(0.98, lat[d]));
    }
  }
}

// Render portals
function updatePortals() {
  for (let i = 0; i < N; i++) {
    const lat = latents[i];
    const el = portals[i];
    const x = lat[0] * innerWidth - 60;
    const y = lat[1] * innerHeight - 40;
    const s = 0.7 + lat[2] * 0.6;
    const h = lat[3] * 360;
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    el.style.background = `hsla(${h}, 60%, 30%, 0.85)`;
    el.style.borderColor = `hsla(${h}, 70%, 50%, 0.9)`;
  }
}

// Canvas noise visualization
let particles = Array.from({length: 120}, () => ({
  x: Math.random() * innerWidth,
  y: Math.random() * innerHeight,
  vx: 0, vy: 0
}));

function drawNoise() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(100,180,255,0.6)';
  for (const p of particles) {
    // advect toward nearest portal residual
    let nearest = 0, best = 1e9;
    for (let i = 0; i < N; i++) {
      const px = latents[i][0] * innerWidth;
      const py = latents[i][1] * innerHeight;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < best) { best = d; nearest = i; }
    }
    const tx = latents[nearest][0] * innerWidth;
    const ty = latents[nearest][1] * innerHeight;
    p.vx += (tx - p.x) * 0.002 + (Math.random()-0.5) * noiseScale * 2;
    p.vy += (ty - p.y) * 0.002 + (Math.random()-0.5) * noiseScale * 2;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5 + noiseScale * 4, 0, Math.PI*2);
    ctx.fill();
  }
}

// Loop
function loop() {
  diffusionStep();
  updatePortals();
  drawNoise();
  hudInfo.textContent = `Noise scale: ${noiseScale.toFixed(2)} | Latents evolving`;
  requestAnimationFrame(loop);
}
loop();

// Seal
document.getElementById('seal').onclick = async () => {
  const data = { mlp: mlp.serialize(), latents: latents.map(l => Array.from(l)), ts: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-diffusion-mind', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'current');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Genome sealed to IndexedDB.';
  } catch (e) {
    statusEl.textContent = 'Seal failed (IDB blocked) — in memory only.';
  }
};

document.getElementById('reset').onclick = () => {
  latents = Array.from({length: N}, () => new Float32Array([Math.random(), Math.random(), 0.6 + Math.random()*0.4, Math.random()]));
  statusEl.textContent = 'Latents reset. Diffusion restarting.';
};

// Try restore
(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-diffusion-mind', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('current');
    req.onsuccess = () => {
      if (req.result) {
        mlp.load(req.result.mlp);
        latents = req.result.latents.map(a => new Float32Array(a));
        statusEl.textContent = 'Restored sealed diffusion mind.';
      }
    };
  } catch (e) { console.debug("lab f841-local-diffusion-denoising-spatial-portal-mind:", e); }
})();
