const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 64, H = 64, scale = 8;
canvas.width = W * scale; canvas.height = H * scale;

let A = new Float32Array(W * H);
let mu = 0.15, sigma = 0.03, dt = 0.1, R = 10;
let fitness = 0, bestFitness = 0;
let weights = null; // MLP
let lastSeal = 'none';
const channel = new BroadcastChannel('f533-lenia');

// Simple MLP: 4→8→2
function initMLP() {
  weights = {
    w1: Array.from({length: 4*8}, () => (Math.random()-0.5)*0.5),
    b1: Array(8).fill(0),
    w2: Array.from({length: 8*2}, () => (Math.random()-0.5)*0.5),
    b2: Array(2).fill(0)
  };
}
function mlpForward(x) {
  const h = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    let s = weights.b1[i];
    for (let j = 0; j < 4; j++) s += x[j] * weights.w1[j*8 + i];
    h[i] = Math.tanh(s);
  }
  const o = [weights.b2[0], weights.b2[1]];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 8; j++) o[i] += h[j] * weights.w2[j*2 + i];
  }
  return o;
}
function updateMLP(reward) {
  // tiny reward modulation
  const lr = 0.01 * reward;
  for (let i = 0; i < weights.w2.length; i++) weights.w2[i] += (Math.random()-0.5)*lr;
}

// Kernel precompute (bell)
const kernel = [];
let ksum = 0;
for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
  const r = Math.sqrt(x*x + y*y) / R;
  if (r <= 1) {
    const w = Math.exp(-((r-0.5)**2)/(2*0.15**2));
    kernel.push({x, y, w});
    ksum += w;
  }
}
kernel.forEach(k => k.w /= ksum);

function stepLenia() {
  const next = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let U = 0;
      for (const k of kernel) {
        const nx = (x + k.x + W) % W;
        const ny = (y + k.y + H) % H;
        U += A[ny*W + nx] * k.w;
      }
      const G = 2 * Math.exp(-((U - mu)**2) / (2 * sigma * sigma)) - 1;
      next[y*W + x] = Math.max(0, Math.min(1, A[y*W + x] + dt * G));
    }
  }
  A = next;
}

function render() {
  const img = ctx.createImageData(W * scale, H * scale);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = A[y*W + x];
    const c = Math.floor(v * 255);
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const i = ((y*scale+sy)*W*scale + (x*scale+sx)) * 4;
      img.data[i] = c; img.data[i+1] = c*0.8; img.data[i+2] = 255-c; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function meanActivity() {
  let s = 0; for (let i = 0; i < A.length; i++) s += A[i];
  return s / A.length;
}

// DOM probes
const probes = [];
for (let i = 0; i < 6; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = `Probe ${i+1}`;
  el.style.left = (60 + i*100) + 'px';
  el.style.top = (520 + (i%2)*80) + 'px';
  document.body.appendChild(el);
  probes.push({el, x: 60 + i*100, y: 520 + (i%2)*80});
  makeDraggable(el, i);
}

function makeDraggable(el, idx) {
  let ox, oy, dragging = false;
  el.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; });
  el.addEventListener('pointerup', e => {
    dragging = false;
    const cx = parseInt(el.style.left) + 45;
    const cy = parseInt(el.style.top) + 35;
    // map to field if over canvas
    const rect = canvas.getBoundingClientRect();
    if (cx > rect.left && cx < rect.right && cy > rect.top && cy < rect.bottom) {
      const fx = Math.floor(((cx - rect.left) / rect.width) * W);
      const fy = Math.floor(((cy - rect.top) / rect.height) * H);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = (fx + dx + W) % W, ny = (fy + dy + H) % H;
        A[ny*W + nx] = Math.min(1, A[ny*W + nx] + 0.4);
      }
    }
  });
}

function updateProbes() {
  probes.forEach((p, i) => {
    const rect = canvas.getBoundingClientRect();
    const fx = Math.floor(((p.el.offsetLeft + 45 - rect.left) / rect.width) * W);
    const fy = Math.floor(((p.el.offsetTop + 35 - rect.top) / rect.height) * H);
    if (fx >= 0 && fx < W && fy >= 0 && fy < H) {
      let local = 0, cnt = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = (fx+dx+W)%W, ny = (fy+dy+H)%H;
        local += A[ny*W + nx]; cnt++;
      }
      local /= cnt;
      p.el.style.transform = `scale(${0.8 + local*0.6})`;
      p.el.style.background = `hsl(${200 + local*120}, 70%, ${30 + local*40}%)`;
      p.el.textContent = `Probe ${i+1}\na=${local.toFixed(2)}`;
    }
  });
}

// Orientation
let orient = {b:0, g:0, db:0, dg:0};
let lastB = 0, lastG = 0;
function onOrient(e) {
  const b = (e.beta || 0) / 90;
  const g = (e.gamma || 0) / 90;
  orient.db = b - lastB; orient.dg = g - lastG;
  orient.b = b; orient.g = g;
  lastB = b; lastG = g;
}
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') window.addEventListener('deviceorientation', onOrient); });
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
};

// Pointer fallback
let px = 0, py = 0;
canvas.addEventListener('pointermove', e => {
  const dx = (e.clientX - px) / 50;
  const dy = (e.clientY - py) / 50;
  orient.b = dx; orient.g = dy; orient.db = dx; orient.dg = dy;
  px = e.clientX; py = e.clientY;
});

// Seal
async function seal() {
  const data = JSON.stringify({weights, mu, sigma, fitness});
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join(''));
  const db = await new Promise(r => { const req = indexedDB.open('f533', 1); req.onupgradeneeded = () => req.result.createObjectStore('genomes'); req.onsuccess = () => r(req.result); });
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({hash, weights, mu, sigma, fitness}, 'latest');
  lastSeal = hash.slice(0,8);
  channel.postMessage({weights, mu, sigma, fitness, hash});
  document.getElementById('status').textContent = `Sealed ${lastSeal} · fitness ${fitness.toFixed(3)}`;
}
document.getElementById('seal').onclick = seal;

channel.onmessage = e => {
  if (e.data.fitness > bestFitness) {
    weights = e.data.weights; mu = e.data.mu; sigma = e.data.sigma; bestFitness = e.data.fitness;
  }
};

function resetField() {
  for (let i = 0; i < A.length; i++) A[i] = Math.random() < 0.05 ? Math.random() : 0;
  // add a blob
  for (let y = 28; y < 36; y++) for (let x = 28; x < 36; x++) A[y*W+x] = 0.8;
}
document.getElementById('reset').onclick = resetField;

// Main loop
initMLP();
resetField();
let lastMLP = 0;
function loop(t) {
  if (t - lastMLP > 200) {
    const out = mlpForward([orient.b, orient.g, orient.db, orient.dg]);
    mu = Math.max(0.05, Math.min(0.3, 0.15 + out[0]*0.1));
    sigma = Math.max(0.01, Math.min(0.08, 0.03 + out[1]*0.02));
    const act = meanActivity();
    fitness = act * 0.7 + (1 - Math.abs(act - 0.2)) * 0.3; // prefer moderate activity
    if (fitness > bestFitness) { bestFitness = fitness; updateMLP(0.5); }
    lastMLP = t;
  }
  stepLenia();
  render();
  updateProbes();
  document.getElementById('status').textContent = `μ:${mu.toFixed(3)} σ:${sigma.toFixed(3)} act:${meanActivity().toFixed(3)} seal:${lastSeal}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
