const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const fitnessEl = document.getElementById('fitness');
const portalsEl = document.getElementById('portals');

let W = innerWidth, H = innerHeight;
canvas.width = W; canvas.height = H;

const N = 48; // lattice resolution
const cell = Math.min(W, H) / N;
let density = new Float32Array(N * N);
let ux = new Float32Array(N * N);
let uy = new Float32Array(N * N);
let vort = new Float32Array(N * N);

// Simple multi-head attention state (3 heads, tiny)
const HEADS = 3;
let attnW = Array.from({length: HEADS}, () => Math.random() * 0.4 - 0.2);
let hist = [];
const HIST = 8;

// Portals
const MAX_PORTALS = 6;
let portals = [];

function idx(x, y) { return ((y + N) % N) * N + ((x + N) % N); }

function initLattice() {
  for (let i = 0; i < N * N; i++) {
    density[i] = 1.0 + (Math.random() - 0.5) * 0.1;
    ux[i] = 0; uy[i] = 0;
  }
}

function stepLBM(forceX, forceY, tauMod) {
  // Simplified LBM-like: advection + diffusion + force + local relaxation
  const tau = 0.8 + tauMod * 0.3;
  const nextD = new Float32Array(N * N);
  const nextUx = new Float32Array(N * N);
  const nextUy = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      // simple neighbor average + force
      let d = 0, vx = 0, vy = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = idx(x + dx, y + dy);
          d += density[j];
          vx += ux[j];
          vy += uy[j];
          cnt++;
        }
      }
      d /= cnt; vx /= cnt; vy /= cnt;
      // force + relaxation
      vx = vx * (1 - 1/tau) + forceX * 0.02;
      vy = vy * (1 - 1/tau) + forceY * 0.02;
      nextD[i] = Math.max(0.2, Math.min(3, d));
      nextUx[i] = vx;
      nextUy[i] = vy;
    }
  }
  density.set(nextD);
  ux.set(nextUx);
  uy.set(nextUy);
  // vorticity approx
  for (let y = 1; y < N-1; y++) {
    for (let x = 1; x < N-1; x++) {
      const i = idx(x, y);
      const dvx = uy[idx(x+1,y)] - uy[idx(x-1,y)];
      const dvy = ux[idx(x,y+1)] - ux[idx(x,y-1)];
      vort[i] = dvx - dvy;
    }
  }
}

function attention(pointerDx, pointerDy, localVort) {
  hist.push({dx: pointerDx, dy: pointerDy, v: localVort});
  if (hist.length > HIST) hist.shift();
  // tiny multi-head: each head scores a different lag
  let modForce = 0, modTau = 0, modSource = 0;
  for (let h = 0; h < HEADS; h++) {
    const lag = hist[Math.max(0, hist.length - 1 - h*2)] || {dx:0,dy:0,v:0};
    const score = Math.tanh(attnW[h] * (lag.dx + lag.dy * 0.7 + lag.v * 2));
    modForce += score * (0.4 + h*0.2);
    modTau += score * 0.3;
    modSource += Math.abs(score) * 0.5;
  }
  return { force: modForce / HEADS, tau: modTau / HEADS, source: modSource / HEADS };
}

let mouseX = W/2, mouseY = H/2, lastX = mouseX, lastY = mouseY;
let webgpu = false;

async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    webgpu = true;
    statusEl.textContent = 'WebGPU ready (compute path sketched)';
    // In a full version a compute shader would own the lattice buffers.
    // This prototype keeps the JS kernel for guaranteed interactivity.
  } catch (e) { /* fallback */ }
}

