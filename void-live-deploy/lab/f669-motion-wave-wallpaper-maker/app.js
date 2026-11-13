const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const statusEl = document.getElementById('status');
const speedEl = document.getElementById('speed');
const dampEl = document.getElementById('damp');

let W = 256, H = 256;
let grid = new Float32Array(W * H);
let prev = new Float32Array(W * H);
let next = new Float32Array(W * H);
let running = true;
let seed = Math.floor(Math.random() * 1e9);
let orient = { beta: 0, gamma: 0 };
let lastPointer = null;

// Tiny causal MLP (Elman-style, pure JS)
const HIDDEN = 8;
let wh = new Float32Array(HIDDEN * 4); // input 3 + bias -> hidden
let wo = new Float32Array(3 * (HIDDEN + 1)); // hidden + bias -> 3 outputs
let hstate = new Float32Array(HIDDEN);

function initWeights() {
  for (let i = 0; i < wh.length; i++) wh[i] = (Math.random() - 0.5) * 0.4;
  for (let i = 0; i < wo.length; i++) wo[i] = (Math.random() - 0.5) * 0.4;
  // Seed-based deterministic start
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < wh.length; i++) wh[i] = (rand() - 0.5) * 0.5;
  for (let i = 0; i < wo.length; i++) wo[i] = (rand() - 0.5) * 0.5;
}

function tanh(x) { return Math.tanh(x); }

function stepMLP(inputs) {
  // inputs: [dBeta, dGamma, energy]
  const inArr = [inputs[0], inputs[1], inputs[2], 1];
  for (let i = 0; i < HIDDEN; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) sum += wh[i * 4 + j] * inArr[j];
    sum += 0.3 * hstate[i]; // recurrence
    hstate[i] = tanh(sum);
  }
  const outs = [0, 0, 0];
  for (let o = 0; o < 3; o++) {
    let sum = wo[o * (HIDDEN + 1) + HIDDEN]; // bias
    for (let i = 0; i < HIDDEN; i++) sum += wo[o * (HIDDEN + 1) + i] * hstate[i];
    outs[o] = Math.tanh(sum);
  }
  return outs; // [speedMod, dampMod, injectMod]
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(128, Math.floor(rect.width * dpr / 2));
  canvas.height = Math.max(128, Math.floor(rect.height * dpr / 2));
  W = canvas.width;
  H = canvas.height;
  grid = new Float32Array(W * H);
  prev = new Float32Array(W * H);
  next = new Float32Array(W * H);
  // Soft random seed field
  for (let i = 0; i < grid.length; i++) grid[i] = (Math.random() - 0.5) * 0.02;
  prev.set(grid);
}

function inject(x, y, amount) {
  const ix = Math.floor(x * W), iy = Math.floor(y * H);
  const r = 6;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = ix + dx, py = iy + dy;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        const d2 = dx*dx + dy*dy;
        if (d2 < r*r) grid[py * W + px] += amount * (1 - d2 / (r*r));
      }
    }
  }
}

function stepWave(speed, damp) {
  const c2 = speed * speed * 0.4;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const lap = grid[i-1] + grid[i+1] + grid[i-W] + grid[i+W] - 4 * grid[i];
      next[i] = (2 * grid[i] - prev[i] + c2 * lap) * damp;
    }
  }
  // edges
  for (let x = 0; x < W; x++) { next[x] = next[W + x]; next[(H-1)*W + x] = next[(H-2)*W + x]; }
  for (let y = 0; y < H; y++) { next[y*W] = next[y*W+1]; next[y*W + W-1] = next[y*W + W-2]; }
  const tmp = prev; prev = grid; grid = next; next = tmp;
}

