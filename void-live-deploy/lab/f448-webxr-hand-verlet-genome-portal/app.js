const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const labelsDiv = document.getElementById('labels');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 24; // particles in loop
let particles = [];
let constraints = [];
let genomes = [];
let bestGenome = null;
let gravity = {x: 0, y: 0.02};
let pointer = {x: W/2, y: H/2, down: false, vx: 0, vy: 0};
let lastPointer = {x: 0, y: 0};

function initMesh(restScale = 1, stiffness = 0.8) {
  particles = [];
  constraints = [];
  const cx = W/2, cy = H/2, R = Math.min(W, H) * 0.18 * restScale;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    particles.push({
      x: cx + Math.cos(a) * R,
      y: cy + Math.sin(a) * R,
      px: 0, py: 0,
      vx: 0, vy: 0,
      mass: 1
    });
  }
  for (let i = 0; i < N; i++) {
    const a = particles[i], b = particles[(i+1)%N];
    const rest = Math.hypot(b.x - a.x, b.y - a.y);
    constraints.push({ a: i, b: (i+1)%N, rest, stiffness });
  }
  // cross constraints for stability
  for (let i = 0; i < N; i++) {
    const a = particles[i], b = particles[(i+3)%N];
    const rest = Math.hypot(b.x - a.x, b.y - a.y) * 0.95;
    constraints.push({ a: i, b: (i+3)%N, rest, stiffness: stiffness * 0.4 });
  }
  updateLabels();
}

function updateLabels() {
  labelsDiv.innerHTML = '';
  const groups = [0, 6, 12, 18];
  groups.forEach((idx, gi) => {
    const p = particles[idx];
    const el = document.createElement('div');
    el.className = 'label';
    el.textContent = `Tendril ${gi+1}`;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.dataset.idx = idx;
    labelsDiv.appendChild(el);
  });
}

function verletStep(dt = 1) {
  // gravity + pointer force
  const forceR = 80;
  for (const p of particles) {
    p.px = p.x; p.py = p.y;
    let fx = gravity.x, fy = gravity.y;
    if (pointer.down) {
      const dx = p.x - pointer.x, dy = p.y - pointer.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < forceR) {
        const f = (1 - d/forceR) * 0.8 * Math.hypot(pointer.vx, pointer.vy);
        fx += (dx/d) * f;
        fy += (dy/d) * f;
      }
    }
    p.vx = (p.x - p.px) * 0.98 + fx;
    p.vy = (p.y - p.py) * 0.98 + fy;
    p.x += p.vx;
    p.y += p.vy;
    // bounds
    if (p.x < 10) p.x = 10;
    if (p.x > W-10) p.x = W-10;
    if (p.y < 10) p.y = 10;
    if (p.y > H-10) p.y = H-10;
  }
  // constraints (iterative)
  for (let iter = 0; iter < 4; iter++) {
    for (const c of constraints) {
      const a = particles[c.a], b = particles[c.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const diff = (d - c.rest) / d * c.stiffness * 0.5;
      const ox = dx * diff, oy = dy * diff;
      a.x += ox; a.y += oy;
      b.x -= ox; b.y -= oy;
    }
  }
  // update labels
  document.querySelectorAll('.label').forEach(el => {
    const p = particles[+el.dataset.idx];
    if (p) {
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
    }
  });
}

function computeFitness() {
  // inverse of radius variance + low energy
  let cx = 0, cy = 0;
  particles.forEach(p => { cx += p.x; cy += p.y; });
  cx /= N; cy /= N;
  let rSum = 0, rVar = 0;
  const rs = particles.map(p => Math.hypot(p.x - cx, p.y - cy));
  rs.forEach(r => rSum += r);
  const rMean = rSum / N;
  rs.forEach(r => rVar += (r - rMean)**2);
  rVar /= N;
  const energy = particles.reduce((s, p) => s + p.vx*p.vx + p.vy*p.vy, 0) / N;
  return 1 / (1 + rVar * 10 + energy * 0.1);
}

