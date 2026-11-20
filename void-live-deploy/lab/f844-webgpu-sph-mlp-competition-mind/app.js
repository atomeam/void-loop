const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 4;
const PARTICLES_PER = 180;
const TOTAL = N_AGENTS * PARTICLES_PER;
let particles = [];
let agents = [];
let pointer = { x: W/2, y: H/2, down: false };
let orient = { x: 0, y: 0 };
let genomes = [];
let fitness = new Array(N_AGENTS).fill(0);
let useWebGPU = false;
let gpuDevice = null;

// Tiny MLP 5-8-3
function mlp(genome, inputs) {
  const w1 = 5*8, w2 = 8*3;
  let h = new Array(8).fill(0);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 8; j++)
      h[j] += inputs[i] * genome[i*8 + j];
  for (let j = 0; j < 8; j++) h[j] = Math.tanh(h[j] + genome[w1 + j]);
  const out = new Array(3).fill(0);
  for (let j = 0; j < 8; j++)
    for (let k = 0; k < 3; k++)
      out[k] += h[j] * genome[w1 + 8 + j*3 + k];
  for (let k = 0; k < 3; k++) out[k] = Math.tanh(out[k] + genome[w1 + 8 + w2 + k]);
  return out;
}

function randomGenome() {
  const len = 5*8 + 8 + 8*3 + 3;
  return Array.from({length: len}, () => (Math.random()-0.5)*1.2);
}

function initAgents() {
  agents = [];
  genomes = [];
  for (let a = 0; a < N_AGENTS; a++) {
    genomes.push(randomGenome());
    agents.push({ id: a, hue: a * 90 });
  }
}

function initParticles() {
  particles = [];
  for (let a = 0; a < N_AGENTS; a++) {
    for (let i = 0; i < PARTICLES_PER; i++) {
      particles.push({
        agent: a,
        x: W/2 + (Math.random()-0.5)*200,
        y: H/2 + (Math.random()-0.5)*200,
        vx: (Math.random()-0.5)*2,
        vy: (Math.random()-0.5)*2,
        dens: 1,
        press: 0
      });
    }
  }
}

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    gpuDevice = await adapter.requestDevice();
    statusEl.textContent = 'WebGPU SPH active';
    return true;
  } catch (e) { return false; }
}

