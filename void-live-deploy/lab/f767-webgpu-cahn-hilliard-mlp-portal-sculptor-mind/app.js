const N = 64;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W, H, cell;
function resize() {
  W = cv.width = innerWidth;
  H = cv.height = innerHeight;
  cell = Math.min(W, H) / N;
}
resize();
addEventListener('resize', resize);

// Field: concentration c[-1..1]
let c = new Float32Array(N * N);
let cNext = new Float32Array(N * N);
function idx(x, y) { return ((y + N) % N) * N + ((x + N) % N); }
function initField() {
  for (let i = 0; i < N * N; i++) c[i] = (Math.random() - 0.5) * 0.4;
}

// MLP helpers
function randW(n) { return Array.from({length: n}, () => (Math.random() - 0.5) * 0.8); }
function tanh(x) { return Math.tanh(x); }
function mlpForward(inp, w1, b1, w2, b2) {
  const h = new Array(8);
  for (let i = 0; i < 8; i++) {
    let s = b1[i];
    for (let j = 0; j < 5; j++) s += w1[i * 5 + j] * inp[j];
    h[i] = tanh(s);
  }
  const o = new Array(3);
  for (let i = 0; i < 3; i++) {
    let s = b2[i];
    for (let j = 0; j < 8; j++) s += w2[i * 8 + j] * h[j];
    o[i] = tanh(s);
  }
  return o;
}

// Portals
const portals = [];
function makePortal(x, y) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'S';
  document.body.appendChild(el);
  return {
    el, x, y,
    w1: randW(8 * 5), b1: randW(8),
    w2: randW(3 * 8), b2: randW(3),
    fitness: 0,
    vx: 0, vy: 0
  };
}
function spawnPortals() {
  for (let i = 0; i < 5; i++) {
    portals.push(makePortal(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6));
  }
}

let pointer = { x: 0.5, y: 0.5, down: false };
let orient = 0;
let time = 0;
let bestIdx = 0;

function loadGenome() {
  try {
    const g = localStorage.getItem('verse-f767-genome');
    if (g) {
      const data = JSON.parse(g);
      portals.forEach(p => {
        p.w1 = data.w1; p.b1 = data.b1; p.w2 = data.w2; p.b2 = data.b2;
      });
    }
  } catch (e) { console.debug("lab f767-webgpu-cahn-hilliard-mlp-portal-sculptor-mind:", e); }
}

function seal() {
  let best = portals[0];
  portals.forEach(p => { if (p.fitness > best.fitness) best = p; });
  const genome = { w1: best.w1, b1: best.b1, w2: best.w2, b2: best.b2 };
  try { localStorage.setItem('verse-f767-genome', JSON.stringify(genome)); } catch (e) { console.debug("lab f767-webgpu-cahn-hilliard-mlp-portal-sculptor-mind:", e); }
  portals.forEach(p => {
    p.w1 = genome.w1.slice(); p.b1 = genome.b1.slice();
    p.w2 = genome.w2.slice(); p.b2 = genome.b2.slice();
    p.fitness *= 0.3;
  });
  document.getElementById('status').textContent = 'Sealed best genome · fitness ' + best.fitness.toFixed(1);
}

function stepFieldClean() {
  const lap = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      lap[i] = c[((y+1)%N)*N + x] + c[((y-1+N)%N)*N + x] + c[y*N + (x+1)%N] + c[y*N + (x-1+N)%N] - 4 * c[i];
    }
  }
  const mu = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const cc = c[i];
    mu[i] = cc * cc * cc - cc - 0.015 * lap[i];
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const lapMu = mu[((y+1)%N)*N + x] + mu[((y-1+N)%N)*N + x] + mu[y*N + (x+1)%N] + mu[y*N + (x-1+N)%N] - 4 * mu[i];
      cNext[i] = Math.max(-1.5, Math.min(1.5, c[i] + 0.04 * lapMu));
    }
  }
  const tmp = c; c = cNext; cNext = tmp;
}

function applyPortals() {
  portals.forEach((p, pi) => {
    const gx = Math.floor(p.x * N), gy = Math.floor(p.y * N);
    const localC = c[gy * N + gx] || 0;
    let gsum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      gsum += Math.abs(c[((gy+dy+N)%N)*N + (gx+dx+N)%N] - localC);
    }
    const grad = gsum / 9;
    const pdist = Math.hypot(p.x - pointer.x, p.y - pointer.y);
    const inp = [localC, grad, Math.min(1, pdist * 2), orient * 0.02, Math.sin(time * 0.01)];
    const out = mlpForward(inp, p.w1, p.b1, p.w2, p.b2);
    const bias = out[1] * 0.08;
    // apply local bias
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const ii = ((gy+dy+N)%N)*N + (gx+dx+N)%N;
      c[ii] = Math.max(-1.5, Math.min(1.5, c[ii] + bias * Math.exp(-(dx*dx+dy*dy)/3)));
    }
    // drift
    p.vx += out[2] * 0.002 + (pointer.down && pdist < 0.08 ? (pointer.x - p.x) * 0.1 : 0);
    p.vy += (Math.random() - 0.5) * 0.001;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x = Math.max(0.05, Math.min(0.95, p.x + p.vx));
    p.y = Math.max(0.05, Math.min(0.95, p.y + p.vy));
    p.fitness += grad * 0.1 + (pointer.down && pdist < 0.1 ? 0.5 : 0);
    // visual
    const px = p.x * W, py = p.y * H;
    p.el.style.left = (px - 24) + 'px';
    p.el.style.top = (py - 24) + 'px';
    p.el.classList.toggle('best', pi === bestIdx);
  });
  // find best
  bestIdx = 0;
  portals.forEach((p, i) => { if (p.fitness > portals[bestIdx].fitness) bestIdx = i; });
}

function render() {
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = (c[i] + 1) * 0.5;
    const r = Math.floor(40 + v * 180);
    const g = Math.floor(60 + (1 - v) * 80);
    const b = Math.floor(180 - v * 100);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  const off = document.createElement('canvas');
  off.width = N; off.height = N;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, W, H);
}

function loop() {
  time++;
  applyPortals();
  stepFieldClean();
  render();
  requestAnimationFrame(loop);
}

// Interactions
cv.addEventListener('pointermove', e => {
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
});
cv.addEventListener('pointerdown', e => { pointer.down = true; });
addEventListener('pointerup', () => { pointer.down = false; });

// Drag portals
let dragging = null;
document.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('portal')) {
    dragging = portals.find(p => p.el === e.target);
    e.preventDefault();
  }
});
document.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.x = e.clientX / W;
    dragging.y = e.clientY / H;
    dragging.fitness += 0.2;
  }
});
document.addEventListener('pointerup', () => { dragging = null; });

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initField(); document.getElementById('status').textContent = 'Field reset'; };

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { orient = e.beta || 0; });
}

initField();
spawnPortals();
loadGenome();
loop();
