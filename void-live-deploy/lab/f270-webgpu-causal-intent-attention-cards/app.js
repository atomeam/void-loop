const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const scene = document.getElementById('scene');
const statusEl = document.getElementById('status');
let W = innerWidth, H = innerHeight;
canvas.width = W; canvas.height = H;

const GW = 64, GH = 40;
let field = new Float32Array(GW * GH);
let vx = new Float32Array(GW * GH);
let vy = new Float32Array(GW * GH);

function resize() {
  W = innerWidth; H = innerHeight;
  canvas.width = W; canvas.height = H;
}
addEventListener('resize', resize);

// Cards
const N_CARDS = 7;
const cards = [];
for (let i = 0; i < N_CARDS; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<strong>slot ${i}</strong><br>intent residual<br>attn —`;
  scene.appendChild(el);
  cards.push({ el, x: 0, y: 0, z: 0, s: 1, h: 0 });
}

// Worker: evolutionary attention
const workerCode = `
let pop = [];
const POP = 6, DIM = 12;
function randG() {
  return Array.from({length: DIM}, () => (Math.random()-0.5)*2);
}
for (let i = 0; i < POP; i++) pop.push({ g: randG(), fit: 0 });
function attn(g, hist) {
  // tiny multi-head-ish: project hist, softmax-ish weights
  const Q = g.slice(0, 4), K = g.slice(4, 8), V = g.slice(8, 12);
  let scores = [];
  for (let i = 0; i < hist.length; i++) {
    let s = 0;
    for (let j = 0; j < 4; j++) s += Q[j] * (hist[i][j % hist[i].length] || 0) * K[j];
    scores.push(s);
  }
  const m = Math.max(...scores, 0.01);
  let sum = 0;
  const w = scores.map(s => { const e = Math.exp(s - m); sum += e; return e; });
  for (let i = 0; i < w.length; i++) w[i] /= sum || 1;
  let residual = [0,0];
  for (let i = 0; i < w.length; i++) {
    residual[0] += w[i] * (hist[i][0] || 0) * V[0];
    residual[1] += w[i] * (hist[i][1] || 0) * V[1];
  }
  return { w, residual };
}
onmessage = e => {
  const { hist, entropy, lastDir } = e.data;
  // evaluate
  for (const p of pop) {
    const { residual } = attn(p.g, hist);
    const predErr = Math.hypot(residual[0] - lastDir[0], residual[1] - lastDir[1]);
    p.fit = entropy * 0.4 - predErr * 1.2 + 0.2;
  }
  pop.sort((a,b) => b.fit - a.fit);
  // mutate top
  const best = pop[0].g.slice();
  for (let i = 2; i < POP; i++) {
    pop[i].g = best.map(v => v + (Math.random()-0.5)*0.3);
  }
  const { w, residual } = attn(pop[0].g, hist);
  postMessage({ best: pop[0].g, weights: w, residual, fit: pop[0].fit, gen: Date.now() });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
let bestG = null, bestW = Array(N_CARDS).fill(1/N_CARDS), residual = [0,0], fit = 0;

worker.onmessage = e => {
  const d = e.data;
  bestG = d.best;
  bestW = d.weights.slice(0, N_CARDS);
  while (bestW.length < N_CARDS) bestW.push(0);
  residual = d.residual;
  fit = d.fit;
  statusEl.textContent = `fit ${fit.toFixed(2)} · residual ${residual.map(v=>v.toFixed(2)).join(',')} · sealed genomes: ${localStorage.getItem('f270-seals')||0}`;
};

// History buffer
const hist = [];
let lastPos = {x:0.5,y:0.5}, lastDir = [0,0];

function inject(nx, ny, str) {
  const x = Math.floor(nx * GW), y = Math.floor(ny * GH);
  if (x<0||x>=GW||y<0||y>=GH) return;
  const i = y*GW + x;
  field[i] = Math.min(1, field[i] + str);
  vx[i] += (nx - lastPos.x) * 0.4;
  vy[i] += (ny - lastPos.y) * 0.4;
  lastDir = [nx - lastPos.x, ny - lastPos.y];
  lastPos = {x: nx, y: ny};
  hist.push([nx, ny, field[i], Math.hypot(...lastDir)]);
  if (hist.length > 16) hist.shift();
}

addEventListener('pointermove', e => {
  inject(e.clientX / W, e.clientY / H, 0.15);
});
addEventListener('pointerdown', e => {
  inject(e.clientX / W, e.clientY / H, 0.4);
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});

let beta = 0, gamma = 0;
addEventListener('deviceorientation', e => {
  beta = (e.beta || 0) / 90;
  gamma = (e.gamma || 0) / 90;
  inject(0.5 + gamma*0.3, 0.5 + beta*0.3, 0.05);
});

// Lattice step
function step() {
  const next = new Float32Array(field.length);
  for (let y = 1; y < GH-1; y++) for (let x = 1; x < GW-1; x++) {
    const i = y*GW + x;
    let s = field[i]*0.6;
    s += field[i-1]*0.08 + field[i+1]*0.08 + field[i-GW]*0.08 + field[i+GW]*0.08;
    s += (vx[i]*0.02 + vy[i]*0.02);
    next[i] = Math.max(0, Math.min(1, s * 0.97));
  }
  field = next;
  // damp velocity
  for (let i = 0; i < vx.length; i++) { vx[i] *= 0.92; vy[i] *= 0.92; }
}

// Audio
let audioCtx, osc, gain;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 180;
  gain.gain.value = 0.02;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
}

// IndexedDB seal
function seal() {
  if (!bestG) return;
  const id = 'f270-' + Date.now();
  try {
    const req = indexedDB.open('void-f270', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put({ id, g: bestG, fit, ts: Date.now() });
      const n = parseInt(localStorage.getItem('f270-seals')||'0') + 1;
      localStorage.setItem('f270-seals', n);
      statusEl.textContent = `sealed ${id.slice(-6)} · total ${n}`;
    };
  } catch(e) { statusEl.textContent = 'seal failed (memory only)'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('xr').onclick = () => {
  if (navigator.xr) navigator.xr.requestSession('immersive-vr').then(s => statusEl.textContent = 'XR session open (stub)').catch(() => statusEl.textContent = 'XR unsupported');
  else statusEl.textContent = 'no WebXR';
};

let lastWorker = 0;
function loop(t) {
  step();
  // draw lattice
  const img = ctx.createImageData(GW, GH);
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    const idx = i*4;
    img.data[idx] = 20 + v*80;
    img.data[idx+1] = 30 + v*120;
    img.data[idx+2] = 60 + v*180;
    img.data[idx+3] = 180 + v*75;
  }
  ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0, GW, GH, 0, 0, W, H);

  // cards from attention
  const cx = W/2, cy = H/2;
  for (let i = 0; i < N_CARDS; i++) {
    const w = bestW[i] || 0;
    const ang = (i / N_CARDS) * Math.PI * 2 + t*0.0002;
    const r = 180 + w * 220;
    cards[i].x = cx + Math.cos(ang) * r;
    cards[i].y = cy + Math.sin(ang) * r * 0.6;
    cards[i].z = (w - 0.14) * 280;
    cards[i].s = 0.7 + w * 1.4;
    cards[i].h = (w * 180 + fit * 40) % 360;
    cards[i].el.style.transform = `translate3d(${cards[i].x - 70}px, ${cards[i].y - 45}px, ${cards[i].z}px) scale(${cards[i].s})`;
    cards[i].el.style.filter = `hue-rotate(${cards[i].h}deg)`;
    cards[i].el.innerHTML = `<strong>slot ${i}</strong><br>w ${(w*100).toFixed(0)}%<br>res ${residual[0].toFixed(2)}`;
  }

  // chrome
  document.documentElement.style.setProperty('--hue', 200 + residual[0]*80 + fit*30);
  document.documentElement.style.setProperty('--blur', Math.abs(residual[1])*4 + 'px');
  document.documentElement.style.setProperty('--contrast', 0.9 + fit*0.3);
  document.documentElement.style.setProperty('--energy', Math.min(1, field.reduce((a,b)=>a+b,0)/field.length * 4));

  if (audioCtx && osc) {
    osc.frequency.value = 160 + fit*80 + Math.abs(residual[0])*40;
    gain.gain.value = 0.01 + Math.abs(residual[1])*0.04;
  }

  if (t - lastWorker > 800 && hist.length > 3) {
    let ent = 0;
    const avg = field.reduce((a,b)=>a+b,0)/field.length;
    for (let i = 0; i < field.length; i += 8) {
      const p = field[i] / (avg + 0.01);
      if (p > 0) ent -= p * Math.log(p+1e-6);
    }
    worker.postMessage({ hist: hist.slice(-8), entropy: ent, lastDir });
    lastWorker = t;
  }

  requestAnimationFrame(loop);
}

addEventListener('click', initAudio, { once: true });
requestAnimationFrame(loop);
statusEl.textContent = 'ready · click/drag or tilt · click for audio';
