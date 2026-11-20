const N = 8;
const DIM = 8;
const HEADS = 2;
const portals = [];
let matrices = null; // {Wq, Wk, Wv, Wo} each Float32Array of size DIM*DIM
let observer = new Float32Array(DIM);
let pointer = {x:0, y:0, dx:0, dy:0};
let orient = {a:0, b:0, g:0};
let sealed = false;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function randMat(scale=0.1) {
  const m = new Float32Array(DIM * DIM);
  for (let i = 0; i < m.length; i++) m[i] = (Math.random()*2-1)*scale;
  return m;
}
function initMatrices() {
  matrices = {
    Wq: randMat(0.15),
    Wk: randMat(0.15),
    Wv: randMat(0.15),
    Wo: randMat(0.1)
  };
}
function matmul(W, x, out) {
  for (let i = 0; i < DIM; i++) {
    let s = 0;
    for (let j = 0; j < DIM; j++) s += W[i*DIM + j] * x[j];
    out[i] = s;
  }
}
function softmax(scores) {
  let m = -Infinity;
  for (let s of scores) if (s > m) m = s;
  let sum = 0;
  const exp = scores.map(s => { const e = Math.exp(s - m); sum += e; return e; });
  return exp.map(e => e / (sum || 1));
}

function makePortal(i) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `<div>P${i}</div><div class="energy">0.50</div>`;
  const p = {
    el,
    x: Math.random() * (innerWidth - 80) + 40,
    y: Math.random() * (innerHeight - 80) + 40,
    vx: 0, vy: 0,
    energy: 0.5 + Math.random()*0.3,
    hue: (i / N) * 360,
    age: 0,
    feat: new Float32Array(DIM)
  };
  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';
  el.style.background = `hsla(${p.hue},70%,40%,.8)`;
  el.onclick = () => reward(p);
  portalsEl.appendChild(el);
  portals.push(p);
}

function updateFeatures() {
  for (const p of portals) {
    p.feat[0] = p.x / innerWidth;
    p.feat[1] = p.y / innerHeight;
    p.feat[2] = p.energy;
    p.feat[3] = p.hue / 360;
    p.feat[4] = Math.min(p.age / 300, 1);
    p.feat[5] = p.vx * 0.01;
    p.feat[6] = p.vy * 0.01;
    p.feat[7] = 0.1;
    p.age++;
  }
  // observer query from orientation + pointer
  observer[0] = (orient.a % 360) / 360;
  observer[1] = (orient.b + 90) / 180;
  observer[2] = (orient.g + 90) / 180;
  observer[3] = pointer.dx * 0.02;
  observer[4] = pointer.dy * 0.02;
  observer[5] = 0.5;
  observer[6] = Math.sin(Date.now()*0.001)*0.5+0.5;
  observer[7] = 0.2;
}

function attentionStep() {
  updateFeatures();
  const Qs = portals.map(() => new Float32Array(DIM));
  const Ks = portals.map(() => new Float32Array(DIM));
  const Vs = portals.map(() => new Float32Array(DIM));
  const oQ = new Float32Array(DIM);
  matmul(matrices.Wq, observer, oQ);

  for (let i = 0; i < N; i++) {
    matmul(matrices.Wq, portals[i].feat, Qs[i]);
    matmul(matrices.Wk, portals[i].feat, Ks[i]);
    matmul(matrices.Wv, portals[i].feat, Vs[i]);
  }

  // compute attention for each portal (including observer influence)
  const forces = portals.map(() => ({x:0, y:0}));
  for (let i = 0; i < N; i++) {
    const scores = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let d = 0; d < DIM; d++) s += Qs[i][d] * Ks[j][d];
      scores[j] = s / Math.sqrt(DIM);
    }
    // blend with observer
    let oScore = 0;
    for (let d = 0; d < DIM; d++) oScore += oQ[d] * Ks[i][d];
    const attn = softmax(scores);
    // apply value-weighted forces (attraction toward high-attn peers)
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = portals[j].x - portals[i].x;
      const dy = portals[j].y - portals[i].y;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = attn[j] * 0.8;
      forces[i].x += (dx / dist) * strength;
      forces[i].y += (dy / dist) * strength;
    }
    // observer bias
    forces[i].x += (oScore * 0.3) * (pointer.dx || (orient.g||0)*0.1);
    forces[i].y += (oScore * 0.3) * (pointer.dy || (orient.b||0)*0.1);
  }

  for (let i = 0; i < N; i++) {
    const p = portals[i];
    p.vx = p.vx * 0.92 + forces[i].x * 1.8;
    p.vy = p.vy * 0.92 + forces[i].y * 1.8;
    p.x += p.vx;
    p.y += p.vy;
    // soft wrap
    if (p.x < 20) p.x = 20, p.vx *= -0.5;
    if (p.x > innerWidth - 60) p.x = innerWidth - 60, p.vx *= -0.5;
    if (p.y < 20) p.y = 20, p.vy *= -0.5;
    if (p.y > innerHeight - 60) p.y = innerHeight - 60, p.vy *= -0.5;
    p.energy = Math.max(0.1, Math.min(1, p.energy + (Math.random()-0.5)*0.005));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.querySelector('.energy').textContent = p.energy.toFixed(2);
  }
}

