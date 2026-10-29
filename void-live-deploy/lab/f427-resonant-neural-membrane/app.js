const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const hudEnt = document.getElementById('ent');
const hudRes = document.getElementById('res');
const hudGen = document.getElementById('gen');
const hudFit = document.getElementById('fit');
const orbsDiv = document.getElementById('orbs');
const sealBtn = document.getElementById('seal');

let W, H, gridW = 80, gridH = 45, cell;
let field = new Float32Array(gridW * gridH);
let next = new Float32Array(gridW * gridH);
let audioCtx, oscillators = [];
let pointer = { x: 0, y: 0, down: false };
let entropy = 0, resonance = 0, generation = 0, bestFitness = 0;

// Simple evolutionary mind in main thread for demo (Worker version noted)
const POP = 12;
let genomes = Array.from({length: POP}, () => ({
  diff: 0.12 + Math.random() * 0.08,
  react: 0.4 + Math.random() * 0.4,
  damp: 0.96 + Math.random() * 0.03,
  fitness: 0
}));

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  cell = Math.min(W / gridW, H / gridH);
}
window.addEventListener('resize', resize);
resize();

// Audio setup (user gesture required)
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Create a few oscillators for modal resonance
  for (let i = 0; i < 4; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 110 * (i + 1);
    g.gain.value = 0;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    oscillators.push({ osc: o, gain: g });
  }
}

function updateField(dt) {
  const best = genomes.reduce((a, b) => a.fitness > b.fitness ? a : b);
  const diff = best.diff, react = best.react, damp = best.damp;
  let sum = 0, sumSq = 0;

  for (let y = 1; y < gridH - 1; y++) {
    for (let x = 1; x < gridW - 1; x++) {
      const i = y * gridW + x;
      const lap = field[i-1] + field[i+1] + field[i-gridW] + field[i+gridW] - 4 * field[i];
      // Membrane + reaction
      let v = field[i] * damp + lap * diff + Math.tanh(field[i] * react) * 0.02;
      // Pointer pluck
      const px = Math.floor(pointer.x / cell);
      const py = Math.floor(pointer.y / cell);
      if (pointer.down && Math.abs(x - px) < 2 && Math.abs(y - py) < 2) {
        v += 0.8;
      }
      next[i] = Math.max(-1, Math.min(1, v));
      sum += next[i];
      sumSq += next[i] * next[i];
    }
  }
  [field, next] = [next, field];

  const mean = sum / (gridW * gridH);
  entropy = Math.sqrt(sumSq / (gridW * gridH) - mean * mean);
  resonance = Math.abs(mean) * 0.5 + entropy;

  // Evolve occasionally
  if (Math.random() < 0.01) evolve();
}

function evolve() {
  genomes.forEach(g => {
    // Fitness: entropy + sustained resonance (proxy)
    g.fitness = entropy * 0.6 + resonance * 0.4 + Math.random() * 0.05;
  });
  genomes.sort((a, b) => b.fitness - a.fitness);
  bestFitness = genomes[0].fitness;
  // Breed top half
  for (let i = POP / 2; i < POP; i++) {
    const a = genomes[Math.floor(Math.random() * POP / 2)];
    const b = genomes[Math.floor(Math.random() * POP / 2)];
    genomes[i] = {
      diff: (a.diff + b.diff) / 2 + (Math.random() - 0.5) * 0.02,
      react: (a.react + b.react) / 2 + (Math.random() - 0.5) * 0.05,
      damp: Math.max(0.9, Math.min(0.99, (a.damp + b.damp) / 2 + (Math.random() - 0.5) * 0.01)),
      fitness: 0
    };
  }
  generation++;
}

function draw() {
  ctx.fillStyle = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--hue')}, 30%, 6%)`;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const v = field[y * gridW + x];
      const hue = 180 + v * 60 + entropy * 40;
      const light = 30 + Math.abs(v) * 40;
      ctx.fillStyle = `hsl(${hue}, 70%, ${light}%)`;
      ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
}

function updateAudio() {
  if (!audioCtx) return;
  oscillators.forEach((o, i) => {
    const target = resonance * 0.15 * (0.5 + 0.5 * Math.sin(performance.now() * 0.001 + i));
    o.gain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.1);
    o.osc.frequency.setTargetAtTime(80 + i * 40 + entropy * 120, audioCtx.currentTime, 0.2);
  });
}

function updateChrome() {
  document.documentElement.style.setProperty('--entropy', entropy.toFixed(3));
  document.documentElement.style.setProperty('--hue', (180 + entropy * 80).toFixed(0));
  document.documentElement.style.setProperty('--pulse', (resonance * 0.5).toFixed(3));
  hudEnt.textContent = entropy.toFixed(2);
  hudRes.textContent = resonance.toFixed(2);
  hudGen.textContent = generation;
  hudFit.textContent = bestFitness.toFixed(2);
}

// Orbs: interactive frequency injectors
function createOrbs() {
  for (let i = 0; i < 5; i++) {
    const orb = document.createElement('div');
    orb.className = 'orb';
    orb.style.left = (20 + i * 15) + '%';
    orb.style.top = (30 + (i % 2) * 20) + '%';
    orb.dataset.freq = 100 + i * 50;
    makeDraggable(orb);
    orbsDiv.appendChild(orb);
  }
}
function makeDraggable(el) {
  let dragging = false;
  el.addEventListener('pointerdown', e => { dragging = true; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = e.clientX + 'px';
    el.style.top = e.clientY + 'px';
    // Inject into field near orb
    const gx = Math.floor(e.clientX / cell);
    const gy = Math.floor(e.clientY / cell);
    if (gx > 1 && gx < gridW-1 && gy > 1 && gy < gridH-1) {
      field[gy * gridW + gx] += 0.3;
    }
  });
  el.addEventListener('pointerup', () => dragging = false);
}

canvas.addEventListener('pointerdown', e => { pointer.down = true; initAudio(); });
canvas.addEventListener('pointerup', () => pointer.down = false);
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

sealBtn.addEventListener('click', async () => {
  const db = await idbOpen();
  const tx = db.transaction('genomes', 'readwrite');
  await tx.objectStore('genomes').put({ id: 'best', genome: genomes[0], gen: generation, ts: Date.now() });
  sealBtn.textContent = 'Sealed';
  setTimeout(() => sealBtn.textContent = 'Seal to IndexedDB', 1200);
});

function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('f232', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes', { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

createOrbs();
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  updateField(dt);
  draw();
  updateAudio();
  updateChrome();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Initial noise
for (let i = 0; i < field.length; i++) field[i] = (Math.random() - 0.5) * 0.2;
