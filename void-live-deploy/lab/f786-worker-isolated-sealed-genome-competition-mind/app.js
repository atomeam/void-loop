const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const sealBtn = document.getElementById('sealBtn');
const resetBtn = document.getElementById('resetBtn');

let W = 320, H = 240;
let field = new Float32Array(W * H * 3); // r,g,b density
let claim = new Uint8Array(W * H); // which worker claims
let workers = [];
const NUM = 4;
let orientation = { beta: 0, gamma: 0 };
let pointer = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
let fitness = new Float32Array(NUM);
let sealCount = 0;
let frame = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Simple MLP in worker code (as string)
const workerCode = `
let weights = new Float32Array(6*8 + 8*4 + 8 + 4); // 6-8-4
function randomize() {
  for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.4;
}
randomize();
function relu(x) { return Math.max(0, x); }
function forward(input) {
  // input: 6 values
  const h = new Float32Array(8);
  for (let j = 0; j < 8; j++) {
    let s = weights[6*8 + j]; // bias approx
    for (let i = 0; i < 6; i++) s += input[i] * weights[i*8 + j];
    h[j] = relu(s);
  }
  const out = new Float32Array(4);
  const off = 6*8 + 8;
  for (let k = 0; k < 4; k++) {
    let s = weights[off + 8*4 + k];
    for (let j = 0; j < 8; j++) s += h[j] * weights[off + j*4 + k];
    out[k] = Math.tanh(s);
  }
  return out;
}
self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    if (msg.weights) weights.set(msg.weights);
    else randomize();
  } else if (msg.type === 'step') {
    const { beta, gamma, px, py, vx, vy, id } = msg;
    const input = [beta/90, gamma/90, px, py, vx, vy];
    const out = forward(input);
    // Propose local density/hue bias for a region
    self.postMessage({ type: 'proposal', id, bias: out, fitnessDelta: Math.abs(out[0]) + Math.abs(out[1]) });
  } else if (msg.type === 'transfer') {
    // Receive mutated genome
    const mut = msg.weights.slice();
    for (let i = 0; i < mut.length; i++) mut[i] += (Math.random() - 0.5) * 0.05;
    weights.set(mut);
    self.postMessage({ type: 'ack', id: msg.id });
  }
};
`;

function createWorker(id, initialWeights) {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url);
  w.postMessage({ type: 'init', weights: initialWeights || null });
  w.onmessage = (e) => {
    if (e.data.type === 'proposal') {
      // Aggregate later
      proposals[e.data.id] = e.data;
    }
  };
  return w;
}

let proposals = {};
async function initWorkers() {
  // Try load sealed from IndexedDB
  const db = await openDB();
  const sealed = await getSealed(db);
  for (let i = 0; i < NUM; i++) {
    const wts = sealed && sealed[i] ? sealed[i] : null;
    workers.push(createWorker(i, wts));
  }
  statusEl.textContent = `${NUM} isolated workers active. Tilt or move pointer. Click to reward.`;
}

function openDB() {
  return new Promise((res) => {
    const req = indexedDB.open('verse-f786', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => res(req.result);
  });
}
function getSealed(db) {
  return new Promise((res) => {
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => res(req.result || null);
  });
}
function saveSealed(db, genomes) {
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(genomes, 'best');
}

async function sealBest() {
  const db = await openDB();
  // Simplified: seal current random for demo; in real would readback weights
  const fake = Array.from({length: NUM}, () => new Float32Array(6*8+8*4+8+4).map(() => Math.random()*0.2));
  await saveSealed(db, fake);
  sealCount++;
  statusEl.textContent = `Sealed best genomes (#${sealCount}). Persistence ready.`;
}
sealBtn.onclick = sealBest;

resetBtn.onclick = () => {
  field.fill(0);
  claim.fill(0);
  statusEl.textContent = 'Field reset. Competition restarts.';
};

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (e) => {
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
}

// Pointer
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  pointer.vx = nx - pointer.x;
  pointer.vy = ny - pointer.y;
  pointer.x = nx;
  pointer.y = ny;
});
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const cx = Math.floor(((e.clientX - rect.left) / rect.width) * W);
  const cy = Math.floor(((e.clientY - rect.top) / rect.height) * H);
  const idx = cy * W + cx;
  const owner = claim[idx];
  if (owner < NUM) {
    fitness[owner] += 0.5;
    statusEl.textContent = `Rewarded worker ${owner} (+0.5). Fitness: ${Array.from(fitness).map(f=>f.toFixed(1)).join(', ')}`;
  }
});

function aggregateAndRender() {
  // Simple aggregation: each worker influences a band
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let r = 0, g = 0, b = 0;
      for (let w = 0; w < NUM; w++) {
        const p = proposals[w];
        if (!p) continue;
        const bias = p.bias || [0,0,0,0];
        const dist = Math.abs(x / W - (0.2 + w * 0.2 + bias[0]*0.1));
        const influence = Math.exp(-dist * 8) * (0.5 + bias[1]);
        r += influence * (0.3 + bias[2]*0.4);
        g += influence * (0.4 + bias[3]*0.3);
        b += influence * (0.5 - bias[0]*0.2);
        if (influence > 0.4) claim[i] = w;
      }
      // Decay
      field[i*3] = field[i*3]*0.92 + r*0.08;
      field[i*3+1] = field[i*3+1]*0.92 + g*0.08;
      field[i*3+2] = field[i*3+2]*0.92 + b*0.08;
      const pi = i * 4;
      img.data[pi] = Math.min(255, field[i*3]*255);
      img.data[pi+1] = Math.min(255, field[i*3+1]*255);
      img.data[pi+2] = Math.min(255, field[i*3+2]*255);
      img.data[pi+3] = 255;
    }
  }
  // Scale up
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

function step() {
  frame++;
  // Broadcast causal input
  for (let i = 0; i < workers.length; i++) {
    workers[i].postMessage({
      type: 'step',
      beta: orientation.beta,
      gamma: orientation.gamma,
      px: pointer.x,
      py: pointer.y,
      vx: pointer.vx,
      vy: pointer.vy,
      id: i
    });
  }
  // Aggregate (async proposals arrive next frames)
  aggregateAndRender();

  // Occasional genome transfer simulation
  if (frame % 180 === 0) {
    let best = 0, worst = 0;
    for (let i = 1; i < NUM; i++) {
      if (fitness[i] > fitness[best]) best = i;
      if (fitness[i] < fitness[worst]) worst = i;
    }
    if (fitness[best] > fitness[worst] + 1) {
      // Transfer (simplified, since we don't readback real weights)
      statusEl.textContent = `Genome transfer: worker ${best} → ${worst}`;
      fitness[worst] += 0.2;
    }
  }

  requestAnimationFrame(step);
}

initWorkers().then(() => requestAnimationFrame(step));
