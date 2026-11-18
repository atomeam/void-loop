const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const LOG = document.getElementById('log');
const N = 12;
const BINS = 5; // orientation bins
const AGENTS = [];

let orient = { beta: 0, gamma: 0 };
let bestFitness = -Infinity;
let bestPolicy = null;

function log(msg) {
  LOG.textContent = msg;
  console.log(msg);
}

function randomPolicy() {
  // Lookup: [betaBin][gammaBin] -> { scale, rot, hueShift, grow }
  const p = [];
  for (let b = 0; b < BINS; b++) {
    p[b] = [];
    for (let g = 0; g < BINS; g++) {
      p[b][g] = {
        scale: 0.8 + Math.random() * 0.6,
        rot: (Math.random() - 0.5) * 40,
        hue: Math.random() * 60 - 30,
        grow: Math.random() * 0.15
      };
    }
  }
  return p;
}

function mutate(policy, rate = 0.15) {
  const np = JSON.parse(JSON.stringify(policy));
  for (let b = 0; b < BINS; b++) for (let g = 0; g < BINS; g++) {
    if (Math.random() < rate) {
      const k = Object.keys(np[b][g])[Math.floor(Math.random()*4)];
      if (k === 'scale') np[b][g][k] *= 0.9 + Math.random()*0.2;
      else if (k === 'rot') np[b][g][k] += (Math.random()-0.5)*10;
      else if (k === 'hue') np[b][g][k] += (Math.random()-0.5)*15;
      else np[b][g][k] *= 0.8 + Math.random()*0.4;
    }
  }
  return np;
}

function bin(v, min, max) {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  return Math.min(BINS-1, Math.floor(t * BINS));
}

class Organism {
  constructor(i) {
    this.id = i;
    this.el = document.createElement('div');
    this.el.className = 'organism';
    this.el.style.width = '60px';
    this.el.style.height = '60px';
    this.el.style.left = (20 + Math.random()*70) + '%';
    this.el.style.top = (20 + Math.random()*60) + '%';
    this.el.style.background = `hsl(${Math.random()*360},70%,50%)`;
    this.el.dataset.id = i;
    this.el.onclick = () => this.reward();
    STAGE.appendChild(this.el);
    this.policy = randomPolicy();
    this.fitness = 0;
    this.age = 0;
    this.size = 60;
    this.hue = Math.random()*360;
  }
  reward() {
    this.fitness += 5;
    this.el.style.boxShadow = '0 0 30px gold';
    setTimeout(() => this.el.style.boxShadow = '0 0 15px currentColor', 400);
    log(`Rewarded agent ${this.id} · fitness ${this.fitness.toFixed(1)}`);
    if (this.fitness > bestFitness) {
      bestFitness = this.fitness;
      bestPolicy = JSON.parse(JSON.stringify(this.policy));
    }
  }
  step() {
    this.age++;
    const bb = bin(orient.beta, -45, 45);
    const gb = bin(orient.gamma, -45, 45);
    const act = this.policy[bb][gb];
    this.size = Math.max(30, Math.min(140, this.size * (0.98 + act.grow)));
    this.hue = (this.hue + act.hue) % 360;
    this.el.style.width = this.size + 'px';
    this.el.style.height = this.size + 'px';
    this.el.style.transform = `rotate(${act.rot}deg) scale(${act.scale})`;
    this.el.style.background = `hsl(${this.hue},70%,${50 + Math.sin(this.age/20)*10}%)`;
    // slight drift
    const dx = (Math.random()-0.5)*2;
    const dy = (Math.random()-0.5)*2;
    const left = parseFloat(this.el.style.left) + dx * 0.1;
    const top = parseFloat(this.el.style.top) + dy * 0.1;
    this.el.style.left = Math.max(5, Math.min(90, left)) + '%';
    this.el.style.top = Math.max(5, Math.min(85, top)) + '%';
    // occasional local mutation if low fitness
    if (this.age % 180 === 0 && this.fitness < 3) {
      this.policy = mutate(this.policy, 0.25);
    }
  }
}

function init() {
  for (let i = 0; i < N; i++) AGENTS.push(new Organism(i));
  STATUS.textContent = `${N} organisms live`;
  // Orientation
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) orient.beta = e.beta;
    if (e.gamma != null) orient.gamma = e.gamma;
  });
  // Mouse proxy
  window.addEventListener('mousemove', e => {
    orient.beta = (e.clientY / window.innerHeight - 0.5) * 60;
    orient.gamma = (e.clientX / window.innerWidth - 0.5) * 60;
  });
  // BroadcastChannel for sealed transfer
  const bc = new BroadcastChannel('f797-genome');
  bc.onmessage = e => {
    if (e.data.type === 'seal' && e.data.fitness > bestFitness) {
      bestFitness = e.data.fitness;
      bestPolicy = e.data.policy;
      // adopt on a random low agent
      const low = AGENTS.reduce((a,b) => a.fitness < b.fitness ? a : b);
      low.policy = JSON.parse(JSON.stringify(bestPolicy));
      low.fitness = bestFitness * 0.8;
      log('Adopted sealed policy from another tab');
    }
  };
  document.getElementById('seal').onclick = () => {
    if (!bestPolicy) { log('No best yet — reward some organisms'); return; }
    const payload = { type:'seal', fitness: bestFitness, policy: bestPolicy, ts: Date.now() };
    bc.postMessage(payload);
    // IndexedDB simple
    const req = indexedDB.open('verse-f797', 1);
    req.onupgradeneeded = ev => ev.target.result.createObjectStore('seals');
    req.onsuccess = ev => {
      const db = ev.target.result;
      const tx = db.transaction('seals', 'readwrite');
      tx.objectStore('seals').put(payload, 'best');
      log(`Sealed fitness ${bestFitness.toFixed(1)} (hash-like ${btoa(JSON.stringify(bestPolicy)).slice(0,8)}…)`);
    };
  };
  document.getElementById('reset').onclick = () => location.reload();
  // Restore
  const req = indexedDB.open('verse-f797', 1);
  req.onsuccess = ev => {
    const db = ev.target.result;
    if (!db.objectStoreNames.contains('seals')) return;
    const tx = db.transaction('seals', 'readonly');
    const g = tx.objectStore('seals').get('best');
    g.onsuccess = () => {
      if (g.result) {
        bestPolicy = g.result.policy;
        bestFitness = g.result.fitness;
        AGENTS[0].policy = JSON.parse(JSON.stringify(bestPolicy));
        log('Restored previous sealed policy');
      }
    };
  };
  loop();
}

function loop() {
  AGENTS.forEach(a => a.step());
  requestAnimationFrame(loop);
}

init();
