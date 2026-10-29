const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Coarse lattice of oscillators (spectral field)
const COLS = 48, ROWS = 32;
const cells = [];
for (let y = 0; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    cells.push({
      phase: Math.random() * Math.PI * 2,
      freq: 0.8 + Math.random() * 0.6,
      amp: 0.2 + Math.random() * 0.3,
      x: (x + 0.5) * (W / COLS),
      y: (y + 0.5) * (H / ROWS)
    });
  }
}
function idx(x, y) { return y * COLS + x; }

// Pointer history
const hist = [];
const MAXH = 12;
let px = W/2, py = H/2;

// Resonator orbs
const orbs = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = 'res' + i;
  el.style.setProperty('--oh', 40 + i * 55);
  document.body.appendChild(el);
  orbs.push({ el, x: 100 + i * 140, y: 90 + (i%2)*40, baseFreq: 110 + i * 55, id: i });
  el.addEventListener('pointerdown', e => {
    e.target.setPointerCapture(e.pointerId);
    const o = orbs[i];
    const move = ev => { o.x = ev.clientX; o.y = ev.clientY; };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
}

// Worker: evolutionary mind for coupling / prediction genes
const workerCode = `
let pop = [];
const P = 8;
const G = 5; // coupling, damping, predWeight, ampGain, orbPull
function rand() { return Math.random() * 1.6 - 0.3; }
for (let i = 0; i < P; i++) pop.push({ genes: Array.from({length: G}, () => Math.random()*1.2), fit: 0 });
self.onmessage = e => {
  const { residual, coherence, peak } = e.data;
  for (const ind of pop) {
    // Fitness: low residual, high coherence, stable peak
    ind.fit = (1 - residual) * 0.55 + coherence * 0.35 + (1 - Math.min(1, Math.abs(peak - 0.5))) * 0.1 + Math.random()*0.01;
  }
  pop.sort((a,b) => b.fit - a.fit);
  const best = pop[0];
  const child = { genes: best.genes.map(g => Math.max(0, Math.min(2, g + (Math.random()-0.5)*0.2))), fit: 0 };
  pop[P-1] = child;
  self.postMessage({ best: best.genes, gen: Date.now() % 10000 });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
let bestGenes = [0.4, 0.15, 0.6, 0.3, 0.25];
let gen = 0;
worker.onmessage = e => {
  bestGenes = e.data.best;
  gen = e.data.gen;
  document.getElementById('gen').textContent = Math.floor(gen / 100);
};

// Audio context (gesture-gated)
let audioCtx = null;
let oscs = [];
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.04;
    osc.connect(gain).connect(audioCtx.destination);
    osc.type = i === 0 ? 'sine' : i === 1 ? 'triangle' : 'sawtooth';
    osc.frequency.value = 220 + i * 80;
    osc.start();
    oscs.push({ osc, gain });
  }
}
addEventListener('pointerdown', initAudio, { once: true });

// Interaction
addEventListener('pointermove', e => {
  px = e.clientX; py = e.clientY;
  hist.push({ x: px, y: py, t: performance.now() });
  if (hist.length > MAXH) hist.shift();
});

function computeResidual() {
  if (hist.length < 4) return 0.45;
  const last = hist[hist.length-1];
  const prev = hist[hist.length-2];
  const actual = Math.hypot(last.x - prev.x, last.y - prev.y);
  const older = hist[hist.length-4];
  const pred = Math.hypot(prev.x - older.x, prev.y - older.y) * bestGenes[2];
  return Math.min(1, Math.abs(actual - pred) / 18);
}

let frame = 0;
let peakHz = 220;
function tick() {
  frame++;
  const residual = computeResidual();
  const coupling = bestGenes[0];
  const damping = bestGenes[1];
  const ampGain = bestGenes[3];

  // Update lattice: couple neighbors, inject from pointer and orbs
  let totalAmp = 0, freqSum = 0;
  for (let y = 1; y < ROWS-1; y++) {
    for (let x = 1; x < COLS-1; x++) {
      const i = idx(x, y);
      const c = cells[i];
      let neigh = 0;
      neigh += cells[idx(x-1,y)].phase + cells[idx(x+1,y)].phase;
      neigh += cells[idx(x,y-1)].phase + cells[idx(x,y+1)].phase;
      neigh *= coupling * 0.25;
      c.phase += c.freq * 0.08 + neigh * 0.05;
      c.phase %= Math.PI * 2;
      // Damping + residual excitation
      c.amp = c.amp * (1 - damping * 0.02) + residual * ampGain * 0.01;
      c.amp = Math.max(0.05, Math.min(1.2, c.amp));
      totalAmp += c.amp;
      freqSum += c.freq * c.amp;
    }
  }
  const coherence = Math.min(1, totalAmp / (COLS * ROWS) * 1.4);
  peakHz = 180 + (freqSum / Math.max(0.1, totalAmp)) * 180;

  // Inject energy near pointer
  const gx = Math.floor((px / W) * COLS);
  const gy = Math.floor((py / H) * ROWS);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = gx + dx, ny = gy + dy;
      if (nx > 0 && nx < COLS-1 && ny > 0 && ny < ROWS-1) {
        cells[idx(nx,ny)].amp += 0.08 * (1 - residual);
      }
    }
  }
  // Orbs inject frequency bias
  for (const o of orbs) {
    const ox = Math.floor((o.x / W) * COLS);
    const oy = Math.floor((o.y / H) * ROWS);
    if (ox > 1 && ox < COLS-2 && oy > 1 && oy < ROWS-2) {
      const c = cells[idx(ox, oy)];
      c.freq = 0.7 + (o.baseFreq / 400) * 0.8;
      c.amp += 0.04 * bestGenes[4];
    }
  }

  document.getElementById('res').textContent = residual.toFixed(2);
  document.getElementById('coh').textContent = coherence.toFixed(2);
  document.getElementById('hz').textContent = Math.round(peakHz);

  // Morph chrome
  const hue = 220 + residual * 100 + coherence * 40;
  document.documentElement.style.setProperty('--hue', hue);
  document.documentElement.style.setProperty('--blur', residual * 2);
  document.documentElement.style.setProperty('--glow', coherence);

  // Draw lattice as colored cells
  ctx.fillStyle = `hsl(${hue}, 35%, 5%)`;
  ctx.fillRect(0, 0, W, H);
  const cw = W / COLS, ch = H / ROWS;
  for (const c of cells) {
    const a = Math.min(1, c.amp * 0.9);
    ctx.fillStyle = `hsla(${(c.phase * 57.3 + hue) % 360}, 65%, ${40 + a*30}%, ${0.4 + a*0.5})`;
    ctx.fillRect(c.x - cw/2, c.y - ch/2, cw - 1, ch - 1);
  }

  // Position orbs
  for (const o of orbs) {
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
  }

  // Drive audio from peak
  if (audioCtx && oscs.length) {
    oscs[0].osc.frequency.setTargetAtTime(peakHz, audioCtx.currentTime, 0.08);
    oscs[1].osc.frequency.setTargetAtTime(peakHz * 1.5, audioCtx.currentTime, 0.1);
    oscs[2].osc.frequency.setTargetAtTime(peakHz * 0.5, audioCtx.currentTime, 0.12);
    const g = 0.02 + coherence * 0.06;
    oscs.forEach(o => o.gain.gain.setTargetAtTime(g, audioCtx.currentTime, 0.05));
  }

  // Evolve
  if (frame % 40 === 0) {
    worker.postMessage({ residual, coherence, peak: peakHz / 600 });
  }

  requestAnimationFrame(tick);
}
tick();

// Seal
document.getElementById('seal').addEventListener('click', () => {
  try {
    localStorage.setItem('f050-best-genes', JSON.stringify(bestGenes));
    alert('Sealed best genes to localStorage');
  } catch (e) { alert('Seal failed: ' + e.message); }
});
try {
  const saved = localStorage.getItem('f050-best-genes');
  if (saved) bestGenes = JSON.parse(saved);
} catch (e) {}
