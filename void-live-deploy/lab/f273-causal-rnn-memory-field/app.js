const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = 64, H = 48;
let grid = new Float32Array(W * H);
let prevGrid = new Float32Array(W * H);
let residual = 0;
let latent = new Float32Array(16);
let portals = [];
const portalCount = 6;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Simple diffusion step
function stepField(depositX, depositY, strength) {
  const next = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            sum += grid[ny * W + nx];
            cnt++;
          }
        }
      }
      next[y * W + x] = (sum / cnt) * 0.88 + grid[y * W + x] * 0.09;
    }
  }
  if (depositX >= 0) {
    const ix = Math.floor(depositX * W);
    const iy = Math.floor(depositY * H);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = ix + dx, ny = iy + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
          const d = Math.hypot(dx, dy);
          next[ny * W + nx] += strength * Math.exp(-d * 0.8);
        }
      }
    }
  }
  for (let i = 0; i < next.length; i++) next[i] = Math.max(0, Math.min(1, next[i] * 0.97));
  prevGrid.set(grid);
  grid.set(next);
}

function render() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const sx = canvas.width / W, sy = canvas.height / H;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const gx = Math.min(W - 1, Math.floor(x / sx));
      const gy = Math.min(H - 1, Math.floor(y / sy));
      const v = grid[gy * W + gx];
      const i = (y * canvas.width + x) * 4;
      const hue = (v * 120 + residual * 40) % 360;
      data[i] = 20 + v * 180;
      data[i+1] = 30 + v * 100;
      data[i+2] = 80 + v * 120;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Worker for RNN
const workerCode = `
let hidden = new Float32Array(16);
let weights = {
  Wh: new Float32Array(16*16).map(() => (Math.random()-0.5)*0.1),
  Wx: new Float32Array(16*8).map(() => (Math.random()-0.5)*0.1),
  b: new Float32Array(16)
};
let latent = new Float32Array(16);

function tanh(x) { return Math.tanh(x); }

self.onmessage = (e) => {
  const { stats, gesture, query } = e.data;
  const input = new Float32Array(8);
  input.set(stats.slice(0,4));
  input.set(gesture.slice(0,3), 4);
  input[7] = query || 0;

  const newH = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    let s = weights.b[i];
    for (let j = 0; j < 16; j++) s += weights.Wh[i*16 + j] * hidden[j];
    for (let j = 0; j < 8; j++) s += weights.Wx[i*8 + j] * input[j];
    newH[i] = tanh(s);
  }
  hidden.set(newH);
  for (let i = 0; i < 16; i++) latent[i] = latent[i]*0.9 + hidden[i]*0.1;

  const latVar = latent.reduce((a,b)=>a+b*b,0)/16;
  const residual = Math.abs(latVar - (stats[1] || 0));

  self.postMessage({ latent: Array.from(latent), residual, hidden: Array.from(hidden) });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

worker.onmessage = (e) => {
  const { latent: lat, residual: res } = e.data;
  residual = res;
  latent.set(lat);
  document.documentElement.style.setProperty('--hue', 180 + residual * 120);
  document.documentElement.style.setProperty('--contrast', 1 + residual * 0.4);
  updatePortals();
};

// Portals
function createPortals() {
  for (let i = 0; i < portalCount; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = i;
    el.style.setProperty('--p-hue', 200 + i * 30);
    document.body.appendChild(el);
    portals.push({ el, x: Math.random(), y: Math.random(), scale: 1, dragging: false });
  }
}
createPortals();

function updatePortals() {
  portals.forEach((p, i) => {
    if (!p.dragging) {
      p.x = (p.x + (latent[i % 16] * 0.02 + (Math.random()-0.5)*0.01)) % 1;
      p.y = (p.y + (latent[(i+4) % 16] * 0.02 + (Math.random()-0.5)*0.01)) % 1;
      if (p.x < 0) p.x += 1; if (p.y < 0) p.y += 1;
    }
    p.scale = 0.6 + residual * 1.5 + Math.abs(latent[i % 16]) * 0.5;
    p.el.style.left = (p.x * window.innerWidth) + 'px';
    p.el.style.top = (p.y * window.innerHeight) + 'px';
    p.el.style.setProperty('--p-scale', p.scale);
    p.el.style.setProperty('--p-hue', 180 + residual * 100 + i * 20);
  });
}

// Interaction
let lastX = 0, lastY = 0, depositing = false;
canvas.addEventListener('pointermove', (e) => {
  const x = e.clientX / canvas.width, y = e.clientY / canvas.height;
  if (e.buttons || depositing) {
    stepField(x, y, 0.45);
  }
  lastX = x; lastY = y;
});
canvas.addEventListener('pointerdown', () => depositing = true);
canvas.addEventListener('pointerup', () => depositing = false);

// Orientation
let orient = { alpha: 0, beta: 0, gamma: 0 };
window.addEventListener('deviceorientation', (e) => {
  orient.alpha = e.alpha || 0;
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
  const nx = ((orient.gamma + 90) / 180);
  const ny = ((orient.beta + 90) / 180);
  stepField(Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)), 0.15);
});

// Drag portals to query
portals.forEach(p => {
  p.el.addEventListener('pointerdown', (e) => { p.dragging = true; e.stopPropagation(); });
  p.el.addEventListener('pointermove', (e) => {
    if (!p.dragging) return;
    p.x = e.clientX / window.innerWidth;
    p.y = e.clientY / window.innerHeight;
    worker.postMessage({ stats: fieldStats(), gesture: [0,0,0], query: p.x - 0.5 });
  });
  window.addEventListener('pointerup', () => p.dragging = false);
});

function fieldStats() {
  let mean = 0, max = 0, energy = 0;
  for (let v of grid) { mean += v; max = Math.max(max, v); energy += v*v; }
  mean /= grid.length;
  let variance = 0;
  for (let v of grid) variance += (v - mean)**2;
  variance /= grid.length;
  return [mean, variance, max, energy / grid.length];
}

function loop() {
  const dx = lastX - 0.5, dy = lastY - 0.5;
  const speed = Math.hypot(dx, dy);
  worker.postMessage({
    stats: fieldStats(),
    gesture: [dx, dy, speed],
    query: 0
  });
  render();
  requestAnimationFrame(loop);
}
loop();

// IDB seal
const dbName = 'f273-rnn-memory';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('store');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
document.getElementById('seal').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('store', 'readwrite');
  tx.objectStore('store').put({ latent: Array.from(latent), residual, ts: Date.now() }, 'memory');
  document.getElementById('status').textContent = 'Sealed to IndexedDB';
};
document.getElementById('load').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('store', 'readonly');
  const req = tx.objectStore('store').get('memory');
  req.onsuccess = () => {
    if (req.result) {
      latent.set(req.result.latent);
      residual = req.result.residual;
      document.getElementById('status').textContent = 'Loaded latent';
    }
  };
};
document.getElementById('reset').onclick = () => {
  grid.fill(0);
  latent.fill(0);
  residual = 0;
  document.getElementById('status').textContent = 'Reset';
};

// Initial seed
for (let i = 0; i < 20; i++) stepField(Math.random(), Math.random(), 0.3);
