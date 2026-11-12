const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = 0, H = 0;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// Bayesian linear regression (online, scalar output)
// Input dim = 5: [1, betaNorm, gammaNorm, battery, pointerSpeed]
const DIM = 5;
let mean = new Array(DIM).fill(0);
let prec = Array.from({length: DIM}, (_, i) => Array(DIM).fill(i === 0 ? 0.1 : 0)); // precision matrix, diagonal prior
function matMulVec(M, v) { return M.map(row => row.reduce((s, a, j) => s + a * v[j], 0)); }
function updateBayesian(x, y, learning = 0.8) {
  // Simplified online update approximating Bayesian linear regression
  const pred = mean.reduce((s, m, i) => s + m * x[i], 0);
  const err = y - pred;
  for (let i = 0; i < DIM; i++) mean[i] += learning * err * x[i] * 0.05;
  // Light covariance decay / regularization
}
function predict(x) { return mean.reduce((s, m, i) => s + m * x[i], 0); }

// Sensors
let beta = 0, gamma = 0, battery = 0.7, pointerX = W/2, pointerY = H/2, lastPointer = {x: W/2, y: H/2}, speed = 0;
addEventListener('deviceorientation', e => { beta = (e.beta || 0) / 90; gamma = (e.gamma || 0) / 90; });
if (navigator.getBattery) navigator.getBattery().then(b => { battery = b.level; b.addEventListener('levelchange', () => battery = b.level); }).catch(() => {});
addEventListener('pointermove', e => { pointerX = e.clientX; pointerY = e.clientY; speed = Math.hypot(pointerX - lastPointer.x, pointerY - lastPointer.y) * 0.01; lastPointer = {x: pointerX, y: pointerY}; });

// Particles
const N = 120;
const particles = Array.from({length: N}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: 0, vy: 0,
  q: Math.random() < 0.5 ? 1 : -1,
  r: 2 + Math.random() * 2
}));

// Portals (living DOM charges)
const portals = [];
function addPortal(x = W * (0.2 + Math.random()*0.6), y = H * (0.2 + Math.random()*0.6), q = Math.random() < 0.5 ? 1 : -1) {
  const el = document.createElement('div');
  el.className = 'portal' + (q < 0 ? ' neg' : '');
  el.textContent = q > 0 ? '+Q' : '−Q';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.dataset.q = q;
  let dragging = false, ox = 0, oy = 0;
  el.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - parseFloat(el.style.left); oy = e.clientY - parseFloat(el.style.top); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; });
  el.addEventListener('pointerup', () => dragging = false);
  el.addEventListener('click', e => { e.stopPropagation(); const nq = -parseFloat(el.dataset.q); el.dataset.q = nq; el.className = 'portal' + (nq < 0 ? ' neg' : ''); el.textContent = nq > 0 ? '+Q' : '−Q'; updateBayesian(getX(), nq * 0.5); });
  document.body.appendChild(el);
  portals.push(el);
}
for (let i = 0; i < 5; i++) addPortal();

function getX() {
  return [1, Math.max(-1, Math.min(1, beta)), Math.max(-1, Math.min(1, gamma)), battery, Math.min(2, speed)];
}

// Persistence
const DB_NAME = 'verse-f714';
const STORE = 'posterior';
let db;
const req = indexedDB.open(DB_NAME, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
req.onsuccess = e => { db = e.target.result; loadPosterior(); };
function savePosterior() {
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({ mean, ts: Date.now() }, 'current');
}
function loadPosterior() {
  if (!db) return;
  const tx = db.transaction(STORE, 'readonly');
  const g = tx.objectStore(STORE).get('current');
  g.onsuccess = () => { if (g.result) mean = g.result.mean; };
}
const bc = new BroadcastChannel('verse-f714');
bc.onmessage = e => { if (e.data.mean) mean = e.data.mean; };

document.getElementById('seal').onclick = () => { savePosterior(); bc.postMessage({ mean }); document.getElementById('status').textContent = 'Sealed & broadcast'; };
document.getElementById('reset').onclick = () => { mean.fill(0); document.getElementById('status').textContent = 'Posterior reset'; };
document.getElementById('add').onclick = () => addPortal(pointerX, pointerY);

// Simulation
function step() {
  const x = getX();
  const bias = predict(x); // -2..2 roughly, used as global polarity / force scale
  const forceScale = 80 + bias * 40;

  // Portal charges
  const charges = portals.map(el => ({
    x: parseFloat(el.style.left) + 36,
    y: parseFloat(el.style.top) + 36,
    q: parseFloat(el.dataset.q) * (1 + bias * 0.3)
  }));

  // Pairwise + portal forces (subsampled for perf)
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    let fx = 0, fy = 0;
    // Self pairwise (every 3rd for speed)
    for (let j = i + 1; j < N; j += 3) {
      const o = particles[j];
      const dx = o.x - p.x, dy = o.y - p.y;
      const r2 = dx*dx + dy*dy + 100;
      const f = (p.q * o.q * forceScale) / r2;
      const inv = 1 / Math.sqrt(r2);
      fx -= f * dx * inv; fy -= f * dy * inv;
      o.vx += f * dx * inv * 0.5; o.vy += f * dy * inv * 0.5;
    }
    // Portal charges
    for (const c of charges) {
      const dx = c.x - p.x, dy = c.y - p.y;
      const r2 = dx*dx + dy*dy + 200;
      const f = (p.q * c.q * forceScale * 1.5) / r2;
      const inv = 1 / Math.sqrt(r2);
      fx -= f * dx * inv; fy -= f * dy * inv;
    }
    // Orientation gravity bias
    fx += gamma * 0.4; fy += beta * 0.4;
    p.vx = (p.vx + fx * 0.02) * 0.98;
    p.vy = (p.vy + fy * 0.02) * 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }

  // Draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    ctx.beginPath();
    ctx.fillStyle = p.q > 0 ? '#f6c' : '#6cf';
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  document.getElementById('status').textContent = `bias ${bias.toFixed(2)} | bat ${(battery*100)|0}% | β ${beta.toFixed(2)} γ ${gamma.toFixed(2)}`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Click canvas for reward
cv.addEventListener('click', () => updateBayesian(getX(), (Math.random() - 0.5) * 2));
