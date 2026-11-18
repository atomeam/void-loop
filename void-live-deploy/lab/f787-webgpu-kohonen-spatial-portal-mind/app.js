const N = 8; // 8x8 SOM
const DIM = 6; // input dim: ax,ay,az or orient + px,py,vel
const portals = [];
const weights = []; // N*N x DIM
let eta = 0.08, sigma = 2.4;
let epoch = 0;
let bestFitness = -Infinity;
let sealedCount = 0;
const statusEl = document.getElementById('status');
const grid = document.getElementById('grid');
const canvas = document.getElementById('vis');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
addEventListener('resize', resize); resize();

// Init portals and random weights
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.dataset.i = y * N + x;
    el.textContent = `${x},${y}`;
    grid.appendChild(el);
    portals.push(el);
    const w = new Float32Array(DIM);
    for (let d = 0; d < DIM; d++) w[d] = Math.random() * 2 - 1;
    weights.push(w);
  }
}

// Input vector
let orient = { alpha: 0, beta: 0, gamma: 0 };
let ptr = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
let lastPtr = { x: 0.5, y: 0.5 };

function getInput() {
  const a = (orient.beta || 0) / 90;
  const b = (orient.gamma || 0) / 90;
  const c = (orient.alpha || 0) / 180;
  return [a, b, c, ptr.x * 2 - 1, ptr.y * 2 - 1, Math.hypot(ptr.vx, ptr.vy) * 4];
}

// SOM step
function somStep(input) {
  // Find BMU
  let minD = Infinity, bmu = 0;
  for (let i = 0; i < weights.length; i++) {
    let d = 0;
    for (let k = 0; k < DIM; k++) {
      const diff = input[k] - weights[i][k];
      d += diff * diff;
    }
    if (d < minD) { minD = d; bmu = i; }
  }
  const bx = bmu % N, by = Math.floor(bmu / N);
  // Update neighborhood
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const dist = Math.hypot(x - bx, y - by);
      const h = Math.exp(-(dist * dist) / (2 * sigma * sigma));
      for (let k = 0; k < DIM; k++) {
        weights[i][k] += eta * h * (input[k] - weights[i][k]);
      }
    }
  }
  return bmu;
}

function updateVisuals(input, bmu) {
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const spacing = Math.min(innerWidth, innerHeight) / (N + 1);
  for (let i = 0; i < portals.length; i++) {
    const x = i % N, y = Math.floor(i / N);
    const w = weights[i];
    // Position: base grid + weight offset
    const ox = w[3] * spacing * 0.6;
    const oy = w[4] * spacing * 0.6;
    const px = cx + (x - N/2 + 0.5) * spacing + ox;
    const py = cy + (y - N/2 + 0.5) * spacing + oy;
    const scale = 0.7 + Math.abs(w[0]) * 0.6 + (i === bmu ? 0.4 : 0);
    const hue = (w[1] * 60 + w[2] * 40 + 180) % 360;
    const sat = 40 + Math.abs(w[5]) * 40;
    portals[i].style.transform = `translate(${px - 24}px, ${py - 24}px) scale(${scale})`;
    portals[i].style.background = `hsl(${hue}, ${sat}%, 42%)`;
    portals[i].style.borderColor = i === bmu ? '#fff' : '#444';
  }
  // Simple canvas trail of BMU
  ctx.fillStyle = 'rgba(10,12,16,0.08)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bx = bmu % N, by = Math.floor(bmu / N);
  const px = cx + (bx - N/2 + 0.5) * spacing;
  const py = cy + (by - N/2 + 0.5) * spacing;
  ctx.fillStyle = '#5ce1e6';
  ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2); ctx.fill();
}

let lastClick = 0;
portals.forEach((el, i) => {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Reward: slightly pull neighborhood toward current input and boost eta temporarily
    const input = getInput();
    const bx = i % N, by = Math.floor(i / N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const j = y * N + x;
        const dist = Math.hypot(x - bx, y - by);
        const h = Math.exp(-(dist * dist) / 4);
        for (let k = 0; k < DIM; k++) {
          weights[j][k] += 0.15 * h * (input[k] - weights[j][k]);
        }
      }
    }
    lastClick = performance.now();
    statusEl.textContent = `Rewarded portal ${i % N},${Math.floor(i / N)} · fitness rising`;
  });
});

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', (e) => {
    orient.alpha = e.alpha || 0;
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// Pointer
addEventListener('pointermove', (e) => {
  const nx = e.clientX / innerWidth;
  const ny = e.clientY / innerHeight;
  ptr.vx = nx - lastPtr.x;
  ptr.vy = ny - lastPtr.y;
  ptr.x = nx; ptr.y = ny;
  lastPtr.x = nx; lastPtr.y = ny;
});

// Persistence
const KEY = 'f787-kohonen-genome';
function seal() {
  try {
    const data = { weights: Array.from(weights, w => Array.from(w)), eta, sigma, epoch, fitness: bestFitness };
    localStorage.setItem(KEY, JSON.stringify(data));
    sealedCount++;
  } catch (e) { console.debug("lab f787-webgpu-kohonen-spatial-portal-mind:", e); }
}
function loadSeal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.weights && data.weights.length === N*N) {
      data.weights.forEach((w, i) => { if (weights[i]) weights[i].set(w); });
      eta = data.eta || eta; sigma = data.sigma || sigma; epoch = data.epoch || 0;
      bestFitness = data.fitness || 0;
      sealedCount = 1;
      statusEl.textContent = 'Loaded sealed genome from previous session';
    }
  } catch (e) { console.debug("lab f787-webgpu-kohonen-spatial-portal-mind:", e); }
}
loadSeal();

// Loop
let lastT = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  const input = getInput();
  const bmu = somStep(input);
  updateVisuals(input, bmu);
  epoch++;
  // Anneal
  if (epoch % 120 === 0) {
    eta = Math.max(0.01, eta * 0.995);
    sigma = Math.max(0.8, sigma * 0.998);
  }
  // Fitness proxy: how well BMU matches (inverse distance)
  let d = 0;
  for (let k = 0; k < DIM; k++) d += (input[k] - weights[bmu][k]) ** 2;
  const fit = -d;
  if (fit > bestFitness) { bestFitness = fit; if (epoch % 60 === 0) seal(); }
  if (epoch % 30 === 0) {
    statusEl.textContent = `epoch ${epoch} · η ${eta.toFixed(3)} · σ ${sigma.toFixed(2)} · seals ${sealedCount} · tilt/move to train`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Optional: request orientation permission on iOS
if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
  document.body.addEventListener('click', () => {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') statusEl.textContent = 'Orientation unlocked';
    }).catch(() => {});
  }, { once: true });
}
