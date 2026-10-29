const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = innerWidth, H = innerHeight;
canvas.width = W; canvas.height = H;

const COLS = 64, ROWS = 36;
let residual = new Float32Array(COLS * ROWS);
let embX = new Float32Array(COLS * ROWS);
let embY = new Float32Array(COLS * ROWS);
let nextRes = new Float32Array(COLS * ROWS);

function idx(x, y) { return y * COLS + x; }

// init
for (let i = 0; i < residual.length; i++) {
  residual[i] = Math.random() * 0.2;
  embX[i] = Math.random() * 2 - 1;
  embY[i] = Math.random() * 2 - 1;
}

let tiltX = 0, tiltY = 0, spectral = 0, trajSpeed = 0;
let diffRate = 0.12, portalGain = 1, hueShift = 0;
let lastResidual = 0.3;
const portals = [];
const NUM_PORTALS = 5;

function makePortal(i) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'portal ' + i;
  el.style.left = (20 + i * 15) + '%';
  el.style.top = (30 + (i % 3) * 15) + '%';
  document.body.appendChild(el);
  return { el, x: 0.2 + i * 0.15, y: 0.3 + (i % 3) * 0.15, vx: 0, vy: 0 };
}
for (let i = 0; i < NUM_PORTALS; i++) portals.push(makePortal(i));

