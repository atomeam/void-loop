const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
addEventListener('resize', () => { W = cv.width = innerWidth; H = cv.height = innerHeight; });

let hand = { x: W/2, y: H/2, active: false };
let agents = Array.from({length: 24}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0,
  genome: { freq: Math.random()*8 + 2, amp: Math.random()*0.5 + 0.2, phase: Math.random()*Math.PI*2 },
  fitness: 0
}));
let spectral = new Float32Array(64);
let bestFitness = 0;
let bestGenome = null;

function updateSpectral(hx, hy) {
  for (let i = 0; i < spectral.length; i++) {
    const f = (i / spectral.length) * 10;
    const residual = Math.sin(f * 0.5 + performance.now()*0.001 + agents[0].genome.phase) * agents[0].genome.amp;
    const dist = Math.hypot(hx - W/2, hy - H/2) / Math.max(W,H);
    spectral[i] = spectral[i]*0.95 + residual * (1 - dist*0.5) + Math.random()*0.01;
  }
}

function step() {
  updateSpectral(hand.x, hand.y);
  agents.forEach(a => {
    const dx = hand.x - a.x, dy = hand.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    a.vx += (dx / d) * a.genome.amp * 0.2;
    a.vy += (dy / d) * a.genome.amp * 0.2;
    a.vx *= 0.95; a.vy *= 0.95;
    a.x = (a.x + a.vx + W) % W;
    a.y = (a.y + a.vy + H) % H;
    if (d < 40) a.fitness += 0.1;
    if (a.fitness > bestFitness) { bestFitness = a.fitness; bestGenome = {...a.genome}; }
  });
  // simple transfer on high fitness
  if (Math.random() < 0.02 && bestGenome) {
    const low = agents.reduce((m, a) => a.fitness < m.fitness ? a : m, agents[0]);
    low.genome = {...bestGenome, phase: bestGenome.phase + (Math.random()-0.5)*0.2};
    low.fitness *= 0.5;
  }
  draw();
  requestAnimationFrame(step);
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  // spectral bars
  for (let i = 0; i < spectral.length; i++) {
    const h = Math.abs(spectral[i]) * 80;
    ctx.fillStyle = `hsl(${i*5},70%,50%)`;
    ctx.fillRect(i * (W/spectral.length), H/2 - h/2, W/spectral.length - 1, h);
  }
  agents.forEach(a => {
    ctx.fillStyle = `hsla(${a.genome.freq*40},80%,60%,0.8)`;
    ctx.beginPath(); ctx.arc(a.x, a.y, 4 + a.fitness*0.1, 0, Math.PI*2); ctx.fill();
  });
  if (hand.active) {
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 20, 0, Math.PI*2); ctx.stroke();
  }
  document.getElementById('status').textContent = `Hand: ${hand.active?'XR':'pointer'} · Best fitness: ${bestFitness.toFixed(1)}`;
}

cv.addEventListener('pointermove', e => { hand.x = e.clientX; hand.y = e.clientY; hand.active = true; });
cv.addEventListener('pointerleave', () => hand.active = false);

// simple portals
const portalsEl = document.getElementById('portals');
for (let i = 0; i < 4; i++) {
  const p = document.createElement('div');
  p.className = 'portal';
  p.style.left = (20 + i*120) + 'px';
  p.style.top = (H - 80) + 'px';
  p.textContent = 'Portal ' + i;
  p.draggable = true;
  portalsEl.appendChild(p);
  p.addEventListener('pointerdown', e => { e.target.style.cursor = 'grabbing'; });
  p.addEventListener('pointermove', e => {
    if (e.buttons) { e.target.style.left = (e.clientX - 50) + 'px'; e.target.style.top = (e.clientY - 30) + 'px'; }
  });
}

document.getElementById('sealBtn').onclick = async () => {
  if (!bestGenome) return;
  const db = await new Promise(r => { const req = indexedDB.open('f659', 1); req.onupgradeneeded = () => req.result.createObjectStore('genomes'); req.onsuccess = () => r(req.result); });
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({genome: bestGenome, fitness: bestFitness, t: Date.now()}, 'best');
  const bc = new BroadcastChannel('f659-genome');
  bc.postMessage({genome: bestGenome, fitness: bestFitness});
  alert('Sealed best genome to IndexedDB + BroadcastChannel');
};

// WebXR hand stub (pointer is primary; XR if available)
document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available; using pointer'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    document.getElementById('status').textContent = 'WebXR session started (hand tracking optional)';
    // full XR loop would go here; for prototype, pointer remains active
    session.end();
  } catch(e) { alert('XR request failed: ' + e.message); }
};

step();
