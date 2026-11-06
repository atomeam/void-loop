const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 6;
const RES_SIZE = 24;
const agents = [];
let pheromone = new Float32Array(W * H); // simplified sparse? full for demo, decay
// Actually for performance, use lower res or just visual overlay; we'll draw deposits as circles and decay via global alpha or periodic clear.

let orient = { beta:0, gamma:0, dbeta:0, dgamma:0 };
let lastOrient = { beta:0, gamma:0 };
let pointer = { x:W/2, y:H/2, vx:0, vy:0 };
let lastPointer = { x:W/2, y:H/2 };

function fnvHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

class Reservoir {
  constructor() {
    this.W = Array.from({length: RES_SIZE}, () => Array.from({length: RES_SIZE}, () => (Math.random()<0.1 ? (Math.random()-0.5)*1.2 : 0)));
    this.Win = Array.from({length: RES_SIZE}, () => Array.from({length: 4}, () => (Math.random()-0.5)*0.5));
    this.readout = Array.from({length: 3}, () => Array.from({length: RES_SIZE}, () => (Math.random()-0.5)*0.1));
    this.state = new Float32Array(RES_SIZE);
  }
  step(inputs) { // inputs: [dbeta, dgamma or pvx, pvy, localDens, selfFit]
    const s = this.state;
    for (let i = 0; i < RES_SIZE; i++) {
      let sum = 0;
      for (let j = 0; j < RES_SIZE; j++) sum += this.W[i][j] * s[j];
      for (let k = 0; k < 4; k++) sum += this.Win[i][k] * inputs[k];
      s[i] = Math.tanh(sum);
    }
    const out = [0,0,0];
    for (let o = 0; o < 3; o++) {
      for (let i = 0; i < RES_SIZE; i++) out[o] += this.readout[o][i] * s[i];
    }
    return out;
  }
  serializeReadout() { return JSON.stringify(this.readout); }
  adoptReadout(arr) { this.readout = arr; }
}

class Agent {
  constructor(id, x, y, hue) {
    this.id = id;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hue = hue;
    this.res = new Reservoir();
    this.fitness = 0.5;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.innerHTML = `<strong>A${id}</strong><span>f:0.50</span>`;
    this.el.style.background = `hsla(${hue},70%,40%,0.75)`;
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
    document.body.appendChild(this.el);
    this.dragging = false;
    this.el.addEventListener('pointerdown', e => { this.dragging = true; this.el.setPointerCapture(e.pointerId); });
    this.el.addEventListener('pointermove', e => { if (this.dragging) { this.x = e.clientX - 36; this.y = e.clientY - 36; } });
    this.el.addEventListener('pointerup', () => this.dragging = false);
  }
  update(inputs, fieldSample) {
    const out = this.res.step(inputs);
    this.vx += out[0] * 0.8;
    this.vy += out[1] * 0.8;
    this.vx *= 0.92; this.vy *= 0.92;
    if (!this.dragging) {
      this.x += this.vx;
      this.y += this.vy;
    }
    this.x = Math.max(0, Math.min(W-72, this.x));
    this.y = Math.max(0, Math.min(H-72, this.y));
    const deposit = Math.max(0, out[2] + 0.3);
    // deposit visual
    ctx.fillStyle = `hsla(${this.hue},80%,60%,${deposit*0.15})`;
    ctx.beginPath(); ctx.arc(this.x+36, this.y+36, 40, 0, Math.PI*2); ctx.fill();
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.transform = `scale(${1 + Math.min(0.3, this.fitness)})`;
    this.el.querySelector('span').textContent = `f:${this.fitness.toFixed(2)}`;
  }
}

function initAgents() {
  document.querySelectorAll('.agent').forEach(el => el.remove());
  agents.length = 0;
  for (let i = 0; i < N_AGENTS; i++) {
    agents.push(new Agent(i, 100 + Math.random()*(W-200), 100 + Math.random()*(H-200), (i*50)%360));
  }
}
initAgents();

