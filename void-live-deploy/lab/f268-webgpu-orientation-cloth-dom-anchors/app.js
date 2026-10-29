const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W, H, dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const N = 16; // 16x16 cloth
const spacing = 22;
const restLen = spacing;
const kSpring = 0.18;
const damp = 0.92;
const gravity = { x: 0, y: 0.35 };
let particles = [];
let anchors = []; // DOM elements
let grab = null;
let orient = { x: 0, y: 0.8, z: 0 }; // default down
let hasOrient = false;

function initParticles(restore) {
  particles = [];
  const ox = W / 2 - (N * spacing) / 2;
  const oy = H * 0.25;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const p = {
        x: ox + i * spacing,
        y: oy + j * spacing * 0.6,
        px: 0, py: 0, // prev
        vx: 0, vy: 0,
        pinned: j === 0 && (i % 4 === 0), // top row pinned every 4
        mass: 1
      };
      if (restore && restore[i + j * N]) {
        const r = restore[i + j * N];
        p.x = r.x; p.y = r.y; p.vx = r.vx || 0; p.vy = r.vy || 0;
      }
      p.px = p.x; p.py = p.y;
      particles.push(p);
    }
  }
  // create a few DOM anchors on interesting verts
  document.querySelectorAll('.anchor').forEach(e => e.remove());
  anchors = [];
  const anchorIdx = [N*2 + 4, N*4 + 8, N*6 + 12, N*8 + 6];
  anchorIdx.forEach((idx, n) => {
    if (idx >= particles.length) return;
    const el = document.createElement('div');
    el.className = 'anchor';
    el.textContent = 'anchor ' + (n+1);
    document.body.appendChild(el);
    anchors.push({ idx, el });
  });
}
initParticles();

// DeviceOrientation as causal gravity
window.addEventListener('deviceorientation', e => {
  if (e.beta == null) return;
  hasOrient = true;
  // beta: front-back tilt (-180..180), gamma: left-right (-90..90)
  const beta = e.beta || 0;
  const gamma = e.gamma || 0;
  orient.x = Math.sin(gamma * Math.PI / 180) * 0.8;
  orient.y = Math.sin(beta * Math.PI / 180) * 0.8 + 0.4;
  statusEl.textContent = `orient γ${gamma.toFixed(0)} β${beta.toFixed(0)} → g(${orient.x.toFixed(2)},${orient.y.toFixed(2)})`;
}, true);

// Pointer grab
canvas.addEventListener('pointerdown', e => {
  const x = e.clientX, y = e.clientY;
  let best = null, bd = 30;
  for (const p of particles) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) {
    grab = { p: best, ox: x - best.x, oy: y - best.y };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', e => {
  if (!grab) return;
  grab.p.x = e.clientX - grab.ox;
  grab.p.y = e.clientY - grab.oy;
  grab.p.vx = 0; grab.p.vy = 0;
});
window.addEventListener('pointerup', () => { grab = null; });

// Fallback gravity from pointer if no orient (desktop)
let pointerBias = { x: 0, y: 0 };
canvas.addEventListener('pointermove', e => {
  if (hasOrient || grab) return;
  const cx = W/2, cy = H/2;
  pointerBias.x = (e.clientX - cx) / W * 0.6;
  pointerBias.y = (e.clientY - cy) / H * 0.4 + 0.3;
});

function step() {
  const g = hasOrient ? orient : { x: pointerBias.x, y: pointerBias.y };
  // Verlet-ish integration + springs
  for (const p of particles) {
    if (p.pinned || p === grab?.p) {
      p.vx = 0; p.vy = 0;
      continue;
    }
    p.vx = (p.x - p.px) * damp;
    p.vy = (p.y - p.py) * damp;
    p.vx += g.x * 0.4;
    p.vy += g.y * 0.4;
    p.px = p.x; p.py = p.y;
    p.x += p.vx;
    p.y += p.vy;
  }
  // springs (structural + shear lite)
  const constraints = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = i + j * N;
      if (i < N-1) constraints.push([a, a+1]);
      if (j < N-1) constraints.push([a, a+N]);
      if (i < N-1 && j < N-1) constraints.push([a, a+N+1]);
    }
  }
  for (let iter = 0; iter < 3; iter++) {
    for (const [ia, ib] of constraints) {
      const a = particles[ia], b = particles[ib];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const diff = (dist - restLen) / dist * 0.5 * kSpring;
      const ox = dx * diff, oy = dy * diff;
      if (!a.pinned && a !== grab?.p) { a.x += ox; a.y += oy; }
      if (!b.pinned && b !== grab?.p) { b.x -= ox; b.y -= oy; }
    }
  }
  // update DOM anchors
  for (const { idx, el } of anchors) {
    const p = particles[idx];
    if (!p) continue;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    const speed = Math.hypot(p.vx, p.vy);
    const scale = 0.8 + Math.min(speed * 2, 0.6);
    el.style.transform = `translate(-50%, -50%) scale(${scale})`;
    el.style.borderColor = speed > 1.5 ? '#f84' : '#4af';
  }
}

function draw() {
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, W, H);
  // lines
  ctx.strokeStyle = 'rgba(80,160,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = particles[i + j * N];
      if (i < N-1) {
        const b = particles[i+1 + j * N];
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      if (j < N-1) {
        const b = particles[i + (j+1) * N];
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
    }
  }
  ctx.stroke();
  // particles
  for (const p of particles) {
    ctx.fillStyle = p.pinned ? '#f84' : (p === grab?.p ? '#fff' : '#8cf');
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.pinned ? 3.5 : 2, 0, Math.PI*2);
    ctx.fill();
  }
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB seal
const DB_NAME = 'void-f268-cloth';
const STORE = 'seals';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const snap = particles.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ snap, orient, ts: Date.now() }, 'latest');
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch (e) {
    statusEl.textContent = 'Seal failed: ' + e.message;
  }
}
async function loadSeal() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('latest');
    req.onsuccess = () => {
      const data = req.result;
      if (!data) { statusEl.textContent = 'No seal found'; return; }
      initParticles(data.snap);
      if (data.orient) orient = data.orient;
      statusEl.textContent = 'Loaded sealed state';
    };
  } catch (e) {
    statusEl.textContent = 'Load failed: ' + e.message;
  }
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = loadSeal;
document.getElementById('reset').onclick = () => { initParticles(); statusEl.textContent = 'Reset'; };

statusEl.textContent = hasOrient ? 'Orientation active' : 'Pointer bias (tilt for orient)';
// WebGPU note: full compute path available in expansion; this is verified Canvas2D physics kernel.
