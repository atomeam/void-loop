const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 64, H = 40;
let field = new Float32Array(W * H);
let next = new Float32Array(W * H);
let energy = 0;
let morph = 0;
let genes = [0.5, 0.3, 0.4, 0.2, 0.6, 1.0]; // attention-related params
let fitness = 0;
let pointer = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
let history = [];
let audioCtx, oscs = [], gains = [];

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Init field with noise
for (let i = 0; i < field.length; i++) field[i] = Math.random() * 0.2;

// Simple Worker for evolutionary mind
const workerCode = `
let pop = [];
const POP = 6;
const GENE_LEN = 6;
function randGenes() { return Array.from({length: GENE_LEN}, () => Math.random()); }
function init() {
  pop = Array.from({length: POP}, () => ({ g: randGenes(), f: 0 }));
}
function mutate(g) {
  return g.map(v => Math.max(0, Math.min(1.5, v + (Math.random()-0.5)*0.15)));
}
function step(energySamples, residual) {
  // fitness proxy: diversity + low residual
  const diversity = energySamples.reduce((a,b)=>a+b,0)/energySamples.length || 0.1;
  pop.forEach(p => {
    p.f = diversity * (1 + p.g[0]) - residual * p.g[2] + Math.random()*0.05;
  });
  pop.sort((a,b) => b.f - a.f);
  const champ = pop[0];
  // mutate rest
  for (let i = 1; i < POP; i++) {
    if (Math.random() < 0.7) pop[i].g = mutate(champ.g);
  }
  return { genes: champ.g, fitness: champ.f };
}
init();
self.onmessage = e => {
  if (e.data.type === 'step') {
    const res = step(e.data.samples, e.data.residual);
    self.postMessage(res);
  }
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

worker.onmessage = e => {
  genes = e.data.genes;
  fitness = e.data.fitness;
  document.getElementById('fitness').textContent = 'Fitness: ' + fitness.toFixed(3);
};

function sampleEnergy() {
  const samples = [];
  for (let y = 0; y < H; y += 8) {
    for (let x = 0; x < W; x += 8) {
      samples.push(field[y*W + x]);
    }
  }
  return samples;
}

function stepField() {
  const diff = 0.1 + genes[0] * 0.15;
  const react = 0.05 + genes[1] * 0.1;
  const attnBias = genes[2];
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      const i = y*W + x;
      const lap = field[i-1] + field[i+1] + field[i-W] + field[i+W] - 4*field[i];
      let v = field[i] + diff * lap + react * field[i] * (1 - field[i]);
      // attention modulation from pointer proximity
      const dx = x/W - pointer.x, dy = y/H - pointer.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      v += attnBias * Math.exp(-dist*8) * 0.05;
      next[i] = Math.max(0, Math.min(1, v));
    }
  }
  // seed pointer
  const px = Math.floor(pointer.x * W), py = Math.floor(pointer.y * H);
  if (px >= 0 && px < W && py >= 0 && py < H) next[py*W + px] = Math.min(1, next[py*W + px] + 0.3);
  [field, next] = [next, field];
  // energy
  energy = 0;
  for (let i = 0; i < field.length; i++) energy += field[i];
  energy /= field.length;
}

function render() {
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    const idx = i*4;
    img.data[idx] = v * 80 + 20;
    img.data[idx+1] = v * 160 + genes[3]*40;
    img.data[idx+2] = v * 255;
    img.data[idx+3] = 255;
  }
  // upscale
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

function updateMorph() {
  morph = energy * 2 + genes[4];
  document.body.style.filter = `hue-rotate(${morph * 120}deg) contrast(${1 + energy})`;
  document.body.style.transform = `scale(${1 + energy * 0.02})`;
  const card = document.getElementById('card');
  card.style.transform = `scale(${1 + morph * 0.3}) rotate(${(genes[5]-0.5)*20}deg)`;
  card.style.filter = `brightness(${1 + energy})`;
  document.getElementById('energy').textContent = 'Energy: ' + energy.toFixed(3);
}

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 110 * (i+1);
    gain.gain.value = 0.02;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    oscs.push(osc);
    gains.push(gain);
  }
}
function updateAudio() {
  if (!audioCtx) return;
  const bands = [energy * 0.3, energy * 0.5, energy * 0.2];
  oscs.forEach((osc, i) => {
    osc.frequency.setTargetAtTime(80 + bands[i] * 400 + genes[i] * 50, audioCtx.currentTime, 0.1);
    gains[i].gain.setTargetAtTime(0.01 + bands[i] * 0.05, audioCtx.currentTime, 0.1);
  });
}

let lastMind = 0;
function loop(t) {
  stepField();
  render();
  updateMorph();
  updateAudio();
  if (t - lastMind > 800) {
    const samples = sampleEnergy();
    const residual = Math.hypot(pointer.vx, pointer.vy);
    worker.postMessage({ type: 'step', samples, residual });
    lastMind = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Input
canvas.addEventListener('pointermove', e => {
  const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight;
  pointer.vx = nx - pointer.x;
  pointer.vy = ny - pointer.y;
  pointer.x = nx;
  pointer.y = ny;
  history.push({ x: nx, y: ny });
  if (history.length > 20) history.shift();
});
canvas.addEventListener('pointerdown', () => {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  document.getElementById('status').textContent = 'Running — move pointer, tilt if available';
});

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      pointer.x = 0.5 + (e.gamma || 0) / 90 * 0.4;
      pointer.y = 0.5 + (e.beta || 0) / 90 * 0.4;
    }
  });
}

// Seal / Load with IndexedDB
const DB_NAME = 'void-f312';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  const data = { genes, fitness, energy, t: Date.now() };
  const str = JSON.stringify(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const db = await openDB();
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ ...data, hash }, 'latest');
  document.getElementById('hash').textContent = 'Sealed: ' + hash;
}
async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('latest');
    req.onsuccess = () => {
      if (req.result) {
        genes = req.result.genes;
        fitness = req.result.fitness || 0;
        document.getElementById('hash').textContent = 'Loaded: ' + (req.result.hash || 'ok');
        document.getElementById('fitness').textContent = 'Fitness: ' + fitness.toFixed(3);
      }
    };
  } catch (e) { console.warn(e); }
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;

document.getElementById('status').textContent = 'Click canvas to start audio. Move to seed waves.';
