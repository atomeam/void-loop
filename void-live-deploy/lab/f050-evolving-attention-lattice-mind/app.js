const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const portalsRoot = document.getElementById('portals');
let W, H, GRID = 32;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Lattice state
let attention = new Float32Array(GRID * GRID);
let features = new Float32Array(GRID * GRID * 2); // simple x/y bias features
let weights = new Float32Array(8); // evolved gains: qk scale, entropy bias, etc.
for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.4;

// Pointer & orientation
let pointer = { x: W/2, y: H/2, dwell: 0 };
let orient = { beta: 0, gamma: 0 };
let hasOrient = false;

// Worker for evolution
let worker = null;
let bestFitness = 0;
try {
  const workerCode = `
    let pop = [];
    const POP = 6, DIM = 8;
    function rand() { return Math.random() * 0.8 - 0.4; }
    for (let i = 0; i < POP; i++) {
      pop.push({ w: Array.from({length:DIM}, rand), fit: 0 });
    }
    self.onmessage = e => {
      const { obs } = e.data; // {dwell, entropy, peak}
      // evaluate
      pop.forEach(ind => {
        ind.fit = obs.dwell * 0.6 + (1 - obs.entropy) * 0.4 + Math.random() * 0.05;
      });
      pop.sort((a,b) => b.fit - a.fit);
      // mutate top
      const elite = pop[0].w.slice();
      for (let i = 1; i < POP; i++) {
        pop[i].w = elite.map((v,j) => v + (Math.random()-0.5)*0.12);
      }
      self.postMessage({ best: elite, fitness: pop[0].fit });
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    weights.set(e.data.best);
    bestFitness = e.data.fitness;
  };
} catch (e) {
  status.textContent = 'Worker blocked — using static weights.';
}

// Init features (positional)
function initFeatures() {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = (y * GRID + x) * 2;
      features[i] = (x / GRID - 0.5) * 2;
      features[i+1] = (y / GRID - 0.5) * 2;
    }
  }
}
initFeatures();

function computeAttention() {
  let max = 0, sum = 0, sumSq = 0;
  for (let i = 0; i < GRID * GRID; i++) {
    const fx = features[i*2], fy = features[i*2+1];
    // simple evolved attention: weighted combination + pointer proximity
    const px = pointer.x / W * 2 - 1, py = pointer.y / H * 2 - 1;
    let score = weights[0] * fx * px + weights[1] * fy * py + weights[2] * (fx*fx + fy*fy);
    score += weights[3] * Math.sin(fx * 3 + weights[4]) * Math.cos(fy * 3);
    // orientation bias
    if (hasOrient) score += weights[5] * orient.gamma * 0.01 + weights[6] * orient.beta * 0.01;
    score = Math.max(0, score + weights[7]);
    attention[i] = score;
    if (score > max) max = score;
    sum += score; sumSq += score * score;
  }
  // normalize roughly
  const mean = sum / (GRID*GRID);
  const variance = Math.max(0, sumSq / (GRID*GRID) - mean*mean);
  const entropy = Math.min(1, Math.sqrt(variance) / (max + 0.01));
  return { entropy, peak: Math.min(1, max / 2), mean };
}

function spawnPortal(gx, gy, score) {
  if (document.querySelectorAll('.portal.on').length >= 5) return;
  const p = document.createElement('div');
  p.className = 'portal';
  const px = (gx / GRID) * W, py = (gy / GRID) * H;
  p.style.left = (px - 32) + 'px';
  p.style.top = (py - 32) + 'px';
  p.textContent = score.toFixed(2);
  p.onclick = () => {
    // inject bias into nearby weights
    for (let k = 0; k < 3; k++) weights[k] += (Math.random()-0.5)*0.08;
    p.classList.remove('on');
    setTimeout(() => p.remove(), 300);
    status.textContent = 'Portal reinforced local attention bias.';
  };
  portalsRoot.appendChild(p);
  requestAnimationFrame(() => p.classList.add('on'));
  setTimeout(() => { if (p.parentNode) { p.classList.remove('on'); setTimeout(() => p.remove(), 400); } }, 8000);
}

function checkPortals(stats) {
  if (Math.random() > 0.04) return;
  for (let y = 2; y < GRID-2; y += 3) {
    for (let x = 2; x < GRID-2; x += 3) {
      const i = y * GRID + x;
      if (attention[i] > 0.45 && Math.random() < 0.15) {
        spawnPortal(x, y, attention[i]);
        return;
      }
    }
  }
}

function draw(stats) {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, W, H);
  const cellW = W / GRID, cellH = H / GRID;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const a = attention[y * GRID + x];
      if (a > 0.05) {
        ctx.fillStyle = `hsla(${200 + a * 80}, 70%, ${40 + a*30}%, ${Math.min(0.85, a)})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
      }
    }
  }
  // pointer glow
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 18, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(100,200,255,0.35)';
  ctx.fill();
}

let lastObs = 0;
function loop() {
  const stats = computeAttention();
  draw(stats);
  checkPortals(stats);
  // morph
  document.documentElement.style.setProperty('--entropy', stats.entropy.toFixed(3));
  document.documentElement.style.setProperty('--peak', stats.peak.toFixed(3));
  document.documentElement.style.setProperty('--hue', (180 + stats.peak * 120).toFixed(0));
  // send obs to worker occasionally
  if (worker && performance.now() - lastObs > 1800) {
    worker.postMessage({ obs: { dwell: pointer.dwell, entropy: stats.entropy, peak: stats.peak } });
    lastObs = performance.now();
    pointer.dwell *= 0.85; // decay
  }
  status.textContent = `Entropy ${stats.entropy.toFixed(2)} | Peak ${stats.peak.toFixed(2)} | Fitness ${bestFitness.toFixed(2)} | Portals ${document.querySelectorAll('.portal.on').length}`;
  requestAnimationFrame(loop);
}

// Interactions
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.dwell = Math.min(1, pointer.dwell + 0.03);
});
canvas.addEventListener('pointerdown', e => {
  pointer.dwell = 1;
  status.textContent = 'Attention seeded at pointer.';
});
document.getElementById('seed').onclick = () => { pointer.dwell = 1; };
document.getElementById('seal').onclick = async () => {
  const genome = { weights: Array.from(weights), fitness: bestFitness, ts: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f050', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'ts' });
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome);
    status.textContent = `Genome sealed ${new Date().toLocaleTimeString()}.`;
  } catch (err) {
    status.textContent = 'Seal failed.';
  }
};

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      orient.beta = e.beta || 0;
      orient.gamma = e.gamma || 0;
      hasOrient = true;
    }
  });
}

// Boot
loop();
status.textContent = 'Attention lattice live. Move pointer or tilt. Portals emerge from coherence.';
