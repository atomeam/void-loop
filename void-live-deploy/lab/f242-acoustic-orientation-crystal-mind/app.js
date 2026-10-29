const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const sealStatus = document.getElementById('seal-status');

let W, H, gridW = 96, gridH = 54;
let field = new Float32Array(gridW * gridH);
let next = new Float32Array(gridW * gridH);
let crystals = [];
let micEnabled = false, oriEnabled = false;
let analyser, audioCtx, micStream;
let tiltX = 0, tiltY = 0;
let lastSeal = null;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function idx(x, y) {
  x = Math.max(0, Math.min(gridW - 1, x));
  y = Math.max(0, Math.min(gridH - 1, y));
  return y * gridW + x;
}

function deposit(gx, gy, amount) {
  const r = 3;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= r) {
        const i = idx(gx + dx, gy + dy);
        field[i] = Math.min(1, field[i] + amount * (1 - d / r));
      }
    }
  }
}

// Pointer deposits
canvas.addEventListener('pointerdown', e => {
  const gx = Math.floor((e.clientX / W) * gridW);
  const gy = Math.floor((e.clientY / H) * gridH);
  deposit(gx, gy, 0.6);
});

// Orientation
document.getElementById('oriBtn').onclick = async () => {
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p !== 'granted') return;
  }
  oriEnabled = true;
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45; // -1..1
    tiltY = (e.beta || 0) / 45;
  });
  statusEl.textContent = 'Tilt active. Field drifts with gravity.';
};

// Mic
document.getElementById('micBtn').onclick = async () => {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    micEnabled = true;
    statusEl.textContent = 'Mic active. Speak or make noise to deposit energy.';
    document.getElementById('micBtn').disabled = true;
  } catch (err) {
    statusEl.textContent = 'Mic denied. Using pointer only.';
  }
};

// Seal
document.getElementById('sealBtn').onclick = async () => {
  const summary = {
    crystals: crystals.length,
    maxEnergy: Math.max(...field),
    avg: field.reduce((a, b) => a + b, 0) / field.length,
    t: Date.now()
  };
  const data = new TextEncoder().encode(JSON.stringify(summary));
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('F242', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ hash, summary }, 'latest');
    await new Promise(res => tx.oncomplete = res);
    lastSeal = hash.slice(0, 12);
    sealStatus.textContent = `Sealed: ${lastSeal}… (${crystals.length} crystals)`;
  } catch {
    sealStatus.textContent = `In-memory seal: ${hash.slice(0, 12)}…`;
  }
};

function spawnCrystal(gx, gy, energy) {
  if (crystals.length >= 16) return;
  const el = document.createElement('div');
  el.className = 'crystal';
  el.style.left = ((gx / gridW) * W - 24) + 'px';
  el.style.top = ((gy / gridH) * H - 24) + 'px';
  el.style.setProperty('--crystal-hue', (energy * 120 + 180) % 360);
  document.body.appendChild(el);
  const c = { el, gx, gy, energy, osc: null, dragging: false };
  // simple audio per crystal
  if (audioCtx) {
    c.osc = audioCtx.createOscillator();
    c.gain = audioCtx.createGain();
    c.osc.type = 'sine';
    c.osc.frequency.value = 220 + energy * 440;
    c.gain.gain.value = 0.03 * energy;
    c.osc.connect(c.gain);
    c.gain.connect(audioCtx.destination);
    c.osc.start();
  }
  // drag
  el.addEventListener('pointerdown', e => {
    c.dragging = true;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!c.dragging) return;
    el.style.left = (e.clientX - 24) + 'px';
    el.style.top = (e.clientY - 24) + 'px';
    c.gx = Math.floor((e.clientX / W) * gridW);
    c.gy = Math.floor((e.clientY / H) * gridH);
    deposit(c.gx, c.gy, 0.15);
  });
  el.addEventListener('pointerup', () => c.dragging = false);
  crystals.push(c);
}

function step() {
  // mic deposit
  if (micEnabled && analyser) {
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    const mid = bins.slice(8, 40).reduce((a, b) => a + b, 0) / 32 / 255;
    if (mid > 0.05) {
      const earX = Math.floor(gridW * 0.5 + tiltX * 20);
      const earY = Math.floor(gridH * 0.3 + tiltY * 10);
      deposit(earX, earY, mid * 0.4);
    }
  }

  // advection + decay + diffusion
  next.fill(0);
  const dx = Math.round(tiltX * 1.5);
  const dy = Math.round(tiltY * 1.5);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const v = field[idx(x, y)] * 0.96; // decay
      if (v < 0.01) continue;
      const nx = x + dx;
      const ny = y + dy;
      next[idx(nx, ny)] += v;
      // slight diffusion
      next[idx(x, y)] += v * 0.02;
    }
  }
  [field, next] = [next, field];

  // consolidation → crystals
  if (performance.now() % 800 < 16) {
    for (let y = 2; y < gridH - 2; y += 4) {
      for (let x = 2; x < gridW - 2; x += 4) {
        const i = idx(x, y);
        if (field[i] > 0.55) {
          const existing = crystals.find(c => Math.hypot(c.gx - x, c.gy - y) < 6);
          if (!existing) spawnCrystal(x, y, field[i]);
          else existing.energy = Math.min(1, existing.energy + 0.1);
          field[i] *= 0.4; // consume
        }
      }
    }
  }

  // update crystals
  crystals = crystals.filter(c => {
    c.energy *= 0.992;
    c.el.style.setProperty('--energy', c.energy.toFixed(2));
    if (c.osc) {
      c.osc.frequency.value = 180 + c.energy * 500;
      c.gain.gain.value = 0.02 * c.energy;
    }
    if (c.energy < 0.08) {
      c.el.remove();
      if (c.osc) { try { c.osc.stop(); } catch {} }
      return false;
    }
    return true;
  });

  // render field
  const img = ctx.createImageData(gridW, gridH);
  for (let i = 0; i < field.length; i++) {
    const v = Math.min(1, field[i]);
    const p = i * 4;
    img.data[p] = v * 40;
    img.data[p + 1] = v * 80;
    img.data[p + 2] = v * 180 + 20;
    img.data[p + 3] = v * 220;
  }
  // scale up
  const tmp = document.createElement('canvas');
  tmp.width = gridW; tmp.height = gridH;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// WebGPU probe
if (navigator.gpu) {
  console.log('WebGPU available — compute path expansion ready');
  statusEl.textContent += ' WebGPU ready.';
}
