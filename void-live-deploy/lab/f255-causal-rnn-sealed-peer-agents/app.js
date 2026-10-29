const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 5;
const HID = 6;
const IN = 4;
const OUT = 3;
const agents = [];
let tiltX = 0, tiltY = 0;
let pointerX = W/2, pointerY = H/2;
let hasOrient = false;
let db = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('f255-genome') : null;

function randn() { return (Math.random()*2-1) * 0.5; }
function hashWeights(w) {
  let h = 0;
  for (let i = 0; i < Math.min(w.length, 32); i++) h = (h * 31 + Math.floor(w[i]*1000)) | 0;
  return Math.abs(h).toString(16);
}

class RNN {
  constructor() {
    this.Wxh = Array.from({length: HID * IN}, randn);
    this.Whh = Array.from({length: HID * HID}, randn);
    this.Why = Array.from({length: OUT * HID}, randn);
    this.h = new Float32Array(HID);
  }
  forward(x) {
    const nh = new Float32Array(HID);
    for (let i = 0; i < HID; i++) {
      let s = 0;
      for (let j = 0; j < IN; j++) s += this.Wxh[i*IN + j] * x[j];
      for (let j = 0; j < HID; j++) s += this.Whh[i*HID + j] * this.h[j];
      nh[i] = Math.tanh(s);
    }
    this.h.set(nh);
    const o = new Float32Array(OUT);
    for (let i = 0; i < OUT; i++) {
      let s = 0;
      for (let j = 0; j < HID; j++) s += this.Why[i*HID + j] * this.h[j];
      o[i] = Math.tanh(s);
    }
    return o;
  }
  genome() { return [...this.Wxh, ...this.Whh, ...this.Why]; }
  loadGenome(g) {
    let p = 0;
    for (let i = 0; i < this.Wxh.length; i++) this.Wxh[i] = g[p++];
    for (let i = 0; i < this.Whh.length; i++) this.Whh[i] = g[p++];
    for (let i = 0; i < this.Why.length; i++) this.Why[i] = g[p++];
  }
  mutate(sigma = 0.15) {
    const m = arr => arr.map(v => v + (Math.random()*2-1)*sigma);
    this.Wxh = m(this.Wxh); this.Whh = m(this.Whh); this.Why = m(this.Why);
  }
}

function makeAgent(id) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.innerHTML = `<div class="id">A${id}</div><div class="fit">0</div>`;
  document.body.appendChild(el);
  return {
    id, el, rnn: new RNN(),
    x: Math.random()*W*0.6 + W*0.2, y: Math.random()*H*0.6 + H*0.2,
    vx: 0, vy: 0, fitness: 0, scale: 1, hue: 200
  };
}

for (let i = 0; i < N; i++) agents.push(makeAgent(i));

function updateAgent(a) {
  const dx = (pointerX - a.x) / W;
  const dy = (pointerY - a.y) / H;
  const x = [tiltX, tiltY, dx, dy];
  const o = a.rnn.forward(x);
  a.vx += o[0] * 1.2;
  a.vy += o[1] * 1.2;
  a.vx *= 0.92; a.vy *= 0.92;
  a.x = Math.max(50, Math.min(W-50, a.x + a.vx));
  a.y = Math.max(40, Math.min(H-40, a.y + a.vy));
  a.scale = 0.7 + (o[2] + 1) * 0.4;
  a.hue = 180 + o[2] * 80 + a.id * 20;
  a.el.style.left = (a.x - 45) + 'px';
  a.el.style.top = (a.y - 35) + 'px';
  a.el.style.transform = `scale(${a.scale})`;
  a.el.style.borderColor = `hsl(${a.hue}, 70%, 60%)`;
  a.el.querySelector('.fit').textContent = Math.floor(a.fitness);
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6, 0, Math.PI*2);
    ctx.fillStyle = `hsl(${a.hue}, 80%, 60%)`;
    ctx.fill();
    // hidden bar
    const h = a.rnn.h;
    for (let i = 0; i < HID; i++) {
      ctx.fillStyle = h[i] > 0 ? '#6cf' : '#f66';
      ctx.fillRect(a.x - 30 + i*10, a.y + 40, 8, Math.abs(h[i])*20);
    }
  });
}

function loop() {
  agents.forEach(updateAgent);
  draw();
  requestAnimationFrame(loop);
}
loop();

// Input
window.addEventListener('deviceorientation', e => {
  if (e.beta == null) return;
  hasOrient = true;
  tiltX = Math.max(-1, Math.min(1, e.beta / 45));
  tiltY = Math.max(-1, Math.min(1, e.gamma / 45));
});
addEventListener('pointermove', e => {
  pointerX = e.clientX; pointerY = e.clientY;
  if (!hasOrient) { tiltX = (e.clientX / W - 0.5) * 2; tiltY = (e.clientY / H - 0.5) * 2; }
});
agents.forEach(a => {
  a.el.addEventListener('click', () => {
    a.fitness += 10;
    a.rnn.h[0] += 0.3; // boost
    statusEl.textContent = `Rewarded A${a.id} (+10). Fitness: ${Math.floor(a.fitness)}`;
  });
});

// Evolution
setInterval(() => {
  agents.sort((a,b) => b.fitness - a.fitness);
  const champ = agents[0];
  const genome = champ.rnn.genome();
  const hsh = hashWeights(genome);
  // mutate losers
  for (let i = 2; i < agents.length; i++) {
    agents[i].rnn.loadGenome(genome);
    agents[i].rnn.mutate(0.12);
    agents[i].fitness *= 0.7;
  }
  statusEl.textContent = `Evolved. Champ A${champ.id} hash ${hsh.slice(0,6)}`;
  if (channel) channel.postMessage({ type: 'genome', genome, hash: hsh, fitness: champ.fitness });
}, 8000);

// Seal / IDB
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f255', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    if (!db) db = await openDB();
    const champ = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
    const genome = champ.rnn.genome();
    const rec = { id: 'champ', genome, hash: hashWeights(genome), fitness: champ.fitness, ts: Date.now() };
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(rec);
    statusEl.textContent = `Sealed champ A${champ.id} hash ${rec.hash.slice(0,6)}`;
    if (channel) channel.postMessage({ type: 'seal', ...rec });
  } catch(e) { statusEl.textContent = 'Seal failed (IDB): ' + e.message; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.rnn = new RNN(); a.fitness = 0; a.x = Math.random()*W*0.6+W*0.2; a.y = Math.random()*H*0.6+H*0.2; });
  statusEl.textContent = 'Population reset';
};

// Load seal
async function loadSeal() {
  try {
    db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('champ');
    req.onsuccess = () => {
      if (req.result) {
        agents[0].rnn.loadGenome(req.result.genome);
        statusEl.textContent = `Loaded sealed hash ${req.result.hash.slice(0,6)}`;
      } else statusEl.textContent = 'Ready. Tilt or move. Click to reward.';
    };
  } catch(e) { statusEl.textContent = 'Ready (no IDB). Tilt or move.'; }
}
loadSeal();

if (channel) {
  channel.onmessage = e => {
    if (e.data.type === 'genome' || e.data.type === 'seal') {
      const weakest = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
      weakest.rnn.loadGenome(e.data.genome);
      weakest.rnn.mutate(0.08);
      statusEl.textContent = `Received peer genome hash ${e.data.hash.slice(0,6)}`;
    }
  };
}
