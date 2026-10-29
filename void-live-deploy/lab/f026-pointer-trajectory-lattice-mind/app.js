const canvas = document.getElementById('void');
const ctx = canvas.getContext('2d', { alpha: false });
const statusEl = document.getElementById('status');
let W, H;
const N = 300;
let particles = [];
let lattice = Array.from({length: 64}, () => ({ x: 0.5, y: 0.5, s: 0.1 }));
let morph = 0;
let audioCtx, oscs = [], panners = [];

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

function rand(a, b) { return a + Math.random() * (b - a); }
function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: rand(0, W), y: rand(0, H),
      vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5)
    });
  }
}
initParticles();

// Trajectory memory mind in Worker
const workerCode = `
let history = [];
const MAX = 24;
let lattice = Array.from({length: 64}, () => ({ x: 0.5, y: 0.5, s: 0.05 }));
self.onmessage = (e) => {
  const { dx, dy, x, y } = e.data;
  if (dx != null) {
    history.push({ dx, dy, nx: x, ny: y });
    if (history.length > MAX) history.shift();
  }
  // Update lattice: project recent vectors into 8x8 bins
  const bins = Array.from({length: 64}, () => ({ sx: 0, sy: 0, c: 0 }));
  history.forEach(h => {
    const ix = Math.min(7, Math.floor(h.nx * 8));
    const iy = Math.min(7, Math.floor(h.ny * 8));
    const idx = iy * 8 + ix;
    bins[idx].sx += h.dx; bins[idx].sy += h.dy; bins[idx].c++;
  });
  let maxS = 0.01, bestIdx = 32;
  for (let i = 0; i < 64; i++) {
    const b = bins[i];
    const mag = b.c ? Math.hypot(b.sx / b.c, b.sy / b.c) : 0;
    const nx = (i % 8 + 0.5) / 8;
    const ny = (Math.floor(i / 8) + 0.5) / 8;
    lattice[i].x = nx + (Math.random() - 0.5) * 0.04;
    lattice[i].y = ny + (Math.random() - 0.5) * 0.04;
    lattice[i].s = Math.min(1, mag * 0.4 + (b.c / MAX) * 0.6);
    if (lattice[i].s > maxS) { maxS = lattice[i].s; bestIdx = i; }
  }
  self.postMessage({ lattice, best: lattice[bestIdx], confidence: maxS, idx: bestIdx });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
let lastSend = 0;
let lastX = 0, lastY = 0;
worker.onmessage = (e) => {
  lattice = e.data.lattice;
  morph = Math.min(1, e.data.confidence * 1.4);
  const best = e.data.best;
  document.documentElement.style.setProperty('--morph', morph);
  document.documentElement.style.setProperty('--hue', 160 + morph * 160);
  document.documentElement.style.setProperty('--intent-x', (best.x - 0.5) * 2);
  document.documentElement.style.setProperty('--intent-y', (best.y - 0.5) * 2);
  statusEl.textContent = `conf ${e.data.confidence.toFixed(2)} | cell ${e.data.idx} | morph ${morph.toFixed(2)}`;
  updateAudio(best);
};

function stepParticles() {
  for (const p of particles) {
    let fx = 0, fy = 0;
    for (const cell of lattice) {
      if (cell.s < 0.15) continue;
      const tx = cell.x * W, ty = cell.y * H;
      const dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 220) {
        const force = cell.s * 0.35 * (1 - d / 220);
        fx += (dx / d) * force;
        fy += (dy / d) * force;
      }
    }
    // mild damping + noise
    p.vx = p.vx * 0.96 + fx + (Math.random() - 0.5) * 0.04;
    p.vy = p.vy * 0.96 + fy + (Math.random() - 0.5) * 0.04;
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > 3.2) { p.vx *= 3.2 / spd; p.vy *= 3.2 / spd; }
    p.x = (p.x + p.vx + W) % W;
    p.y = (p.y + p.vy + H) % H;
  }
}

function draw() {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `hsl(${160 + morph * 160}, 75%, 62%)`;
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // faint lattice hints
  ctx.strokeStyle = `hsla(${160 + morph * 160}, 50%, 50%, 0.15)`;
  ctx.lineWidth = 1;
  for (const cell of lattice) {
    if (cell.s > 0.3) {
      ctx.beginPath();
      ctx.arc(cell.x * W, cell.y * H, 8 + cell.s * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function loop(t) {
  stepParticles();
  draw();
  if (t - lastSend > 500) {
    // send dummy if no recent pointer to keep mind alive
    worker.postMessage({ dx: 0, dy: 0, x: 0.5, y: 0.5 });
    lastSend = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Pointer trajectory
canvas.addEventListener('pointermove', (e) => {
  const nx = e.clientX / W, ny = e.clientY / H;
  const dx = (e.clientX - lastX) / W * 8;
  const dy = (e.clientY - lastY) / H * 8;
  lastX = e.clientX; lastY = e.clientY;
  // inject force
  for (const p of particles) {
    const ddx = e.clientX - p.x, ddy = e.clientY - p.y;
    const d = Math.hypot(ddx, ddy);
    if (d < 90) {
      p.vx += (ddx / d) * 0.25;
      p.vy += (ddy / d) * 0.25;
    }
  }
  worker.postMessage({ dx, dy, x: nx, y: ny });
  lastSend = performance.now();
});

document.getElementById('clear').onclick = () => {
  worker.postMessage({ dx: 0, dy: 0, x: 0.5, y: 0.5, clear: true });
  statusEl.textContent = 'memory cleared';
};

// Web Audio spatial
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const panner = audioCtx.createStereoPanner();
    o.type = ['sine', 'triangle', 'sine'][i];
    o.frequency.value = 110 + i * 55;
    g.gain.value = 0.03;
    o.connect(g); g.connect(panner); panner.connect(audioCtx.destination);
    o.start();
    oscs.push({ o, g });
    panners.push(panner);
  }
}
function updateAudio(best) {
  if (!audioCtx) return;
  const base = 100 + morph * 220;
  const pan = (best.x - 0.5) * 1.6;
  oscs.forEach((s, i) => {
    s.o.frequency.setTargetAtTime(base + i * 40, audioCtx.currentTime, 0.25);
    s.g.gain.setTargetAtTime(0.015 + morph * 0.05, audioCtx.currentTime, 0.4);
  });
  panners.forEach(p => p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), audioCtx.currentTime, 0.3));
}
document.body.addEventListener('pointerdown', initAudio, { once: true });

// Seal
document.getElementById('seal').onclick = async () => {
  const idb = await new Promise((res, rej) => {
    const r = indexedDB.open('f026-lattices', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('l', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const payload = JSON.stringify({ lattice: lattice.slice(0, 8).map(c => ({x: +c.x.toFixed(3), y: +c.y.toFixed(3), s: +c.s.toFixed(3)})), morph });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('').slice(0,16));
  const tx = idb.transaction('l', 'readwrite');
  tx.objectStore('l').put({ id: Date.now(), morph, hash, t: new Date().toISOString() });
  statusEl.textContent = `sealed ${hash}`;
};
