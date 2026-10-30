// Tiny MLP: 3 inputs → 4 hidden → 3 outputs
class TinyMLP {
  constructor() {
    this.w1 = Array.from({length: 3}, () => Array.from({length: 4}, () => (Math.random()-0.5)*0.5));
    this.b1 = Array(4).fill(0);
    this.w2 = Array.from({length: 4}, () => Array.from({length: 3}, () => (Math.random()-0.5)*0.5));
    this.b2 = Array(3).fill(0);
  }
  tanh(x) { return Math.tanh(x); }
  forward(x) {
    const h = this.b1.map((b, j) => this.tanh(x.reduce((s, xi, i) => s + xi * this.w1[i][j], b)));
    const o = this.b2.map((b, k) => this.tanh(h.reduce((s, hj, j) => s + hj * this.w2[j][k], b)));
    return o;
  }
  // simple reward update: nudge toward higher output magnitude on rewarded dims
  reward(x, outputs, strength = 0.02) {
    const h = this.b1.map((b, j) => this.tanh(x.reduce((s, xi, i) => s + xi * this.w1[i][j], b)));
    for (let k = 0; k < 3; k++) {
      const target = outputs[k] + strength * Math.sign(outputs[k] || 0.1);
      const err = target - outputs[k];
      for (let j = 0; j < 4; j++) {
        this.w2[j][k] += 0.1 * err * h[j];
      }
      this.b2[k] += 0.1 * err;
    }
    // light hidden update
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 3; i++) {
        this.w1[i][j] += 0.005 * x[i] * (Math.random()-0.5);
      }
    }
  }
  toJSON() { return { w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 }; }
  fromJSON(data) {
    this.w1 = data.w1; this.b1 = data.b1;
    this.w2 = data.w2; this.b2 = data.b2;
  }
}

const mlp = new TinyMLP();
const statusEl = document.getElementById('status');
const tiles = document.querySelectorAll('.tile');
const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');

let inputs = [0, 0, 0]; // alpha, beta, gamma normalized -1..1
let outputs = [0, 0, 0];
let particles = [];

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// IndexedDB persistence
let db;
const req = indexedDB.open('void-mlp', 1);
req.onupgradeneeded = e => {
  const db = e.target.result;
  db.createObjectStore('weights', { keyPath: 'id' });
};
req.onsuccess = e => {
  db = e.target.result;
  const tx = db.transaction('weights', 'readonly');
  const store = tx.objectStore('weights');
  const get = store.get(1);
  get.onsuccess = () => {
    if (get.result) {
      mlp.fromJSON(get.result.data);
      statusEl.textContent = 'loaded persistent weights';
    } else {
      statusEl.textContent = 'new controller · tilt to explore';
    }
  };
};
req.onerror = () => { statusEl.textContent = 'in-memory only'; };

function saveWeights() {
  if (!db) return;
  const tx = db.transaction('weights', 'readwrite');
  tx.objectStore('weights').put({ id: 1, data: mlp.toJSON(), t: Date.now() });
}

// DeviceOrientation or mouse fallback
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    inputs[0] = Math.max(-1, Math.min(1, (e.alpha || 0) / 180 - 1));
    inputs[1] = Math.max(-1, Math.min(1, (e.beta || 0) / 90));
    inputs[2] = Math.max(-1, Math.min(1, (e.gamma || 0) / 90));
  });
  statusEl.textContent = 'orientation active';
} else {
  statusEl.textContent = 'mouse fallback';
  addEventListener('pointermove', e => {
    inputs[0] = (e.clientX / innerWidth) * 2 - 1;
    inputs[1] = (e.clientY / innerHeight) * 2 - 1;
    inputs[2] = Math.sin(Date.now() / 1000);
  });
}

// Particles driven by force output
for (let i = 0; i < 60; i++) {
  particles.push({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    vx: 0, vy: 0
  });
}

function step() {
  outputs = mlp.forward(inputs);
  const scale = 0.8 + outputs[0] * 0.4;
  const hue = 180 + outputs[1] * 80;
  const force = outputs[2];

  document.documentElement.style.setProperty('--scale', scale);
  document.documentElement.style.setProperty('--hue', hue);
  document.documentElement.style.setProperty('--force', force);

  // canvas field
  ctx.fillStyle = 'rgba(10,10,10,0.2)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    p.vx += (inputs[0] * force * 0.2);
    p.vy += (inputs[1] * force * 0.2);
    p.vx *= 0.96; p.vy *= 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x += canvas.width;
    if (p.x > canvas.width) p.x -= canvas.width;
    if (p.y < 0) p.y += canvas.height;
    if (p.y > canvas.height) p.y -= canvas.height;
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.6)`;
    ctx.fillRect(p.x, p.y, 2, 2);
  }

  requestAnimationFrame(step);
}
step();

// Reward on tile click
tiles.forEach(tile => {
  tile.addEventListener('click', () => {
    mlp.reward(inputs, outputs, 0.05);
    saveWeights();
    statusEl.textContent = 'rewarded · weights updated';
    tile.style.background = 'hsla(var(--hue), 80%, 50%, 0.5)';
    setTimeout(() => { tile.style.background = ''; }, 300);
  });
});