function reward(p) {
  p.energy = Math.min(1, p.energy + 0.25);
  // mutate matrices toward current
  const scale = 0.04 * p.energy;
  for (const key of ['Wq','Wk','Wv','Wo']) {
    const W = matrices[key];
    for (let i = 0; i < W.length; i++) {
      W[i] += (Math.random()*2-1) * scale;
    }
  }
  statusEl.textContent = `rewarded P · energy ${p.energy.toFixed(2)}`;
}

function drawLinks() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(120,180,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < N; i++) {
    for (let j = i+1; j < N; j++) {
      const dx = portals[j].x - portals[i].x;
      const dy = portals[j].y - portals[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist < 220) {
        ctx.globalAlpha = Math.max(0.05, 1 - dist/220) * 0.6;
        ctx.beginPath();
        ctx.moveTo(portals[i].x + 36, portals[i].y + 36);
        ctx.lineTo(portals[j].x + 36, portals[j].y + 36);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f851', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('matrices');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('matrices', 'readwrite');
    tx.objectStore('matrices').put(matrices, 'current');
    await new Promise(r => tx.oncomplete = r);
    const bc = new BroadcastChannel('f851-matrices');
    bc.postMessage({type:'seal', matrices});
    statusEl.textContent = 'sealed to IndexedDB + broadcast';
    sealed = true;
  } catch (e) {
    try { sessionStorage.setItem('f851', JSON.stringify(matrices)); } catch (e) { console.debug("lab f851-webgpu-self-attention-portal-field-mind:", e); }
    statusEl.textContent = 'sealed to session (IDB blocked)';
  }
}

async function loadSeal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f851', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('matrices', 'readonly');
    const req = tx.objectStore('matrices').get('current');
    const data = await new Promise(r => req.onsuccess = () => r(req.result));
    if (data) {
      matrices = data;
      statusEl.textContent = 'loaded sealed matrices';
      return;
    }
  } catch (e) { console.debug("lab f851-webgpu-self-attention-portal-field-mind:", e); }
  const s = sessionStorage.getItem('f851');
  if (s) {
    try { matrices = JSON.parse(s); statusEl.textContent = 'loaded from session'; return; } catch (e) { console.debug("lab f851-webgpu-self-attention-portal-field-mind:", e); }
  }
  initMatrices();
  statusEl.textContent = 'fresh matrices';
}

function loop() {
  attentionStep();
  drawLinks();
  requestAnimationFrame(loop);
}

// sensors
addEventListener('pointermove', e => {
  pointer.dx = e.movementX || 0;
  pointer.dy = e.movementY || 0;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.a = e.alpha || 0;
    orient.b = e.beta || 0;
    orient.g = e.gamma || 0;
  });
}

document.getElementById('seal').onclick = seal;

// init
for (let i = 0; i < N; i++) makePortal(i);
loadSeal().then(() => loop());
