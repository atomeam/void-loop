const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const agentsEl = document.getElementById('agents');

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight * 0.7;
window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight * 0.7;
});

// Tiny MLP: 4 inputs -> 4 hidden -> 2 outputs (fx, fy)
const INPUTS = 4, HIDDEN = 4, OUTPUTS = 2;
const WEIGHTS_LEN = INPUTS * HIDDEN + HIDDEN + HIDDEN * OUTPUTS + OUTPUTS;

function randomWeights() {
  const w = new Float32Array(WEIGHTS_LEN);
  for (let i = 0; i < WEIGHTS_LEN; i++) w[i] = (Math.random() - 0.5) * 1.2;
  return w;
}

function mutate(w, rate = 0.15) {
  const m = new Float32Array(w);
  for (let i = 0; i < m.length; i++) if (Math.random() < rate) m[i] += (Math.random() - 0.5) * 0.4;
  return m;
}

function mlpForward(weights, inputs) {
  const h = new Float32Array(HIDDEN);
  let idx = 0;
  for (let j = 0; j < HIDDEN; j++) {
    let sum = weights[idx++];
    for (let i = 0; i < INPUTS; i++) sum += weights[idx++] * inputs[i];
    h[j] = Math.tanh(sum);
  }
  const out = [0, 0];
  for (let k = 0; k < OUTPUTS; k++) {
    let sum = weights[idx++];
    for (let j = 0; j < HIDDEN; j++) sum += weights[idx++] * h[j];
    out[k] = Math.tanh(sum);
  }
  return out;
}

async function sha256(buf) {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

class Agent {
  constructor(id, weights = null) {
    this.id = id;
    this.weights = weights || randomWeights();
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = 0;
    this.vy = 0;
    this.energy = 1;
    this.fitness = 0;
    this.seal = '';
    this.color = `hsl(${(id * 47) % 360}, 70%, 55%)`;
    this.updateSeal();
  }
  async updateSeal() {
    const buf = new ArrayBuffer(this.weights.byteLength);
    new Float32Array(buf).set(this.weights);
    this.seal = await sha256(buf);
  }
  step(resources, orientBias) {
    let density = 0;
    for (const r of resources) {
      const dx = r.x - this.x, dy = r.y - this.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 80*80) density += 1 / (1 + d2 / 400);
    }
    const inputs = [
      Math.min(density / 5, 1),
      this.energy,
      orientBias.x,
      orientBias.y
    ];
    const force = mlpForward(this.weights, inputs);
    this.vx += force[0] * 0.8;
    this.vy += force[1] * 0.8;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W) this.vx *= -0.7;
    if (this.y < 0 || this.y > H) this.vy *= -0.7;
    this.x = Math.max(0, Math.min(W, this.x));
    this.y = Math.max(0, Math.min(H, this.y));
    for (let i = resources.length - 1; i >= 0; i--) {
      const r = resources[i];
      const dx = r.x - this.x, dy = r.y - this.y;
      if (dx*dx + dy*dy < 18*18) {
        this.energy = Math.min(3, this.energy + 0.4);
        this.fitness += 1;
        resources.splice(i, 1);
      }
    }
    this.energy *= 0.995;
    this.fitness += this.energy * 0.01;
  }
}

let agents = [];
let resources = [];
let orientBias = { x: 0, y: 0 };
let selected = null;
let orientEnabled = false;

function init() {
  agents = [];
  for (let i = 0; i < 8; i++) agents.push(new Agent(i));
  resources = [];
  for (let i = 0; i < 40; i++) {
    resources.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5 });
  }
  renderUI();
}

function evolve() {
  agents.sort((a, b) => b.fitness - a.fitness);
  const top = agents[0];
  for (let i = 4; i < agents.length; i++) {
    agents[i].weights = mutate(top.weights);
    agents[i].fitness *= 0.3;
    agents[i].energy = 1;
    agents[i].updateSeal();
  }
  status.textContent = `Evolved. Top fitness: ${top.fitness.toFixed(1)} seal:${top.seal}`;
  renderUI();
}

