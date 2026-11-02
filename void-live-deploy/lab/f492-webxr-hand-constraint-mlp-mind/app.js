const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 42;
const particles = [];
const constraints = [];
let hand = { x: W/2, y: H/2, active: false, pinching: false };
let sealed = null;
let db;

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f492', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('folds');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
openDB().then(d => db = d).catch(() => {});

class Particle {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.px = x; this.py = y; // previous for Verlet
    this.vx = 0; this.vy = 0;
    this.mlp = new Float32Array(6); // tiny: 2->2->1 roughly
    this.mlp.set(Array.from({length:6}, () => (Math.random()-0.5)*0.4));
    this.stiffness = 0.8;
    this.rest = 48;
    this.handHist = 0;
  }
  mlpForward(dist, hist) {
    // tiny MLP: inputs dist, hist
    const h1 = Math.tanh(this.mlp[0]*dist + this.mlp[1]*hist + this.mlp[2]);
    const h2 = Math.tanh(this.mlp[3]*h1 + this.mlp[4]);
    return (Math.tanh(this.mlp[5]*h2) + 1) * 0.5; // 0..1
  }
  updateMLP(dist) {
    this.handHist = this.handHist * 0.95 + (dist < 80 ? 1 : 0) * 0.05;
    const out = this.mlpForward(Math.min(dist/200,1), this.handHist);
    this.stiffness = 0.4 + out * 1.2;
    // slight weight plasticity toward recent
    this.mlp[0] += (Math.random()-0.5)*0.002 * this.handHist;
  }
}

function init() {
  particles.length = 0; constraints.length = 0;
  const cols = 7, rows = 6;
  const gap = 50;
  const ox = W/2 - (cols-1)*gap/2, oy = H/2 - (rows-1)*gap/2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (particles.length >= N) break;
      particles.push(new Particle(ox + c*gap, oy + r*gap));
    }
  }
  // structural constraints
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    for (let j = i+1; j < particles.length; j++) {
      const q = particles[j];
      const dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.hypot(dx, dy);
      if (d < 70 && d > 10) constraints.push({ a: i, b: j, rest: d });
    }
  }
}
init();

function step(dt) {
  // gravity / damping
  for (const p of particles) {
    p.vx *= 0.98; p.vy *= 0.98;
    p.vy += 0.05; // slight gravity
    const dx = p.x - hand.x, dy = p.y - hand.y;
    const dist = Math.hypot(dx, dy) || 1;
    p.updateMLP(dist);
    if (hand.active && dist < 120) {
      const f = (120 - dist) * 0.012 * (hand.pinching ? 2.5 : 1);
      p.vx -= (dx / dist) * f;
      p.vy -= (dy / dist) * f;
    }
    p.x += p.vx; p.y += p.vy;
    // bounds
    if (p.x < 10) { p.x = 10; p.vx *= -0.5; }
    if (p.x > W-10) { p.x = W-10; p.vx *= -0.5; }
    if (p.y < 10) { p.y = 10; p.vy *= -0.5; }
    if (p.y > H-10) { p.y = H-10; p.vy *= -0.5; }
  }
  // satisfy constraints (Jacobi, few iterations)
  for (let it = 0; it < 4; it++) {
    for (const c of constraints) {
      const a = particles[c.a], b = particles[c.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const rest = c.rest * ((a.stiffness + b.stiffness) * 0.5);
      const diff = (d - rest) / d;
      const stiff = 0.5 * Math.min(a.stiffness, b.stiffness);
      const ox = dx * diff * stiff * 0.5, oy = dy * diff * stiff * 0.5;
      a.x += ox; a.y += oy;
      b.x -= ox; b.y -= oy;
    }
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(100,180,255,0.25)';
  ctx.lineWidth = 1;
  for (const c of constraints) {
    const a = particles[c.a], b = particles[c.b];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const p of particles) {
    const hue = 200 + p.stiffness * 80;
    ctx.fillStyle = `hsl(${hue}, 70%, ${50 + p.handHist*30}%)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4 + p.handHist*3, 0, Math.PI*2); ctx.fill();
  }
  if (hand.active) {
    ctx.strokeStyle = hand.pinching ? '#f66' : '#6cf';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hand.x, hand.y, hand.pinching ? 18 : 28, 0, Math.PI*2); ctx.stroke();
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(32, now - last); last = now;
  step(dt / 16);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Pointer fallback
canvas.addEventListener('pointermove', e => {
  hand.x = e.clientX; hand.y = e.clientY; hand.active = true;
});
canvas.addEventListener('pointerdown', e => { hand.pinching = true; });
canvas.addEventListener('pointerup', e => { hand.pinching = false; });
canvas.addEventListener('pointerleave', () => hand.active = false);
canvas.addEventListener('dblclick', seal);

// Seal / restore
async function seal() {
  if (!db) { statusEl.textContent = 'IDB unavailable'; return; }
  const data = {
    particles: particles.map(p => ({ x: p.x, y: p.y, mlp: Array.from(p.mlp), stiffness: p.stiffness })),
    constraints: constraints.map(c => ({ a: c.a, b: c.b, rest: c.rest })),
    ts: Date.now()
  };
  const str = JSON.stringify(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  const tx = db.transaction('folds', 'readwrite');
  tx.objectStore('folds').put({ hash, data, ts: Date.now() }, 'latest');
  sealed = hash;
  statusEl.textContent = 'Sealed fold: ' + hash.slice(0,12) + '…';
}
async function restore() {
  if (!db) return;
  const tx = db.transaction('folds', 'readonly');
  const req = tx.objectStore('folds').get('latest');
  req.onsuccess = () => {
    if (!req.result) { statusEl.textContent = 'No sealed fold'; return; }
    const { data, hash } = req.result;
    // restore positions and MLPs (constraints stay structural)
    data.particles.forEach((s, i) => {
      if (particles[i]) {
        particles[i].x = s.x; particles[i].y = s.y;
        particles[i].mlp.set(s.mlp);
        particles[i].stiffness = s.stiffness;
      }
    });
    statusEl.textContent = 'Restored fold ' + (hash||'').slice(0,12) + '…';
  };
}
document.getElementById('sealBtn').onclick = seal;
document.getElementById('restoreBtn').onclick = restore;

// WebXR hand attempt
document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { statusEl.textContent = 'No WebXR — staying in pointer mode'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['hand-tracking', 'local-floor']
    }).catch(() => navigator.xr.requestSession('inline', { optionalFeatures: ['hand-tracking'] }));
    statusEl.textContent = 'XR session started (hand tracking if available)';
    // Minimal XR loop stub — real hand joints would update hand.x/y from pose
    // For prototype, XR presence activates stronger forces; pointer still works as fallback
    hand.active = true;
    session.addEventListener('end', () => { statusEl.textContent = 'XR ended — pointer mode'; hand.active = false; });
    // Note: full hand joint projection requires reference space + frame.getPose; kept lightweight for single-file offline prototype
  } catch (e) {
    statusEl.textContent = 'XR unavailable: ' + e.message + ' — pointer mode';
  }
};
