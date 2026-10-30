const W = 120, H = 80;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
let u = new Float32Array(W * H);
let v = new Float32Array(W * H);
let du = new Float32Array(W * H);
let dv = new Float32Array(W * H);

function initField() {
  for (let i = 0; i < W * H; i++) {
    u[i] = 1.0;
    v[i] = 0.0;
  }
  // seed a few spots
  for (let k = 0; k < 8; k++) {
    const x = (Math.random() * (W - 10) + 5) | 0;
    const y = (Math.random() * (H - 10) + 5) | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx*dx + dy*dy < 10) {
        const i = (y + dy) * W + (x + dx);
        if (i >= 0 && i < W*H) v[i] = 0.8 + Math.random() * 0.2;
      }
    }
  }
}
initField();

let genes = { f: 0.035, k: 0.065, Du: 0.16, Dv: 0.08 };
let bestFitness = 0;
let energy = 0;
let userMotion = 0;
let lastX = 0, lastY = 0;
const portals = [];
const portalContainer = document.getElementById('portals');

function laplacian(field, x, y) {
  const i = y * W + x;
  const l = (x === 0 ? field[i + W - 1] : field[i - 1]);
  const r = (x === W-1 ? field[i - W + 1] : field[i + 1]);
  const u = (y === 0 ? field[i + (H-1)*W] : field[i - W]);
  const d = (y === H-1 ? field[i - (H-1)*W] : field[i + W]);
  return l + r + u + d - 4 * field[i];
}

function step() {
  const { f, k, Du, Dv } = genes;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const uu = u[i], vv = v[i];
      const lapU = laplacian(u, x, y);
      const lapV = laplacian(v, x, y);
      const uvv = uu * vv * vv;
      du[i] = Math.max(0, uu + Du * lapU - uvv + f * (1 - uu));
      dv[i] = Math.max(0, vv + Dv * lapV + uvv - (f + k) * vv);
    }
  }
  // swap
  const tmpU = u; u = du; du = tmpU;
  const tmpV = v; v = dv; dv = tmpV;
  // energy
  energy = 0;
  for (let i = 0; i < W*H; i++) energy += v[i];
  energy /= W * H;
}

function render() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let i = 0; i < W*H; i++) {
    const val = Math.min(1, v[i] * 2.5);
    const j = i * 4;
    data[j] = val * 80 + energy * 40;
    data[j+1] = val * 140 + 40;
    data[j+2] = val * 220 + 60;
    data[j+3] = 255;
  }
  // upscale
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

function updatePortals() {
  // spawn if high local v and few portals
  if (portals.length < 6 && Math.random() < 0.08) {
    let best = 0, bx = 0, by = 0;
    for (let n = 0; n < 20; n++) {
      const x = (Math.random() * W) | 0;
      const y = (Math.random() * H) | 0;
      const val = v[y*W + x];
      if (val > best) { best = val; bx = x; by = y; }
    }
    if (best > 0.4) {
      const el = document.createElement('div');
      el.className = 'portal';
      el.textContent = (best * 100 | 0);
      el.style.left = (bx / W * 100) + '%';
      el.style.top = (by / H * 100) + '%';
      portalContainer.appendChild(el);
      const p = { el, x: bx, y: by, vx: 0, vy: 0 };
      portals.push(p);
      makeDraggable(p);
    }
  }
  // update existing
  portals.forEach((p, idx) => {
    const i = Math.max(0, Math.min(W*H-1, (p.y|0)*W + (p.x|0)));
    const val = v[i] || 0;
    p.el.style.transform = `scale(${0.6 + val * 0.8})`;
    p.el.style.opacity = 0.4 + val * 0.6;
    if (val < 0.15 && Math.random() < 0.02) {
      p.el.remove();
      portals.splice(idx, 1);
    }
  });
}

