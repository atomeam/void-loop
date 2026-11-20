const canvas = document.getElementById('canvas');
const input = document.getElementById('input');
const status = document.getElementById('status');
let agents = [];
let orient = { beta: 0, gamma: 0 };
let pointer = { x: 0, y: 0, vx: 0, vy: 0 };
let lastPointer = { x: 0, y: 0 };
let bestFitness = -Infinity;
let sealedGenome = null;
const channel = new BroadcastChannel('f834-genome');
const DB_NAME = 'verse-f834-qtable';
const ACTIONS = ['N','S','E','W','stay'];
const GRID = 5; // coarse state grid

// DeviceOrientation
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
}, true);

// Pointer
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = e.clientX - rect.left;
  pointer.y = e.clientY - rect.top;
  pointer.vx = pointer.x - lastPointer.x;
  pointer.vy = pointer.y - lastPointer.y;
  lastPointer = { x: pointer.x, y: pointer.y };
});

function makeQTable() {
  // state: gx(0-4) * gy(0-4) * orientBin(0-2) * prox(0-1) → 5*5*3*2 = 150
  return Array(150).fill(0).map(() => Array(5).fill(0));
}

function stateIndex(gx, gy, oBin, prox) {
  return ((gx * GRID + gy) * 3 + oBin) * 2 + prox;
}

function orientBin() {
  const mag = Math.hypot(orient.beta, orient.gamma);
  if (mag < 15) return 1; // neutral
  return orient.gamma > 0 ? 2 : 0; // right / left bias
}

class Agent {
  constructor(text, i) {
    this.text = text;
    this.id = i;
    this.x = 100 + (i % 4) * 180;
    this.y = 120 + Math.floor(i / 4) * 100;
    this.fitness = 0;
    this.q = makeQTable();
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.innerHTML = `<div>${text}</div><div class="fit">fit 0</div>`;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    canvas.appendChild(this.el);
    this.el.addEventListener('pointerdown', this.onDragStart.bind(this));
    this.el.addEventListener('click', this.onClick.bind(this));
  }
  onClick() {
    this.fitness += 1;
    this.learn(1.0); // strong reward
    this.updateVisual();
  }
  onDragStart(e) {
    e.preventDefault();
    const startX = e.clientX - this.x;
    const startY = e.clientY - this.y;
    const move = (ev) => {
      this.x = ev.clientX - startX;
      this.y = ev.clientY - startY;
      this.clamp();
      this.el.style.left = this.x + 'px';
      this.el.style.top = this.y + 'px';
    };
    const up = () => {
      this.fitness += 0.5;
      this.learn(0.5);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
  getState() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const gx = Math.min(GRID-1, Math.max(0, Math.floor(this.x / w * GRID)));
    const gy = Math.min(GRID-1, Math.max(0, Math.floor(this.y / h * GRID)));
    const oBin = orientBin();
    const dist = Math.hypot(pointer.x - this.x, pointer.y - this.y);
    const prox = dist < 120 ? 1 : 0;
    return stateIndex(gx, gy, oBin, prox);
  }
  chooseAction(eps = 0.15) {
    const s = this.getState();
    if (Math.random() < eps) return Math.floor(Math.random() * 5);
    let best = 0, bestQ = this.q[s][0];
    for (let a = 1; a < 5; a++) if (this.q[s][a] > bestQ) { bestQ = this.q[s][a]; best = a; }
    return best;
  }
  applyAction(a) {
    const step = 28;
    if (a === 0) this.y -= step; // N
    if (a === 1) this.y += step; // S
    if (a === 2) this.x += step; // E
    if (a === 3) this.x -= step; // W
    this.clamp();
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
  }
  clamp() {
    const w = canvas.clientWidth - 140, h = canvas.clientHeight - 80;
    this.x = Math.max(10, Math.min(w, this.x));
    this.y = Math.max(70, Math.min(h, this.y));
  }
  learn(reward) {
    const s = this.getState();
    const a = this.chooseAction(0); // greedy for update
    const qsa = this.q[s][a];
    const nextS = this.getState(); // after possible move, but approximate
    let maxNext = Math.max(...this.q[nextS]);
    this.q[s][a] = qsa + 0.2 * (reward + 0.9 * maxNext - qsa);
  }
  step() {
    // orientation alignment reward
    const oBin = orientBin();
    let alignReward = 0;
    if (oBin === 2 && this.x > canvas.clientWidth * 0.55) alignReward = 0.15;
    if (oBin === 0 && this.x < canvas.clientWidth * 0.45) alignReward = 0.15;
    if (alignReward) { this.fitness += alignReward; this.learn(alignReward); }
    // occasional explore move
    if (Math.random() < 0.08) {
      const a = this.chooseAction(0.3);
      this.applyAction(a);
    }
    this.updateVisual();
  }
  updateVisual() {
    const hue = Math.min(140, this.fitness * 8);
    this.el.style.borderColor = `hsl(${hue}, 70%, 55%)`;
    this.el.querySelector('.fit').textContent = `fit ${this.fitness.toFixed(1)}`;
    if (this.fitness > bestFitness) bestFitness = this.fitness;
  }
  toJSON() {
    return { text: this.text, x: this.x, y: this.y, fitness: this.fitness, q: this.q };
  }
}

function spawn() {
  agents.forEach(a => a.el.remove());
  agents = [];
  const lines = input.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12);
  if (!lines.length) { status.textContent = 'Paste at least one line'; return; }
  lines.forEach((t, i) => agents.push(new Agent(t, i)));
  status.textContent = `${agents.length} cards spawned · tilt or click to teach`;
}

