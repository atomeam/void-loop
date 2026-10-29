const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const W = 64, H = 48, CH = 4;
let lattice = new Float32Array(W * H * CH);
let next = new Float32Array(W * H * CH);
const orbs = [];
const N_ORBS = 5;
let residual = 0, energy = 0.3, generation = 0;
let tiltX = 0, tiltY = 0, spectral = 0;
let audioCtx, oscillators = [], gains = [], pans = [];
let worker;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Seed lattice
for (let i = 0; i < lattice.length; i++) lattice[i] = Math.random() * 0.2;

// Orbs
const orbsContainer = document.getElementById('orbs');
for (let i = 0; i < N_ORBS; i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.style.setProperty('--h', 180 + i * 40);
  orbsContainer.appendChild(el);
  orbs.push({ el, x: Math.random(), y: Math.random(), sealed: false });
  el.addEventListener('pointerdown', e => startDrag(e, i));
}

let dragging = null;
function startDrag(e, i) {
  dragging = i;
  orbs[i].el.setPointerCapture(e.pointerId);
}
addEventListener('pointermove', e => {
  if (dragging === null) return;
  const rect = canvas.getBoundingClientRect();
  orbs[dragging].x = (e.clientX - rect.left) / rect.width;
  orbs[dragging].y = (e.clientY - rect.top) / rect.height;
});
addEventListener('pointerup', () => {
  if (dragging !== null) {
    // Seal fragment
    sealFragment(dragging);
    dragging = null;
  }
});

function sealFragment(i) {
  const o = orbs[i];
  const cx = Math.floor(o.x * W), cy = Math.floor(o.y * H);
  const snapshot = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = (cx + dx + W) % W, y = (cy + dy + H) % H;
    snapshot.push(lattice[(y * W + x) * CH]);
  }
  const record = { t: Date.now(), residual, energy, snapshot, gen: generation };
  try {
    const req = indexedDB.open('F253', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals', { keyPath: 't' });
    req.onsuccess = () => {
      const tx = req.result.transaction('seals', 'readwrite');
      tx.objectStore('seals').put(record);
    };
  } catch (e) {}
  // Inject seed
  const idx = (cy * W + cx) * CH;
  lattice[idx] = Math.min(1, lattice[idx] + 0.5);
  o.el.style.filter = 'brightness(1.5)';
  setTimeout(() => o.el.style.filter = '', 400);
}

// Worker for evolutionary residual MLP
const workerCode = `
let pop = Array.from({length: 6}, () => Array.from({length: 16}, () => Math.random() * 0.4 - 0.2));
let best = pop[0].slice();
let gen = 0;
function predict(inputs, weights) {
  let h = 0;
  for (let i = 0; i < 8; i++) {
    let s = weights[i];
    for (let j = 0; j < inputs.length; j++) s += inputs[j] * weights[8 + i * inputs.length + j];
    h += Math.tanh(s);
  }
  return Math.tanh(h / 8);
}
self.onmessage = e => {
  const { residual, deposits } = e.data;
  // Simple fitness proxy: lower residual better, diversity bonus
  const fitness = 1 / (1 + residual) + Math.random() * 0.1;
  // Hill-climb / mutate
  if (Math.random() < 0.3) {
    const i = Math.floor(Math.random() * best.length);
    best[i] += (Math.random() - 0.5) * 0.2;
  }
  gen++;
  self.postMessage({ best, gen, fitness });
};
`;
try {
  worker = new Worker(URL.createObjectURL(new Blob([workerCode])));
  worker.onmessage = e => {
    generation = e.data.gen;
    // Apply best weights somehow — for demo we just track residual modulation
  };
} catch (e) { console.warn('Worker blocked', e); }

// Audio
function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  for (let i = 0; i < 6; i++) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const p = audioCtx.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.value = 220 + i * 40;
    g.gain.value = 0.02;
    osc.connect(g).connect(p).connect(audioCtx.destination);
    osc.start();
    oscillators.push(osc); gains.push(g); pans.push(p);
  }
}

// Orientation
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(s => s === 'granted' && startOrient());
  } else startOrient();
};
function startOrient() {
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 90;
    tiltY = (e.beta || 0) / 90;
  });
}

