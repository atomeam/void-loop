const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

const N = 64;
const cell = Math.min(W, H) / N;
let lattice = new Uint8Array(N * N);
for (let i = 0; i < lattice.length; i++) lattice[i] = Math.random() > 0.5 ? 1 : 0;

class MLP {
  constructor() {
    this.w1 = Array.from({length: 8}, () => Array.from({length: 6}, () => Math.random()*2-1));
    this.b1 = Array.from({length: 8}, () => Math.random()*2-1);
    this.w2 = Array.from({length: 3}, () => Array.from({length: 8}, () => Math.random()*2-1));
    this.b2 = Array.from({length: 3}, () => Math.random()*2-1);
  }
  forward(x) {
    const h = this.w1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * x[j], this.b1[i])));
    return this.w2.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * h[j], this.b2[i])));
  }
  mutate(rate=0.1) {
    const m = new MLP();
    m.w1 = this.w1.map(r => r.map(w => w + (Math.random()-0.5)*rate));
    m.b1 = this.b1.map(b => b + (Math.random()-0.5)*rate);
    m.w2 = this.w2.map(r => r.map(w => w + (Math.random()-0.5)*rate));
    m.b2 = this.b2.map(b => b + (Math.random()-0.5)*rate);
    return m;
  }
  serialize() { return {w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2}; }
}

const agents = Array.from({length: 4}, (_, i) => ({
  id: i,
  mlp: new MLP(),
  x: Math.random() * W,
  y: Math.random() * H,
  fitness: 1,
  opinion: i % 2,
  el: null
}));

agents.forEach(a => {
  const el = document.createElement('div');
  el.className = 'agent-card';
  el.textContent = 'A' + a.id;
  document.body.appendChild(el);
  a.el = el;
});

let orient = {alpha:0, beta:0, gamma:0};
window.addEventListener('deviceorientation', e => {
  orient.alpha = e.alpha || 0;
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});

let pointer = {x: W/2, y: H/2};
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

function stepVoter() {
  const next = new Uint8Array(lattice);
  for (let y = 1; y < N-1; y++) {
    for (let x = 1; x < N-1; x++) {
      const i = y * N + x;
      if (Math.random() < 0.15) {
        const dx = Math.floor(Math.random()*3)-1;
        const dy = Math.floor(Math.random()*3)-1;
        const ni = (y+dy)*N + (x+dx);
        next[i] = lattice[ni];
      } else next[i] = lattice[i];
    }
  }
  lattice = next;
}

function seedFromAgents() {
  agents.forEach(a => {
    const input = [
      (pointer.x / W)*2-1,
      (pointer.y / H)*2-1,
      orient.beta / 90,
      orient.gamma / 90,
      a.fitness / 100,
      a.opinion
    ];
    const out = a.mlp.forward(input);
    const sx = Math.floor((out[0]*0.5 + 0.5) * N);
    const sy = Math.floor((out[1]*0.5 + 0.5) * N);
    const strength = Math.max(0, out[2]);
    if (strength > 0.2 && sx>=0 && sx<N && sy>=0 && sy<N) {
      lattice[sy*N + sx] = a.opinion;
    }
    // move agent toward seed
    a.x += (sx * cell - a.x) * 0.05;
    a.y += (sy * cell - a.y) * 0.05;
  });
}

function updateFitness() {
  // rough region size
  agents.forEach(a => a.fitness *= 0.98);
  for (let i = 0; i < lattice.length; i++) {
    const owner = agents.find(a => a.opinion === lattice[i]);
    if (owner) owner.fitness += 0.01;
  }
}

function genomeTransfer() {
  for (let i = 0; i < agents.length; i++) {
    for (let j = i+1; j < agents.length; j++) {
      const dx = agents[i].x - agents[j].x;
      const dy = agents[i].y - agents[j].y;
      if (dx*dx + dy*dy < 8000) {
        const stronger = agents[i].fitness > agents[j].fitness ? agents[i] : agents[j];
        const weaker = stronger === agents[i] ? agents[j] : agents[i];
        weaker.mlp = stronger.mlp.mutate(0.15);
        weaker.opinion = stronger.opinion;
        weaker.fitness = stronger.fitness * 0.7;
        console.log('Genome sealed from', stronger.id, 'to', weaker.id);
      }
    }
  }
}

function render() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,W,H);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = lattice[y*N + x];
      ctx.fillStyle = v ? '#4af' : '#f44';
      ctx.fillRect(x*cell, y*cell, cell-1, cell-1);
    }
  }
  agents.forEach(a => {
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    a.el.style.background = a.opinion ? 'rgba(68,170,255,.8)' : 'rgba(255,68,68,.8)';
    a.el.style.transform = `scale(${0.8 + a.fitness/200})`;
  });
}

function loop() {
  stepVoter();
  seedFromAgents();
  updateFitness();
  genomeTransfer();
  render();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB persistence stub
const dbName = 'verse-f513';
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => {
  const db = e.target.result;
  db.createObjectStore('state');
};
req.onsuccess = e => {
  const db = e.target.result;
  setInterval(() => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({lattice: Array.from(lattice), agents: agents.map(a => ({...a, mlp: a.mlp.serialize(), el:null}))}, 'snapshot');
  }, 5000);
};
