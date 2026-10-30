const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = 60, H = 40;
let cellW, cellH;
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  cellW = canvas.width / W;
  cellH = canvas.height / H;
}
resize();
addEventListener('resize', resize);

let grid = new Float32Array(W * H);
let next = new Float32Array(W * H);
function initGrid() {
  for (let i = 0; i < grid.length; i++) grid[i] = (Math.random() - 0.5) * 0.4;
}
initGrid();

// Tiny MLP: 11 inputs → 8 hidden → 1 output
const IN = 11, HID = 8, OUT = 1;
const GENOME_LEN = IN * HID + HID * OUT;
let weights = new Float32Array(GENOME_LEN);
function randomWeights() {
  for (let i = 0; i < GENOME_LEN; i++) weights[i] = (Math.random() - 0.5) * 0.8;
}
randomWeights();

function mlp(inputs, w) {
  const h = new Float32Array(HID);
  let p = 0;
  for (let j = 0; j < HID; j++) {
    let s = 0;
    for (let i = 0; i < IN; i++) s += inputs[i] * w[p++];
    h[j] = Math.max(0, s); // ReLU
  }
  let o = 0;
  for (let j = 0; j < HID; j++) o += h[j] * w[p++];
  return Math.tanh(o * 0.5); // bounded Δ
}

let pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0 };
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  pointer.dx = nx - pointer.x;
  pointer.dy = ny - pointer.y;
  pointer.x = nx;
  pointer.y = ny;
});

function step() {
  const pxi = Math.floor(pointer.x * W);
  const pyi = Math.floor(pointer.y * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const inputs = new Float32Array(IN);
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (x + dx + W) % W;
          const ny = (y + dy + H) % H;
          inputs[k++] = grid[ny * W + nx];
        }
      }
      // pointer relative
      inputs[9] = (x - pxi) / W;
      inputs[10] = (y - pyi) / H;
      const delta = mlp(inputs, weights);
      let s = grid[i] + delta * 0.15;
      // inject near pointer
      const d2 = (x - pxi)**2 + (y - pyi)**2;
      if (d2 < 9) s += 0.08 * (1 - d2/9);
      next[i] = Math.max(-1, Math.min(1, s * 0.98));
    }
  }
  [grid, next] = [next, grid];
}

function render() {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = grid[y * W + x];
      const hue = 200 + s * 80;
      const light = 30 + Math.abs(s) * 40;
      ctx.fillStyle = `hsl(${hue},70%,${light}%)`;
      ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
    }
  }
}

// Metrics
function metrics() {
  let sum = 0, sum2 = 0, act = 0;
  for (let v of grid) { sum += v; sum2 += v*v; act += Math.abs(v); }
  const mean = sum / grid.length;
  const variance = sum2 / grid.length - mean*mean;
  const entropy = Math.min(1, Math.sqrt(Math.max(0, variance)) * 2);
  return { entropy, variance, activity: act / grid.length };
}

// Morph
function applyMorph(m) {
  document.documentElement.style.setProperty('--hue', (m.entropy * 120).toFixed(1));
  document.documentElement.style.setProperty('--blur', (m.variance * 2).toFixed(2) + 'px');
  document.documentElement.style.setProperty('--contrast', (1 + m.activity * 0.4).toFixed(2));
  document.documentElement.style.setProperty('--scale', (1 + m.entropy * 0.04).toFixed(3));
  document.getElementById('metrics').textContent =
    `entropy: ${m.entropy.toFixed(2)} · var: ${m.variance.toFixed(3)} · act: ${m.activity.toFixed(2)}`;
}

// Simple audio
let audioCtx, osc, gain;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 80;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
}
addEventListener('pointerdown', () => { if (!audioCtx) initAudio(); }, { once: true });

function updateAudio(m) {
  if (!osc) return;
  osc.frequency.setTargetAtTime(60 + m.activity * 140, audioCtx.currentTime, 0.1);
  gain.gain.setTargetAtTime(0.02 + m.entropy * 0.06, audioCtx.currentTime, 0.1);
}

// Worker for evolution (blob)
const workerCode = `
let pop = [];
const N = 4, LEN = ${GENOME_LEN};
function randG() {
  const g = new Float32Array(LEN);
  for (let i = 0; i < LEN; i++) g[i] = (Math.random()-0.5)*0.8;
  return g;
}
for (let i = 0; i < N; i++) pop.push({ w: randG(), fit: 0 });
onmessage = e => {
  const { metrics, pointer } = e.data;
  // crude fitness
  for (let p of pop) {
    p.fit = metrics.entropy * 1.2 + metrics.activity * 0.6 - Math.abs(metrics.variance - 0.15) * 0.5;
    if (pointer) p.fit += 0.1;
  }
  pop.sort((a,b) => b.fit - a.fit);
  // mutate top, replace bottom
  const best = pop[0].w.slice();
  for (let i = 2; i < N; i++) {
    const child = best.slice();
    for (let j = 0; j < LEN; j++) if (Math.random() < 0.08) child[j] += (Math.random()-0.5)*0.3;
    pop[i] = { w: child, fit: 0 };
  }
  postMessage({ best: Array.from(pop[0].w) });
};
`;
let worker;
try {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    if (e.data.best) weights = new Float32Array(e.data.best);
  };
} catch (err) {
  console.warn('Worker blocked', err);
}

// Seal
document.getElementById('seal').onclick = async () => {
  const m = metrics();
  const payload = { weights: Array.from(weights).slice(0, 32), m, t: Date.now() };
  const buf = new TextEncoder().encode(JSON.stringify(payload));
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f036', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ hash: hex, ...payload }, hex);
    alert('Sealed: ' + hex);
  } catch (e) { alert('Seal failed: ' + e.message); }
};
document.getElementById('reset').onclick = () => { initGrid(); randomWeights(); };

let lastMind = 0;
function loop(t) {
  step();
  render();
  const m = metrics();
  applyMorph(m);
  updateAudio(m);
  if (worker && t - lastMind > 2000) {
    worker.postMessage({ metrics: m, pointer: true });
    lastMind = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
