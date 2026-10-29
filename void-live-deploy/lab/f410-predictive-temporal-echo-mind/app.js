// F-042: Predictive Temporal Echo Mind
// Spatial particles + decaying echo grid + Worker predictive coding + morphing portals

const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const portalsEl = document.getElementById('portals');
const chromeEl = document.getElementById('chrome');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', () => {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
});

const N = 110;
const particles = [];
const GRID_W = 32;
const GRID_H = 24;
let echo = new Float32Array(GRID_W * GRID_H);
let pointer = { x: W/2, y: H/2 };
let orient = { beta: 0, gamma: 0 };
let energy = 0;
let predError = 0.4;
let forecasts = [];
let worker = null;
let audioCtx = null;
let oscillators = [];

function initParticles() {
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2
    });
  }
}

function stampEcho(x, y, amp) {
  const gx = Math.max(0, Math.min(GRID_W-1, Math.floor((x / W) * GRID_W)));
  const gy = Math.max(0, Math.min(GRID_H-1, Math.floor((y / H) * GRID_H)));
  echo[gy * GRID_W + gx] += amp;
}

function stepParticles(dt) {
  const ax = (orient.gamma || 0) * 0.015;
  const ay = (orient.beta || 0) * 0.015;
  energy = 0;
  particles.forEach(p => {
    const dx = pointer.x - p.x;
    const dy = pointer.y - p.y;
    const dist = Math.hypot(dx, dy) + 40;
    p.vx += (dx / dist) * 0.35 + ax;
    p.vy += (dy / dist) * 0.35 + ay;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.7;
    if (p.y < 0 || p.y > H) p.vy *= -0.7;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
    stampEcho(p.x, p.y, 0.08);
    energy += Math.hypot(p.vx, p.vy);
  });
  energy = Math.min(1, energy / (N * 2.5));
  // decay echo
  for (let i = 0; i < echo.length; i++) echo[i] *= 0.935;
}

function findHotspots() {
  const peaks = [];
  for (let y = 1; y < GRID_H-1; y++) {
    for (let x = 1; x < GRID_W-1; x++) {
      const v = echo[y * GRID_W + x];
      if (v > 0.25) {
        peaks.push({ x: (x + 0.5) / GRID_W * W, y: (y + 0.5) / GRID_H * H, v });
      }
    }
  }
  peaks.sort((a,b) => b.v - a.v);
  return peaks.slice(0, 5);
}

// Worker for prediction
const workerCode = `
let history = [];
let biasX = 0, biasY = 0;
self.onmessage = e => {
  const { type, hotspots, reward } = e.data;
  if (type === 'observe') {
    if (hotspots.length) {
      const cx = hotspots.reduce((s,h)=>s+h.x,0)/hotspots.length;
      const cy = hotspots.reduce((s,h)=>s+h.y,0)/hotspots.length;
      history.push({x:cx, y:cy, t: performance.now()});
      if (history.length > 10) history.shift();
    }
    let preds = [];
    if (history.length >= 3) {
      const last = history[history.length-1];
      const prev = history[history.length-3];
      const dt = (last.t - prev.t) / 1000 || 0.5;
      const vx = (last.x - prev.x) / dt;
      const vy = (last.y - prev.y) / dt;
      for (let k = 1; k <= 3; k++) {
        const t = k * 0.7;
        preds.push({
          x: last.x + (vx + biasX) * t,
          y: last.y + (vy + biasY) * t,
          conf: Math.max(0.2, 1 - k * 0.25)
        });
      }
    }
    self.postMessage({ type: 'forecast', preds, biasX, biasY });
  } else if (type === 'reward') {
    biasX += reward.dx * 0.15;
    biasY += reward.dy * 0.15;
    biasX = Math.max(-80, Math.min(80, biasX));
    biasY = Math.max(-80, Math.min(80, biasY));
  }
};
`;

