const N = 10;
const stage = document.getElementById('stage');
const info = document.getElementById('info');
const status = document.getElementById('status');
const agents = [];
let orient = { beta: 0, gamma: 0 };
let pointer = { x: window.innerWidth/2, y: window.innerHeight/2 };
let bestFitness = -Infinity;
let db, channel;

class MLP {
  constructor() {
    this.w1 = Array.from({length: 4*6}, () => (Math.random()-0.5)*0.5);
    this.b1 = Array.from({length: 6}, () => (Math.random()-0.5)*0.2);
    this.w2 = Array.from({length: 6*3}, () => (Math.random()-0.5)*0.5);
    this.b2 = Array.from({length: 3}, () => (Math.random()-0.5)*0.2);
  }
  forward(x) { // x: [4]
    const h = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      let s = this.b1[i];
      for (let j = 0; j < 4; j++) s += x[j] * this.w1[j*6 + i];
      h[i] = Math.max(0, s); // ReLU
    }
    const y = new Array(3).fill(0);
    for (let i = 0; i < 3; i++) {
      let s = this.b2[i];
      for (let j = 0; j < 6; j++) s += h[j] * this.w2[j*3 + i];
      y[i] = Math.tanh(s);
    }
    return y;
  }
  clone() {
    const m = new MLP();
    m.w1 = [...this.w1]; m.b1 = [...this.b1]; m.w2 = [...this.w2]; m.b2 = [...this.b2];
    return m;
  }
  mutate(rate = 0.1) {
    const noise = (arr) => arr.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = noise(this.w1); this.b1 = noise(this.b1);
    this.w2 = noise(this.w2); this.b2 = noise(this.b2);
  }
  transferFrom(other, frac = 0.25) {
    const mix = (a, b) => a.map((v, i) => v * (1-frac) + b[i] * frac);
    this.w1 = mix(this.w1, other.w1); this.b1 = mix(this.b1, other.b1);
    this.w2 = mix(this.w2, other.w2); this.b2 = mix(this.b2, other.b2);
    this.mutate(0.05);
  }
  serialize() { return { w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 }; }
  static deserialize(o) {
    const m = new MLP();
    m.w1 = o.w1; m.b1 = o.b1; m.w2 = o.w2; m.b2 = o.b2;
    return m;
  }
}

function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.innerHTML = `<div>A${i}</div><div class="fit">0</div>`;
  stage.appendChild(el);
  return {
    el, i,
    x: Math.random() * (window.innerWidth - 100) + 50,
    y: Math.random() * (window.innerHeight - 100) + 50,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    hue: Math.random()*360,
    fitness: 0,
    mlp: new MLP(),
    radius: 40
  };
}

function init() {
  agents.length = 0;
  stage.innerHTML = '';
  for (let i = 0; i < N; i++) agents.push(createAgent(i));
  bestFitness = -Infinity;
}

function getInputs(a) {
  let density = 0;
  for (const b of agents) if (b !== a) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 150) density += 1 - d/150;
  }
  density = Math.min(1, density / 3);
  const pdist = Math.hypot(a.x - pointer.x, a.y - pointer.y);
  const pnorm = Math.min(1, pdist / 400);
  return [
    Math.max(-1, Math.min(1, orient.beta / 45)),
    Math.max(-1, Math.min(1, orient.gamma / 45)),
    density,
    1 - pnorm
  ];
}

