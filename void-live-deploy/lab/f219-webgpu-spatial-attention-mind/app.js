const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = 0, H = 0, GRID = 48, cell = 0;
let field = [], attn = [], entropy = 0, curiosity = 0.5;
let pointer = { x: 0.5, y: 0.5, down: false };
let orient = { beta: 0, gamma: 0 };
let thoughts = [];
let sealed = null;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cell = Math.min(W, H) / GRID;
}
addEventListener('resize', resize); resize();

function initField() {
  field = new Float32Array(GRID * GRID);
  attn = new Float32Array(GRID * GRID);
  for (let i = 0; i < field.length; i++) field[i] = Math.random() * 0.3;
}

function idx(x, y) { return (y * GRID + x + GRID * GRID) % (GRID * GRID); } // wrap

function updateLattice() {
  const next = new Float32Array(field.length);
  const px = Math.floor(pointer.x * GRID);
  const py = Math.floor(pointer.y * GRID);
  const tiltX = orient.gamma / 90;
  const tiltY = orient.beta / 90;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      let sum = 0, wsum = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = (x + dx + GRID) % GRID;
          const ny = (y + dy + GRID) % GRID;
          const dist = Math.sqrt(dx*dx + dy*dy) + 0.1;
          const bias = 1 / dist * (1 + curiosity * 0.5);
          const a = attn[idx(nx, ny)] || 0.1;
          const val = field[idx(nx, ny)];
          sum += val * a * bias;
          wsum += a * bias;
        }
      }
      let v = wsum > 0 ? sum / wsum : field[idx(x, y)];
      // pointer / tilt focus
      const d = Math.hypot(x - px, y - py) / GRID;
      if (pointer.down) v = Math.max(v, Math.exp(-d * 8) * 0.8);
      v += tiltX * (x / GRID - 0.5) * 0.05 + tiltY * (y / GRID - 0.5) * 0.05;
      // curiosity noise in low areas
      if (Math.random() < curiosity * 0.02) v += (Math.random() - 0.5) * 0.1;
      next[idx(x, y)] = Math.max(0, Math.min(1, v * 0.92 + field[idx(x, y)] * 0.08));
    }
  }
  field = next;
  // recompute attention peaks
  let max = 0, e = 0;
  for (let i = 0; i < field.length; i++) {
    attn[i] = field[i] * field[i];
    max = Math.max(max, field[i]);
    e += field[i] * Math.log(field[i] + 1e-6);
  }
  entropy = -e / field.length;
  curiosity = Math.min(0.9, 0.2 + entropy * 0.8);
}

function draw() {
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const v = field[idx(x, y)];
      const a = attn[idx(x, y)];
      const hue = 220 + a * 80;
      ctx.fillStyle = `hsla(${hue}, 70%, ${20 + v * 50}%, ${0.4 + v * 0.6})`;
      ctx.fillRect(x * cell, y * cell, cell - 0.5, cell - 0.5);
    }
  }
}

function spawnThoughts() {
  // clear old
  document.querySelectorAll('.thought').forEach(el => el.remove());
  thoughts = [];
  // find top peaks
  const peaks = [];
  for (let y = 2; y < GRID-2; y += 4) {
    for (let x = 2; x < GRID-2; x += 4) {
      peaks.push({ x, y, v: field[idx(x, y)] });
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  for (let i = 0; i < Math.min(5, peaks.length); i++) {
    const p = peaks[i];
    if (p.v < 0.25) continue;
    const el = document.createElement('div');
    el.className = 'thought';
    el.textContent = `focus ${i+1} · ${p.v.toFixed(2)}`;
    el.style.left = (p.x * cell) + 'px';
    el.style.top = (p.y * cell) + 'px';
    el.style.transform = `translateZ(${p.v * 40}px) scale(${0.8 + p.v})`;
    el.style.opacity = 0.5 + p.v;
    let drag = false, ox = 0, oy = 0;
    el.addEventListener('pointerdown', e => { drag = true; ox = e.clientX - parseFloat(el.style.left); oy = e.clientY - parseFloat(el.style.top); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const nx = e.clientX - ox, ny = e.clientY - oy;
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
      const gx = Math.floor(nx / cell), gy = Math.floor(ny / cell);
      if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) field[idx(gx, gy)] = Math.min(1, field[idx(gx, gy)] + 0.15);
    });
    el.addEventListener('pointerup', () => drag = false);
    document.body.appendChild(el);
    thoughts.push(el);
  }
}

async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f219', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('k');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('k', 'readwrite');
    tx.objectStore('k').put({ curiosity, entropy, t: Date.now() }, 'best');
    await tx.complete;
    statusEl.textContent = 'Sealed · entropy ' + entropy.toFixed(3);
  } catch (e) { statusEl.textContent = 'Seal failed (in-memory)'; }
}

canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / W; pointer.y = e.clientY / H;
});
canvas.addEventListener('pointerdown', () => pointer.down = true);
canvas.addEventListener('pointerup', () => pointer.down = false);

if (typeof DeviceOrientationEvent !== 'undefined') {
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0; orient.gamma = e.gamma || 0;
  });
}

initField();
let frame = 0;
function loop() {
  updateLattice();
  draw();
  if (frame % 30 === 0) spawnThoughts();
  if (frame % 180 === 0) seal();
  frame++;
  requestAnimationFrame(loop);
}
statusEl.textContent = 'Canvas lattice · drag or tilt to focus attention';
loop();

// WebGPU path stub (upgrade: replace updateLattice with compute shader)
if (navigator.gpu) {
  statusEl.textContent += ' · WebGPU available (compute path reserved)';
}