function startWorker() {
  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = e => {
      if (e.data.type === 'forecast') {
        forecasts = e.data.preds || [];
        updatePortals();
      }
    };
    statusEl.textContent = 'Worker mind online. Forecasting density.';
  } catch (err) {
    statusEl.textContent = 'Worker unavailable — local fallback.';
    worker = null;
  }
}

function updatePortals() {
  // clear old
  portalsEl.innerHTML = '';
  forecasts.forEach((f, i) => {
    if (f.x < -50 || f.x > W+50 || f.y < -50 || f.y > H+50) return;
    const p = document.createElement('div');
    p.className = 'portal active';
    p.style.left = f.x + 'px';
    p.style.top = f.y + 'px';
    p.textContent = `+${(i+1)*0.7}s\n${(f.conf*100)|0}%`;
    p.onclick = () => {
      const dx = pointer.x - f.x;
      const dy = pointer.y - f.y;
      if (worker) worker.postMessage({ type: 'reward', reward: { dx: dx * 0.01, dy: dy * 0.01 } });
      predError = Math.max(0.1, predError * 0.85);
      statusEl.textContent = `Trained on portal ${i+1}. Error ↓`;
      p.style.borderColor = '#6f6';
      setTimeout(() => p.remove(), 300);
    };
    portalsEl.appendChild(p);
  });
}

function draw() {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);
  // echo heat
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const v = echo[y * GRID_W + x];
      if (v > 0.04) {
        const px = (x / GRID_W) * W;
        const py = (y / GRID_H) * H;
        const s = (W / GRID_W) * 0.9;
        ctx.fillStyle = `hsla(${180 + v * 80}, 70%, ${40 + v * 30}%, ${Math.min(0.7, v * 1.4)})`;
        ctx.fillRect(px, py, s, s);
      }
    }
  }
  // particles
  ctx.fillStyle = '#8ef';
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  });
}

function observe() {
  const hot = findHotspots();
  if (worker) {
    worker.postMessage({ type: 'observe', hotspots: hot });
  } else {
    // simple fallback
    forecasts = hot.slice(0, 2).map(h => ({ x: h.x + 40, y: h.y, conf: 0.5 }));
    updatePortals();
  }
}

// Audio (after gesture)
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { console.warn('f410-predictive-temporal-echo-mind:', e); }
}

function tone(freq, dur = 0.12) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}

let frame = 0;
function loop() {
  stepParticles(1/60);
  if (frame % 8 === 0) observe();
  draw();
  document.documentElement.style.setProperty('--energy', energy.toFixed(3));
  document.documentElement.style.setProperty('--error', predError.toFixed(3));
  if (energy > 0.6 && frame % 30 === 0) tone(220 + energy * 180);
  frame++;
  requestAnimationFrame(loop);
}

// Events
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  initAudio();
});
canvas.addEventListener('pointerdown', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  for (let i = 0; i < 8; i++) stampEcho(e.clientX, e.clientY, 0.6);
  initAudio();
  tone(440, 0.08);
});

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

document.getElementById('seed').onclick = () => {
  particles.forEach(p => { p.vx += (Math.random()-0.5)*2; p.vy += (Math.random()-0.5)*2; });
  statusEl.textContent = 'Field reseeded.';
};

document.getElementById('seal').onclick = async () => {
  const state = {
    echoSum: Array.from(echo).reduce((s,v)=>s+v,0),
    energy,
    predError,
    ts: Date.now()
  };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f042', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('minds', { keyPath: 'ts' });
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('minds', 'readwrite');
    tx.objectStore('minds').put(state);
    statusEl.textContent = `Mind sealed ${new Date(state.ts).toLocaleTimeString()}.`;
  } catch (e) {
    statusEl.textContent = 'Seal skipped (IndexedDB).';
  }
};

// Boot
initParticles();
startWorker();
statusEl.textContent = 'Echo field live. Move to train predictions.';
loop();
