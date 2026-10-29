const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const statusEl = document.getElementById('status');
const enEl = document.getElementById('en');
const resEl = document.getElementById('res');

// Particles for fluid-like diffusion
const N = 50;
const particles = Array.from({length:N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

// Reservoir (Echo State) — main thread for simplicity, Worker note
const RES = 16;
let Wres = Array.from({length:RES}, () => Array.from({length:RES}, () => (Math.random()<0.3 ? (Math.random()-0.5)*1.2 : 0)));
let state = new Float32Array(RES);
let readout = Array.from({length:RES}, () => (Math.random()-0.5)*0.5);
let leak = 0.25;
let energy = 0;
let residual = 0;
let lastPred = 0;
let lastDx = 0, lastDy = 0;
let beta = 0, gamma = 0;

function stepReservoir(inputs) {
  // inputs: [b, g, res, 1]
  const next = new Float32Array(RES);
  for (let i = 0; i < RES; i++) {
    let s = inputs[3]; // bias
    for (let j = 0; j < RES; j++) s += Wres[i][j] * state[j];
    s += inputs[0]*0.8 + inputs[1]*0.8 + inputs[2]*1.2;
    next[i] = (1-leak)*state[i] + leak * Math.tanh(s);
  }
  state.set(next);
  let pred = 0;
  for (let i = 0; i < RES; i++) pred += readout[i] * state[i];
  energy = 0;
  for (let i = 0; i < RES; i++) energy += state[i]*state[i];
  energy = Math.sqrt(energy / RES);
  return pred;
}

// Probes
const probes = [];
for (let i = 0; i < 3; i++) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.textContent = 'mem ' + (i+1);
  el.style.left = (100 + i*120) + 'px';
  el.style.top = (120 + i*40) + 'px';
  document.getElementById('probes').appendChild(el);
  probes.push({ el, x: 100+i*120, y: 120+i*40, vx:0, vy:0, dragging:false });
  el.addEventListener('pointerdown', e => { probes[i].dragging = true; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup', e => { probes[i].dragging = false; injectPulse(i); });
  el.addEventListener('pointermove', e => {
    if (!probes[i].dragging) return;
    probes[i].x = e.clientX - 36;
    probes[i].y = e.clientY - 24;
  });
}

function injectPulse(idx) {
  // inject into reservoir
  for (let k = 0; k < 4; k++) state[(idx*4 + k) % RES] += (Math.random()-0.5)*1.5;
  statusEl.textContent = 'pulse injected';
}

// Pointer residual
let px = W/2, py = H/2;
addEventListener('pointermove', e => {
  const dx = e.clientX - px, dy = e.clientY - py;
  residual = Math.hypot(dx - lastDx, dy - lastDy);
  lastDx = dx; lastDy = dy;
  px = e.clientX; py = e.clientY;
});

// Orientation
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') startOrient(); });
  } else startOrient();
};
function startOrient() {
  addEventListener('deviceorientation', e => {
    beta = e.beta || 0;
    gamma = e.gamma || 0;
  });
  statusEl.textContent = 'orient on';
}

// IndexedDB
let db;
const req = indexedDB.open('f288', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('seal');
req.onsuccess = e => { db = e.target.result; };
function seal() {
  if (!db) return;
  const tx = db.transaction('seal', 'readwrite');
  tx.objectStore('seal').put({ Wres, state: Array.from(state), readout, energy, residual }, 'latest');
  statusEl.textContent = 'sealed';
}
function load() {
  if (!db) return;
  const tx = db.transaction('seal', 'readonly');
  tx.objectStore('seal').get('latest').onsuccess = e => {
    const d = e.target.result;
    if (!d) return;
    Wres = d.Wres; state.set(d.state); readout = d.readout;
    statusEl.textContent = 'loaded';
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;

function frame() {
  const pred = stepReservoir([beta/90, gamma/90, residual*0.1, 1]);
  residual = Math.abs(residual - Math.abs(pred)*10); // simple residual update
  lastPred = pred;

  // fluid update
  const visc = 0.92 - energy * 0.15;
  const forceScale = 0.4 + energy * 1.2;
  for (const p of particles) {
    p.vx += (gamma/90) * forceScale * 0.3 + (Math.random()-0.5)*0.2;
    p.vy += (beta/90) * forceScale * 0.3 + (Math.random()-0.5)*0.2;
    p.vx *= visc; p.vy *= visc;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }

  // draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = `hsla(${200 + energy*80}, 70%, 60%, 0.6)`;
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 2 + energy*3, 0, Math.PI*2); ctx.fill();
  }

  // probes morph
  probes.forEach((pr, i) => {
    if (!pr.dragging) {
      let near = 0;
      for (const p of particles) {
        const d = Math.hypot(p.x - pr.x - 36, p.y - pr.y - 24);
        if (d < 80) near += (80-d)/80;
      }
      const targetX = pr.x + (Math.sin(performance.now()/800 + i) * 20 * energy);
      const targetY = pr.y + (Math.cos(performance.now()/900 + i) * 15 * energy);
      pr.x += (targetX - pr.x) * 0.05;
      pr.y += (targetY - pr.y) * 0.05;
      pr.el.style.opacity = 0.5 + Math.min(1, near*0.3 + energy);
      pr.el.style.transform = `scale(${1 + energy*0.4})`;
    }
    pr.el.style.left = pr.x + 'px';
    pr.el.style.top = pr.y + 'px';
  });

  // chrome morph
  document.body.style.filter = `hue-rotate(${energy*40}deg)`;
  enEl.textContent = energy.toFixed(2);
  resEl.textContent = residual.toFixed(2);
  requestAnimationFrame(frame);
}
statusEl.textContent = 'running';
requestAnimationFrame(frame);
