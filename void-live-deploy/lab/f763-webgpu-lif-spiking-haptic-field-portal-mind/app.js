const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statsEl = document.getElementById('stats');

let W = innerWidth, H = innerHeight;
canvas.width = W; canvas.height = H;

const COLS = 36, ROWS = 24;
const N = COLS * ROWS;
const dt = 0.05;
const leak = 0.08;
const thresh = 1.0;
const resetV = 0.0;
const refrac = 4;

// State
let V = new Float32Array(N);
let spike = new Uint8Array(N);
let lastSpike = new Int32Array(N).fill(-100);
let I = new Float32Array(N); // injected current

// Sparse weights: for simplicity, local neighborhood Hebbian on a few connections per neuron
const neighbors = [];
for (let i = 0; i < N; i++) {
  const x = i % COLS, y = Math.floor(i / COLS);
  const neigh = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) neigh.push(ny * COLS + nx);
  }
  neighbors.push(neigh);
}
let w = neighbors.map(ns => ns.map(() => (Math.random() - 0.4) * 0.15)); // sparse weights

// Portals
const portals = [];
for (let p = 0; p < 5; p++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'portal ' + (p + 1);
  el.style.left = (20 + p * 15) + '%';
  el.style.top = (30 + (p % 2) * 20) + '%';
  portalsEl.appendChild(el);
  portals.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx: 0, vy: 0 });
}

let orient = { beta: 0, gamma: 0 };
let pointer = { x: W / 2, y: H / 2, active: false };
let frame = 0;
let popRate = 0;

function idx(x, y) { return y * COLS + x; }

function loadGenome() {
  try {
    const raw = localStorage.getItem('verse-f763-lif');
    if (raw) {
      const g = JSON.parse(raw);
      if (g.w && g.w.length === w.length) w = g.w;
    }
  } catch (e) { console.debug("lab f763-webgpu-lif-spiking-haptic-field-portal-mind:", e); }
}

function seal() {
  try {
    localStorage.setItem('verse-f763-lif', JSON.stringify({ w, t: Date.now() }));
    statsEl.textContent = 'sealed';
    setTimeout(() => statsEl.textContent = 'rate: ' + popRate.toFixed(2), 800);
  } catch (e) { console.debug("lab f763-webgpu-lif-spiking-haptic-field-portal-mind:", e); }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  localStorage.removeItem('verse-f763-lif');
  location.reload();
};

window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});

canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
});
canvas.addEventListener('pointerdown', e => { pointer.active = true; });
canvas.addEventListener('pointerup', () => { pointer.active = false; });

// Drag portals
portals.forEach(p => {
  let dragging = false, ox = 0, oy = 0;
  p.el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - parseFloat(p.el.style.left) * W / 100;
    oy = e.clientY - parseFloat(p.el.style.top) * H / 100;
    e.stopPropagation();
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    p.el.style.left = ((e.clientX - ox) / W * 100) + '%';
    p.el.style.top = ((e.clientY - oy) / H * 100) + '%';
  });
  window.addEventListener('pointerup', () => { dragging = false; });
});

loadGenome();

function step() {
  frame++;
  // Bias from orientation (tilt as global current)
  const bias = (orient.beta / 90) * 0.12 + (orient.gamma / 90) * 0.08;

  // Pointer local injection
  const px = Math.floor(pointer.x / W * COLS);
  const py = Math.floor(pointer.y / H * ROWS);

  let spikes = 0;
  for (let i = 0; i < N; i++) {
    const x = i % COLS, y = Math.floor(i / COLS);
    let current = bias;
    if (pointer.active && Math.abs(x - px) < 2 && Math.abs(y - py) < 2) current += 0.6;

    // Synaptic input from neighbors
    const ns = neighbors[i];
    const ws = w[i];
    for (let k = 0; k < ns.length; k++) {
      if (spike[ns[k]]) current += ws[k];
    }

    // Integrate
    if (frame - lastSpike[i] > refrac) {
      V[i] += (-leak * V[i] + current) * dt * 4;
      if (V[i] > thresh) {
        V[i] = resetV;
        spike[i] = 1;
        lastSpike[i] = frame;
        spikes++;
        // Hebbian: strengthen if pre was recent
        for (let k = 0; k < ns.length; k++) {
          if (frame - lastSpike[ns[k]] < 8) ws[k] = Math.min(0.4, ws[k] + 0.008);
        }
      } else spike[i] = 0;
    } else {
      spike[i] = 0;
      V[i] *= 0.95;
    }
    V[i] = Math.max(-0.5, Math.min(1.5, V[i]));
  }
  popRate = spikes / N;

  // Haptic
  if (popRate > 0.04 && navigator.vibrate) {
    navigator.vibrate(Math.min(80, popRate * 400));
  }

  // Draw field
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const cellW = W / COLS, cellH = H / ROWS;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const i = idx(x, y);
    const pot = (V[i] + 0.5) / 2;
    const r = spike[i] ? 255 : Math.floor(pot * 40);
    const g = Math.floor(pot * 180);
    const b = Math.floor(180 + pot * 75);
    const sx = Math.floor(x * cellW), sy = Math.floor(y * cellH);
    for (let dy = 0; dy < cellH; dy++) for (let dx = 0; dx < cellW; dx++) {
      const px = (sy + dy) * W + (sx + dx);
      const off = px * 4;
      data[off] = r; data[off + 1] = g; data[off + 2] = b; data[off + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Update portals: seek high activity
  portals.forEach(p => {
    const px = parseFloat(p.el.style.left) / 100;
    const py = parseFloat(p.el.style.top) / 100;
    const cx = Math.floor(px * COLS), cy = Math.floor(py * ROWS);
    let localRate = 0, count = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        localRate += spike[idx(nx, ny)];
        count++;
      }
    }
    localRate /= Math.max(1, count);
    const scale = 0.8 + localRate * 2.5;
    const hue = 200 + localRate * 80;
    p.el.style.transform = `scale(${scale})`;
    p.el.style.background = `hsla(${hue}, 70%, 55%, 0.35)`;
    // mild advection toward higher (simplified: random walk biased by rate)
    if (localRate < 0.1) {
      p.el.style.left = (parseFloat(p.el.style.left) + (Math.random() - 0.5) * 0.4) + '%';
      p.el.style.top = (parseFloat(p.el.style.top) + (Math.random() - 0.5) * 0.4) + '%';
    }
  });

  statsEl.textContent = 'rate: ' + popRate.toFixed(3) + '  spikes: ' + spikes;
  requestAnimationFrame(step);
}

onresize = () => { W = innerWidth; H = innerHeight; canvas.width = W; canvas.height = H; };
step();