function spawnPortals() {
  const sites = [];
  for (let y = 2; y < N-2; y++) {
    for (let x = 2; x < N-2; x++) {
      const i = idx(x, y);
      if (Math.abs(vort[i]) > 0.15) sites.push({x, y, v: Math.abs(vort[i]), d: density[i]});
    }
  }
  sites.sort((a,b) => b.v - a.v);
  portals = sites.slice(0, MAX_PORTALS).map((s, i) => ({
    lx: s.x, ly: s.y,
    px: (s.x / N) * W, py: (s.y / N) * H,
    v: s.v, d: s.d,
    glyph: ['V','E','R','S','E','M'][i % 6],
    el: null
  }));
  portalsEl.innerHTML = '';
  portals.forEach(p => {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = p.glyph;
    el.style.left = (p.px - 24) + 'px';
    el.style.top = (p.py - 24) + 'px';
    const hue = 200 + p.v * 120;
    el.style.background = `radial-gradient(circle, hsla(${hue},80%,60%,0.9), hsla(${hue+40},70%,30%,0.4))`;
    el.style.transform = `scale(${0.7 + p.d * 0.3})`;
    el.onclick = () => rewardPortal(p);
    portalsEl.appendChild(el);
    p.el = el;
  });
}

let fitness = 0;
function rewardPortal(p) {
  // evolve attention toward higher engagement
  const target = Math.min(1, p.v * 2);
  for (let h = 0; h < HEADS; h++) {
    attnW[h] += (target - attnW[h]) * 0.15 + (Math.random()-0.5)*0.05;
    attnW[h] = Math.max(-1.2, Math.min(1.2, attnW[h]));
  }
  fitness = Math.max(fitness, p.v * 3 + portals.length * 0.2);
  fitnessEl.textContent = 'fitness: ' + fitness.toFixed(2);
  statusEl.textContent = 'rewarded · evolved';
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N*N; i++) {
    const d = density[i];
    const v = Math.abs(vort[i]);
    const r = Math.min(255, d * 80 + v * 180);
    const g = Math.min(255, d * 40);
    const b = Math.min(255, 120 + v * 100);
    img.data[i*4] = r; img.data[i*4+1] = g; img.data[i*4+2] = b; img.data[i*4+3] = 255;
  }
  // upscale
  const tmp = document.createElement('canvas');
  tmp.width = N; tmp.height = N;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);
}

let lastTime = 0;
function loop(t) {
  const dt = t - lastTime;
  if (dt > 16) {
    const dx = mouseX - lastX, dy = mouseY - lastY;
    const gx = Math.floor(mouseX / W * N), gy = Math.floor(mouseY / H * N);
    const localV = vort[idx(gx, gy)] || 0;
    const mod = attention(dx * 0.1, dy * 0.1, localV);
    stepLBM(mod.force + dx*0.01, mod.force*0.7 + dy*0.01, mod.tau);
    // inject at cursor
    const ci = idx(gx, gy);
    density[ci] = Math.min(2.5, density[ci] + 0.3 * mod.source);
    spawnPortals();
    draw();
    lastX = mouseX; lastY = mouseY;
    lastTime = t;
  }
  requestAnimationFrame(loop);
}

// persistence
const DB = 'verse-f581';
async function seal() {
  const genome = { attnW, fitness, ts: Date.now() };
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(genome, 'current');
      statusEl.textContent = 'sealed';
    };
  } catch (e) { statusEl.textContent = 'seal session-only'; }
  // broadcast
  try {
    const bc = new BroadcastChannel('f581-genome');
    bc.postMessage(genome);
  } catch (e) {}
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initLattice(); attnW = attnW.map(() => Math.random()*0.4-0.2); fitness=0; };

addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; });
addEventListener('resize', () => { W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; });

tryWebGPU();
initLattice();
statusEl.textContent = webgpu ? 'WebGPU + LBM' : 'Canvas LBM fallback';
requestAnimationFrame(loop);

// listen for genome
try {
  const bc = new BroadcastChannel('f581-genome');
  bc.onmessage = e => {
    if (e.data.fitness > fitness) {
      attnW = e.data.attnW.slice();
      fitness = e.data.fitness;
      statusEl.textContent = 'adopted higher genome';
    }
  };
} catch (e) {}
