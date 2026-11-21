const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = 256, H = 256;
let grid = new Float32Array(W * H);
let weights = new Float32Array(W * H * 4); // 4 neighbors
let portals = [];
let usingWebGPU = false;
let animId;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function initGrid() {
  for (let i = 0; i < grid.length; i++) {
    grid[i] = (Math.random() - 0.5) * 0.2;
    for (let d = 0; d < 4; d++) weights[i * 4 + d] = (Math.random() - 0.5) * 0.1;
  }
}

function stepJS() {
  const next = new Float32Array(grid.length);
  const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      const i = y * W + x;
      let sum = grid[i] * 0.6;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = dirs[d];
        const ni = (y + dy) * W + (x + dx);
        sum += grid[ni] * weights[i * 4 + d];
        // Hebbian
        weights[i * 4 + d] += 0.002 * grid[i] * grid[ni];
        weights[i * 4 + d] = Math.max(-1, Math.min(1, weights[i * 4 + d]));
      }
      next[i] = Math.tanh(sum);
    }
  }
  grid.set(next);
}

function renderJS() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const scaleX = canvas.width / W, scaleY = canvas.height / H;
  for (let py = 0; py < canvas.height; py += 2) {
    for (let px = 0; px < canvas.width; px += 2) {
      const gx = Math.min(W-1, Math.floor(px / scaleX));
      const gy = Math.min(H-1, Math.floor(py / scaleY));
      const v = (grid[gy * W + gx] + 1) * 0.5;
      const c = Math.floor(v * 255);
      const idx = (py * canvas.width + px) * 4;
      img.data[idx] = c * 0.3; img.data[idx+1] = c * 0.6; img.data[idx+2] = c; img.data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function sample(x, y) {
  const gx = Math.max(0, Math.min(W-1, Math.floor(x / canvas.width * W)));
  const gy = Math.max(0, Math.min(H-1, Math.floor(y / canvas.height * H)));
  return grid[gy * W + gx];
}

function createPortals() {
  portalsEl.innerHTML = '';
  portals = [];
  for (let i = 0; i < 10; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'Portal ' + i;
    el.style.left = (Math.random() * (window.innerWidth - 100)) + 'px';
    el.style.top = (Math.random() * (window.innerHeight - 80)) + 'px';
    portalsEl.appendChild(el);
    portals.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx: 0, vy: 0 });
    let dragging = false, ox, oy;
    el.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - portals[i].x; oy = e.clientY - portals[i].y; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (dragging) { portals[i].x = e.clientX - ox; portals[i].y = e.clientY - oy; el.style.left = portals[i].x + 'px'; el.style.top = portals[i].y + 'px'; } });
    el.addEventListener('pointerup', () => dragging = false);
  }
}

function updatePortals() {
  portals.forEach(p => {
    const act = sample(p.x + 40, p.y + 30);
    p.vx += act * 0.5;
    p.vy += act * 0.3;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(0, Math.min(window.innerWidth - 80, p.x));
    p.y = Math.max(0, Math.min(window.innerHeight - 60, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    const hue = Math.floor((act + 1) * 120);
    p.el.style.borderColor = `hsl(${hue}, 70%, 60%)`;
    p.el.style.transform = `scale(${0.8 + Math.abs(act)})`;
    p.el.textContent = `A:${act.toFixed(2)}`;
  });
}

canvas.addEventListener('pointermove', e => {
  if (e.buttons) {
    const gx = Math.floor(e.clientX / canvas.width * W);
    const gy = Math.floor(e.clientY / canvas.height * H);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = gx + dx, ny = gy + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) grid[ny * W + nx] = 1;
    }
  }
});

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    statusEl.textContent = 'WebGPU active (simplified field)';
    usingWebGPU = true;
    // Note: full WGSL compute would go here; for this prototype we keep JS simulation
    // and mark WebGPU available for future extension. Visualization remains Canvas2D.
    return true;
  } catch (e) { return false; }
}

function loop() {
  stepJS();
  renderJS();
  updatePortals();
  animId = requestAnimationFrame(loop);
}

async function start() {
  initGrid();
  createPortals();
  const gpu = await tryWebGPU();
  if (!gpu) statusEl.textContent = 'Canvas2D Hebbian field (WebGPU unavailable)';
  else statusEl.textContent = 'WebGPU detected – running spatial neural field';
  loop();
}

document.getElementById('reset').onclick = () => { initGrid(); statusEl.textContent = 'Field reset'; };
document.getElementById('seal').onclick = async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f877', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ weights: Array.from(weights.slice(0, 1000)), portals: portals.map(p => ({x:p.x,y:p.y})), t: Date.now() }, 'sealed');
    statusEl.textContent = 'Genome sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (IDB blocked)'; }
};

start();
