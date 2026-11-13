const N = 6;
const stage = document.getElementById('stage');
const status = document.getElementById('status');
const cards = [];
let orientation = { beta: 0, gamma: 0 };
let mouse = { x: 0, y: 0, vx: 0, vy: 0 };
let phase = 0;
const dbName = 'verse-f696';
const channel = new BroadcastChannel('f696-genome');

function randn() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.8; }

class MLP {
  constructor(w) {
    this.w1 = w ? w.w1 : Array.from({length:3*5}, () => randn()*0.4);
    this.b1 = w ? w.b1 : Array.from({length:5}, () => randn()*0.2);
    this.w2 = w ? w.w2 : Array.from({length:5*8}, () => randn()*0.4);
    this.b2 = w ? w.b2 : Array.from({length:8}, () => randn()*0.2);
  }
  forward(x) { // x: [3]
    const h = new Array(5).fill(0);
    for (let i=0; i<5; i++) {
      let s = this.b1[i];
      for (let j=0; j<3; j++) s += x[j] * this.w1[j*5 + i];
      h[i] = Math.tanh(s);
    }
    const y = new Array(8).fill(0);
    for (let i=0; i<8; i++) {
      let s = this.b2[i];
      for (let j=0; j<5; j++) s += h[j] * this.w2[j*8 + i];
      y[i] = Math.tanh(s);
    }
    return y;
  }
  clone() { return new MLP({ w1: [...this.w1], b1: [...this.b1], w2: [...this.w2], b2: [...this.b2] }); }
  mutate(rate=0.05) {
    const m = (a) => a.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = m(this.w1); this.b1 = m(this.b1); this.w2 = m(this.w2); this.b2 = m(this.b2);
  }
  transferFrom(other, frac=0.3) {
    const mix = (a, b) => a.map((v,i) => v*(1-frac) + b[i]*frac + (Math.random()-0.5)*0.02);
    this.w1 = mix(this.w1, other.w1); this.b1 = mix(this.b1, other.b1);
    this.w2 = mix(this.w2, other.w2); this.b2 = mix(this.b2, other.b2);
  }
}

class Agent {
  constructor(i) {
    this.id = i;
    this.mlp = new MLP();
    this.x = 100 + Math.random()* (window.innerWidth-200);
    this.y = 100 + Math.random()* (window.innerHeight-200);
    this.vx = 0; this.vy = 0;
    this.fitness = 1;
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.textContent = 'A' + i;
    this.el.addEventListener('pointerdown', (e) => { this.reward(); e.stopPropagation(); });
    stage.appendChild(this.el);
    this.updateVisual();
  }
  step(dt) {
    const feat = [
      Math.sin(orientation.beta * Math.PI/180) * 0.5 + Math.sin(phase)*0.3,
      Math.sin(orientation.gamma * Math.PI/180) * 0.5 + Math.cos(phase)*0.3,
      Math.sin(phase * 0.7)
    ];
    const out = this.mlp.forward(feat);
    this.vx += out[0] * 0.4 * dt;
    this.vy += out[1] * 0.4 * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.x = Math.max(20, Math.min(window.innerWidth-110, this.x));
    this.y = Math.max(20, Math.min(window.innerHeight-110, this.y));
    this.radii = out.slice(2,8).map(v => 30 + v*25);
    this.updateVisual();
    this.fitness *= 0.995;
  }
  updateVisual() {
    const cx = 45, cy = 45;
    const pts = [];
    for (let k=0; k<6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      const r = this.radii ? this.radii[k] : 35;
      pts.push(`${cx + Math.cos(ang)*r}px ${cy + Math.sin(ang)*r}px`);
    }
    this.el.style.clipPath = `polygon(${pts.join(', ')})`;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.background = `hsla(${200 + this.fitness*20}, 70%, 55%, 0.35)`;
  }
  reward() { this.fitness += 2; this.el.style.background = 'rgba(100,255,180,0.5)'; setTimeout(()=>this.updateVisual(), 200); }
  getEnergy() { return this.radii ? this.radii.reduce((s,r)=>s+Math.abs(r-35),0) : 0; }
}

function init() {
  for (let i=0; i<N; i++) cards.push(new Agent(i));
  loadGenome();
}

function loop(ts) {
  const dt = 0.016;
  phase += dt * 0.8;
  cards.forEach(a => a.step(dt));
  for (let i=0; i<N; i++) for (let j=i+1; j<N; j++) {
    const a = cards[i], b = cards[j];
    const dx = a.x - b.x, dy = a.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 70) {
      if (a.fitness > b.fitness) b.mlp.transferFrom(a.mlp);
      else a.mlp.transferFrom(b.mlp);
    }
  }
  requestAnimationFrame(loop);
}

function seal() {
  const best = cards.reduce((m,a) => a.fitness > m.fitness ? a : m, cards[0]);
  const data = { w1: best.mlp.w1, b1: best.mlp.b1, w2: best.mlp.w2, b2: best.mlp.b2, fitness: best.fitness };
  localStorage.setItem('verse-f696', JSON.stringify(data));
  try {
    const req = indexedDB.open(dbName, 1);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(data, 'best');
    };
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('genomes');
    };
  } catch (e) { console.debug("lab f696-orientation-mlp-clippath-sealed-swarm-mind:", e); }
  channel.postMessage({ type: 'genome', data });
  status.textContent = 'Genome sealed. Fitness: ' + best.fitness.toFixed(1);
}

function loadGenome() {
  try {
    const s = localStorage.getItem('verse-f696');
    if (s) {
      const data = JSON.parse(s);
      cards.forEach(a => { a.mlp = new MLP(data); });
      status.textContent = 'Loaded sealed genome.';
    }
  } catch (e) { console.debug("lab f696-orientation-mlp-clippath-sealed-swarm-mind:", e); }
  channel.onmessage = e => {
    if (e.data.type === 'genome') {
      cards.forEach(a => { a.mlp = new MLP(e.data.data); });
      status.textContent = 'Received genome from other tab.';
    }
  };
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { localStorage.removeItem('verse-f696'); location.reload(); };

window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orientation.beta = e.beta;
  if (e.gamma != null) orientation.gamma = e.gamma;
});
window.addEventListener('mousemove', e => {
  mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y;
  mouse.x = e.clientX; mouse.y = e.clientY;
  orientation.beta = (mouse.y / window.innerHeight - 0.5) * 60;
  orientation.gamma = (mouse.x / window.innerWidth - 0.5) * 60;
});

if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
  document.body.addEventListener('click', () => DeviceOrientationEvent.requestPermission().then(p => {
    if (p === 'granted') status.textContent = 'Orientation granted. Tilt to morph.';
  }).catch(()=>{}), { once: true });
}

init();
requestAnimationFrame(loop);
status.textContent = 'Ready. Tilt device or move mouse. Click cards.';
