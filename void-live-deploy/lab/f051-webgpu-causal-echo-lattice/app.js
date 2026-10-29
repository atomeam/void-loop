const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0, GRID = 64, CELL = 0;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  CELL = Math.max(4, Math.floor(Math.min(W, H) / GRID));
}
resize();
addEventListener('resize', resize);

// Lattice: phase and amplitude (simple wave-like)
const phase = new Float32Array(GRID * GRID);
const amp = new Float32Array(GRID * GRID);
const nextAmp = new Float32Array(GRID * GRID);

function idx(x, y) { return ((y + GRID) % GRID) * GRID + ((x + GRID) % GRID); }

// Pointer
const hist = [];
const MAXH = 12;
let px = W/2, py = H/2;
let lastEnergy = 0;

// Anchors
const anchors = [];
function makeAnchor(x, y, i) {
  const el = document.createElement('div');
  el.className = 'anchor';
  el.textContent = 'echo' + i;
  el.style.setProperty('--ah', 40 + i * 50);
  document.body.appendChild(el);
  const a = { el, x, y, id: i, strength: 0.8 };
  anchors.push(a);
  el.addEventListener('pointerdown', e => {
    e.target.setPointerCapture(e.pointerId);
    const move = ev => { a.x = ev.clientX; a.y = ev.clientY; };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  return a;
}

// Seed a couple
makeAnchor(W * 0.3, H * 0.4, 0);
makeAnchor(W * 0.7, H * 0.6, 1);

// Worker: evolutionary residual predictor
const workerCode = `
let pop = [];
const P = 8;
const G = 5; // speedBias, dampScale, residualGain, anchorWeight, coherenceBoost
function rand() { return Math.random() * 1.6 - 0.8; }
for (let i = 0; i < P; i++) pop.push({ genes: Array.from({length: G}, rand), fit: 0 });
self.onmessage = e => {
  const { residual, coherence, energyNear } = e.data;
  for (const ind of pop) {
    const predEnergy = energyNear * ind.genes[2] + ind.genes[0] * 0.1;
    const err = Math.abs(predEnergy - energyNear);
    ind.fit = (1 - Math.min(1, residual)) * 0.5 + coherence * 0.35 + (1 - Math.min(1, err)) * 0.15 + Math.random()*0.01;
  }
  pop.sort((a,b) => b.fit - a.fit);
  const best = pop[0];
  const child = { genes: best.genes.map(g => g + (Math.random()-0.5)*0.2), fit: 0 };
  pop[P-1] = child;
  self.postMessage({ best: best.genes, gen: Date.now() % 100000 });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
let worker = null;
let bestGenes = [0.2, 0.6, 0.4, 0.5, 0.3];
let gen = 0;
try {
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    bestGenes = e.data.best;
    gen = e.data.gen;
    document.getElementById('gen').textContent = Math.floor(gen / 100);
  };
} catch (e) { console.warn('Worker blocked', e); }

document.getElementById('mode').textContent = worker ? 'Worker' : 'static';

// Interaction
addEventListener('pointermove', e => {
  px = e.clientX; py = e.clientY;
  hist.push({ x: px, y: py, t: performance.now() });
  if (hist.length > MAXH) hist.shift();
});

addEventListener('click', e => {
  if (e.target.closest('.anchor') || e.target.id === 'seal') return;
  makeAnchor(e.clientX, e.clientY, anchors.length);
});

function sampleEnergyNear(gx, gy, r = 3) {
  let s = 0, c = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    s += amp[idx(gx + dx, gy + dy)];
    c++;
  }
  return s / c;
}

function computeResidual() {
  if (hist.length < 4) return 0.45;
  const gx = Math.floor(px / CELL) % GRID;
  const gy = Math.floor(py / CELL) % GRID;
  const observed = sampleEnergyNear(gx, gy);
  const prev = hist[hist.length - 2];
  const pgx = Math.floor(prev.x / CELL) % GRID;
  const pgy = Math.floor(prev.y / CELL) % GRID;
  const prevE = sampleEnergyNear(pgx, pgy);
  const predicted = prevE * bestGenes[2] + bestGenes[0] * 0.05;
  return Math.min(1, Math.abs(observed - predicted) * 2.5);
}

let frame = 0;
function stepLattice() {
  const residual = computeResidual();
  const conf = 1 - residual;
  const speed = 0.18 + bestGenes[0] * 0.08 * conf;
  const damp = 0.92 - residual * 0.08 * bestGenes[1];

  // Inject from pointer
  const pgx = Math.floor(px / CELL) % GRID;
  const pgy = Math.floor(py / CELL) % GRID;
  amp[idx(pgx, pgy)] = Math.min(1.2, amp[idx(pgx, pgy)] + 0.35);

  // Inject from anchors
  for (const a of anchors) {
    const agx = Math.floor(a.x / CELL) % GRID;
    const agy = Math.floor(a.y / CELL) % GRID;
    amp[idx(agx, agy)] = Math.min(1.4, amp[idx(agx, agy)] + 0.22 * a.strength * bestGenes[3]);
  }

  // Wave-like update
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = idx(x, y);
      const n = amp[idx(x+1,y)] + amp[idx(x-1,y)] + amp[idx(x,y+1)] + amp[idx(x,y-1)];
      const laplacian = n / 4 - amp[i];
      nextAmp[i] = amp[i] * damp + laplacian * speed + phase[i] * 0.02;
      phase[i] += 0.05 + residual * 0.03;
      if (nextAmp[i] < 0) nextAmp[i] = 0;
      if (nextAmp[i] > 1.5) nextAmp[i] = 1.5;
    }
  }
  amp.set(nextAmp);

  return { residual, conf };
}

function tick() {
  frame++;
  const { residual, conf } = stepLattice();
  document.getElementById('res').textContent = residual.toFixed(2);
  document.getElementById('conf').textContent = conf.toFixed(2);

  // Morph
  const hue = 200 + residual * 120;
  document.documentElement.style.setProperty('--hue', hue);
  document.documentElement.style.setProperty('--glow', conf * 0.8);
  document.body.style.filter = conf > 0.6 ? `hue-rotate(${residual * 20}deg)` : '';

  // Draw lattice
  ctx.fillStyle = `hsl(${hue}, 35%, 5%)`;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const a = amp[idx(x, y)];
      if (a < 0.02) continue;
      const h = (hue + a * 80 + phase[idx(x,y)] * 20) % 360;
      ctx.fillStyle = `hsla(${h}, 70%, ${40 + a * 40}%, ${0.4 + a * 0.5})`;
      ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
    }
  }

  // Position anchors
  for (const a of anchors) {
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
  }

  // Evolve
  if (frame % 40 === 0 && worker) {
    const gx = Math.floor(px / CELL) % GRID;
    const gy = Math.floor(py / CELL) % GRID;
    const energyNear = sampleEnergyNear(gx, gy);
    let coherence = 0;
    for (let i = 0; i < 40; i++) coherence += amp[Math.floor(Math.random() * amp.length)];
    coherence = Math.min(1, coherence / 40 * 2);
    worker.postMessage({ residual, coherence, energyNear });
  }

  requestAnimationFrame(tick);
}
tick();

// Seal
document.getElementById('seal').addEventListener('click', () => {
  try {
    const data = {
      genes: bestGenes,
      anchors: anchors.map(a => ({ x: a.x / W, y: a.y / H, id: a.id }))
    };
    localStorage.setItem('f051-causal-echo', JSON.stringify(data));
    alert('Sealed genome + anchors');
  } catch (e) { alert('Seal failed: ' + e.message); }
});

// Load
try {
  const saved = localStorage.getItem('f051-causal-echo');
  if (saved) {
    const data = JSON.parse(saved);
    if (data.genes) bestGenes = data.genes;
    if (data.anchors) {
      anchors.forEach(a => a.el.remove());
      anchors.length = 0;
      data.anchors.forEach((sa, i) => makeAnchor(sa.x * W, sa.y * H, i));
    }
  }
} catch (e) {}
