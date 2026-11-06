const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const hashEl = document.getElementById('hash');
let w, h;
function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Particles & constraints
const N = 48;
const particles = [];
const constraints = [];
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random() * w, y: Math.random() * h,
    px: 0, py: 0, // previous for Verlet
    invMass: 1
  });
}
// Random distance constraints
for (let i = 0; i < N; i++) {
  for (let j = i+1; j < N; j++) {
    if (Math.random() < 0.08) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const rest = Math.hypot(dx, dy) * 0.7 + 40;
      constraints.push({ a:i, b:j, rest, stiffness: 0.5 });
    }
  }
}

// Tiny MLP: 4 inputs (attractor x,y normalized, dist to centroid, time) → 2 outputs (stiffness mod, rest mod)
let weights = [
  // input to hidden (4x8)
  Array.from({length:4}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.5)),
  // hidden to output (8x2)
  Array.from({length:8}, () => Array.from({length:2}, () => (Math.random()-0.5)*0.5))
];
function mlp(inp) {
  const h = new Array(8).fill(0);
  for (let i=0; i<4; i++) for (let j=0; j<8; j++) h[j] += inp[i] * weights[0][i][j];
  for (let j=0; j<8; j++) h[j] = Math.tanh(h[j]);
  const out = [0,0];
  for (let j=0; j<8; j++) for (let k=0; k<2; k++) out[k] += h[j] * weights[1][j][k];
  return out.map(v => Math.tanh(v));
}

let attractor = { x: w/2, y: h/2 };
let pointerMode = true;
let time = 0;

// Pointer / mouse as hand fallback
canvas.addEventListener('pointermove', e => {
  attractor.x = e.clientX;
  attractor.y = e.clientY;
});
canvas.addEventListener('pointerdown', e => { attractor.x = e.clientX; attractor.y = e.clientY; });

// Optional WebXR hand tracking attempt
async function tryWebXR() {
  if (!navigator.xr) return;
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if (!supported) return;
    status.textContent = 'WebXR available. Click canvas for hand mode (requires headset).';
    // Full immersive session would go here; for canvas prototype we stay pointer + note
  } catch(e) {}
}
tryWebXR();

// IndexedDB for sealed genome
let db;
const req = indexedDB.open('verse-f605', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('genomes', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; };

function sealGenome() {
  const data = JSON.stringify(weights);
  // Simple hash (not crypto for demo; in real use crypto.subtle)
  let hash = 0;
  for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  const id = 'g' + Math.abs(hash).toString(16);
  hashEl.textContent = 'Sealed: ' + id;
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ id, weights, time: Date.now() });
  }
  status.textContent = 'Genome sealed to IndexedDB.';
}
document.getElementById('seal').onclick = sealGenome;
document.getElementById('reset').onclick = () => {
  weights = [
    Array.from({length:4}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.5)),
    Array.from({length:8}, () => Array.from({length:2}, () => (Math.random()-0.5)*0.5))
  ];
  status.textContent = 'Weights reset.';
  hashEl.textContent = '';
};

// Simulation step
function step() {
  time += 0.016;
  // Compute centroid
  let cx=0, cy=0;
  for (const p of particles) { cx += p.x; cy += p.y; }
  cx /= N; cy /= N;
  const dx = (attractor.x - cx) / w;
  const dy = (attractor.y - cy) / h;
  const dist = Math.hypot(attractor.x - cx, attractor.y - cy) / Math.hypot(w,h);
  const mods = mlp([dx, dy, dist, Math.sin(time)]);
  const stiffMod = 0.3 + mods[0] * 0.4;
  const restMod = 0.8 + mods[1] * 0.4;

  // Verlet integration + gravity-like attractor pull
  for (const p of particles) {
    const vx = p.x - p.px;
    const vy = p.y - p.py;
    p.px = p.x; p.py = p.y;
    const ax = (attractor.x - p.x) * 0.002;
    const ay = (attractor.y - p.y) * 0.002;
    p.x += vx * 0.98 + ax;
    p.y += vy * 0.98 + ay;
    // bounds
    if (p.x < 10) p.x = 10; if (p.x > w-10) p.x = w-10;
    if (p.y < 10) p.y = 10; if (p.y > h-10) p.y = h-10;
  }

  // Constraint projections (PBD Gauss-Seidel)
  for (let iter = 0; iter < 4; iter++) {
    for (const c of constraints) {
      const pa = particles[c.a], pb = particles[c.b];
      let dx = pb.x - pa.x, dy = pb.y - pa.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const rest = c.rest * restMod;
      const diff = (d - rest) / d;
      const stiff = c.stiffness * stiffMod;
      const corr = diff * stiff * 0.5;
      pa.x += dx * corr;
      pa.y += dy * corr;
      pb.x -= dx * corr;
      pb.y -= dy * corr;
    }
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,w,h);
  // constraints
  ctx.strokeStyle = 'rgba(100,150,255,0.25)';
  ctx.lineWidth = 1;
  for (const c of constraints) {
    const pa = particles[c.a], pb = particles[c.b];
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  // particles
  for (const p of particles) {
    ctx.fillStyle = '#8cf';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fill();
  }
  // attractor
  ctx.fillStyle = '#f84';
  ctx.beginPath();
  ctx.arc(attractor.x, attractor.y, 8, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#fa6';
  ctx.stroke();
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();
