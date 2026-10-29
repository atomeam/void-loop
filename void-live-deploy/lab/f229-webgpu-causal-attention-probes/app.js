const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = 128, H = 72, field = new Float32Array(W * H);
let gpu = null, device = null, pipeline = null, buffers = null;
let useGPU = false;
let audioCtx, analyser, dataArray;
let orientation = { beta: 0, gamma: 0 };
let thought = { x: 0.5, y: 0.5, energy: 0.3, hue: 210, coherence: 0.5 };
let history = [];
const orbs = [];
const NUM_ORBS = 5;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Worker for local attention mind
const workerCode = `
let weights = Array.from({length: 8}, () => Math.random() * 0.2 - 0.1);
let history = [];
self.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'step') {
    history.push(payload);
    if (history.length > 16) history.shift();
    // Tiny attention over history
    let scores = history.map((h, i) => {
      let s = 0;
      for (let k = 0; k < 4; k++) s += h[k] * weights[k] * (i / history.length);
      return Math.exp(s);
    });
    let sum = scores.reduce((a,b)=>a+b, 1e-6);
    let attn = scores.map(s => s / sum);
    let thought = [0,0,0,0];
    history.forEach((h, i) => {
      for (let k = 0; k < 4; k++) thought[k] += attn[i] * h[k];
    });
    // Light mutation
    if (Math.random() < 0.05) weights = weights.map(w => w + (Math.random()-0.5)*0.02);
    self.postMessage({ thought, weights, coherence: Math.max(...attn) });
  } else if (type === 'seal') {
    self.postMessage({ sealed: { weights, history: history.slice(-8) } });
  }
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  if (e.data.thought) {
    const t = e.data.thought;
    thought.x = 0.5 + Math.tanh(t[0]) * 0.4;
    thought.y = 0.5 + Math.tanh(t[1]) * 0.4;
    thought.energy = Math.min(1, Math.abs(t[2]) * 2);
    thought.hue = 180 + t[3] * 120;
    thought.coherence = e.data.coherence || 0.5;
    document.documentElement.style.setProperty('--hue', Math.round(thought.hue));
    document.documentElement.style.setProperty('--contrast', 1 + thought.energy * 0.5);
    document.documentElement.style.setProperty('--blur', (1 - thought.coherence) * 4 + 'px');
    document.documentElement.style.setProperty('--energy', thought.energy);
  }
};

function createOrbs() {
  for (let i = 0; i < NUM_ORBS; i++) {
    const el = document.createElement('div');
    el.className = 'orb';
    el.textContent = i + 1;
    el.style.left = (20 + i * 15) + '%';
    el.style.top = (30 + (i % 3) * 15) + '%';
    document.body.appendChild(el);
    const orb = { el, x: 0.2 + i * 0.15, y: 0.3 + (i % 3) * 0.15, vx: 0, vy: 0, dragging: false };
    el.addEventListener('pointerdown', (ev) => { orb.dragging = true; el.setPointerCapture(ev.pointerId); });
    el.addEventListener('pointerup', () => { orb.dragging = false; });
    el.addEventListener('pointermove', (ev) => {
      if (!orb.dragging) return;
      orb.x = ev.clientX / innerWidth;
      orb.y = ev.clientY / innerHeight;
    });
    orbs.push(orb);
  }
}
createOrbs();

async function initGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    useGPU = true;
    statusEl.textContent = 'WebGPU active · causal lattice + attention probes';
    return true;
  } catch (e) {
    console.warn('WebGPU failed', e);
    return false;
  }
}

function stepField() {
  const next = new Float32Array(W * H);
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      const i = y * W + x;
      const n = field[i] * 0.85 + (field[i-1] + field[i+1] + field[i-W] + field[i+W]) * 0.03;
      next[i] = n;
    }
  }
  field = next;
  function deposit(px, py, amt) {
    const ix = Math.floor(px * W), iy = Math.floor(py * H);
    if (ix > 0 && ix < W-1 && iy > 0 && iy < H-1) field[iy * W + ix] += amt;
  }
  orbs.forEach(o => deposit(o.x, o.y, 0.15 * thought.energy));
}

function render() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const sx = canvas.width / W, sy = canvas.height / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.min(1, field[y * W + x] * 2);
      const r = Math.floor(v * 80 + thought.energy * 40);
      const g = Math.floor(v * 40);
      const b = Math.floor(180 + thought.hue * 0.3);
      for (let dy = 0; dy < sy; dy++) {
        for (let dx = 0; dx < sx; dx++) {
          const px = Math.floor(x * sx + dx), py = Math.floor(y * sy + dy);
          if (px < canvas.width && py < canvas.height) {
            const i = (py * canvas.width + px) * 4;
            data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  orbs.forEach((o, i) => {
    if (!o.dragging) {
      const tx = thought.x + Math.sin(performance.now() / 800 + i) * 0.1;
      const ty = thought.y + Math.cos(performance.now() / 900 + i) * 0.08;
      o.x += (tx - o.x) * 0.04;
      o.y += (ty - o.y) * 0.04;
    }
    o.el.style.left = (o.x * 100) + '%';
    o.el.style.top = (o.y * 100) + '%';
    o.el.style.transform = `scale(${0.8 + thought.energy * 0.6})`;
    o.el.style.filter = `hue-rotate(${thought.hue - 210}deg) brightness(${1 + thought.coherence})`;
  });
}

function loop() {
  stepField();
  let residual = 0;
  for (let i = 0; i < field.length; i += 16) residual += field[i];
  residual /= (field.length / 16);
  let audioFeat = 0;
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    audioFeat = dataArray[4] / 255;
  }
  worker.postMessage({
    type: 'step',
    payload: [orientation.gamma / 90, orientation.beta / 90, residual, audioFeat]
  });
  render();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointermove', (e) => {
  const ix = Math.floor(e.clientX / innerWidth * W), iy = Math.floor(e.clientY / innerHeight * H);
  if (ix > 0 && ix < W-1 && iy > 0 && iy < H-1) field[iy * W + ix] += 0.4;
});
canvas.addEventListener('pointerdown', (e) => {
  const ix = Math.floor(e.clientX / innerWidth * W), iy = Math.floor(e.clientY / innerHeight * H);
  if (ix > 0 && ix < W-1 && iy > 0 && iy < H-1) field[iy * W + ix] += 1.2;
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', (e) => {
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
}

document.getElementById('mic').onclick = async () => {
  try {
    audioCtx = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    statusEl.textContent = 'Mic active · spectral energy feeding attention mind';
    document.getElementById('mic').disabled = true;
  } catch (err) {
    statusEl.textContent = 'Mic denied · pointer + orientation continue';
  }
};

document.getElementById('seal').onclick = () => {
  worker.postMessage({ type: 'seal' });
  const req = indexedDB.open('void-f229', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('thought');
  req.onsuccess = () => {
    const tx = req.result.transaction('thought', 'readwrite');
    tx.objectStore('thought').put({ id: 'leader', thought, ts: Date.now() });
    statusEl.textContent = 'Thought sealed to IndexedDB';
  };
};

initGPU().then(() => loop());