// Mic
document.getElementById('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const actx = new AudioContext();
    const src = actx.createMediaStreamSource(stream);
    const an = actx.createAnalyser();
    an.fftSize = 64;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    setInterval(() => {
      an.getByteFrequencyData(data);
      let sum = 0, wsum = 0;
      for (let i = 0; i < data.length; i++) { sum += data[i] * i; wsum += data[i]; }
      spectral = wsum > 0 ? sum / wsum / data.length : 0;
    }, 100);
    document.getElementById('mic').textContent = 'Mic on';
  } catch (e) { console.warn(e); }
};

// XR stub
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) return alert('WebXR not supported');
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    document.getElementById('xr').textContent = 'XR active';
  } catch (e) { console.warn(e); }
};

document.getElementById('seal').onclick = () => sealFragment(0);

// Main loop
let pointer = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  pointer.vx = nx - pointer.x;
  pointer.vy = ny - pointer.y;
  pointer.x = nx;
  pointer.y = ny;
  // Deposit
  const cx = Math.floor(nx * W), cy = Math.floor(ny * H);
  const idx = (cy * W + cx) * CH;
  lattice[idx] = Math.min(1, lattice[idx] + 0.15);
});

function step() {
  // Simple residual-modulated diffusion + reaction
  residual = Math.min(1, residual * 0.98 + Math.abs(pointer.vx) * 0.1 + spectral * 0.05);
  energy = Math.min(1, energy * 0.99 + residual * 0.02);
  document.documentElement.style.setProperty('--residual', residual);
  document.documentElement.style.setProperty('--energy', energy);
  document.documentElement.style.setProperty('--hue', 200 + residual * 160);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * CH;
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
        sum += lattice[(ny * W + nx) * CH];
        cnt++;
      }
      const avg = sum / cnt;
      const delta = (avg - lattice[i]) * (0.15 + residual * 0.1) + (Math.random() - 0.5) * 0.01;
      next[i] = Math.max(0, Math.min(1, lattice[i] + delta));
      next[i + 1] = next[i] * 0.8 + tiltX * 0.1;
      next[i + 2] = spectral * 0.5;
      next[i + 3] = residual;
    }
  }
  [lattice, next] = [next, lattice];

  // Render
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = lattice[i * CH];
    img.data[i * 4] = v * 80 + residual * 100;
    img.data[i * 4 + 1] = v * 120;
    img.data[i * 4 + 2] = v * 180 + spectral * 50;
    img.data[i * 4 + 3] = 255;
  }
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

  // Update orbs
  orbs.forEach((o, idx) => {
    const cx = Math.floor(o.x * W), cy = Math.floor(o.y * H);
    const v = lattice[(cy * W + cx) * CH];
    o.el.style.left = (o.x * 100) + '%';
    o.el.style.top = (o.y * 100) + '%';
    o.el.style.transform = `scale(${0.6 + v * 1.2}) rotate(${v * 40}deg)`;
    o.el.style.filter = `hue-rotate(${v * 180}deg) brightness(${0.7 + v})`;
  });

  // Audio
  if (audioCtx && oscillators.length) {
    for (let i = 0; i < oscillators.length; i++) {
      const sx = (i / 5) % 1, sy = (i * 0.3) % 1;
      const cx = Math.floor(sx * W), cy = Math.floor(sy * H);
      const v = lattice[(cy * W + cx) * CH];
      oscillators[i].frequency.setTargetAtTime(180 + v * 400 + spectral * 200, audioCtx.currentTime, 0.05);
      gains[i].gain.setTargetAtTime(0.01 + v * 0.06, audioCtx.currentTime, 0.05);
      pans[i].pan.setTargetAtTime(sx * 2 - 1, audioCtx.currentTime, 0.05);
    }
  }

  if (worker) worker.postMessage({ residual, deposits: [pointer.vx, tiltX, spectral] });

  document.getElementById('status').textContent = `residual: ${residual.toFixed(2)} | energy: ${energy.toFixed(2)} | gen: ${generation}`;
  requestAnimationFrame(step);
}

// Gesture to start audio
addEventListener('pointerdown', () => initAudio(), { once: true });
step();
