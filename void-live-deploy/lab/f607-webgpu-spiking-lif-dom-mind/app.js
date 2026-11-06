const N = 64;
const nodesEl = document.getElementById('nodes');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let w, h;
function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// LIF state
const V = new Float32Array(N);
const thresh = new Float32Array(N).fill(1.0);
const leak = 0.08;
const weights = new Float32Array(N * N);
const lastSpike = new Float32Array(N);
const rate = new Float32Array(N);
let t = 0;
const domNodes = [];

// init sparse random weights
function initWeights() {
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      weights[i*N + j] = (Math.random() < 0.12 && i !== j) ? (Math.random() - 0.4) * 0.8 : 0;
    }
  }
  for (let i = 0; i < N; i++) thresh[i] = 0.8 + Math.random() * 0.4;
}
initWeights();

// DOM embodiment
for (let i = 0; i < N; i++) {
  const el = document.createElement('div');
  el.className = 'node';
  el.textContent = i;
  el.dataset.i = i;
  const col = i % 8, row = Math.floor(i / 8);
  el.style.left = (12 + col * (innerWidth-80)/8) + 'px';
  el.style.top = (80 + row * (innerHeight-160)/8) + 'px';
  nodesEl.appendChild(el);
  domNodes.push(el);
  el.addEventListener('pointerdown', e => { e.preventDefault(); forceSpike(i); });
}

// inputs
let px = 0, py = 0, vx = 0, vy = 0, beta = 0, gamma = 0;
addEventListener('pointermove', e => {
  vx = (e.clientX - px) * 0.05; vy = (e.clientY - py) * 0.05;
  px = e.clientX; py = e.clientY;
});
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    beta = (e.beta || 0) / 90; gamma = (e.gamma || 0) / 90;
  });
}

function forceSpike(i) {
  V[i] = thresh[i] + 0.5;
}

// WebGPU optional particle layer (simple fallback always works)
let gpu = false, device, context, pipeline;
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    gpu = true;
    statusEl.textContent += ' | WebGPU on';
  } catch(e) { gpu = false; }
}
tryWebGPU();

// particles for spikes
const particles = [];
function emitSpike(i, x, y) {
  for (let k = 0; k < 3; k++) {
    particles.push({ x, y, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 1 });
  }
}

function step() {
  t++;
  // input currents to first 8
  const inputs = [vx, vy, beta, gamma, Math.sin(t*0.01), Math.cos(t*0.007)];
  for (let s = 0; s < 6; s++) {
    V[s] += inputs[s] * 0.15;
  }

  const spikes = [];
  for (let i = 0; i < N; i++) {
    V[i] += -leak * V[i];
    // recurrent
    let I = 0;
    for (let j = 0; j < N; j++) I += weights[i*N + j] * (lastSpike[j] > 0 ? 1 : 0);
    V[i] += I * 0.3;
    if (V[i] >= thresh[i]) {
      spikes.push(i);
      V[i] = 0;
      lastSpike[i] = 8;
      rate[i] = rate[i] * 0.95 + 0.05;
      const el = domNodes[i];
      el.classList.add('spike');
      setTimeout(() => el.classList.remove('spike'), 80);
      const rect = el.getBoundingClientRect();
      emitSpike(i, rect.left + 24, rect.top + 24);
    } else {
      rate[i] *= 0.98;
    }
    if (lastSpike[i] > 0) lastSpike[i]--;
    // visual
    const el = domNodes[i];
    const sc = 0.7 + rate[i] * 0.8;
    el.style.transform = `translate(-50%,-50%) scale(${sc})`;
    el.style.opacity = 0.4 + rate[i] * 0.6;
  }

  // entropy / sync for chrome
  let mean = 0, ent = 0;
  for (let i = 0; i < N; i++) mean += rate[i];
  mean /= N;
  for (let i = 0; i < N; i++) {
    const p = rate[i] / (mean + 0.01);
    if (p > 0) ent -= p * Math.log(p + 1e-6);
  }
  document.documentElement.style.setProperty('--hue', 180 + ent * 20);
  document.documentElement.style.setProperty('--sat', (40 + mean * 40) + '%');

  // particles
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,w,h);
  for (let p of particles) {
    p.x += p.vx; p.y += p.vy; p.life -= 0.02;
    if (p.life > 0) {
      ctx.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')},80%,60%,${p.life})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2 + p.life*3, 0, 6.28); ctx.fill();
    }
  }
  particles.splice(0, particles.length - 200); // cap

  const active = spikes.length;
  statusEl.textContent = `spikes:${active} meanRate:${mean.toFixed(3)} ent:${ent.toFixed(2)} ${gpu?'GPU':'CPU'} | drag cards to force`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Seal + persistence
const dbName = 'f607-spiking-mind';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'hash' });
req.onsuccess = e => db = e.target.result;

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

const channel = new BroadcastChannel('f607-genome');
channel.onmessage = async e => {
  if (e.data.hash && e.data.weights) {
    // adopt if better entropy proxy (longer hash or just always for demo)
    statusEl.textContent = 'received genome ' + e.data.hash.slice(0,8);
    weights.set(e.data.weights);
    if (e.data.thresh) thresh.set(e.data.thresh);
  }
};

document.getElementById('seal').onclick = async () => {
  const wArr = Array.from(weights);
  const tArr = Array.from(thresh);
  const payload = JSON.stringify({w: wArr, t: tArr});
  const hash = await sha256(payload);
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ hash, weights: wArr, thresh: tArr, time: Date.now() });
  }
  channel.postMessage({ hash, weights: wArr, thresh: tArr });
  statusEl.textContent = 'sealed ' + hash.slice(0,12) + '...';
};

document.getElementById('reward').onclick = () => {
  for (let i = 0; i < N; i++) thresh[i] *= 0.97;
};
document.getElementById('reset').onclick = () => { initWeights(); for(let i=0;i<N;i++) { V[i]=0; rate[i]=0; } };
addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') document.getElementById('reward').click(); });

// load last sealed on start
setTimeout(() => {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const store = tx.objectStore('genomes');
  const all = store.getAll();
  all.onsuccess = () => {
    if (all.result.length) {
      const latest = all.result.sort((a,b)=>b.time-a.time)[0];
      weights.set(latest.weights);
      if (latest.thresh) thresh.set(latest.thresh);
      statusEl.textContent = 'loaded sealed ' + latest.hash.slice(0,8);
    }
  };
}, 500);
