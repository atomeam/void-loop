const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
let W, H, dpr = devicePixelRatio || 1;
function resize() {
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.scale(dpr, dpr);
}
resize(); addEventListener('resize', resize);

const N_AGENTS = 3;
const PARTICLES_PER = 180;
const TOTAL = N_AGENTS * PARTICLES_PER;
let agents = [];
let particles = [];
let orientation = {x:0, y:0, alpha:0};
let pointer = {x:0.5, y:0.5};
let usePointer = true;
let db = null;

function initAgents() {
  agents = [];
  for (let i = 0; i < N_AGENTS; i++) {
    agents.push({
      id: i,
      weights: Array.from({length: 8}, () => (Math.random()-0.5)*0.4),
      fitness: 0,
      color: `hsl(${i*120},70%,60%)`,
      sealed: false
    });
  }
}
function initParticles() {
  particles = [];
  for (let a = 0; a < N_AGENTS; a++) {
    for (let p = 0; p < PARTICLES_PER; p++) {
      particles.push({
        x: Math.random()*W, y: Math.random()*H,
        vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
        agent: a
      });
    }
  }
}
initAgents(); initParticles();

const DB_NAME = 'f190-neural-particles';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath: 'id'});
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = () => res(null);
  });
}
async function sealChampion() {
  if (!db) return;
  const champ = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const payload = {id: 'champion', weights: champ.weights, fitness: champ.fitness, ts: Date.now()};
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put(payload);
  statusEl.textContent = `Sealed agent ${champ.id} (fit ${champ.fitness.toFixed(1)})`;
}
async function loadSealed() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  const req = tx.objectStore('genomes').get('champion');
  req.onsuccess = () => {
    if (req.result && req.result.weights) {
      agents[0].weights = req.result.weights;
      statusEl.textContent = 'Restored sealed champion into agent 0';
    }
  };
}

function onOrient(e) {
  usePointer = false;
  const beta = e.beta || 0;
  const gamma = e.gamma || 0;
  orientation.x = Math.max(-1, Math.min(1, gamma / 45));
  orientation.y = Math.max(-1, Math.min(1, beta / 45));
}
addEventListener('deviceorientation', onOrient);
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
  if (usePointer) {
    orientation.x = (pointer.x - 0.5) * 2;
    orientation.y = (pointer.y - 0.5) * 2;
  }
});

function agentBias(agent, ox, oy) {
  const w = agent.weights;
  const bx = w[0]*ox + w[1]*oy + w[2];
  const by = w[3]*ox + w[4]*oy + w[5];
  return {bx: bx*12, by: by*12};
}

function step() {
  const focusX = W * (0.5 + orientation.x * 0.35);
  const focusY = H * (0.5 + orientation.y * 0.35);
  for (const p of particles) {
    const ag = agents[p.agent];
    const bias = agentBias(ag, orientation.x, orientation.y);
    const dx = focusX - p.x, dy = focusY - p.y;
    const dist = Math.hypot(dx, dy) + 1;
    p.vx += (dx / dist) * 0.35 + bias.bx * 0.08;
    p.vy += (dy / dist) * 0.35 + bias.by * 0.08;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }
  const centroids = agents.map(() => ({x:0,y:0,n:0}));
  for (const p of particles) {
    centroids[p.agent].x += p.x; centroids[p.agent].y += p.y; centroids[p.agent].n++;
  }
  agents.forEach((ag, i) => {
    if (centroids[i].n) {
      const cx = centroids[i].x / centroids[i].n;
      const cy = centroids[i].y / centroids[i].n;
      const d = Math.hypot(cx - focusX, cy - focusY);
      ag.fitness = Math.max(0, 400 - d) * 0.05 + ag.fitness * 0.98;
    }
  });
}

function transfer() {
  const sorted = [...agents].sort((a,b) => b.fitness - a.fitness);
  const champ = sorted[0];
  const worst = sorted[sorted.length-1];
  worst.weights = champ.weights.map(w => w + (Math.random()-0.5)*0.15);
  worst.fitness *= 0.6;
  statusEl.textContent = `Transfer: agent ${champ.id} → ${worst.id} (mutated)`;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,15,0.25)';
  ctx.fillRect(0,0,W,H);
  const fx = W * (0.5 + orientation.x * 0.35);
  const fy = H * (0.5 + orientation.y * 0.35);
  ctx.strokeStyle = '#fff4';
  ctx.beginPath(); ctx.arc(fx, fy, 18, 0, Math.PI*2); ctx.stroke();
  for (const p of particles) {
    ctx.fillStyle = agents[p.agent].color;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(p.x-1.5, p.y-1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
  agents.forEach(ag => {
    ctx.fillStyle = ag.color;
    ctx.font = '12px system-ui';
    ctx.fillText(`A${ag.id} ${ag.fitness.toFixed(0)}`, 12, H - 40 + ag.id*16);
  });
}

let lastTransfer = 0;
function loop(t) {
  step();
  draw();
  if (t - lastTransfer > 6000) { transfer(); lastTransfer = t; }
  requestAnimationFrame(loop);
}

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    statusEl.textContent = 'WebGPU available (compute kernels ready for extension)';
    return true;
  } catch { return false; }
}

document.getElementById('seal').onclick = sealChampion;
document.getElementById('transfer').onclick = transfer;
document.getElementById('reset').onclick = () => { initAgents(); initParticles(); statusEl.textContent = 'Reset'; };

(async () => {
  await openDB();
  await loadSealed();
  const hasGPU = await tryWebGPU();
  statusEl.textContent = hasGPU ? 'WebGPU detected · Canvas particles active' : 'Canvas2D neural particles (WebGPU fallback)';
  requestAnimationFrame(loop);
})();
