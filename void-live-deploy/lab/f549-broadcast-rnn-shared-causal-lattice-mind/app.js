const W = 32, H = 32;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize(); addEventListener('resize', resize);

// Lattice: activation[W*H], phase[W*H]
let act = new Float32Array(W * H);
let phase = new Float32Array(W * H);
let fitness = 0;

// Elman RNN: input 9 → hidden 16 → out 3
const HIDDEN = 16;
let Wxh = new Float32Array(HIDDEN * 9);
let Whh = new Float32Array(HIDDEN * HIDDEN);
let Why = new Float32Array(3 * HIDDEN);
let bh = new Float32Array(HIDDEN);
let by = new Float32Array(3);
let h = new Float32Array(HIDDEN);
function randW(a) { for (let i = 0; i < a.length; i++) a[i] = (Math.random() - 0.5) * 0.4; }
function initRNN() { randW(Wxh); randW(Whh); randW(Why); randW(bh); randW(by); h.fill(0); }
initRNN();

function tanh(x) { return Math.tanh(x); }
function rnnForward(neigh) {
  const newH = new Float32Array(HIDDEN);
  for (let i = 0; i < HIDDEN; i++) {
    let s = bh[i];
    for (let j = 0; j < 9; j++) s += Wxh[i * 9 + j] * neigh[j];
    for (let j = 0; j < HIDDEN; j++) s += Whh[i * HIDDEN + j] * h[j];
    newH[i] = tanh(s);
  }
  h.set(newH);
  const out = new Float32Array(3);
  for (let i = 0; i < 3; i++) {
    let s = by[i];
    for (let j = 0; j < HIDDEN; j++) s += Why[i * HIDDEN + j] * h[j];
    out[i] = tanh(s);
  }
  return out;
}

function sampleNeigh(cx, cy) {
  const n = new Float32Array(9);
  let k = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = (cx + dx + W) % W, y = (cy + dy + H) % H;
    n[k++] = act[y * W + x];
  }
  return n;
}

// Persistence
const DB_NAME = 'f549-shared-lattice';
let db;
function openDB() {
  return new Promise(res => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => res();
  });
}
async function saveState() {
  if (!db) return;
  const tx = db.transaction('state', 'readwrite');
  tx.objectStore('state').put({ act: Array.from(act), phase: Array.from(phase), fitness, ts: Date.now() }, 'lattice');
  const w = { Wxh: Array.from(Wxh), Whh: Array.from(Whh), Why: Array.from(Why), bh: Array.from(bh), by: Array.from(by), h: Array.from(h) };
  tx.objectStore('state').put(w, 'weights');
}
async function loadState() {
  if (!db) return;
  const tx = db.transaction('state', 'readonly');
  const lat = await new Promise(r => tx.objectStore('state').get('lattice').onsuccess = e => r(e.target.result));
  const w = await new Promise(r => tx.objectStore('state').get('weights').onsuccess = e => r(e.target.result));
  if (lat && lat.act) { act.set(lat.act); phase.set(lat.phase || 0); fitness = lat.fitness || 0; }
  if (w) {
    Wxh.set(w.Wxh); Whh.set(w.Whh); Why.set(w.Why); bh.set(w.bh); by.set(w.by); if (w.h) h.set(w.h);
  }
}

// Broadcast
let peers = 0;
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('f549-lattice') : null;
if (bc) {
  bc.onmessage = e => {
    const m = e.data;
    if (m.type === 'delta' && m.act) {
      // soft merge
      for (let i = 0; i < act.length; i++) act[i] = act[i] * 0.85 + m.act[i] * 0.15;
      peers = Math.max(peers, 1);
    } else if (m.type === 'sealed' && m.hash) {
      // simple adopt if higher fitness
      if (m.fitness > fitness + 0.05) {
        if (m.weights) {
          Wxh.set(m.weights.Wxh); /* similarly for others in real impl */
          fitness = m.fitness;
        }
      }
    } else if (m.type === 'hello') peers++;
  };
  bc.postMessage({ type: 'hello' });
}

function hashWeights() {
  let hsh = 0;
  for (let i = 0; i < Math.min(32, Wxh.length); i++) hsh = (hsh * 31 + Math.round(Wxh[i] * 1000)) | 0;
  return hsh.toString(16);
}

