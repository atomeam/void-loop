const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = window.innerWidth, H = window.innerHeight;
canvas.width = W; canvas.height = H;

const N = 140;
let particles = [];
let pointer = { x: W/2, y: H/2 };
let orient = { beta: 0, gamma: 0 };
let weights = null;
let bestWeights = null, bestFit = 0;
let nearCount = 0;

function initParticles() {
  particles = Array.from({length: N}, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: 0, vy: 0,
    trail: []
  }));
}

function mlp(w, x, y, d) {
  const ih = 3*8, bh = 8, ho = 8*2;
  const h = new Float32Array(8);
  for (let j = 0; j < 8; j++) {
    let s = w[ih + j];
    s += w[j*3 + 0] * x;
    s += w[j*3 + 1] * y;
    s += w[j*3 + 2] * d;
    h[j] = Math.max(0, s);
  }
  const out = [w[ih+bh+ho], w[ih+bh+ho+1]];
  for (let j = 0; j < 8; j++) {
    out[0] += w[ih+bh + j*2] * h[j];
    out[1] += w[ih+bh + j*2 + 1] * h[j];
  }
  return [Math.tanh(out[0]) * 4, Math.tanh(out[1]) * 4];
}

function step() {
  if (!weights) return;
  nearCount = 0;
  let speedSum = 0, speedVar = 0;
  for (const p of particles) {
    const nx = p.x / W * 2 - 1;
    const ny = p.y / H * 2 - 1;
    const dist = Math.hypot(p.x - pointer.x, p.y - pointer.y) / Math.max(W, H);
    const d = Math.exp(-dist * 4);
    if (dist < 0.12) nearCount++;
    const [fvx, fvy] = mlp(weights, nx, ny, d);
    const ox = (orient.gamma || 0) / 90 * 1.5;
    const oy = (orient.beta || 0) / 90 * 1.5;
    p.vx = p.vx * 0.92 + fvx * 0.35 + ox * 0.1 + (Math.random()-0.5)*0.2;
    p.vy = p.vy * 0.92 + fvy * 0.35 + oy * 0.1 + (Math.random()-0.5)*0.2;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
    p.trail.push({x: p.x, y: p.y});
    if (p.trail.length > 12) p.trail.shift();
    speedSum += Math.hypot(p.vx, p.vy);
  }
  const meanSpeed = speedSum / N;
  for (const p of particles) speedVar += (Math.hypot(p.vx, p.vy) - meanSpeed) ** 2;
  return { spread: Math.min(1, nearCount / 20), speedVar: speedVar / N, meanSpeed };
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,10,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(100,200,255,0.6)';
  ctx.lineWidth = 1.2;
  for (const p of particles) {
    if (p.trail.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(p.trail[0].x, p.trail[0].y);
    for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI*2);
  ctx.fill();
}

const workerCode = `
let pop = [];
function rand() { return Math.random() * 2 - 1; }
function init() {
  pop = Array.from({length: 6}, () => ({
    w: Array.from({length: 3*8 + 8 + 8*2 + 2}, rand),
    fit: 0
  }));
}
init();
self.onmessage = (e) => {
  const { spread, speedVar, meanSpeed, near } = e.data;
  const fit = spread * 3 + Math.min(1, near / 30) * 2 + (1 - Math.min(1, Math.abs(meanSpeed - 1.5))) + speedVar * 0.5;
  const idx = Math.floor(Math.random() * pop.length);
  pop[idx].fit = fit;
  pop.sort((a,b) => b.fit - a.fit);
  const best = pop[0];
  for (let i = 1; i < pop.length; i++) {
    for (let j = 0; j < best.w.length; j++) {
      pop[i].w[j] = best.w[j] + (Math.random()-0.5)*0.15;
    }
  }
  self.postMessage({ w: best.w, fit: best.fit });
};
`;
const blob = new Blob([workerCode], {type: 'application/javascript'});
let worker;
try {
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = (e) => {
    weights = e.data.w;
    if (e.data.fit > bestFit) { bestFit = e.data.fit; bestWeights = weights.slice(); }
    const m = Math.min(1, e.data.fit / 6);
    document.body.style.filter = `hue-rotate(${m*220}deg) contrast(${1 + m*0.6}) blur(${(1-m)*1.5}px)`;
    document.body.style.transform = `scale(${1 + m*0.04})`;
    status.textContent = `fit=${e.data.fit.toFixed(2)} best=${bestFit.toFixed(2)} near=${nearCount} | neural field evolving`;
  };
} catch (err) {
  weights = Array.from({length: 3*8 + 8 + 8*2 + 2}, () => Math.random()*0.5-0.25);
  status.textContent = 'Worker unavailable — static field';
}

function loop() {
  const stats = step() || {spread:0, speedVar:0, meanSpeed:0};
  if (worker) worker.postMessage({ ...stats, near: nearCount });
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
}, true);

document.getElementById('reset').onclick = initParticles;
document.getElementById('seal').onclick = async () => {
  const data = { w: bestWeights || weights, fit: bestFit, t: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f044', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'best');
    status.textContent += ' | sealed';
  } catch (e) {
    localStorage.setItem('f044-best', JSON.stringify(data));
    status.textContent += ' | sealed (ls)';
  }
};

window.addEventListener('resize', () => {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
});

initParticles();
status.textContent = 'Running. Move pointer. Mind evolving neural field…';
requestAnimationFrame(loop);
