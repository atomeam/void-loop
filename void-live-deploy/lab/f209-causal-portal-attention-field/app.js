const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener('resize', resize); resize();

// Sensor history for causal attention
const HISTORY = 8;
let hist = Array.from({length: HISTORY}, () => ({ox:0, oy:0, px:0.5, py:0.5}));
let orient = {beta:0, gamma:0};
let pointer = {x:0.5, y:0.5};
let weights = {w1:0.3, w2:0.4, w3:0.2, bias:0.1}; // tiny attention-like weights

// IndexedDB seal
const DB_NAME = 'f209-portal-mind';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('weights');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function sealWeights() {
  try {
    const db = await openDB();
    const tx = db.transaction('weights', 'readwrite');
    tx.objectStore('weights').put(weights, 'latest');
    alert('Weights sealed to IndexedDB');
  } catch(e) { console.warn('Seal failed', e); }
}
async function loadWeights() {
  try {
    const db = await openDB();
    const tx = db.transaction('weights', 'readonly');
    const req = tx.objectStore('weights').get('latest');
    req.onsuccess = () => { if (req.result) Object.assign(weights, req.result); };
  } catch(e) {}
}
loadWeights();
document.getElementById('seal').onclick = sealWeights;

// Orientation
if (typeof DeviceOrientationEvent !== 'undefined') {
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// Pointer
addEventListener('pointermove', e => {
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
});

// Particles
const particles = [];
const N = 180;
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0, life: 1
  });
}

// Portals
let portals = [];

function updateHistory() {
  hist.shift();
  hist.push({
    ox: orient.gamma / 90, oy: orient.beta / 90,
    px: pointer.x, py: pointer.y
  });
}

function predictNext() {
  // Tiny causal "attention": weighted sum of recent history
  let px = 0, py = 0, ox = 0, oy = 0, sumw = 0;
  for (let i = 0; i < HISTORY; i++) {
    const w = Math.exp(-(HISTORY-1-i)*0.4) * (weights.w1 + weights.w2 * i / HISTORY);
    sumw += w;
    const h = hist[i];
    px += h.px * w; py += h.py * w;
    ox += h.ox * w; oy += h.oy * w;
  }
  if (sumw > 0) { px/=sumw; py/=sumw; ox/=sumw; oy/=sumw; }
  return {px, py, ox, oy};
}

function residual() {
  const pred = predictNext();
  const dx = pointer.x - pred.px;
  const dy = pointer.y - pred.py;
  const dox = (orient.gamma/90) - pred.ox;
  const doy = (orient.beta/90) - pred.oy;
  return Math.sqrt(dx*dx + dy*dy + dox*dox + doy*doy);
}

function step() {
  updateHistory();
  const res = residual();
  document.getElementById('res').textContent = res.toFixed(3);

  // Spawn portal on high residual
  if (res > 0.15 && Math.random() < 0.08 && portals.length < 6) {
    portals.push({
      x: pointer.x * W, y: pointer.y * H,
      strength: res * 80, life: 120 + res*200, id: Date.now()
    });
  }

  // Update portals
  portals = portals.filter(p => {
    p.life--;
    p.strength *= 0.992;
    return p.life > 0 && p.strength > 5;
  });

  // Particles
  for (const p of particles) {
    let fx = 0, fy = 0;
    for (const port of portals) {
      const dx = port.x - p.x, dy = port.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const f = port.strength / d2;
      fx += dx * f; fy += dy * f;
    }
    // mild pointer attraction
    fx += (pointer.x*W - p.x) * 0.002;
    fy += (pointer.y*H - p.y) * 0.002;
    // orientation bias
    fx += orient.gamma * 0.02;
    fy += orient.beta * 0.015;

    p.vx = p.vx * 0.92 + fx;
    p.vy = p.vy * 0.92 + fy;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.7;
    if (p.y < 0 || p.y > H) p.vy *= -0.7;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }

  // Evolve weights lightly based on portal occupancy
  if (portals.length > 0 && Math.random() < 0.02) {
    const fitness = portals.reduce((s,p)=>s+p.strength,0);
    weights.w1 += (Math.random()-0.5)*0.01 * (fitness>100?1:-0.3);
    weights.w2 = Math.max(0.1, Math.min(0.8, weights.w2 + (Math.random()-0.5)*0.005));
  }

  // Morph UI based on portal activity
  const activity = portals.reduce((s,p)=>s + p.strength, 0) / 400;
  document.documentElement.style.setProperty('--hue', 180 + activity * 80);
  document.documentElement.style.setProperty('--scale', 1 + Math.min(0.08, activity*0.02));
  document.documentElement.style.setProperty('--blur', (activity*2) + 'px');
  document.documentElement.style.setProperty('--portal-glow', Math.min(1, activity));

  document.getElementById('pc').textContent = particles.length;
  document.getElementById('pt').textContent = portals.length;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);

  // particles
  ctx.fillStyle = 'rgba(140,180,255,0.7)';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI*2);
    ctx.fill();
  }

  // portals
  for (const p of portals) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 40 + p.strength);
    g.addColorStop(0, 'rgba(80,200,255,0.4)');
    g.addColorStop(1, 'rgba(80,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 40 + p.strength*0.5, 0, Math.PI*2);
    ctx.fill();
  }
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// DOM portal markers (hybrid embodiment)
function syncMarkers() {
  document.querySelectorAll('.portal-marker').forEach(el => el.remove());
  for (const p of portals) {
    const m = document.createElement('div');
    m.className = 'portal-marker';
    m.style.left = p.x + 'px';
    m.style.top = p.y + 'px';
    m.style.opacity = Math.min(1, p.strength / 60);
    document.body.appendChild(m);
  }
}
setInterval(syncMarkers, 100);
