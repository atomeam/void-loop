const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const HISTORY = 16, DIM = 8, HEADS = 4, PORTALS = 5;
let history = new Float32Array(HISTORY * DIM);
let histPtr = 0;
let lastX = 0.5, lastY = 0.5, lastT = 0;
let fitness = 0;

// Simple projection weights: [HEADS, DIM, DIM] flattened for QKV approx
let weights = new Float32Array(HEADS * DIM * DIM);
function initWeights() {
  for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.4;
}
initWeights();

const portals = [];
for (let i = 0; i < PORTALS; i++) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'portal');
  svg.setAttribute('viewBox', '0 0 180 120');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', `hsl(${i * 70}, 70%, 55%)`);
  path.setAttribute('stroke', '#fff');
  path.setAttribute('stroke-width', '1.5');
  svg.appendChild(path);
  portalsEl.appendChild(svg);
  portals.push({ svg, path, x: 0.2 + Math.random()*0.6, y: 0.2 + Math.random()*0.6, hue: i*70, fit: 0 });
  svg.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const p = portals[i];
    p.fit += 1.2;
    fitness += 1.0;
    // local update: strengthen weights a bit toward current
    for (let k = 0; k < weights.length; k++) {
      weights[k] += (Math.random() - 0.45) * 0.02;
    }
    if (p.fit > 3) proposeTransfer();
  });
}

function recordPointer(e) {
  const x = e.clientX / W, y = e.clientY / H;
  const t = performance.now();
  const vx = (x - lastX) / Math.max(0.001, (t - lastT)/1000);
  const vy = (y - lastY) / Math.max(0.001, (t - lastT)/1000);
  lastX = x; lastY = y; lastT = t;
  const base = histPtr * DIM;
  history[base] = x; history[base+1] = y;
  history[base+2] = Math.tanh(vx*0.1); history[base+3] = Math.tanh(vy*0.1);
  history[base+4] = x*x; history[base+5] = y*y;
  history[base+6] = Math.sin(x*6); history[base+7] = Math.cos(y*6);
  histPtr = (histPtr + 1) % HISTORY;
}

addEventListener('pointermove', recordPointer);

function attend() {
  // Simplified multi-head: query from current pointer, keys from history
  const q = new Float32Array(DIM);
  q[0] = lastX; q[1] = lastY; q[2] = 0; q[3] = 0;
  const scores = [];
  for (let h = 0; h < HEADS; h++) {
    const headScores = new Float32Array(HISTORY);
    for (let t = 0; t < HISTORY; t++) {
      let s = 0;
      for (let d = 0; d < DIM; d++) s += q[d] * history[t*DIM + d];
      headScores[t] = s / Math.sqrt(DIM);
    }
    // softmax
    let max = -Infinity;
    for (let t = 0; t < HISTORY; t++) if (headScores[t] > max) max = headScores[t];
    let sum = 0;
    for (let t = 0; t < HISTORY; t++) { headScores[t] = Math.exp(headScores[t] - max); sum += headScores[t]; }
    for (let t = 0; t < HISTORY; t++) headScores[t] /= sum;
    scores.push(headScores);
  }
  return scores;
}

function morphFromAttention(scores) {
  // Average attended features across heads for control points
  const morph = new Float32Array(8);
  for (let h = 0; h < HEADS; h++) {
    for (let t = 0; t < HISTORY; t++) {
      const w = scores[h][t];
      for (let d = 0; d < 8; d++) morph[d] += w * history[t*DIM + d] * 0.25;
    }
  }
  return morph;
}

function updatePortals(morph) {
  portals.forEach((p, i) => {
    const phase = i * 0.8 + morph[0] * 2;
    const cx1 = 40 + morph[2]*40 + Math.sin(phase)*20;
    const cy1 = 30 + morph[3]*30;
    const cx2 = 140 + morph[4]*40;
    const cy2 = 90 + morph[5]*30 + Math.cos(phase)*15;
    const d = `M 20 60 C ${cx1} ${cy1}, ${cx2} ${cy2}, 160 60 C ${cx2+10} ${cy2-20}, ${cx1-10} ${cy1+10}, 20 60 Z`;
    p.path.setAttribute('d', d);
    p.hue = (p.hue + morph[6]*8) % 360;
    p.path.setAttribute('fill', `hsl(${p.hue}, 70%, 55%)`);
    // gentle drift
    p.x += (morph[0] - 0.5) * 0.002;
    p.y += (morph[1] - 0.5) * 0.002;
    p.x = Math.max(0.05, Math.min(0.95, p.x));
    p.y = Math.max(0.05, Math.min(0.95, p.y));
    p.svg.style.left = (p.x * W - 90) + 'px';
    p.svg.style.top = (p.y * H - 60) + 'px';
  });
}

function drawAttention(scores) {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const cellW = W / HISTORY, cellH = H / HEADS;
  for (let h = 0; h < HEADS; h++) {
    for (let t = 0; t < HISTORY; t++) {
      const v = scores[h][t];
      ctx.fillStyle = `rgba(${100+v*155}, ${150+v*100}, 255, ${0.15 + v*0.6})`;
      ctx.fillRect(t * cellW, h * cellH, cellW - 1, cellH - 1);
    }
  }
  // pointer trail
  ctx.strokeStyle = 'rgba(200,220,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let t = 0; t < HISTORY; t++) {
    const idx = (histPtr + t) % HISTORY;
    const x = history[idx*DIM] * W;
    const y = history[idx*DIM + 1] * H;
    if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

let lastTransfer = 0;
function proposeTransfer() {
  if (performance.now() - lastTransfer < 2000) return;
  lastTransfer = performance.now();
  try {
    const ch = new BroadcastChannel('f746-genomes');
    ch.postMessage({ weights: Array.from(weights), fitness, ts: Date.now() });
    ch.close();
  } catch (e) { console.debug("lab f746-pointer-attention-svg-morph-portals-mind:", e); }
}

// IndexedDB
let db;
const req = indexedDB.open('verse-f746', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('genomes', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; loadBest(); };

function sealBest() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ id: 'best', weights: Array.from(weights), fitness, ts: Date.now() });
  document.getElementById('fit').textContent = fitness.toFixed(1);
}

function loadBest() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const r = tx.objectStore('genomes').get('best');
  r.onsuccess = () => {
    if (r.result) {
      weights.set(r.result.weights);
      fitness = r.result.fitness || 0;
    }
  };
}

document.getElementById('seal').onclick = sealBest;
document.getElementById('reset').onclick = () => { initWeights(); fitness = 0; portals.forEach(p => p.fit = 0); };

// Receive genomes
try {
  const ch = new BroadcastChannel('f746-genomes');
  ch.onmessage = ev => {
    if (ev.data.fitness > fitness + 0.5) {
      weights.set(ev.data.weights);
      fitness = ev.data.fitness;
    }
  };
} catch (e) { console.debug("lab f746-pointer-attention-svg-morph-portals-mind:", e); }

function loop() {
  const scores = attend();
  const morph = morphFromAttention(scores);
  updatePortals(morph);
  drawAttention(scores);
  document.getElementById('fit').textContent = fitness.toFixed(1);
  requestAnimationFrame(loop);
}
loop();
