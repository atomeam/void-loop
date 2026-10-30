const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const agentsEl = document.getElementById('agents');
let agents = [];
const N = 5;
let fitness = new Float32Array(N);
let genomes = []; // MLP weights per agent
let positions = new Float32Array(N * 2);
let velocities = new Float32Array(N * 2);
let targets = new Float32Array(N * 2);
let stiffness = new Float32Array(N);
let gaze = { x: 0.5, y: 0.5, dx: 0, dy: 0 };
let orient = { beta: 0, gamma: 0 };
let xrSession = null;
let webgpu = null;
let device = null;
let idb = null;
const BC = new BroadcastChannel('F256-genomes');

function log(s) { statusEl.textContent = s; console.log(s); }

function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
window.addEventListener('resize', resize); resize();

// Tiny MLP: input 5 → hidden 6 → output 3
function makeGenome() {
  const size = 5*6 + 6 + 6*3 + 3;
  const g = new Float32Array(size);
  for (let i = 0; i < size; i++) g[i] = (Math.random() - 0.5) * 0.8;
  return g;
}
function mlpForward(genome, x) {
  // x: [relX, relY, gazeDx, gazeDy, bias]
  let idx = 0;
  const h = new Float32Array(6);
  for (let j = 0; j < 6; j++) {
    let s = 0;
    for (let i = 0; i < 5; i++) s += x[i] * genome[idx++];
    h[j] = Math.tanh(s + genome[idx++]);
  }
  const o = new Float32Array(3);
  for (let j = 0; j < 3; j++) {
    let s = 0;
    for (let i = 0; i < 6; i++) s += h[i] * genome[idx++];
    o[j] = s + genome[idx++];
  }
  return o;
}

function initAgents() {
  agentsEl.innerHTML = '';
  agents = [];
  genomes = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'agent';
    el.textContent = `A${i}`;
    el.dataset.i = i;
    el.onclick = () => { fitness[i] += 2; };
    agentsEl.appendChild(el);
    agents.push(el);
    genomes.push(makeGenome());
    positions[i*2] = 0.2 + Math.random() * 0.6;
    positions[i*2+1] = 0.2 + Math.random() * 0.6;
    velocities[i*2] = velocities[i*2+1] = 0;
  }
  fitness.fill(0);
}

function updateDOM() {
  const w = canvas.width, h = canvas.height;
  for (let i = 0; i < N; i++) {
    const el = agents[i];
    const x = positions[i*2] * w - 60;
    const y = positions[i*2+1] * h - 40;
    el.style.transform = `translate(${x}px, ${y}px) scale(${0.8 + stiffness[i]*0.4})`;
    el.style.borderColor = `hsl(${180 + fitness[i]*20}, 80%, 60%)`;
  }
}

function stepPhysics(dt) {
  const k = 8, damp = 0.85, repel = 0.015;
  for (let i = 0; i < N; i++) {
    const tx = targets[i*2], ty = targets[i*2+1];
    const px = positions[i*2], py = positions[i*2+1];
    let fx = (tx - px) * stiffness[i] * k;
    let fy = (ty - py) * stiffness[i] * k;
    // inter-agent repulsion / soft constraints
    for (let j = 0; j < N; j++) if (i !== j) {
      const dx = px - positions[j*2], dy = py - positions[j*2+1];
      const d2 = dx*dx + dy*dy + 0.001;
      const f = repel / d2;
      fx += dx * f; fy += dy * f;
    }
    // orientation bias
    fx += orient.gamma * 0.002;
    fy += orient.beta * 0.002;
    velocities[i*2] = (velocities[i*2] + fx * dt) * damp;
    velocities[i*2+1] = (velocities[i*2+1] + fy * dt) * damp;
    positions[i*2] = Math.max(0.05, Math.min(0.95, positions[i*2] + velocities[i*2] * dt));
    positions[i*2+1] = Math.max(0.05, Math.min(0.95, positions[i*2+1] + velocities[i*2+1] * dt));
  }
}