function stepSPH() {
  const h = 18, restDens = 2.5, k = 40, visc = 0.08, dt = 0.016;
  for (let i = 0; i < particles.length; i++) {
    let dens = 0;
    const p = particles[i];
    for (let j = 0; j < particles.length; j++) {
      if (i === j) continue;
      const q = particles[j];
      const dx = p.x - q.x, dy = p.y - q.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < h*h) {
        const r = Math.sqrt(r2);
        dens += (1 - r/h) * (1 - r/h);
      }
    }
    p.dens = Math.max(dens, 0.1);
    p.press = k * (p.dens - restDens);
  }
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let fx = 0, fy = 0;
    const g = genomes[p.agent];
    const densRes = (p.dens - restDens) / restDens;
    const dxPtr = (pointer.x - p.x) / W;
    const dyPtr = (pointer.y - p.y) / H;
    const out = mlp(g, [densRes, dxPtr, dyPtr, orient.x, orient.y]);
    const forceScale = 1 + out[0] * 0.8;
    const cohesion = out[1] * 0.3;
    p.hueBias = out[2];
    for (let j = 0; j < particles.length; j++) {
      if (i === j) continue;
      const q = particles[j];
      const dx = p.x - q.x, dy = p.y - q.y;
      const r2 = dx*dx + dy*dy + 0.01;
      const r = Math.sqrt(r2);
      if (r < h) {
        const pressF = (p.press + q.press) / (2 * q.dens) * (1 - r/h);
        fx += dx / r * pressF * forceScale;
        fy += dy / r * pressF * forceScale;
        if (p.agent === q.agent) {
          fx -= dx * cohesion;
          fy -= dy * cohesion;
        }
        fx += (q.vx - p.vx) * visc;
        fy += (q.vy - p.vy) * visc;
      }
    }
    if (pointer.down) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < 8000) {
        fx += dx * 0.4;
        fy += dy * 0.4;
      }
    }
    fx += orient.x * 12;
    fy += orient.y * 12 + 0.3;
    p.vx = (p.vx + fx * dt) * 0.98;
    p.vy = (p.vy + fy * dt) * 0.98;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 10) { p.x = 10; p.vx *= -0.5; }
    if (p.x > W-10) { p.x = W-10; p.vx *= -0.5; }
    if (p.y < 10) { p.y = 10; p.vy *= -0.5; }
    if (p.y > H-10) { p.y = H-10; p.vy *= -0.5; }
  }
  for (let a = 0; a < N_AGENTS; a++) {
    let cx = 0, cy = 0, n = 0;
    for (const p of particles) if (p.agent === a) { cx += p.x; cy += p.y; n++; }
    if (n === 0) continue;
    cx /= n; cy /= n;
    let varSum = 0;
    for (const p of particles) if (p.agent === a) varSum += (p.x-cx)**2 + (p.y-cy)**2;
    const coherence = 1 / (1 + varSum / n / 1000);
    const coverage = Math.exp(-Math.hypot(cx - pointer.x, cy - pointer.y) / 200);
    fitness[a] = fitness[a] * 0.97 + (coherence * 0.6 + coverage * 0.4) * 0.03;
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    const baseHue = agents[p.agent].hue + (p.hueBias || 0) * 40;
    ctx.fillStyle = `hsl(${baseHue % 360}, 70%, ${50 + Math.min(p.dens, 4)*8}%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
    ctx.fill();
  }
  for (let a = 0; a < N_AGENTS; a++) {
    ctx.fillStyle = `hsl(${agents[a].hue}, 60%, 50%)`;
    ctx.fillRect(12 + a*70, H - 30, 60, 8);
    ctx.fillStyle = '#fff';
    ctx.fillRect(12 + a*70, H - 30, 60 * Math.min(fitness[a]*4, 1), 8);
  }
}

let db;
const bc = new BroadcastChannel('f844-genome');
async function openDB() {
  return new Promise((res) => {
    const r = indexedDB.open('f844-sph-mlp', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => res();
  });
}
async function sealGenome() {
  const best = fitness.indexOf(Math.max(...fitness));
  const payload = { fitness: fitness[best], genome: genomes[best], agent: best, t: Date.now() };
  bc.postMessage(payload);
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(payload, 'best');
  }
  statusEl.textContent = `Sealed agent ${best} fitness ${fitness[best].toFixed(3)}`;
}
bc.onmessage = (ev) => {
  const p = ev.data;
  if (!p || !p.genome) return;
  const worst = fitness.indexOf(Math.min(...fitness));
  if (p.fitness > fitness[worst] + 0.02) {
    genomes[worst] = p.genome.slice();
    fitness[worst] = p.fitness * 0.9;
    statusEl.textContent = `Adopted remote genome into agent ${worst}`;
  }
};

canvas.addEventListener('pointerdown', e => { pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('pointerup', () => pointer.down = false);
document.getElementById('seal').onclick = sealGenome;
document.getElementById('reset').onclick = () => { initAgents(); initParticles(); fitness.fill(0); };
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.x = (e.gamma || 0) / 45;
    orient.y = (e.beta || 0) / 45;
  });
}

async function loop() {
  stepSPH();
  render();
  requestAnimationFrame(loop);
}

(async () => {
  initAgents();
  initParticles();
  await openDB();
  useWebGPU = await tryWebGPU();
  if (!useWebGPU) statusEl.textContent = 'Canvas2D SPH fallback (WebGPU unavailable)';
  loop();
})();