function render() {
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let i = 0; i < grid.length; i++) {
    const v = Math.max(-1, Math.min(1, grid[i] * 3));
    const hue = (0.55 + v * 0.15) % 1;
    const sat = 0.7 + Math.abs(v) * 0.3;
    const light = 0.45 + v * 0.35;
    // HSL to RGB approx
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs((hue * 6) % 2 - 1));
    const m = light - c / 2;
    let r = 0, g = 0, b = 0;
    const h6 = hue * 6;
    if (h6 < 1) { r = c; g = x; }
    else if (h6 < 2) { r = x; g = c; }
    else if (h6 < 3) { g = c; b = x; }
    else if (h6 < 4) { g = x; b = c; }
    else if (h6 < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const o = i * 4;
    data[o] = (r + m) * 255;
    data[o+1] = (g + m) * 255;
    data[o+2] = (b + m) * 255;
    data[o+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

let lastTime = performance.now();
let prevOrient = { beta: 0, gamma: 0 };
function loop(now) {
  if (running) {
    const dt = Math.min(32, now - lastTime);
    lastTime = now;
    const dBeta = (orient.beta - prevOrient.beta) * 0.05;
    const dGamma = (orient.gamma - prevOrient.gamma) * 0.05;
    prevOrient = { ...orient };
    const energy = Math.min(1, Math.hypot(dBeta, dGamma) * 2);
    const mods = stepMLP([dBeta, dGamma, energy]);
    const speed = parseFloat(speedEl.value) * (1 + mods[0] * 0.4);
    const damp = parseFloat(dampEl.value) * (1 + mods[1] * 0.02);
    if (energy > 0.05) inject(0.5 + dGamma * 0.3, 0.5 + dBeta * 0.3, mods[2] * 0.4 * energy);
    stepWave(speed, damp);
    render();
  }
  requestAnimationFrame(loop);
}

function saveState() {
  try {
    localStorage.setItem('verse-f669-wallpaper', JSON.stringify({
      seed, speed: speedEl.value, damp: dampEl.value, hstate: Array.from(hstate)
    }));
  } catch (e) { console.debug("lab f669-motion-wave-wallpaper-maker:", e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem('verse-f669-wallpaper');
    if (raw) {
      const s = JSON.parse(raw);
      seed = s.seed || seed;
      if (s.speed) speedEl.value = s.speed;
      if (s.damp) dampEl.value = s.damp;
      if (s.hstate) hstate.set(s.hstate);
    }
    const hash = location.hash.slice(1);
    if (hash) seed = parseInt(hash, 36) || seed;
  } catch (e) { console.debug("lab f669-motion-wave-wallpaper-maker:", e); }
}

document.getElementById('freeze').onclick = () => {
  running = false;
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wallpaper-${seed}.png`;
    a.click();
    setTimeout(() => running = true, 400);
    statusEl.textContent = 'Downloaded PNG. Tilt or drag to continue.';
    saveState();
  }, 'image/png');
};

document.getElementById('reset').onclick = () => {
  seed = Math.floor(Math.random() * 1e9);
  initWeights();
  hstate.fill(0);
  resize();
  statusEl.textContent = 'Reset with new seed. Tilt or drag.';
  saveState();
};

document.getElementById('copy').onclick = () => {
  const text = `seed:${seed.toString(36)} speed:${speedEl.value} damp:${dampEl.value}`;
  navigator.clipboard.writeText(text).then(() => {
    statusEl.textContent = 'Seed and params copied.';
  }).catch(() => {
    statusEl.textContent = text;
  });
  location.hash = seed.toString(36);
  saveState();
};

canvas.addEventListener('pointerdown', e => { lastPointer = [e.clientX, e.clientY]; });
canvas.addEventListener('pointermove', e => {
  if (!lastPointer) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  inject(x, y, 0.6);
  lastPointer = [e.clientX, e.clientY];
});
canvas.addEventListener('pointerup', () => { lastPointer = null; });
canvas.addEventListener('pointerleave', () => { lastPointer = null; });

window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient.beta = e.beta;
  if (e.gamma != null) orient.gamma = e.gamma;
});

window.addEventListener('resize', resize);
loadState();
initWeights();
resize();
requestAnimationFrame(loop);

// Periodic save
setInterval(saveState, 5000);
