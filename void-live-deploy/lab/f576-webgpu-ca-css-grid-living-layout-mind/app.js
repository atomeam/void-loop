const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const VIS = document.getElementById('vis');
const VCTX = VIS.getContext('2d');
const W = 64, H = 48;
let grid = new Uint8Array(W * H);
let next = new Uint8Array(W * H);
let rules = new Uint8Array(4 * 4 * 4); // simple lookup: s0,s1,s2 -> new (simplified)
let density = 0.3, entropy = 0.5, cx = 50, cy = 50;
let useGPU = false;
let adapter, device, pipeline, bindGroup;

// Init cards
const CARDS = [
  { t: 'Clock', d: 'Live time' },
  { t: 'Timer', d: 'Countdown' },
  { t: 'Note', d: 'Sticky' },
  { t: 'Calc', d: 'Units' },
  { t: 'Shape', d: 'Draw' },
  { t: 'Link', d: 'Card' },
  { t: 'List', d: 'Tasks' },
  { t: 'Color', d: 'Palette' }
];
CARDS.forEach((c, i) => {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<h3>${c.t}</h3><p>${c.d}</p>`;
  el.onclick = () => injectAt(i % 4 * 16, Math.floor(i / 4) * 12);
  STAGE.appendChild(el);
});

function randRules() {
  for (let i = 0; i < rules.length; i++) rules[i] = (Math.random() * 4) | 0;
}
randRules();

function seed() {
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < 0.15 ? (Math.random() * 3 | 0) + 1 : 0;
}

function stepCPU() {
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const n = grid[i - 1] + grid[i + 1] + grid[i - W] + grid[i + W];
      const s = grid[i];
      const key = (s * 16 + (n & 3) * 4 + (grid[i - W - 1] & 3)) % rules.length;
      next[i] = rules[key] % 4;
    }
  }
  [grid, next] = [next, grid];
}

function computeStats() {
  let act = 0, e = 0, sx = 0, sy = 0;
  const counts = [0,0,0,0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = grid[y * W + x];
      counts[s]++;
      if (s) { act++; sx += x; sy += y; }
    }
  }
  density = act / (W * H);
  const tot = act || 1;
  for (let c of counts) if (c) e -= (c / tot) * Math.log2(c / tot + 1e-9);
  entropy = Math.min(1, e / 2);
  cx = act ? (sx / act / W) * 100 : 50;
  cy = act ? (sy / act / H) * 100 : 50;
  document.documentElement.style.setProperty('--density', density.toFixed(3));
  document.documentElement.style.setProperty('--entropy', entropy.toFixed(3));
  document.documentElement.style.setProperty('--cx', cx.toFixed(1));
  document.documentElement.style.setProperty('--cy', cy.toFixed(1));
  document.documentElement.style.setProperty('--cols', Math.max(2, Math.min(6, 2 + Math.round(entropy * 4))));
  document.documentElement.style.setProperty('--gap', (8 + density * 20) + 'px');
  STATUS.textContent = `d=${density.toFixed(2)} e=${entropy.toFixed(2)} ${useGPU ? 'GPU' : 'CPU'}`;
}

function drawVis() {
  VCTX.fillStyle = '#000';
  VCTX.fillRect(0, 0, 160, 120);
  const sx = 160 / W, sy = 120 / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = grid[y * W + x];
      if (s) {
        VCTX.fillStyle = ['#000', '#4af', '#fa4', '#4fa'][s];
        VCTX.fillRect(x * sx, y * sy, sx, sy);
      }
    }
  }
}

function injectAt(gx, gy) {
  const x = Math.max(1, Math.min(W - 2, gx));
  const y = Math.max(1, Math.min(H - 2, gy));
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = (y + dy) * W + (x + dx);
    if (i >= 0 && i < grid.length) grid[i] = 2;
  }
}

document.getElementById('inject').onclick = () => injectAt(W / 2, H / 2);
document.getElementById('reset').onclick = () => { seed(); randRules(); };
document.getElementById('seal').onclick = seal;

async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f576-ca-grid-mind', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put({ rules: Array.from(rules), density, entropy, t: Date.now() }, 'best');
    await new Promise(r => tx.oncomplete = r);
    STATUS.textContent = 'sealed';
  } catch (e) { console.warn(e); }
}

async function tryLoad() {
  try {
    const db = await new Promise(res => {
      const r = indexedDB.open('f576-ca-grid-mind', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
    if (!db) return;
    const tx = db.transaction('seal');
    const req = tx.objectStore('seal').get('best');
    req.onsuccess = () => {
      if (req.result && req.result.rules) {
        rules.set(req.result.rules);
        STATUS.textContent = 'restored';
      }
    };
  } catch (e) {}
}

// Minimal WebGPU attempt (placeholder; falls back)
async function tryGPU() {
  if (!navigator.gpu) return;
  try {
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    device = await adapter.requestDevice();
    useGPU = true;
    STATUS.textContent = 'GPU ready (sim)';
  } catch (e) { useGPU = false; }
}

function loop() {
  stepCPU();
  computeStats();
  drawVis();
  requestAnimationFrame(loop);
}

seed();
tryLoad();
tryGPU().then(() => loop());
