const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const cohEl = document.getElementById('coh');
const varEl = document.getElementById('var');
const npartEl = document.getElementById('npart');
let coherence = 0.3, variance = 0.2;
function updateUI() {
  document.documentElement.style.setProperty('--coherence', coherence.toFixed(3));
  document.documentElement.style.setProperty('--variance', variance.toFixed(3));
  document.documentElement.style.setProperty('--hue', (200 + coherence * 80).toFixed(0));
  cohEl.textContent = coherence.toFixed(2);
  varEl.textContent = variance.toFixed(2);
}
updateUI();

// Simple Canvas2D fallback particle system with simulated Hebbian (main thread for reliability)
const ctx = canvas.getContext('2d');
let particles = [];
const N = 400;
let pointer = {x: 0, y: 0, active: false};
let orient = {beta: 0, gamma: 0};

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random()-0.5)*2,
      vy: (Math.random()-0.5)*2,
      mem: [Math.random()*0.2, Math.random()*0.2, Math.random()*0.2, Math.random()*0.2],
      active: 0
    });
  }
  npartEl.textContent = N;
}
initParticles();

// Hebbian update (simplified local)
function hebbianStep() {
  const lr = 0.02;
  let sumAbs = 0, sumVar = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    // Activation from pointer / orient
    const dx = p.x - pointer.x;
    const dy = p.y - pointer.y;
    const dist = Math.hypot(dx, dy);
    p.active = pointer.active ? Math.max(0, 1 - dist / 180) : 0;
    p.active += Math.abs(orient.beta) / 90 * 0.3;
    // Simple neighbor Hebbian (sample)
    for (let k = 0; k < 3; k++) {
      const j = (i + k * 17) % particles.length;
      const q = particles[j];
      const nd = Math.hypot(p.x - q.x, p.y - q.y);
      if (nd < 80 && p.active > 0.2 && q.active > 0.2) {
        for (let m = 0; m < 4; m++) {
          p.mem[m] += lr * p.active * q.active * (q.mem[m] - p.mem[m] * 0.1);
          p.mem[m] = Math.max(-1, Math.min(1, p.mem[m]));
        }
      }
    }
    sumAbs += Math.abs(p.mem.reduce((a,b)=>a+b,0)/4);
  }
  coherence = Math.min(1, sumAbs / particles.length * 2);
  variance = Math.min(1, Math.random()*0.1 + coherence * 0.4); // approx
  updateUI();
}

function step() {
  // Physics
  const cx = pointer.active ? pointer.x : canvas.width/2 + Math.sin(Date.now()/2000)*100;
  const cy = pointer.active ? pointer.y : canvas.height/2;
  for (const p of particles) {
    const dx = cx - p.x, dy = cy - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx += (dx / d) * 0.15 * (p.active + 0.2);
    p.vy += (dy / d) * 0.15 * (p.active + 0.2);
    p.vx *= 0.96; p.vy *= 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -0.5;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(canvas.width, p.x));
    p.y = Math.max(0, Math.min(canvas.height, p.y));
  }
  if (Math.random() < 0.3) hebbianStep();

  // Render
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for (const p of particles) {
    const m = (Math.abs(p.mem[0]) + Math.abs(p.mem[1])) * 0.5;
    ctx.fillStyle = `hsla(${200 + m*80}, 70%, ${50 + p.active*30}%, ${0.4 + m*0.5})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + m*3, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Input
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
});
canvas.addEventListener('pointerleave', () => pointer.active = false);

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
  statusEl.textContent = 'Pointer + orientation active. Hebbian learning on.';
} else {
  statusEl.textContent = 'Pointer active (orientation unavailable). Hebbian learning on.';
}

// Persistence
document.getElementById('seal').onclick = async () => {
  const snap = particles.slice(0, 50).map(p => p.mem);
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f303', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('mem');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem', 'readwrite');
    tx.objectStore('mem').put(snap, 'champion');
    statusEl.textContent = 'Sealed to IndexedDB.';
  } catch(e) { statusEl.textContent = 'Seal failed (memory only).'; }
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f303', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem');
    const req = tx.objectStore('mem').get('champion');
    req.onsuccess = () => {
      if (req.result) {
        req.result.forEach((m, i) => { if (particles[i]) particles[i].mem = m; });
        statusEl.textContent = 'Loaded sealed memory.';
      }
    };
  } catch(e) { statusEl.textContent = 'No sealed memory.'; }
};
document.getElementById('reset').onclick = () => { initParticles(); statusEl.textContent = 'Reset.'; };

statusEl.textContent = 'Ready — move pointer to seed associations.';
