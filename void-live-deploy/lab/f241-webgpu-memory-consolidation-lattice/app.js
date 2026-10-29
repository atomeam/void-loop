const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const statusEl = document.getElementById('status');
let W, H, gridW = 96, gridH = 54;
let field = new Float32Array(gridW * gridH);
let orbs = [];
const MAX_ORBS = 10;
let orientX = 0, orientY = 0;
let hasOrient = false;
let dragX = 0, dragY = 0;
let lastSeal = null;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// WebGPU probe
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(a => {
    statusEl.textContent = a ? 'WebGPU available (Canvas2D active)' : 'WebGPU adapter failed';
  }).catch(() => statusEl.textContent = 'WebGPU probe error');
} else {
  statusEl.textContent = 'Canvas2D · no WebGPU';
}

function deposit(x, y, strength = 1.8) {
  const gx = Math.floor((x / W) * gridW);
  const gy = Math.floor((y / H) * gridH);
  const r = 4;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = gx + dx, ny = gy + dy;
      if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
        const d = Math.hypot(dx, dy);
        if (d <= r) {
          const idx = ny * gridW + nx;
          field[idx] = Math.min(4, field[idx] + strength * (1 - d / r));
        }
      }
    }
  }
}

canvas.addEventListener('pointerdown', e => {
  deposit(e.clientX, e.clientY);
  dragX = e.clientX; dragY = e.clientY;
});
canvas.addEventListener('pointermove', e => {
  if (e.buttons) {
    const dx = (e.clientX - dragX) / W * 0.4;
    const dy = (e.clientY - dragY) / H * 0.4;
    advect(dx, dy);
    dragX = e.clientX; dragY = e.clientY;
  }
});

document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') window.addEventListener('deviceorientation', onOrient);
    });
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
  statusEl.textContent = 'Orientation listening…';
};

function onOrient(e) {
  hasOrient = true;
  orientX = (e.gamma || 0) / 90 * 0.35; // -1..1-ish
  orientY = (e.beta || 0) / 90 * 0.35;
}

document.getElementById('clear').onclick = () => {
  field.fill(0);
  orbs.forEach(o => o.el.remove());
  orbs = [];
};

document.getElementById('seal').onclick = async () => {
  const sum = field.reduce((a, b) => a + b, 0);
  const max = Math.max(...field);
  const payload = JSON.stringify({ t: Date.now(), sum: +sum.toFixed(2), max: +max.toFixed(2), orbs: orbs.length });
  const buf = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  lastSeal = hex;
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f241', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ payload, hex, t: Date.now() }, 'latest');
    statusEl.textContent = `Sealed ${hex} · orbs:${orbs.length}`;
  } catch (err) {
    statusEl.textContent = `Seal (mem) ${hex}`;
  }
};

function advect(vx, vy) {
  if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return;
  const next = new Float32Array(field.length);
  const sx = Math.round(vx * gridW * 0.5);
  const sy = Math.round(vy * gridH * 0.5);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const nx = x - sx, ny = y - sy;
      if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
        next[y * gridW + x] = field[ny * gridW + nx] * 0.97;
      }
    }
  }
  field.set(next);
}

function consolidate() {
  const next = new Float32Array(field);
  for (let y = 1; y < gridH - 1; y++) {
    for (let x = 1; x < gridW - 1; x++) {
      const idx = y * gridW + x;
      let localMax = field[idx];
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = field[(y + dy) * gridW + (x + dx)];
          if (v > localMax) localMax = v;
          if (v > 0.4) count++;
        }
      }
      if (field[idx] > 0.6 && count > 3) {
        next[idx] = Math.min(5, field[idx] + 0.08);
      } else {
        next[idx] = field[idx] * 0.992;
      }
    }
  }
  field.set(next);
}

function updateOrbs() {
  // Find peaks
  const peaks = [];
  for (let y = 2; y < gridH - 2; y++) {
    for (let x = 2; x < gridW - 2; x++) {
      const v = field[y * gridW + x];
      if (v > 0.8) {
        let isMax = true;
        for (let dy = -2; dy <= 2 && isMax; dy++)
          for (let dx = -2; dx <= 2; dx++)
            if (field[(y+dy)*gridW + (x+dx)] > v) isMax = false;
        if (isMax) peaks.push({ x, y, v });
      }
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  peaks.length = Math.min(peaks.length, MAX_ORBS);

  while (orbs.length < peaks.length) {
    const el = document.createElement('div');
    el.className = 'orb';
    el.style.width = '40px'; el.style.height = '40px';
    document.body.appendChild(el);
    orbs.push({ el, x: 0, y: 0, v: 0 });
  }
  while (orbs.length > peaks.length) {
    orbs.pop().el.remove();
  }
  peaks.forEach((p, i) => {
    const o = orbs[i];
    o.x = (p.x / gridW) * W;
    o.y = (p.y / gridH) * H;
    o.v = p.v;
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
    const scale = 0.6 + p.v * 0.5;
    const hue = 160 + p.v * 40;
    o.el.style.setProperty('--orb-scale', scale);
    o.el.style.setProperty('--orb-hue', hue);
    o.el.style.width = (30 + p.v * 20) + 'px';
    o.el.style.height = (30 + p.v * 20) + 'px';
  });

  // Chrome morph from average
  const avg = orbs.reduce((s, o) => s + o.v, 0) / (orbs.length || 1);
  document.documentElement.style.setProperty('--chrome-blur', (avg * 2) + 'px');
  document.documentElement.style.setProperty('--chrome-opacity', 0.6 + avg * 0.15);
}

function draw() {
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.createImageData(W, H);
  // Simple nearest for performance; could bilinear
  for (let py = 0; py < H; py += 2) {
    for (let px = 0; px < W; px += 2) {
      const gx = Math.min(gridW - 1, Math.floor(px / W * gridW));
      const gy = Math.min(gridH - 1, Math.floor(py / H * gridH));
      const v = field[gy * gridW + gx];
      const c = Math.min(255, v * 60);
      const i = (py * W + px) * 4;
      img.data[i] = c * 0.4;
      img.data[i+1] = c * 0.6;
      img.data[i+2] = c;
      img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

let frame = 0;
function loop() {
  if (hasOrient) advect(orientX, orientY);
  if (frame % 8 === 0) consolidate();
  if (frame % 4 === 0) updateOrbs();
  draw();
  frame++;
  requestAnimationFrame(loop);
}
loop();

// Initial deposits
setTimeout(() => {
  deposit(W * 0.3, H * 0.4, 2);
  deposit(W * 0.7, H * 0.6, 1.5);
}, 300);