// Sensors
let ori = { beta: 0, gamma: 0 };
let ptr = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
addEventListener('deviceorientation', e => { ori.beta = e.beta || 0; ori.gamma = e.gamma || 0; }, true);
addEventListener('pointermove', e => {
  const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight;
  ptr.vx = nx - ptr.x; ptr.vy = ny - ptr.y;
  ptr.x = nx; ptr.y = ny;
  inject(ptr.x, ptr.y, 0.4 + Math.hypot(ptr.vx, ptr.vy) * 2);
});

function inject(fx, fy, str) {
  const x = Math.floor(fx * W), y = Math.floor(fy * H);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = (x + dx + W) % W, yy = (y + dy + H) % H;
    const d = Math.hypot(dx, dy);
    act[yy * W + xx] += str * Math.exp(-d * d * 0.5);
  }
}

// Observers
const cards = [];
for (let i = 0; i < 4; i++) {
  const c = document.createElement('div');
  c.className = 'card';
  c.style.left = (20 + i * 110) + 'px';
  c.style.top = (innerHeight - 80) + 'px';
  c.textContent = 'Obs ' + i;
  document.body.appendChild(c);
  let drag = false, ox, oy;
  c.addEventListener('pointerdown', e => { drag = true; ox = e.clientX - parseFloat(c.style.left); oy = e.clientY - parseFloat(c.style.top); c.classList.add('dragging'); });
  addEventListener('pointermove', e => { if (drag) { c.style.left = (e.clientX - ox) + 'px'; c.style.top = (e.clientY - oy) + 'px'; } });
  addEventListener('pointerup', () => { drag = false; c.classList.remove('dragging'); });
  cards.push({ el: c, x: 0, y: 0 });
}

let lastEmit = 0;
function step(ts) {
  // Sensor inject
  const ox = 0.5 + ori.gamma / 180 * 0.4;
  const oy = 0.5 + ori.beta / 180 * 0.4;
  if (Math.abs(ori.beta) + Math.abs(ori.gamma) > 5) inject(ox, oy, 0.15);

  // RNN emit every ~120ms
  if (ts - lastEmit > 120) {
    lastEmit = ts;
    const cx = Math.floor(Math.random() * W), cy = Math.floor(Math.random() * H);
    const neigh = sampleNeigh(cx, cy);
    const out = rnnForward(neigh);
    const ex = (out[0] * 0.5 + 0.5) * W, ey = (out[1] * 0.5 + 0.5) * H;
    const str = Math.max(0, out[2] * 0.6);
    if (str > 0.05) inject(ex / W, ey / H, str);
    fitness = fitness * 0.99 + Math.abs(out[2]) * 0.01;
  }

  // Diffuse + decay
  const next = new Float32Array(act);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      s += act[((y + dy + H) % H) * W + (x + dx + W) % W];
    }
    next[y * W + x] = Math.max(-1, Math.min(1, s / 9 * 0.92 + act[y * W + x] * 0.05));
  }
  act.set(next);

  // Render
  const cellW = innerWidth / W, cellH = innerHeight / H;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = act[y * W + x];
    const v = Math.min(1, Math.abs(a));
    ctx.fillStyle = a > 0 ? `rgba(100,180,255,${v})` : `rgba(255,100,140,${v})`;
    ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
  }

  // Cards
  cards.forEach((c, i) => {
    const sx = parseFloat(c.el.style.left) / innerWidth * W;
    const sy = parseFloat(c.el.style.top) / innerHeight * H;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    const val = act[iy * W + ix] || 0;
    c.el.textContent = `Obs${i}\n${val.toFixed(2)}`;
  });

  document.getElementById('status').textContent = `Peers: ${peers} | Fitness: ${fitness.toFixed(3)}`;

  // Broadcast delta occasionally
  if (bc && Math.random() < 0.05) {
    bc.postMessage({ type: 'delta', act: Array.from(act).map(v => Math.round(v * 100) / 100), ts: Date.now() });
  }

  requestAnimationFrame(step);
}

document.getElementById('seal').onclick = async () => {
  await saveState();
  if (bc) bc.postMessage({ type: 'sealed', hash: hashWeights(), fitness, weights: { Wxh: Array.from(Wxh).slice(0, 20) } });
  alert('Sealed to IndexedDB + broadcast');
};
document.getElementById('reset').onclick = () => { act.fill(0); phase.fill(0); fitness = 0; initRNN(); };

openDB().then(loadState).then(() => requestAnimationFrame(step));