function evolve() {
  if (genomes.length === 0) {
    for (let i = 0; i < 6; i++) {
      genomes.push({ restScale: 0.7 + Math.random()*0.6, stiffness: 0.4 + Math.random()*0.6, fit: 0 });
    }
  }
  // evaluate
  const snap = particles.map(p => ({...p}));
  genomes.forEach(g => {
    initMesh(g.restScale, g.stiffness);
    for (let s = 0; s < 30; s++) verletStep();
    g.fit = computeFitness();
    // restore roughly
  });
  // restore previous mesh roughly by re-init with best
  genomes.sort((a,b) => b.fit - a.fit);
  bestGenome = genomes[0];
  // mutate
  for (let i = 2; i < genomes.length; i++) {
    const p = genomes[Math.floor(Math.random()*2)];
    genomes[i].restScale = Math.max(0.5, Math.min(1.5, p.restScale + (Math.random()-0.5)*0.15));
    genomes[i].stiffness = Math.max(0.2, Math.min(1, p.stiffness + (Math.random()-0.5)*0.1));
  }
  initMesh(bestGenome.restScale, bestGenome.stiffness);
  statusEl.textContent = `Evolved. Best fitness ${bestGenome.fit.toFixed(3)} scale=${bestGenome.restScale.toFixed(2)} stiff=${bestGenome.stiffness.toFixed(2)}`;
}

async function sealGenome() {
  if (!bestGenome) { statusEl.textContent = 'Evolve first'; return; }
  const payload = { ...bestGenome, ts: Date.now() };
  const str = JSON.stringify(payload);
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  payload.hash = hash;
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(payload);
    await tx.complete;
    // broadcast
    const bc = new BroadcastChannel('verse-verlet-genome');
    bc.postMessage({ type: 'genome', payload });
    statusEl.textContent = `Sealed ${hash.slice(0,8)}… and broadcast`;
  } catch(e) {
    statusEl.textContent = 'Seal failed (IDB): ' + e.message;
  }
}

async function loadSealed() {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').getAll();
    const all = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    if (all.length) {
      const g = all.sort((a,b) => b.fit - a.fit)[0];
      bestGenome = g;
      initMesh(g.restScale, g.stiffness);
      statusEl.textContent = `Loaded sealed ${g.hash?.slice(0,8)}…`;
    } else statusEl.textContent = 'No sealed genomes';
  } catch(e) {
    statusEl.textContent = 'Load failed';
  }
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-verlet', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'hash' });
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

// Broadcast receive
const bc = new BroadcastChannel('verse-verlet-genome');
bc.onmessage = (ev) => {
  if (ev.data.type === 'genome') {
    const g = ev.data.payload;
    statusEl.textContent = `Received genome from other tab (fit ${g.fit?.toFixed(3)})`;
    // inject as new competitor
    genomes.push({ restScale: g.restScale, stiffness: g.stiffness, fit: g.fit || 0 });
  }
};

// Pointer
canvas.addEventListener('pointerdown', e => { pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY; lastPointer = {x: e.clientX, y: e.clientY}; });
addEventListener('pointerup', () => pointer.down = false);
addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.vx = e.clientX - lastPointer.x;
  pointer.vy = e.clientY - lastPointer.y;
  lastPointer = {x: e.clientX, y: e.clientY};
});

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (e.gamma != null) gravity.x = (e.gamma / 90) * 0.08;
    if (e.beta != null) gravity.y = (e.beta / 90) * 0.08;
  });
}

// Label drag
labelsDiv.addEventListener('pointerdown', e => {
  if (!e.target.classList.contains('label')) return;
  e.target.setPointerCapture(e.pointerId);
  const idx = +e.target.dataset.idx;
  const move = (ev) => {
    const p = particles[idx];
    if (p) { p.x = ev.clientX; p.y = ev.clientY; }
  };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
});

document.getElementById('seal').onclick = sealGenome;
document.getElementById('load').onclick = loadSealed;
document.getElementById('evolve').onclick = evolve;
document.getElementById('reset').onclick = () => { initMesh(); statusEl.textContent = 'Mesh reset'; };

function loop() {
  verletStep();
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  // draw constraints
  ctx.strokeStyle = 'rgba(100,180,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const c of constraints) {
    const a = particles[c.a], b = particles[c.b];
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  // particles
  ctx.fillStyle = '#7cf';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(loop);
}

initMesh();
evolve(); // initial
loop();