function seal() {
  if (!agents.length) return;
  const best = agents.reduce((a, b) => a.fitness > b.fitness ? a : b);
  sealedGenome = { fitness: best.fitness, q: best.q, sample: best.toJSON() };
  channel.postMessage({ type: 'genome', data: sealedGenome });
  // IndexedDB
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ id: 'best', ...sealedGenome, ts: Date.now() });
  };
  status.textContent = `Sealed best fitness ${best.fitness.toFixed(1)} · broadcasting`;
}

channel.onmessage = e => {
  if (e.data?.type === 'genome' && e.data.data.fitness > bestFitness) {
    // adopt higher
    agents.forEach(a => { a.q = JSON.parse(JSON.stringify(e.data.data.q)); });
    status.textContent = 'Adopted stronger sealed genome from another tab';
  }
};

function copyOrdered() {
  if (!agents.length) return;
  const sorted = [...agents].sort((a, b) => b.fitness - a.fitness || a.y - b.y);
  const md = sorted.map((a, i) => `${i+1}. ${a.text} (fit ${a.fitness.toFixed(1)})`).join('\n');
  navigator.clipboard.writeText(md).then(() => status.textContent = 'Ordered list copied');
}

function download() {
  const data = { agents: agents.map(a => a.toJSON()), sealed: sealedGenome, ts: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'adaptive-layout.json';
  a.click();
}

document.getElementById('spawn').onclick = spawn;
document.getElementById('seal').onclick = seal;
document.getElementById('copy').onclick = copyOrdered;
document.getElementById('download').onclick = download;

// main loop
setInterval(() => {
  agents.forEach(a => a.step());
}, 400);

// load sealed if any
const req = indexedDB.open(DB_NAME, 1);
req.onsuccess = e => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains('genomes')) return;
  const tx = db.transaction('genomes', 'readonly');
  const get = tx.objectStore('genomes').get('best');
  get.onsuccess = () => {
    if (get.result && get.result.fitness) {
      sealedGenome = get.result;
      bestFitness = get.result.fitness;
      status.textContent = 'Loaded previously sealed layout mind';
    }
  };
};

status.textContent = 'Paste notes, spawn, then tilt / click / seal';
