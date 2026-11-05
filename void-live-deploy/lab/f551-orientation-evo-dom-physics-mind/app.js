const status = document.getElementById('status');
const N = 6;
let orient = { beta: 0, gamma: 0 }; // pitch, roll proxies
let pointer = { x: innerWidth/2, y: innerHeight/2 };
let useOrient = false;

// Genome: [stiffness, damping, attractor, noise]
class Genome {
  constructor(p = null) {
    this.p = p || [0.08 + Math.random()*0.12, 0.7 + Math.random()*0.25, 0.4 + Math.random()*0.5, 0.02];
  }
  mutate(sigma = 0.08) {
    const n = this.p.map(v => Math.max(0.01, Math.min(1.5, v + (Math.random()-0.5)*sigma)));
    return new Genome(n);
  }
  async seal() {
    const data = JSON.stringify(this.p);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,12);
  }
}

class Agent {
  constructor(i) {
    this.id = i;
    this.genome = new Genome();
    this.seal = '…';
    this.x = Math.random() * (innerWidth - 100) + 50;
    this.y = Math.random() * (innerHeight - 100) + 50;
    this.vx = 0; this.vy = 0;
    this.fitness = 0;
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.style.background = `hsl(${i * 60}, 70%, 45%)`;
    this.el.textContent = `#${i}`;
    document.body.appendChild(this.el);
    this.updateSeal();
  }
  async updateSeal() { this.seal = await this.genome.seal(); }
  step(targetX, targetY) {
    const [k, d, a, noise] = this.genome.p;
    const ax = (targetX - this.x) * a * k + (Math.random()-0.5)*noise*20;
    const ay = (targetY - this.y) * a * k + (Math.random()-0.5)*noise*20;
    this.vx = this.vx * d + ax;
    this.vy = this.vy * d + ay;
    this.x += this.vx;
    this.y += this.vy;
    // Soft bounds
    this.x = Math.max(36, Math.min(innerWidth-36, this.x));
    this.y = Math.max(36, Math.min(innerHeight-36, this.y));
    this.el.style.transform = `translate(${this.x-36}px, ${this.y-36}px)`;
    this.el.textContent = `#${this.id}\n${this.seal.slice(0,6)}\n${this.fitness.toFixed(1)}`;
    // Fitness: low velocity + proximity to target
    const dist = Math.hypot(targetX - this.x, targetY - this.y);
    const vel = Math.hypot(this.vx, this.vy);
    this.fitness = this.fitness * 0.98 + (1 / (1 + dist/80)) * 2 - vel * 0.1;
    if (this.fitness < 0) this.fitness = 0;
  }
}

let agents = [];
function spawn() {
  agents.forEach(a => a.el.remove());
  agents = [];
  for (let i = 0; i < N; i++) agents.push(new Agent(i));
}
spawn();

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      useOrient = true;
      orient.beta = e.beta || 0;
      orient.gamma = e.gamma || 0;
    }
  });
}

// Pointer fallback / engagement
document.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

// BroadcastChannel for multi-tab sealed transfer
const bc = new BroadcastChannel('f551-evo-mind');
bc.onmessage = async e => {
  if (e.data.type === 'genome' && e.data.p) {
    // Inject into worst agent
    const worst = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
    worst.genome = new Genome(e.data.p);
    await worst.updateSeal();
    status.textContent = `Received sealed genome into agent ${worst.id}`;
  }
};

// IndexedDB persistence
let db;
const req = indexedDB.open('verse-f551', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
req.onsuccess = e => { db = e.target.result; loadBest(); };

function loadBest() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const store = tx.objectStore('genomes');
  const get = store.get('best');
  get.onsuccess = () => {
    if (get.result && get.result.p) {
      agents[0].genome = new Genome(get.result.p);
      agents[0].updateSeal();
      status.textContent = 'Restored sealed genome from IndexedDB';
    }
  };
}

async function sealWinner() {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const seal = await best.genome.seal();
  const payload = { id: 'best', p: best.genome.p, seal, fitness: best.fitness, t: Date.now() };
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(payload);
  }
  bc.postMessage({ type: 'genome', p: best.genome.p, seal });
  status.textContent = `Sealed winner #${best.id} (${seal}) → IndexedDB + BroadcastChannel`;
}

document.getElementById('sealBtn').onclick = sealWinner;
document.getElementById('resetBtn').onclick = spawn;

// Evolution step every ~2s: mutate best, replace worst if better
setInterval(() => {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const worst = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
  const child = best.genome.mutate();
  // Temporary eval by swapping and seeing next frames, but simple: replace if random chance or always trial
  worst.genome = child;
  worst.updateSeal();
  worst.fitness *= 0.5; // reset for trial
}, 2200);

function loop() {
  // Target from orientation (mapped to screen) or pointer
  let tx, ty;
  if (useOrient) {
    tx = innerWidth/2 + orient.gamma * 4;
    ty = innerHeight/2 + orient.beta * 4;
  } else {
    tx = pointer.x;
    ty = pointer.y;
  }
  tx = Math.max(50, Math.min(innerWidth-50, tx));
  ty = Math.max(50, Math.min(innerHeight-50, ty));

  agents.forEach(a => a.step(tx, ty));

  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  status.textContent = `Best #${best.id} fit:${best.fitness.toFixed(2)} seal:${best.seal} | ${useOrient ? 'ORIENT' : 'POINTER'} | Tabs share via BroadcastChannel`;

  requestAnimationFrame(loop);
}
loop();
