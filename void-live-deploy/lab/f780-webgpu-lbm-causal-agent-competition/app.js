'use strict';
const N = 96; // grid
const AGENTS = 8;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stat = document.getElementById('stat');
const note = document.getElementById('note');
let W = 0, H = 0, scale = 1;

function resize() {
  W = canvas.width = innerWidth * devicePixelRatio;
  H = canvas.height = innerHeight * devicePixelRatio;
  scale = Math.min(W, H) / N;
}
addEventListener('resize', resize);
resize();

// Simple LBM-like density/velocity field (CPU for reliability; WebGPU path sketched)
let dens = new Float32Array(N * N);
let ux = new Float32Array(N * N);
let uy = new Float32Array(N * N);
let tmp = new Float32Array(N * N);
function idx(x, y) { return ((y + N) % N) * N + ((x + N) % N); }

function initField() {
  for (let i = 0; i < N * N; i++) {
    dens[i] = 0.8 + Math.random() * 0.4;
    ux[i] = (Math.random() - 0.5) * 0.05;
    uy[i] = (Math.random() - 0.5) * 0.05;
  }
}
initField();

// Tiny causal LMS model: inputs [ax, ay, pvx, pvy] -> [fx, fy, tau]
let weights = new Float32Array(4 * 3).fill(0);
let lr = 0.01;
function predict(u) {
  let fx = 0, fy = 0, tau = 0.8;
  for (let i = 0; i < 4; i++) {
    fx += weights[i] * u[i];
    fy += weights[4 + i] * u[i];
    tau += weights[8 + i] * u[i] * 0.1;
  }
  return [fx * 0.002, fy * 0.002, Math.max(0.5, Math.min(1.2, tau))];
}
function train(u, targetFx, targetFy) {
  const [fx, fy] = predict(u);
  const errX = targetFx - fx, errY = targetFy - fy;
  for (let i = 0; i < 4; i++) {
    weights[i] += lr * errX * u[i];
    weights[4 + i] += lr * errY * u[i];
  }
}

// Agents
const agents = [];
for (let i = 0; i < AGENTS; i++) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.style.setProperty('--h', (i * 40) % 360);
  document.body.appendChild(el);
  agents.push({
    x: Math.random() * N, y: Math.random() * N,
    vx: 0, vy: 0, energy: 0.5, genome: new Float32Array(weights),
    el, id: i
  });
}

let pointer = { x: 0, y: 0, vx: 0, vy: 0, down: false };
let motion = { ax: 0, ay: 0 };
let bestEnergy = 0;

canvas.addEventListener('pointermove', e => {
  const nx = e.clientX / innerWidth * N;
  const ny = e.clientY / innerHeight * N;
  pointer.vx = nx - pointer.x;
  pointer.vy = ny - pointer.y;
  pointer.x = nx; pointer.y = ny;
  if (pointer.down) inject(nx, ny, pointer.vx, pointer.vy);
});
canvas.addEventListener('pointerdown', () => pointer.down = true);
canvas.addEventListener('pointerup', () => pointer.down = false);

if (window.DeviceMotionEvent) {
  addEventListener('devicemotion', e => {
    if (e.accelerationIncludingGravity) {
      motion.ax = e.accelerationIncludingGravity.x || 0;
      motion.ay = e.accelerationIncludingGravity.y || 0;
    }
  });
}

function inject(x, y, vx, vy) {
  const ix = Math.floor(x), iy = Math.floor(y);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = idx(ix + dx, iy + dy);
    dens[i] = Math.min(2, dens[i] + 0.3);
    ux[i] += vx * 0.05;
    uy[i] += vy * 0.05;
  }
}

