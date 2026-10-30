(() => {
const cv = document.getElementById('cv');
const g = cv.getContext('2d');
const statusEl = document.getElementById('status');
const ranksEl = document.getElementById('ranks');
let N = 256;
let particles = [];
let mlps = [];
let leaderIdx = 0;
let pointer = { x: 0.5, y: 0.5 };
let useGPU = false;
let device, pipeline, bindGroup, storageBuffers;
const COLORS = ['#6b78ff','#ff6b78','#78ff6b','#ffb36b','#b36bff','#6bffd6'];

function randn() { let u=0,v=0; while(!u) u=Math.random(); while(!v) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

class MLP {
  constructor(genome = null) {
    this.w1 = genome ? genome.w1.slice() : Array.from({length:4*12}, () => randn()*0.3);
    this.b1 = genome ? genome.b1.slice() : Array(12).fill(0);
    this.w2 = genome ? genome.w2.slice() : Array.from({length:12*4}, () => randn()*0.3);
    this.b2 = genome ? genome.b2.slice() : Array(4).fill(0);
    this.error = 1;
    this.fitness = 0;
  }
  forward(x) {
    const h = this.b1.slice();
    for (let i=0;i<4;i++) for (let j=0;j<12;j++) h[j] += x[i] * this.w1[i*12+j];
    for (let j=0;j<12;j++) h[j] = Math.tanh(h[j]);
    const y = this.b2.slice();
    for (let j=0;j<12;j++) for (let k=0;k<4;k++) y[k] += h[j] * this.w2[j*4+k];
    return y;
  }
  mutate(rate=0.05) {
    const m = new MLP(this);
    for (let a of [m.w1, m.b1, m.w2, m.b2]) for (let i=0;i<a.length;i++) if (Math.random()<0.3) a[i] += randn()*rate;
    return m;
  }
  genome() { return { w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2 }; }
}

function initParticles() {
  particles = [];
  for (let i=0;i<N;i++) particles.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, owner: i % 6 });
}

function initMLPs() {
  mlps = Array.from({length:6}, () => new MLP());
}

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    statusEl.textContent = 'WebGPU available (CPU MLP + particle path for this build)';
    return true;
  } catch (e) {
    return false;
  }
}

function stepCPU() {
  const dt = 0.016;
  const attract = pointer;
  let totalErr = 0;
  for (const p of particles) {
    const mlp = mlps[p.owner];
    const input = [p.vx, p.vy, attract.x - p.x, attract.y - p.y];
    const pred = mlp.forward(input);
    const ax = (attract.x - p.x) * 2.2 - p.vx * 0.4;
    const ay = (attract.y - p.y) * 2.2 - p.vy * 0.4;
    const err = Math.abs(pred[0]-ax) + Math.abs(pred[1]-ay);
    mlp.error = mlp.error * 0.98 + err * 0.02;
    totalErr += err;
    p.vx += ax * dt;
    p.vy += ay * dt;
    p.x = (p.x + p.vx * dt + 1) % 1;
    p.y = (p.y + p.vy * dt + 1) % 1;
    p.vx *= 0.99; p.vy *= 0.99;
  }
  mlps.forEach((m,i) => m.fitness = 1 / (0.01 + m.error));
  let worst = 0;
  for (let i=1;i<mlps.length;i++) if (mlps[i].fitness < mlps[worst].fitness) worst = i;
  if (Math.random() < 0.02) {
    const best = mlps.reduce((a,b,i) => b.fitness > a.fitness ? {fitness:b.fitness,i} : a, {fitness:-1,i:0}).i;
    mlps[worst] = mlps[best].mutate();
    leaderIdx = best;
  }
  return totalErr / N;
}

function draw() {
  const dpr = devicePixelRatio || 1;
  if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#05060a'; g.fillRect(0,0,innerWidth,innerHeight);
  for (const p of particles) {
    g.fillStyle = COLORS[p.owner];
    g.beginPath();
    g.arc(p.x * innerWidth, p.y * innerHeight, 2.2, 0, 7);
    g.fill();
  }
  g.strokeStyle = '#fff6'; g.lineWidth = 1;
  g.beginPath(); g.arc(pointer.x*innerWidth, pointer.y*innerHeight, 18, 0, 7); g.stroke();
  const ranked = mlps.map((m,i)=>({i,f:m.fitness.toFixed(2),e:m.error.toFixed(3)})).sort((a,b)=>b.f-a.f);
  ranksEl.innerHTML = ranked.map(r => `<small style="color:${COLORS[r.i]}">#${r.i} fit ${r.f} err ${r.e}</small>`).join(' · ');
  statusEl.textContent = useGPU ? 'GPU path ready · CPU MLPs' : 'Canvas2D fallback · CPU MLPs';
  requestAnimationFrame(() => { stepCPU(); draw(); });
}

async function sealLeader() {
  const g = mlps[leaderIdx].genome();
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f221-mlp', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('weights');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('weights','readwrite');
    tx.objectStore('weights').put(g, 'leader');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Leader sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (IndexedDB blocked)'; }
}

async function loadSealed() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f221-mlp', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('weights','readonly');
    const req = tx.objectStore('weights').get('leader');
    req.onsuccess = () => {
      if (req.result) {
        mlps[0] = new MLP(req.result);
        statusEl.textContent = 'Loaded sealed leader into agent 0';
      } else statusEl.textContent = 'No sealed weights found';
    };
  } catch (e) { statusEl.textContent = 'Load failed'; }
}

cv.addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; });
cv.addEventListener('click', e => { pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; });
document.getElementById('seal').onclick = sealLeader;
document.getElementById('load').onclick = loadSealed;
document.getElementById('reset').onclick = () => { initMLPs(); statusEl.textContent = 'Population reset'; };

initParticles();
initMLPs();
tryWebGPU().then(ok => { useGPU = ok; draw(); });
})();