function makeDraggable(p) {
  let dragging = false, ox = 0, oy = 0;
  p.el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - p.el.offsetLeft;
    oy = e.clientY - p.el.offsetTop;
    p.el.setPointerCapture(e.pointerId);
  });
  p.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const nx = e.clientX - ox;
    const ny = e.clientY - oy;
    p.el.style.left = nx + 'px';
    p.el.style.top = ny + 'px';
    p.x = (nx / canvas.clientWidth) * W;
    p.y = (ny / canvas.clientHeight) * H;
    // inject energy while dragging
    seedAt(p.x, p.y, 0.6);
  });
  p.el.addEventListener('pointerup', () => { dragging = false; });
  p.el.addEventListener('click', () => {
    bestFitness += 0.05;
    seedAt(p.x, p.y, 1.0);
  });
}

function seedAt(gx, gy, strength = 0.7) {
  const x = Math.max(0, Math.min(W-1, gx|0));
  const y = Math.max(0, Math.min(H-1, gy|0));
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (dx*dx + dy*dy < 18) {
      const i = (y+dy)*W + (x+dx);
      if (i >= 0 && i < W*H) v[i] = Math.min(1, v[i] + strength * (1 - (dx*dx+dy*dy)/20));
    }
  }
}

canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  const gx = ((e.clientX - rect.left) / rect.width) * W;
  const gy = ((e.clientY - rect.top) / rect.height) * H;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  userMotion = Math.min(1, Math.hypot(dx, dy) / 12);
  lastX = e.clientX; lastY = e.clientY;
  if (e.buttons) seedAt(gx, gy, 0.5 + userMotion * 0.4);
});

// Worker for evolutionary mind
const workerCode = `
let pop = [];
const POP = 5;
function randomGenes() {
  return { f: 0.02 + Math.random()*0.04, k: 0.04 + Math.random()*0.04, Du: 0.1 + Math.random()*0.1, Dv: 0.05 + Math.random()*0.06 };
}
for (let i = 0; i < POP; i++) pop.push({ genes: randomGenes(), fit: 0 });
self.onmessage = (e) => {
  const { energy, motion, current } = e.data;
  // fitness: prefer energy that tracks motion (resonance) + some diversity
  const resonance = 1 - Math.abs(energy - motion * 0.6);
  const fitness = resonance * 0.7 + energy * 0.3;
  // update current
  pop[0].genes = current;
  pop[0].fit = fitness;
  // mutate others occasionally
  if (Math.random() < 0.3) {
    for (let i = 1; i < POP; i++) {
      pop[i].genes.f += (Math.random()-0.5)*0.004;
      pop[i].genes.k += (Math.random()-0.5)*0.004;
      pop[i].genes.f = Math.max(0.01, Math.min(0.08, pop[i].genes.f));
      pop[i].genes.k = Math.max(0.03, Math.min(0.09, pop[i].genes.k));
      pop[i].fit = fitness * (0.6 + Math.random()*0.4);
    }
  }
  // pick best
  pop.sort((a,b) => b.fit - a.fit);
  self.postMessage({ genes: pop[0].genes, fitness: pop[0].fit });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  genes = e.data.genes;
  bestFitness = e.data.fitness;
  document.getElementById('status').textContent = `Mind: f=${genes.f.toFixed(3)} k=${genes.k.toFixed(3)} | Fit: ${bestFitness.toFixed(2)} | Energy: ${energy.toFixed(3)}`;
  document.documentElement.style.setProperty('--hue', (genes.f * 2000) % 360);
  document.documentElement.style.setProperty('--energy', energy);
  document.documentElement.style.setProperty('--scale', 0.8 + bestFitness * 0.6);
};

document.getElementById('seal').onclick = () => {
  const payload = { genes, fitness: bestFitness, energy, ts: Date.now() };
  localStorage.setItem('void-f044-genome', JSON.stringify(payload));
  document.getElementById('status').textContent = 'Sealed to localStorage ✓';
};
document.getElementById('reset').onclick = () => { initField(); portals.forEach(p => p.el.remove()); portals.length = 0; };

function loop() {
  for (let s = 0; s < 4; s++) step();
  render();
  updatePortals();
  if (Math.random() < 0.15) worker.postMessage({ energy, motion: userMotion, current: genes });
  requestAnimationFrame(loop);
}
loop();

// load sealed if present
try {
  const saved = localStorage.getItem('void-f044-genome');
  if (saved) {
    const p = JSON.parse(saved);
    genes = p.genes || genes;
    document.getElementById('status').textContent = 'Loaded sealed genome';
  }
} catch(e) {}