// Worker residual MLP + hill-climb
const workerCode = `
let w = new Float32Array(5*3 + 3); // tiny residual MLP weights
for (let i = 0; i < w.length; i++) w[i] = (Math.random() - 0.5) * 0.4;
let bestW = w.slice(), bestFit = -Infinity;

function mlp(inp) {
  // 5 -> 3 hidden -> 3 out (diff, gain, hue)
  const h = new Float32Array(3);
  for (let j = 0; j < 3; j++) {
    let s = 0;
    for (let i = 0; i < 5; i++) s += inp[i] * w[i*3 + j];
    h[j] = Math.tanh(s);
  }
  const out = new Float32Array(3);
  for (let k = 0; k < 3; k++) {
    let s = 0;
    for (let j = 0; j < 3; j++) s += h[j] * w[15 + j*3 + k];
    out[k] = Math.tanh(s) * 0.5 + 0.5;
  }
  return out;
}

function predict(inp) {
  const o = mlp(inp);
  return o[0] * 0.4; // predicted residual proxy
}

self.onmessage = e => {
  const { residual, sensors } = e.data;
  const inp = [sensors.tiltX, sensors.tiltY, sensors.spectral, sensors.traj, residual];
  const pred = predict(inp);
  const fit = -Math.abs(pred - residual);
  if (fit > bestFit) { bestFit = fit; bestW = w.slice(); }
  // hill-climb
  const trial = bestW.slice();
  const idx = Math.floor(Math.random() * trial.length);
  trial[idx] += (Math.random() - 0.5) * 0.15;
  w = trial;
  const o = mlp(inp);
  self.postMessage({
    diffRate: 0.05 + o[0] * 0.2,
    portalGain: 0.4 + o[1] * 1.6,
    hueShift: o[2] * 360,
    fit
  });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  diffRate = e.data.diffRate;
  portalGain = e.data.portalGain;
  hueShift = e.data.hueShift;
};

// Audio
let audioCtx, oscs = [];
function startAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  for (let i = 0; i < 2; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = i ? 'sine' : 'triangle';
    o.frequency.value = 120 + i * 80;
    g.gain.value = 0.03;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    oscs.push({ o, g });
  }
}

// Mic
let analyser;
document.getElementById('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = audioCtx || new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    startAudio();
  } catch (e) { console.warn(e); }
};

// Orientation
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') window.addEventListener('deviceorientation', onOrient); });
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
};
function onOrient(e) {
  tiltX = (e.gamma || 0) / 45;
  tiltY = (e.beta || 0) / 45;
}

// Pointer trajectory
let px = 0, py = 0, lastT = 0;
window.addEventListener('pointermove', e => {
  const now = performance.now();
  const dx = e.clientX - px, dy = e.clientY - py;
  trajSpeed = Math.min(1, Math.hypot(dx, dy) / 40);
  px = e.clientX; py = e.clientY;
  // seed residual near pointer
  const cx = Math.floor((e.clientX / W) * COLS);
  const cy = Math.floor((e.clientY / H) * ROWS);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) residual[idx(x, y)] = Math.min(1, residual[idx(x, y)] + 0.15);
  }
  lastT = now;
});

// Portal drag consolidation
portals.forEach(p => {
  let dragging = false, ox, oy;
  p.el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - parseFloat(p.el.style.left || 0);
    oy = e.clientY - parseFloat(p.el.style.top || 0);
    p.el.setPointerCapture(e.pointerId);
  });
  p.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    p.el.style.left = (e.clientX - ox) + 'px';
    p.el.style.top = (e.clientY - oy) + 'px';
    p.x = e.clientX / W;
    p.y = e.clientY / H;
  });
  p.el.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    consolidate(p);
  });
});

function consolidate(p) {
  const cx = Math.floor(p.x * COLS), cy = Math.floor(p.y * ROWS);
  let sx = 0, sy = 0, n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
      sx += embX[idx(x, y)]; sy += embY[idx(x, y)]; n++;
      residual[idx(x, y)] = Math.min(1, residual[idx(x, y)] + 0.4 * Math.exp(-(dx*dx+dy*dy)/4));
    }
  }
  if (n) {
    const frag = { emb: [sx/n, sy/n], residual: lastResidual, t: Date.now() };
    // seal
    const req = indexedDB.open('void-f248', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals', { autoIncrement: true });
    req.onsuccess = () => {
      const tx = req.result.transaction('seals', 'readwrite');
      tx.objectStore('seals').add(frag);
    };
    p.el.textContent = 'sealed ' + Math.abs(Math.floor(sx/n * 100));
  }
}

// XR stub
document.getElementById('xr').onclick = async () => {
  if (navigator.xr) {
    try {
      const session = await navigator.xr.requestSession('immersive-vr');
      status.textContent += ' · XR entered';
      session.end();
    } catch (e) { status.textContent += ' · XR unavailable'; }
  }
};

function step() {
  // diffuse residual
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
    const i = idx(x, y);
    const avg = (residual[idx(x-1,y)] + residual[idx(x+1,y)] + residual[idx(x,y-1)] + residual[idx(x,y+1)]) * 0.25;
    nextRes[i] = residual[i] * (1 - diffRate) + avg * diffRate;
    // tilt bias
    nextRes[i] += tiltX * 0.002 * (x / COLS - 0.5) + tiltY * 0.002 * (y / ROWS - 0.5);
    nextRes[i] = Math.max(0, Math.min(1, nextRes[i]));
  }
  residual.set(nextRes);

  // spectral modulation
  if (analyser) {
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    spectral = bins.reduce((a, b) => a + b, 0) / (bins.length * 255);
  }

  // mean residual
  let sum = 0;
  for (let i = 0; i < residual.length; i++) sum += residual[i];
  lastResidual = sum / residual.length;

  // send to worker
  worker.postMessage({ residual: lastResidual, sensors: { tiltX, tiltY, spectral, traj: trajSpeed } });

  // update portals toward peaks
  portals.forEach((p, pi) => {
    let best = 0, bx = p.x, by = p.y;
    for (let k = 0; k < 8; k++) {
      const tx = Math.floor(Math.random() * COLS), ty = Math.floor(Math.random() * ROWS);
      if (residual[idx(tx, ty)] > best) { best = residual[idx(tx, ty)]; bx = tx / COLS; by = ty / ROWS; }
    }
    p.x += (bx - p.x) * 0.04 * portalGain;
    p.y += (by - p.y) * 0.04 * portalGain;
    p.el.style.left = (p.x * W - 70) + 'px';
    p.el.style.top = (p.y * H - 40) + 'px';
    const r = residual[idx(Math.floor(p.x * COLS), Math.floor(p.y * ROWS))] || 0;
    const rotX = tiltY * 20 + r * 15;
    const rotY = tiltX * 20 + (pi - 2) * 5;
    p.el.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${0.8 + r * 0.6})`;
    p.el.style.borderColor = `hsla(${(hueShift + r * 120) % 360}, 70%, 60%, .7)`;
    p.el.style.filter = `blur(${r * 1.5}px)`;
  });

  // chrome
  document.documentElement.style.setProperty('--hue', hueShift);
  document.documentElement.style.setProperty('--blur', (lastResidual * 4) + 'px');
  document.documentElement.style.setProperty('--contrast', 1 + lastResidual * 0.3);
  document.documentElement.style.setProperty('--bg', `hsl(${hueShift}, 30%, ${8 + lastResidual * 6}%)`);

  // audio
  if (oscs.length) {
    oscs[0].o.frequency.value = 80 + lastResidual * 200 + spectral * 100;
    oscs[0].g.gain.value = 0.02 + lastResidual * 0.04;
    oscs[1].o.frequency.value = 160 + spectral * 180;
    oscs[1].g.gain.value = 0.015 + spectral * 0.03;
  }

  status.textContent = `residual ${lastResidual.toFixed(3)} · diff ${diffRate.toFixed(3)} · spectral ${spectral.toFixed(2)}`;

  // draw
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const cellW = W / COLS, cellH = H / ROWS;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const r = residual[idx(x, y)];
    const hue = (hueShift + r * 180 + embX[idx(x, y)] * 40) % 360;
    const col = `hsl(${hue}, 70%, ${20 + r * 50}%)`;
    // simple fill via sampling (coarse)
    const sx = Math.floor(x * cellW), sy = Math.floor(y * cellH);
    const ex = Math.floor((x + 1) * cellW), ey = Math.floor((y + 1) * cellH);
    for (let py = sy; py < ey && py < H; py += 2) for (let px = sx; px < ex && px < W; px += 2) {
      const i = (py * W + px) * 4;
      data[i] = r * 80; data[i+1] = r * 40 + 20; data[i+2] = 80 + r * 120; data[i+3] = 180 + r * 75;
    }
  }
  ctx.putImageData(img, 0, 0);

  requestAnimationFrame(step);
}
step();

window.addEventListener('resize', () => {
  W = innerWidth; H = innerHeight;
  canvas.width = W; canvas.height = H;
});
