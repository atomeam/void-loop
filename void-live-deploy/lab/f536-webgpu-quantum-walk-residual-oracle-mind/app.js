const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('title');
const hudEl = document.getElementById('hud');
const ctx2d = canvas.getContext('2d');

let agents = [];
const N = 4000;
const residual = new Float32Array(256 * 256);
let entropy = 0;
let pointer = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
let audioCentroid = 0.5;
let mlp = null;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Simple MLP oracle
class MLP {
  constructor() {
    this.w1 = Array.from({length: 4}, () => Array.from({length: 16}, () => Math.random()*0.2-0.1));
    this.b1 = Array(16).fill(0);
    this.w2 = Array.from({length: 16}, () => Array.from({length: 3}, () => Math.random()*0.2-0.1));
    this.b2 = Array(3).fill(0);
  }
  relu(x) { return Math.max(0, x); }
  forward(inp) {
    const h = this.w1.map((row, i) => this.relu(row.reduce((s, w, j) => s + w * inp[j], this.b1[i])));
    return this.w2[0].map((_, k) => h.reduce((s, hval, j) => s + this.w2[j][k] * hval, this.b2[k]));
  }
  update(inp, target) {
    // tiny online step
    const out = this.forward(inp);
    const err = out.map((o, i) => target[i] - o);
    // very light update (demo)
    for (let k = 0; k < 3; k++) this.b2[k] += 0.01 * err[k];
  }
}
mlp = new MLP();

function initAgents() {
  agents = Array.from({length: N}, () => ({
    x: Math.random(), y: Math.random(),
    ax: Math.random()*2-1, ay: Math.random()*2-1, // amplitude proxy
    life: 1
  }));
}

// Residual persistence
async function loadResidual() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-residual', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('map');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('map', 'readonly');
    const req = tx.objectStore('map').get('density');
    await new Promise(r => { req.onsuccess = () => r(); req.onerror = r; });
    if (req.result) residual.set(req.result);
  } catch (e) { console.warn('idb', e); }
}
async function saveResidual() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-residual', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('map', 'readwrite');
    tx.objectStore('map').put(residual.slice(), 'density');
  } catch (e) {}
}

function step() {
  const inp = [pointer.vx, pointer.vy, audioCentroid, entropy * 0.01];
  const bias = mlp.forward(inp);
  const bx = Math.tanh(bias[0]) * 0.004;
  const by = Math.tanh(bias[1]) * 0.004;
  const coin = Math.tanh(bias[2]);

  let total = 0;
  for (let i = 0; i < N; i++) {
    const a = agents[i];
    // simplified quantum-inspired walk step
    a.ax = a.ax * Math.cos(coin) - a.ay * Math.sin(coin) + bx;
    a.ay = a.ax * Math.sin(coin) + a.ay * Math.cos(coin) + by;
    const norm = Math.hypot(a.ax, a.ay) || 1;
    a.x = (a.x + a.ax / norm * 0.008 + 1) % 1;
    a.y = (a.y + a.ay / norm * 0.008 + 1) % 1;
    // deposit residual
    const gx = (a.x * 255) | 0, gy = (a.y * 255) | 0;
    residual[gy * 256 + gx] += 0.002;
    total += residual[gy * 256 + gx];
  }
  // decay residual
  for (let i = 0; i < residual.length; i++) residual[i] *= 0.9995;
  entropy = Math.log(1 + total / N);

  // oracle update toward residual concentration
  const target = [pointer.vx * 2, pointer.vy * 2, 0];
  mlp.update(inp, target);

  // UI morph
  const glow = Math.min(1, entropy * 0.4);
  titleEl.style.letterSpacing = (0.05 + glow * 0.15) + 'em';
  titleEl.style.textShadow = `0 0 ${8 + glow*20}px rgba(120,180,255,${0.4+glow*0.5})`;
  document.body.style.boxShadow = `inset 0 0 ${20+glow*40}px rgba(80,140,255,${0.1+glow*0.2})`;
}

function draw() {
  ctx2d.fillStyle = 'rgba(10,10,18,0.25)';
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  ctx2d.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i += 2) {
    const a = agents[i];
    const g = residual[((a.y*255)|0)*256 + ((a.x*255)|0)] || 0;
    ctx2d.fillStyle = `hsla(${200 + g*40}, 80%, ${50 + Math.min(40,g*20)}%, ${0.4 + Math.min(0.5,g)})`;
    ctx2d.beginPath();
    ctx2d.arc(a.x * canvas.width, a.y * canvas.height, 1.2 + g*2, 0, 6.28);
    ctx2d.fill();
  }
  ctx2d.globalCompositeOperation = 'source-over';
  // residual heatmap overlay (sparse)
  for (let i = 0; i < 256*256; i += 64) {
    if (residual[i] > 0.05) {
      const x = (i % 256) / 256 * canvas.width;
      const y = ((i / 256)|0) / 256 * canvas.height;
      ctx2d.fillStyle = `rgba(100,180,255,${Math.min(0.15, residual[i]*0.3)})`;
      ctx2d.fillRect(x, y, 4, 4);
    }
  }
}

let last = 0;
function loop(t) {
  if (t - last > 16) {
    step();
    draw();
    statusEl.textContent = `agents ${N} · residual entropy ${entropy.toFixed(2)} · oracle bias active · WebGPU: fallback canvas`;
    last = t;
  }
  requestAnimationFrame(loop);
}

addEventListener('pointermove', e => {
  const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight;
  pointer.vx = nx - pointer.x; pointer.vy = ny - pointer.y;
  pointer.x = nx; pointer.y = ny;
});
addEventListener('click', e => {
  const gx = (e.clientX / innerWidth * 255)|0, gy = (e.clientY / innerHeight * 255)|0;
  residual[gy*256 + gx] += 2;
});

// optional mic
let micStarted = false;
addEventListener('pointerdown', async () => {
  if (micStarted) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    setInterval(() => {
      an.getByteFrequencyData(data);
      let sum = 0, w = 0;
      for (let i = 0; i < data.length; i++) { sum += i * data[i]; w += data[i]; }
      audioCentroid = w ? (sum / w) / data.length : 0.5;
    }, 100);
    micStarted = true;
    hudEl.textContent += ' · mic active';
  } catch (e) { /* denied */ }
}, { once: true });

initAgents();
loadResidual().then(() => {
  statusEl.textContent = 'loaded residual · running';
  requestAnimationFrame(loop);
  setInterval(saveResidual, 30000);
});
