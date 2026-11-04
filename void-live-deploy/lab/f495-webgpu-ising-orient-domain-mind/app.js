const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const N = 64;
const spins = new Int8Array(N * N);
const temp = 2.2;
let Hx = 0, Hy = 0;
let pointerX = 0.5, pointerY = 0.5;
let globalM = 0;
let portals = [];
let lastSeal = null;
const DB_NAME = 'void-f495';
const STORE = 'seals';

function initSpins() {
  for (let i = 0; i < spins.length; i++) spins[i] = Math.random() < 0.5 ? 1 : -1;
}
initSpins();

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function idx(x, y) { return ((y + N) % N) * N + ((x + N) % N); }

function metropolisStep() {
  for (let k = 0; k < N * N / 4; k++) {
    const x = Math.floor(Math.random() * N);
    const y = Math.floor(Math.random() * N);
    const i = idx(x, y);
    const s = spins[i];
    let sum = 0;
    sum += spins[idx(x+1, y)];
    sum += spins[idx(x-1, y)];
    sum += spins[idx(x, y+1)];
    sum += spins[idx(x, y-1)];
    const localH = Hx * Math.cos(x / N * Math.PI * 2) + Hy * Math.sin(y / N * Math.PI * 2) + (pointerX > 0 ? (x / N - pointerX) * 0.5 : 0);
    const dE = 2 * s * (sum + localH * 2);
    if (dE <= 0 || Math.random() < Math.exp(-dE / temp)) spins[i] = -s;
  }
}

function computeMagnetization() {
  let m = 0;
  for (let i = 0; i < spins.length; i++) m += spins[i];
  globalM = m / spins.length;
  return Math.abs(globalM);
}

function sampleDomains() {
  portals = [];
  const step = 16;
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      let m = 0, count = 0;
      for (let dy = 0; dy < step; dy++) {
        for (let dx = 0; dx < step; dx++) {
          const x = gx * step + dx;
          const y = gy * step + dy;
          m += spins[idx(x, y)];
          count++;
        }
      }
      const localM = m / count;
      if (Math.abs(localM) > 0.4) {
        portals.push({
          x: (gx + 0.5) / 4,
          y: (gy + 0.5) / 4,
          m: localM,
          scale: 0.6 + Math.abs(localM) * 0.8
        });
      }
    }
  }
  portals.sort((a, b) => Math.abs(b.m) - Math.abs(a.m));
  portals = portals.slice(0, 6);
}

function render() {
  const w = canvas.width, h = canvas.height;
  const cellW = w / N, cellH = h / N;
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const s = spins[idx(x, y)];
      ctx.fillStyle = s > 0 ? '#ffcc66' : '#3344aa';
      ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
    }
  }
  document.querySelectorAll('.portal').forEach(el => el.remove());
  portals.forEach(p => {
    const el = document.createElement('div');
    el.className = 'portal';
    el.style.left = (p.x * w - 40) + 'px';
    el.style.top = (p.y * h - 40) + 'px';
    el.style.transform = `scale(${p.scale}) rotate(${p.m * 30}deg)`;
    el.style.background = p.m > 0
      ? 'radial-gradient(circle, rgba(255,200,100,0.9), rgba(200,100,50,0.4))'
      : 'radial-gradient(circle, rgba(100,150,255,0.9), rgba(50,50,150,0.4))';
    document.body.appendChild(el);
  });
  document.documentElement.style.setProperty('--m', Math.abs(globalM).toFixed(3));
  statusEl.textContent = `Tilt or drag to bias field · |M|: ${Math.abs(globalM).toFixed(2)} · portals: ${portals.length}`;
}

async function hashSpins() {
  const buf = new Uint8Array(spins.buffer);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function seal() {
  try {
    const hash = await hashSpins();
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: 'last', spins: Array.from(spins), hash, t: Date.now() });
    await tx.complete;
    lastSeal = hash.slice(0, 8);
    statusEl.textContent = `Sealed ${lastSeal}…`;
  } catch (e) {
    try { localStorage.setItem('f495-seal', JSON.stringify(Array.from(spins))); lastSeal = 'ls'; } catch (_) {}
  }
}

async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('last');
    req.onsuccess = () => {
      if (req.result && req.result.spins) {
        spins.set(req.result.spins);
        statusEl.textContent = `Restored ${req.result.hash.slice(0, 8)}…`;
      }
    };
  } catch (e) {
    try {
      const raw = localStorage.getItem('f495-seal');
      if (raw) spins.set(JSON.parse(raw));
    } catch (_) {}
  }
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

document.getElementById('sealBtn').onclick = seal;
document.getElementById('restoreBtn').onclick = restore;
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

canvas.addEventListener('pointermove', e => {
  pointerX = e.clientX / canvas.width;
  pointerY = e.clientY / canvas.height;
});
canvas.addEventListener('pointerdown', e => {
  pointerX = e.clientX / canvas.width;
  pointerY = e.clientY / canvas.height;
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (e.beta != null && e.gamma != null) {
      Hx = Math.max(-1, Math.min(1, e.gamma / 45));
      Hy = Math.max(-1, Math.min(1, e.beta / 45));
    }
  });
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => DeviceOrientationEvent.requestPermission().catch(() => {}), { once: true });
  }
}

function loop() {
  metropolisStep();
  computeMagnetization();
  sampleDomains();
  render();
  requestAnimationFrame(loop);
}
loop();