function update() {
  const w = window.innerWidth, h = window.innerHeight;
  for (const a of agents) {
    const inp = getInputs(a);
    const out = a.mlp.forward(inp);
    a.vx += out[0] * 0.4 + orient.beta * 0.01;
    a.vy += out[1] * 0.4 + orient.gamma * 0.01;
    a.hue = (a.hue + out[2] * 8 + 360) % 360;
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += a.vx; a.y += a.vy;
    // walls
    if (a.x < a.radius) { a.x = a.radius; a.vx *= -0.6; }
    if (a.x > w - a.radius) { a.x = w - a.radius; a.vx *= -0.6; }
    if (a.y < a.radius) { a.y = a.radius; a.vy *= -0.6; }
    if (a.y > h - a.radius) { a.y = h - a.radius; a.vy *= -0.6; }
    // pointer attract mild
    const dx = pointer.x - a.x, dy = pointer.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 200) { a.vx += dx/d * 0.3; a.vy += dy/d * 0.3; a.fitness += 0.02; }
    a.fitness *= 0.999;
  }
  // collisions
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    const a = agents[i], b = agents[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < a.radius + b.radius) {
      const nx = dx / dist, ny = dy / dist;
      const overlap = (a.radius + b.radius - dist) * 0.5;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;
      // momentum exchange (equal mass)
      const rel = (a.vx - b.vx)*nx + (a.vy - b.vy)*ny;
      if (rel > 0) continue; // separating
      const impulse = -rel;
      a.vx += impulse * nx; a.vy += impulse * ny;
      b.vx -= impulse * nx; b.vy -= impulse * ny;
      a.fitness -= 0.05; b.fitness -= 0.05;
      // genome transfer if superior
      if (a.fitness > b.fitness + 2) b.mlp.transferFrom(a.mlp);
      else if (b.fitness > a.fitness + 2) a.mlp.transferFrom(b.mlp);
    }
  }
  // render
  for (const a of agents) {
    a.el.style.left = (a.x - a.radius) + 'px';
    a.el.style.top = (a.y - a.radius) + 'px';
    a.el.style.setProperty('--h', a.hue);
    a.el.querySelector('.fit').textContent = a.fitness.toFixed(1);
    if (a.fitness > bestFitness) bestFitness = a.fitness;
  }
  status.textContent = `F743 · best ${bestFitness.toFixed(1)} · tilt ${orient.beta.toFixed(0)}°/${orient.gamma.toFixed(0)}°`;
  requestAnimationFrame(update);
}

// events
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient.beta = e.beta;
  if (e.gamma != null) orient.gamma = e.gamma;
});
window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') orient.gamma -= 5;
  if (e.key === 'ArrowRight') orient.gamma += 5;
  if (e.key === 'ArrowUp') orient.beta -= 5;
  if (e.key === 'ArrowDown') orient.beta += 5;
});
stage.addEventListener('click', e => {
  let nearest = agents[0], md = 1e9;
  for (const a of agents) {
    const d = Math.hypot(a.x - e.clientX, a.y - e.clientY);
    if (d < md) { md = d; nearest = a; }
  }
  nearest.fitness += 5;
  nearest.mlp.mutate(0.02);
});

document.getElementById('reset').onclick = init;
document.getElementById('seal').onclick = seal;

// persistence
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f743', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  if (!db) db = await openDB();
  const data = agents.map(a => ({ fitness: a.fitness, mlp: a.mlp.serialize(), hue: a.hue }));
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(data, 'best');
  if (channel) channel.postMessage({ type: 'genome', data, fitness: Math.max(...agents.map(a=>a.fitness)) });
  info.textContent = 'Sealed to IndexedDB + broadcast';
}
async function load() {
  try {
    db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        req.result.forEach((d, i) => {
          if (agents[i]) {
            agents[i].mlp = MLP.deserialize(d.mlp);
            agents[i].fitness = d.fitness || 0;
            agents[i].hue = d.hue || 0;
          }
        });
        info.textContent = 'Restored sealed genomes';
      }
    };
  } catch (e) { console.warn(e); }
}
function setupChannel() {
  try {
    channel = new BroadcastChannel('f743-genomes');
    channel.onmessage = e => {
      if (e.data.type === 'genome' && e.data.fitness > bestFitness) {
        e.data.data.forEach((d, i) => {
          if (agents[i]) agents[i].mlp = MLP.deserialize(d.mlp);
        });
        bestFitness = e.data.fitness;
        info.textContent = 'Received superior genome';
      }
    };
  } catch (e) { console.debug("lab f743-orientation-mlp-collision-dom-agents-mind:", e); }
}

init();
load();
setupChannel();
requestAnimationFrame(update);
