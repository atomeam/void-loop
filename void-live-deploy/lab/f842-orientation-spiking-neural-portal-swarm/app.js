const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_PORTALS = 8;
const N_NEURONS = 16;
const portals = [];
const neurons = [];
let weights = new Float32Array(N_NEURONS * N_NEURONS);
let fitness = 0;
let orientation = { beta: 0, gamma: 0 };
let lastSeal = null;

function initWeights() {
  for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.4;
}

function createPortal(i) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = i;
  el.style.left = (Math.random() * (W - 80) + 40) + 'px';
  el.style.top = (Math.random() * (H - 80) + 40) + 'px';
  document.body.appendChild(el);
  return {
    el, x: parseFloat(el.style.left), y: parseFloat(el.style.top),
    vx: 0, vy: 0, energy: 0.5, id: i
  };
}

function createNeurons() {
  for (let i = 0; i < N_NEURONS; i++) {
    neurons.push({ v: 0, spike: 0, refrac: 0 });
  }
}

initWeights();
createNeurons();
for (let i = 0; i < N_PORTALS; i++) portals.push(createPortal(i));

// Drag
let dragging = null, dragOff = {x:0,y:0};
document.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('portal')) {
    dragging = portals.find(p => p.el === e.target);
    dragOff.x = e.clientX - dragging.x; dragOff.y = e.clientY - dragging.y;
    dragging.el.setPointerCapture(e.pointerId);
  }
});
document.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.x = e.clientX - dragOff.x;
    dragging.y = e.clientY - dragOff.y;
    dragging.el.style.left = dragging.x + 'px';
    dragging.el.style.top = dragging.y + 'px';
    // inject residual as current
    injectCurrent(0.3);
  }
});
document.addEventListener('pointerup', () => { dragging = null; });

// Click reward
document.addEventListener('click', e => {
  if (e.target.classList.contains('portal')) {
    const p = portals.find(pp => pp.el === e.target);
    fitness += 1;
    // simple reward-modulated STDP-ish: strengthen recent weights
    for (let i = 0; i < 20; i++) {
      const a = Math.floor(Math.random() * N_NEURONS);
      const b = Math.floor(Math.random() * N_NEURONS);
      weights[a * N_NEURONS + b] += 0.05 * (Math.random() - 0.2);
    }
    p.energy = Math.min(1, p.energy + 0.3);
    document.getElementById('fitness').textContent = 'Fitness: ' + fitness;
  }
});

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orientation.beta = (e.beta || 0) / 90;
    orientation.gamma = (e.gamma || 0) / 90;
  });
}

function injectCurrent(strength) {
  const I = strength * (orientation.beta + orientation.gamma * 0.5);
  for (let i = 0; i < 4; i++) neurons[i].v += I * 0.2;
}

// Spiking simulation
function stepNeurons(dt) {
  injectCurrent(0.1);
  const spikes = new Float32Array(N_NEURONS);
  for (let i = 0; i < N_NEURONS; i++) {
    const n = neurons[i];
    if (n.refrac > 0) { n.refrac -= dt; n.spike = 0; continue; }
    let I = 0;
    for (let j = 0; j < N_NEURONS; j++) {
      I += weights[i * N_NEURONS + j] * neurons[j].spike;
    }
    n.v += dt * (-n.v / 0.02 + I + 0.1 * Math.random());
    if (n.v > 1) {
      n.spike = 1; n.v = 0; n.refrac = 0.005; spikes[i] = 1;
    } else n.spike = 0;
  }
  // map spikes to portal forces
  for (let p = 0; p < N_PORTALS; p++) {
    const idx = p % N_NEURONS;
    const s = spikes[idx];
    portals[p].vx += (s - 0.1) * 20 * Math.cos(p);
    portals[p].vy += (s - 0.1) * 20 * Math.sin(p * 1.3);
    portals[p].energy = 0.9 * portals[p].energy + 0.1 * s;
  }
}

function stepPhysics(dt) {
  for (const p of portals) {
    p.vx *= 0.95; p.vy *= 0.95;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.x = Math.max(20, Math.min(W - 80, p.x));
    p.y = Math.max(20, Math.min(H - 80, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `scale(${0.6 + p.energy})`;
    p.el.style.background = `radial-gradient(circle, hsl(${180 + p.energy * 120},80%,60%) 0%, #124 70%)`;
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#48f';
  ctx.lineWidth = 1;
  for (let i = 0; i < N_NEURONS; i++) {
    if (neurons[i].spike) {
      ctx.beginPath();
      ctx.arc(40 + i * 20, 40, 4, 0, Math.PI*2);
      ctx.fillStyle = '#8cf';
      ctx.fill();
    }
  }
  // connections hint
  ctx.strokeStyle = 'rgba(100,150,255,0.3)';
  for (let i = 0; i < portals.length; i++) {
    for (let j = i+1; j < portals.length; j++) {
      const d = Math.hypot(portals[i].x - portals[j].x, portals[i].y - portals[j].y);
      if (d < 200) {
        ctx.beginPath();
        ctx.moveTo(portals[i].x + 30, portals[i].y + 30);
        ctx.lineTo(portals[j].x + 30, portals[j].y + 30);
        ctx.stroke();
      }
    }
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepNeurons(dt);
  stepPhysics(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Seal / IndexedDB + BroadcastChannel
const bc = new BroadcastChannel('f842-genome');
const dbName = 'f842-spiking';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => {
  const d = e.target.result;
  if (!d.objectStoreNames.contains('genomes')) d.createObjectStore('genomes', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; loadGenome(); };
function loadGenome() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const store = tx.objectStore('genomes');
  const g = store.get('latest');
  g.onsuccess = () => {
    if (g.result && g.result.fitness > fitness) {
      weights.set(g.result.weights);
      fitness = g.result.fitness;
      document.getElementById('status').textContent = 'Adopted sealed genome fitness ' + fitness;
    }
  };
}
function seal() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({
    id: 'latest',
    weights: Array.from(weights),
    fitness,
    ts: Date.now()
  });
  bc.postMessage({ type: 'genome', weights: Array.from(weights), fitness });
  document.getElementById('status').textContent = 'Sealed genome fitness ' + fitness;
}
bc.onmessage = e => {
  if (e.data.type === 'genome' && e.data.fitness > fitness) {
    weights.set(e.data.weights);
    fitness = e.data.fitness;
    document.getElementById('status').textContent = 'Adopted peer genome';
  }
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initWeights(); fitness = 0; location.reload(); };

document.getElementById('status').textContent = 'Ready. Tilt device or drag/click portals. Seal to persist.';