function localDensity(a) {
  let d = 0;
  agents.forEach(b => {
    if (a === b) return;
    const dx = a.x - b.x, dy = a.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 120) d += (120 - dist)/120;
  });
  return d / N_AGENTS;
}

function resolveCollisions() {
  for (let i = 0; i < agents.length; i++) {
    for (let j = i+1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 80) {
        const push = (80 - dist) * 0.15;
        const nx = dx/dist, ny = dy/dist;
        a.x -= nx * push; b.x += nx * push;
        a.y -= ny * push; b.y += ny * push;
        a.vx -= nx * 0.5; b.vx += nx * 0.5;
        a.vy -= ny * 0.5; b.vy += ny * 0.5;
      }
    }
  }
}

let frame = 0;
function loop() {
  frame++;
  // fade field
  ctx.fillStyle = 'rgba(10,10,18,0.08)';
  ctx.fillRect(0,0,W,H);

  const inputsBase = [
    orient.dbeta * 0.01,
    orient.dgamma * 0.01,
    pointer.vx * 0.05,
    pointer.vy * 0.05
  ];

  agents.forEach(a => {
    const dens = localDensity(a);
    const inputs = [inputsBase[0]||inputsBase[2], inputsBase[1]||inputsBase[3], dens, a.fitness];
    a.update(inputs, dens);
    // fitness: low density better + small persistence
    a.fitness = a.fitness * 0.98 + (1 - Math.min(1, dens*1.5)) * 0.02;
    if (a.fitness > 1) a.fitness = 1;
  });
  resolveCollisions();

  document.getElementById('info').textContent = `agents:${N_AGENTS} best:${Math.max(...agents.map(a=>a.fitness)).toFixed(2)}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.dbeta = (e.beta||0) - lastOrient.beta;
    orient.dgamma = (e.gamma||0) - lastOrient.gamma;
    lastOrient.beta = e.beta||0; lastOrient.gamma = e.gamma||0;
    orient.beta = e.beta||0; orient.gamma = e.gamma||0;
  });
}

// Pointer
window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - lastPointer.x;
  pointer.vy = e.clientY - lastPointer.y;
  lastPointer.x = e.clientX; lastPointer.y = e.clientY;
  pointer.x = e.clientX; pointer.y = e.clientY;
});

// Seal & Broadcast
const channel = new BroadcastChannel('f541-genome');
const dbName = 'f541-reservoir';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
req.onsuccess = e => { db = e.target.result; loadBest(); };

function sealBest() {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const readout = best.res.readout;
  const payload = { readout, fitness: best.fitness, id: Date.now() };
  const hash = fnvHash(JSON.stringify(readout));
  payload.hash = hash;
  channel.postMessage({ type: 'seal', ...payload });
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ id: 'best', ...payload });
  }
  document.getElementById('status').textContent = `Sealed A${best.id} f=${best.fitness.toFixed(2)} hash=${hash.slice(0,8)}`;
}

function loadBest() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const g = tx.objectStore('genomes').get('best');
  g.onsuccess = () => {
    if (g.result) adopt(g.result);
  };
}

function adopt(payload) {
  if (fnvHash(JSON.stringify(payload.readout)) !== payload.hash) return;
  const worst = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
  if (payload.fitness > worst.fitness) {
    worst.res.adoptReadout(payload.readout);
    worst.fitness = payload.fitness * 0.9;
    document.getElementById('status').textContent = `Adopted into A${worst.id} f=${payload.fitness.toFixed(2)}`;
  }
}

channel.onmessage = e => { if (e.data.type === 'seal') adopt(e.data); };
document.getElementById('seal').onclick = sealBest;
document.getElementById('reset').onclick = initAgents;

// iOS permission note
if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
  document.getElementById('status').textContent += ' · tap to enable orientation';
  document.body.addEventListener('click', () => DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') location.reload(); }), { once:true });
}