function stepMLPs() {
  for (let i = 0; i < N; i++) {
    const relX = gaze.x - positions[i*2];
    const relY = gaze.y - positions[i*2+1];
    const x = [relX, relY, gaze.dx, gaze.dy, 1];
    const o = mlpForward(genomes[i], x);
    targets[i*2] = Math.max(0.1, Math.min(0.9, positions[i*2] + o[0] * 0.15));
    targets[i*2+1] = Math.max(0.1, Math.min(0.9, positions[i*2+1] + o[1] * 0.15));
    stiffness[i] = Math.max(0.1, Math.min(1.5, 0.5 + o[2] * 0.5));
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,15,0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(102,204,255,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < N; i++) {
    const x = positions[i*2] * canvas.width;
    const y = positions[i*2+1] * canvas.height;
    const tx = targets[i*2] * canvas.width;
    const ty = targets[i*2+1] * canvas.height;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
  }
  // gaze
  ctx.fillStyle = 'rgba(255,100,100,0.6)';
  ctx.beginPath(); ctx.arc(gaze.x * canvas.width, gaze.y * canvas.height, 8, 0, Math.PI*2); ctx.fill();
}

let last = performance.now();
let evoTimer = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepMLPs();
  stepPhysics(dt);
  // dwell
  for (let i = 0; i < N; i++) {
    const dx = gaze.x - positions[i*2], dy = gaze.y - positions[i*2+1];
    if (dx*dx + dy*dy < 0.02) fitness[i] += dt * 4;
  }
  evoTimer += dt;
  if (evoTimer > 6) { evolve(); evoTimer = 0; }
  updateDOM();
  draw();
  requestAnimationFrame(loop);
}

function evolve() {
  const order = [...Array(N).keys()].sort((a,b) => fitness[b] - fitness[a]);
  const champ = order[0];
  // mutate losers
  for (let k = 2; k < N; k++) {
    const i = order[k];
    genomes[i] = genomes[champ].slice();
    for (let j = 0; j < genomes[i].length; j++) genomes[i][j] += (Math.random()-0.5)*0.15;
  }
  log(`Evo: champ A${champ} fitness ${fitness[champ].toFixed(1)}`);
  fitness.fill(0);
}

async function seal() {
  const order = [...Array(N).keys()].sort((a,b) => fitness[b] - fitness[a]);
  const g = genomes[order[0]];
  const buf = g.buffer.slice(0);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
  const payload = { genome: Array.from(g), hash: hex, ts: Date.now(), fit: fitness[order[0]] };
  if (idb) {
    const tx = idb.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(payload, 'champ');
  }
  BC.postMessage(payload);
  log(`Sealed champ hash ${hex.slice(0,12)}…`);
}

function initIDB() {
  return new Promise((res) => {
    const req = indexedDB.open('F256', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals');
    req.onsuccess = () => { idb = req.result; res(); };
    req.onerror = () => res();
  });
}

BC.onmessage = (e) => {
  const p = e.data;
  if (p && p.genome && p.hash) {
    // inject into weakest
    const order = [...Array(N).keys()].sort((a,b) => fitness[a] - fitness[b]);
    genomes[order[0]] = new Float32Array(p.genome);
    log('Received sealed genome via BC');
  }
};

// Input
canvas.addEventListener('pointermove', (e) => {
  gaze.x = e.clientX / canvas.width;
  gaze.y = e.clientY / canvas.height;
  gaze.dx = e.movementX / canvas.width;
  gaze.dy = e.movementY / canvas.height;
});

document.getElementById('orientBtn').onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
    window.addEventListener('deviceorientation', (e) => {
      orient.beta = (e.beta || 0) / 90;
      orient.gamma = (e.gamma || 0) / 90;
    });
    log('Orientation enabled');
  } catch (err) { log('Orientation denied'); }
};

document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = () => { initAgents(); log('Reset'); };

document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { log('No WebXR'); return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    log('XR session started (gaze proxy via head pose)');
    // In a full impl: XRWebGLLayer + viewer pose each frame. Here we mark supported.
  } catch (e) { log('XR failed: ' + e.message); }
};

// WebGPU stub (compute path optional; CPU is primary for reliability)
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    log('WebGPU available (CPU path active for stability)');
  } catch (e) {}
}

(async () => {
  await initIDB();
  await tryWebGPU();
  initAgents();
  requestAnimationFrame(loop);
  log('F256 ready · pointer/orient/XR · seal + multi-tab BC');
})();