function stepLBM() {
  const u = [motion.ax * 0.1, motion.ay * 0.1, pointer.vx, pointer.vy];
  const [fx, fy, tau] = predict(u);
  // simple relaxation + force + diffusion (LBM-inspired)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    let nx = 0, ny = 0, nd = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = idx(x + dx, y + dy);
      const w = (dx === 0 && dy === 0) ? 4 : (Math.abs(dx) + Math.abs(dy) === 1 ? 2 : 1);
      nd += dens[j] * w;
      nx += ux[j] * dens[j] * w;
      ny += uy[j] * dens[j] * w;
    }
    nd /= 16; nx /= 16; ny /= 16;
    tmp[i] = dens[i] * (1 - 1 / tau) + nd / tau;
    ux[i] = ux[i] * 0.9 + nx * 0.1 + fx;
    uy[i] = uy[i] * 0.9 + ny * 0.1 + fy;
  }
  dens.set(tmp);
  // mild decay
  for (let i = 0; i < N * N; i++) {
    dens[i] = dens[i] * 0.998 + 0.002;
    ux[i] *= 0.99; uy[i] *= 0.99;
  }
}

function stepAgents() {
  let top = 0;
  agents.forEach(a => {
    const ix = Math.floor(a.x), iy = Math.floor(a.y);
    const i = idx(ix, iy);
    a.vx += ux[i] * 0.4;
    a.vy += uy[i] * 0.4;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = (a.x + a.vx + N) % N;
    a.y = (a.y + a.vy + N) % N;
    // harvest shear energy
    const shear = Math.abs(ux[i]) + Math.abs(uy[i]);
    a.energy = Math.min(2, a.energy * 0.995 + shear * 0.05);
    if (a.energy > top) top = a.energy;
    // competition: nearby weaker agents transfer genome
    agents.forEach(b => {
      if (b === a) return;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < 9 && a.energy > b.energy + 0.2) {
        // seal transfer
        for (let k = 0; k < weights.length; k++) b.genome[k] = a.genome[k] * 0.9 + (Math.random() - 0.5) * 0.02;
        b.energy *= 0.7;
        a.energy += 0.05;
      }
    });
    // DOM
    a.el.style.left = (a.x / N * innerWidth) + 'px';
    a.el.style.top = (a.y / N * innerHeight) + 'px';
    a.el.style.opacity = 0.6 + a.energy * 0.4;
    a.el.classList.toggle('best', a.energy > top * 0.9);
  });
  bestEnergy = top;
  // train model toward useful force (simple: increase energy)
  if (pointer.down || Math.abs(motion.ax) + Math.abs(motion.ay) > 0.5) {
    const u = [motion.ax * 0.1, motion.ay * 0.1, pointer.vx, pointer.vy];
    train(u, pointer.vx * 0.01, pointer.vy * 0.01);
  }
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const d = Math.min(1, dens[i] * 0.7);
    const spd = Math.min(1, Math.hypot(ux[i], uy[i]) * 8);
    const r = Math.floor(40 + spd * 180);
    const g = Math.floor(60 + d * 120);
    const b = Math.floor(180 + d * 70);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  // upscale
  const tmpC = document.createElement('canvas');
  tmpC.width = N; tmpC.height = N;
  tmpC.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmpC, 0, 0, W, H);
}

function frame() {
  stepLBM();
  stepAgents();
  render();
  stat.textContent = `agents ${AGENTS} · best energy ${bestEnergy.toFixed(2)} · force model active`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Seal
document.getElementById('seal').addEventListener('click', async () => {
  const best = agents.reduce((a, b) => a.energy > b.energy ? a : b);
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f780-genomes', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ id: Date.now(), genome: Array.from(best.genome), energy: best.energy });
    note.textContent = `sealed genome of agent ${best.id} (energy ${best.energy.toFixed(2)})`;
  } catch (e) {
    note.textContent = 'IndexedDB unavailable; genome kept in memory';
  }
});

// Load previous seals on start
(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f780-genomes', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').getAll();
    req.onsuccess = () => {
      if (req.result.length) {
        const last = req.result[req.result.length - 1];
        weights.set(last.genome);
        agents.forEach(a => a.genome.set(last.genome));
        note.textContent = 'restored last sealed genome';
      }
    };
  } catch (e) { console.debug("lab f780-webgpu-lbm-causal-agent-competition:", e); }
})();

note.textContent = 'drag / tilt / shake to stir · click Seal to persist best genome';
