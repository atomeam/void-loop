const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const constellation = document.getElementById('constellation');
const statusEl = document.getElementById('status');
const seedInput = document.getElementById('seed');

let W, H, gridW = 80, gridH = 60;
let energy = new Float32Array(gridW * gridH);
let nextEnergy = new Float32Array(gridW * gridH);
let nodes = [];
let mindState = { weights: [0.5, 0.3, 0.2], residual: 0, history: [] };
let worker = null;
let xrSession = null;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
resize();
window.addEventListener('resize', resize);

function idx(x, y) { return y * gridW + x; }

function deposit(px, py, amount = 0.8) {
  const gx = Math.floor((px / W) * gridW);
  const gy = Math.floor((py / H) * gridH);
  if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
    energy[idx(gx, gy)] = Math.min(1, energy[idx(gx, gy)] + amount);
  }
}

function updateLattice() {
  for (let y = 1; y < gridH - 1; y++) {
    for (let x = 1; x < gridW - 1; x++) {
      const i = idx(x, y);
      const neighbors = (
        energy[idx(x-1,y)] + energy[idx(x+1,y)] +
        energy[idx(x,y-1)] + energy[idx(x,y+1)]
      ) * 0.25;
      nextEnergy[i] = energy[i] * 0.92 + neighbors * 0.08;
      if (nextEnergy[i] < 0.01) nextEnergy[i] = 0;
    }
  }
  [energy, nextEnergy] = [nextEnergy, energy];
}

function render() {
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, W, H);
  const cellW = W / gridW;
  const cellH = H / gridH;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const e = energy[idx(x, y)];
      if (e > 0.02) {
        const hue = 200 + e * 160;
        ctx.fillStyle = `hsla(${hue}, 80%, ${30 + e * 40}%, ${e * 0.8})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
      }
    }
  }
}

function sampleField() {
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(Math.random() * gridW);
    const y = Math.floor(Math.random() * gridH);
    samples.push(energy[idx(x, y)]);
  }
  return samples;
}

function updateMind(samples) {
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const pred = mindState.weights[0] * avg + mindState.weights[1] * (mindState.history.slice(-1)[0] || 0);
  mindState.residual = avg - pred;
  mindState.history.push(avg);
  if (mindState.history.length > 32) mindState.history.shift();
  mindState.weights[0] = Math.max(0.1, Math.min(0.9, mindState.weights[0] + mindState.residual * 0.02));
  return {
    intent: avg,
    residual: mindState.residual,
    count: Math.max(1, Math.min(6, Math.floor(avg * 5 + 1))),
    hueShift: mindState.residual * 40
  };
}

function spawnConstellation(mindOut) {
  while (nodes.length > 8) {
    const old = nodes.shift();
    old.el.remove();
  }
  for (let i = 0; i < mindOut.count; i++) {
    const el = document.createElement('div');
    el.className = 'thought-node';
    const hue = (220 + mindOut.hueShift + i * 30) % 360;
    el.style.setProperty('--node-hue', hue);
    el.style.setProperty('--node-scale', 0.8 + Math.random() * 0.6);
    const label = ['resonance', 'intent', 'echo', 'seed', 'probe', 'wave', 'focus', 'drift'][i % 8] + ' ' + Math.floor(mindOut.intent * 100);
    el.textContent = label;
    const angle = (i / mindOut.count) * Math.PI * 2;
    const r = 120 + mindOut.intent * 180;
    const x = W/2 + Math.cos(angle) * r;
    const y = H/2 + Math.sin(angle) * r;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.x = x;
    el.dataset.y = y;
    let dragging = false, ox, oy;
    el.addEventListener('pointerdown', e => {
      dragging = true;
      ox = e.clientX - parseFloat(el.dataset.x);
      oy = e.clientY - parseFloat(el.dataset.y);
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      const nx = e.clientX - ox;
      const ny = e.clientY - oy;
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
      el.dataset.x = nx;
      el.dataset.y = ny;
      deposit(nx, ny, 0.3);
    });
    el.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('click', () => {
      el.classList.add('affirmed');
      deposit(parseFloat(el.dataset.x), parseFloat(el.dataset.y), 0.6);
    });
    constellation.appendChild(el);
    nodes.push({ el, hue });
  }
}

function updateChrome(mindOut) {
  const e = Math.min(1, mindOut.intent);
  document.documentElement.style.setProperty('--energy', e);
  document.documentElement.style.setProperty('--residual', mindOut.residual);
  document.documentElement.style.setProperty('--hue', 220 + mindOut.hueShift);
  document.documentElement.style.setProperty('--contrast', 1 + Math.abs(mindOut.residual) * 0.5);
  document.documentElement.style.setProperty('--scale', 1 + e * 0.05);
  document.documentElement.style.setProperty('--rotate', mindOut.residual * 2 + 'deg');
}

function loop() {
  updateLattice();
  render();
  const samples = sampleField();
  const mindOut = updateMind(samples);
  if (Math.random() < 0.02) spawnConstellation(mindOut);
  updateChrome(mindOut);
  statusEl.textContent = `Energy: ${mindOut.intent.toFixed(2)} | Residual: ${mindOut.residual.toFixed(3)} | Nodes: ${nodes.length}`;
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointermove', e => {
  if (e.buttons) deposit(e.clientX, e.clientY, 0.5);
});
canvas.addEventListener('pointerdown', e => deposit(e.clientX, e.clientY, 0.9));

document.getElementById('inject').onclick = () => {
  const word = seedInput.value.trim() || 'void';
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i);
    deposit((c % 100) / 100 * W, ((c * 7) % 100) / 100 * H, 0.7);
  }
  statusEl.textContent = 'Seed injected: ' + word;
};

document.getElementById('seal').onclick = () => {
  localStorage.setItem('f197-mind', JSON.stringify(mindState));
  statusEl.textContent = 'Mind sealed to localStorage';
};

document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) {
    statusEl.textContent = 'WebXR not available';
    return;
  }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    statusEl.textContent = 'XR session started (flat field remains interactive)';
    xrSession.addEventListener('end', () => { xrSession = null; statusEl.textContent = 'XR ended'; });
  } catch (err) {
    statusEl.textContent = 'XR failed: ' + err.message;
  }
};

try {
  const saved = localStorage.getItem('f197-mind');
  if (saved) mindState = { ...mindState, ...JSON.parse(saved) };
} catch (e) {}

if (navigator.gpu) {
  statusEl.textContent = 'WebGPU available — using Canvas2D fallback for lattice';
} else {
  statusEl.textContent = 'Canvas2D lattice active';
}

loop();
