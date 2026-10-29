const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
let agents = [];
let orientation = { alpha: 0, beta: 0, gamma: 0 };
let energyPool = 100;
let bestGenome = null;
const DB_NAME = 'F450-orb-comp';
const STORE = 'genomes';

class TinyMLP {
  constructor(weights = null) {
    // 4 inputs (orient x,y,z + self energy) → 6 hidden → 2 outputs (vx, vy)
    this.w1 = weights?.w1 || this.rand(4, 6);
    this.b1 = weights?.b1 || this.rand(1, 6)[0];
    this.w2 = weights?.w2 || this.rand(6, 2);
    this.b2 = weights?.b2 || this.rand(1, 2)[0];
  }
  rand(r, c) {
    return Array.from({length: r}, () => Array.from({length: c}, () => (Math.random()-0.5)*0.8));
  }
  forward(x) {
    // x: [alphaN, betaN, gammaN, energyN]
    const h = this.w1[0].map((_, j) => {
      let s = this.b1[j];
      for (let i = 0; i < 4; i++) s += x[i] * this.w1[i][j];
      return Math.tanh(s);
    });
    const y = this.w2[0].map((_, k) => {
      let s = this.b2[k];
      for (let j = 0; j < 6; j++) s += h[j] * this.w2[j][k];
      return Math.tanh(s);
    });
    return y; // [vx, vy] in [-1,1]
  }
  clone() { return new TinyMLP({ w1: this.w1.map(r => [...r]), b1: [...this.b1], w2: this.w2.map(r => [...r]), b2: [...this.b2] }); }
  mutate(rate = 0.08) {
    const m = (arr) => arr.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = this.w1.map(r => m(r));
    this.b1 = m(this.b1);
    this.w2 = this.w2.map(r => m(r));
    this.b2 = m(this.b2);
  }
  serialize() { return { w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 }; }
}

class OrbAgent {
  constructor(x, y, genome = null) {
    this.el = document.createElement('div');
    this.el.className = 'orb';
    this.el.textContent = '•';
    stage.appendChild(this.el);
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.energy = 20 + Math.random()*30;
    this.mlp = new TinyMLP(genome);
    this.hue = Math.random()*360;
    this.updateVisual();
    this.el.addEventListener('pointerdown', (e) => this.onGrab(e));
  }
  onGrab(e) {
    this.energy = Math.min(100, this.energy + 15);
    statusEl.textContent = 'Fed orb +15 energy';
  }
  step(dt) {
    const ox = (orientation.beta || 0) / 90;
    const oy = (orientation.gamma || 0) / 90;
    const oz = (orientation.alpha || 0) / 180;
    const en = this.energy / 100;
    const out = this.mlp.forward([ox, oy, oz, en]);
    this.vx += out[0] * 0.4 * dt;
    this.vy += out[1] * 0.4 * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    // bounds
    const w = stage.clientWidth, h = stage.clientHeight;
    if (this.x < 24) { this.x = 24; this.vx *= -0.5; }
    if (this.x > w-24) { this.x = w-24; this.vx *= -0.5; }
    if (this.y < 24) { this.y = 24; this.vy *= -0.5; }
    if (this.y > h-24) { this.y = h-24; this.vy *= -0.5; }
    // compete: drain energy slowly, gain if near others? simple resource
    this.energy -= 0.05 * dt * 60;
    if (this.energy > 0) energyPool = Math.max(0, energyPool - 0.02);
    this.updateVisual();
  }
  updateVisual() {
    this.el.style.left = (this.x - 24) + 'px';
    this.el.style.top = (this.y - 24) + 'px';
    const s = 0.6 + (this.energy / 100) * 0.8;
    this.el.style.transform = `scale(${s})`;
    this.el.style.background = `hsl(${this.hue}, 70%, ${40 + this.energy/3}%)`;
    this.el.classList.toggle('winner', this.energy > 60);
  }
  die() {
    this.el.remove();
  }
}

function spawn(genome = null) {
  const x = 100 + Math.random() * (stage.clientWidth - 200);
  const y = 100 + Math.random() * (stage.clientHeight - 200);
  agents.push(new OrbAgent(x, y, genome));
}

function compete() {
  // find strongest
  if (agents.length < 2) return;
  agents.sort((a,b) => b.energy - a.energy);
  const winner = agents[0];
  const loser = agents[agents.length-1];
  if (winner.energy > 40 && loser.energy < 15) {
    // sealed transfer: winner genome clones and mutates into loser
    const sealed = winner.mlp.clone();
    sealed.mutate(0.12);
    loser.mlp = sealed;
    loser.energy = Math.min(50, winner.energy * 0.6);
    loser.hue = (winner.hue + 30) % 360;
    statusEl.textContent = `Sealed transfer: winner → loser (energy ${winner.energy.toFixed(0)})`;
    bestGenome = winner.mlp.serialize();
  }
  // cull dead
  agents = agents.filter(a => {
    if (a.energy <= 0) { a.die(); return false; }
    return true;
  });
  // auto spawn if few
  if (agents.length < 3 && energyPool > 20) {
    spawn(bestGenome);
    energyPool -= 10;
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  agents.forEach(a => a.step(dt));
  if (Math.random() < 0.02) compete();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Orientation
function onOrient(e) {
  orientation.alpha = e.alpha || 0;
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
}
document.getElementById('start').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') window.addEventListener('deviceorientation', onOrient);
    });
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
  statusEl.textContent = 'Orientation active. Tilt to influence MLPs.';
};
document.getElementById('spawn').onclick = () => spawn();
document.getElementById('reset').onclick = () => {
  agents.forEach(a => a.die());
  agents = [];
  energyPool = 100;
  for (let i = 0; i < 5; i++) spawn();
  statusEl.textContent = 'Reset: 5 new orbs.';
};
document.getElementById('seal').onclick = async () => {
  if (!bestGenome) { statusEl.textContent = 'No winner yet.'; return; }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: 'best', genome: bestGenome, ts: Date.now() });
    await tx.done;
    statusEl.textContent = 'Sealed best genome to IndexedDB.';
  } catch (err) { statusEl.textContent = 'IDB error: ' + err.message; }
};

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// restore on load
openDB().then(async db => {
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get('best');
  req.onsuccess = () => {
    if (req.result) {
      bestGenome = req.result.genome;
      statusEl.textContent = 'Restored sealed genome from IndexedDB.';
      spawn(bestGenome);
    }
  };
}).catch(() => {});

// initial
for (let i = 0; i < 4; i++) spawn();
