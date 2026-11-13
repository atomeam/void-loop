const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 128, H = 128;
let scale = 1;
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  scale = Math.min(canvas.width / W, canvas.height / H);
}
addEventListener('resize', resize);
resize();

// Lattice: amplitude and phase (simplified quantum-like)
let amp = new Float32Array(W * H);
let phase = new Float32Array(W * H);
let potential = new Float32Array(W * H); // 0 = free, 1 = barrier
let density = new Float32Array(W * H);

function idx(x, y) { return ((y + H) % H) * W + ((x + W) % W); }

function init(random = true) {
  for (let i = 0; i < amp.length; i++) {
    amp[i] = random ? Math.random() * 0.3 : 0.1;
    phase[i] = random ? Math.random() * Math.PI * 2 : 0;
    potential[i] = 0;
  }
  // seed a few waves
  for (let k = 0; k < 3; k++) {
    const cx = (Math.random() * W) | 0, cy = (Math.random() * H) | 0;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        const i = idx(cx + dx, cy + dy);
        amp[i] += (8 - d) * 0.05;
        phase[i] += Math.atan2(dy, dx);
      }
    }
  }
}
init();

// Portals
const portals = Array.from({length: 6}, (_, i) => {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'idle';
  document.body.appendChild(el);
  return { el, x: W/2, y: H/2, label: 'mode 0' };
});

let barrierMode = false;
document.getElementById('barriers').onclick = () => barrierMode = !barrierMode;

let lastX = 0, lastY = 0, hasLast = false;
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / scale) | 0;
  const py = ((e.clientY - rect.top) / scale) | 0;
  if (px < 0 || px >= W || py < 0 || py >= H) return;
  if (barrierMode && e.buttons) {
    potential[idx(px, py)] = 1;
    amp[idx(px, py)] = 0;
    return;
  }
  // inject phase based on velocity
  let vx = 0, vy = 0;
  if (hasLast) {
    vx = px - lastX; vy = py - lastY;
  }
  lastX = px; lastY = py; hasLast = true;
  const speed = Math.hypot(vx, vy);
  const kick = Math.min(speed * 0.15, 1.2);
  const ang = Math.atan2(vy, vx);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = idx(px + dx, py + dy);
    if (potential[i] < 0.5) {
      phase[i] += ang * 0.3 + kick;
      amp[i] = Math.min(amp[i] + 0.08, 1.5);
    }
  }
});
canvas.addEventListener('pointerdown', e => { hasLast = false; });

function step() {
  const newAmp = new Float32Array(amp);
  const newPhase = new Float32Array(phase);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (potential[i] > 0.5) { newAmp[i] = 0; continue; }
      let sumA = amp[i], sumP = phase[i];
      let count = 1;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const j = idx(x + dx, y + dy);
        if (potential[j] < 0.5) {
          sumA += amp[j] * 0.25;
          sumP += phase[j] * 0.25;
          count++;
        }
      }
      newAmp[i] = Math.max(0, sumA / count * 0.98); // slight damping
      newPhase[i] = sumP / count + (Math.random() - 0.5) * 0.02;
    }
  }
  amp = newAmp; phase = newPhase;
  // density
  let maxD = 0.001;
  for (let i = 0; i < amp.length; i++) {
    density[i] = amp[i] * amp[i];
    if (density[i] > maxD) maxD = density[i];
  }
  return maxD;
}

function findPeaks(n = 6) {
  const peaks = [];
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = idx(x, y);
      const d = density[i];
      if (d < 0.05) continue;
      let isPeak = true;
      for (let dy = -1; dy <= 1 && isPeak; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx || dy) if (density[idx(x+dx, y+dy)] > d) isPeak = false;
      }
      if (isPeak) peaks.push({ x, y, d, phase: phase[i] });
    }
  }
  peaks.sort((a, b) => b.d - a.d);
  return peaks.slice(0, n);
}

function render(maxD) {
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const d = density[i] / maxD;
    const p = phase[i];
    const hue = ((p / (Math.PI * 2)) % 1) * 360;
    const sat = 70 + d * 30;
    const lit = 10 + d * 60;
    // simple HSL to RGB approx
    const c = (1 - Math.abs(2 * lit/100 - 1)) * sat/100;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = lit/100 - c/2;
    let r=0,g=0,b=0;
    if (hue < 60) { r=c; g=x; }
    else if (hue < 120) { r=x; g=c; }
    else if (hue < 180) { g=c; b=x; }
    else if (hue < 240) { g=x; b=c; }
    else if (hue < 300) { r=x; b=c; }
    else { r=c; b=x; }
    img.data[i*4] = (r+m)*255;
    img.data[i*4+1] = (g+m)*255;
    img.data[i*4+2] = (b+m)*255;
    img.data[i*4+3] = 255;
  }
  // upscale
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W * scale, H * scale);
}

function updatePortals(peaks) {
  for (let i = 0; i < portals.length; i++) {
    const p = portals[i];
    if (peaks[i]) {
      const t = peaks[i];
      p.x += (t.x - p.x) * 0.15;
      p.y += (t.y - p.y) * 0.15;
      const mode = Math.round(((t.phase / (Math.PI * 2)) % 1) * 8);
      p.label = `mode ${mode} · ${t.d.toFixed(2)}`;
    }
    p.el.style.left = (p.x * scale) + 'px';
    p.el.style.top = (p.y * scale) + 'px';
    p.el.textContent = p.label;
  }
}

// Persistence
const DB_NAME = 'verse-f725';
const KEY = 'phase-genome';
let db;
const bc = new BroadcastChannel('f725-genome');

function openDB() {
  return new Promise(res => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => { db = req.result; res(); };
    req.onerror = () => res();
  });
}
async function seal() {
  if (!db) return;
  const entropy = -density.reduce((s, d) => d > 0 ? s + d * Math.log(d + 1e-8) : s, 0);
  const genome = { potential: Array.from(potential), entropy, t: Date.now() };
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(genome, KEY);
  bc.postMessage(genome);
  document.getElementById('status').textContent = `Sealed (entropy ${entropy.toFixed(2)})`;
}
async function load() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const req = tx.objectStore('genomes').get(KEY);
  req.onsuccess = () => {
    if (req.result && req.result.potential) {
      potential.set(req.result.potential);
      document.getElementById('status').textContent = 'Loaded sealed genome';
    }
  };
}
bc.onmessage = e => {
  if (e.data && e.data.potential) {
    potential.set(e.data.potential);
    document.getElementById('status').textContent = 'Adopted remote genome';
  }
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => init(true);
document.getElementById('clear').onclick = () => potential.fill(0);

openDB().then(load);

function loop() {
  const maxD = step();
  const peaks = findPeaks();
  render(maxD);
  updatePortals(peaks);
  requestAnimationFrame(loop);
}
loop();