function renderUI() {
  agentsEl.innerHTML = '';
  agents.forEach(a => {
    const div = document.createElement('div');
    div.className = 'agent' + (selected === a ? ' selected' : '') + (a.fitness > 5 ? ' high' : '');
    div.innerHTML = `A${a.id} E:${a.energy.toFixed(1)} F:${a.fitness.toFixed(1)}<br><span class="seal">${a.seal || '...'}</span>`;
    div.onclick = () => { selected = selected === a ? null : a; renderUI(); };
    agentsEl.appendChild(div);
  });
}

function loop() {
  resources.forEach(r => {
    r.x += r.vx; r.y += r.vy;
    if (r.x < 0 || r.x > W) r.vx *= -1;
    if (r.y < 0 || r.y > H) r.vy *= -1;
  });
  if (resources.length < 20 && Math.random() < 0.05) {
    resources.push({ x: Math.random()*W, y: Math.random()*H, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3 });
  }
  agents.forEach(a => a.step(resources, orientBias));
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4af';
  resources.forEach(r => {
    ctx.beginPath();
    ctx.arc(r.x, r.y, 4, 0, Math.PI*2);
    ctx.fill();
  });
  agents.forEach(a => {
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 8 + a.energy * 2, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = selected === a ? '#0af' : '#fff';
    ctx.lineWidth = selected === a ? 2 : 0.5;
    ctx.stroke();
  });
  requestAnimationFrame(loop);
}

document.getElementById('btnOrient').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') enableOrient();
    } catch(e) { status.textContent = 'Orientation permission denied'; }
  } else {
    enableOrient();
  }
};

function enableOrient() {
  orientEnabled = true;
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null && e.gamma != null) {
      orientBias.x = Math.max(-1, Math.min(1, e.gamma / 45));
      orientBias.y = Math.max(-1, Math.min(1, e.beta / 45));
      status.textContent = `Orient bias: ${orientBias.x.toFixed(2)}, ${orientBias.y.toFixed(2)}`;
    }
  });
  status.textContent = 'Orientation bias enabled (tilt device)';
}

canvas.addEventListener('pointermove', e => {
  if (!orientEnabled) {
    const rect = canvas.getBoundingClientRect();
    orientBias.x = ((e.clientX - rect.left) / W - 0.5) * 2;
    orientBias.y = ((e.clientY - rect.top) / H - 0.5) * 2;
  }
});

document.getElementById('btnEvolve').onclick = evolve;
document.getElementById('btnReset').onclick = init;

const DB_NAME = 'f197-neural-competition';
let db;
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = rej;
  });
}

document.getElementById('btnSave').onclick = async () => {
  await openDB();
  const tx = db.transaction('genomes', 'readwrite');
  const store = tx.objectStore('genomes');
  for (const a of agents) {
    await a.updateSeal();
    store.put({ id: a.id, weights: Array.from(a.weights), seal: a.seal, fitness: a.fitness });
  }
  status.textContent = 'Sealed genomes saved to IndexedDB';
};

document.getElementById('btnLoad').onclick = async () => {
  await openDB();
  const tx = db.transaction('genomes', 'readonly');
  const store = tx.objectStore('genomes');
  const req = store.getAll();
  req.onsuccess = () => {
    const saved = req.result;
    if (saved.length) {
      agents.forEach((a, i) => {
        const s = saved.find(x => x.id === a.id);
        if (s) {
          a.weights = new Float32Array(s.weights);
          a.seal = s.seal;
          a.fitness = s.fitness || 0;
        }
      });
      status.textContent = `Loaded ${saved.length} sealed genomes from IDB`;
      renderUI();
    } else status.textContent = 'No saved genomes';
  };
};

agentsEl.addEventListener('dblclick', async e => {
  if (selected) {
    const target = agents.find(a => a !== selected && a.fitness < selected.fitness);
    if (target) {
      target.weights = mutate(selected.weights, 0.05);
      target.fitness = selected.fitness * 0.5;
      await target.updateSeal();
      status.textContent = `Transferred seal ${selected.seal} → A${target.id}`;
      renderUI();
    }
  }
});

init();
loop();
if (navigator.gpu) {
  status.textContent += ' | WebGPU available (kernel stub ready for expansion)';
} else {
  status.textContent += ' | WebGPU unavailable, JS MLP kernel';
}
