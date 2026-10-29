const N = 256;
const AGENTS = 5;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const fitEl = document.getElementById('fit');
const agentsEl = document.getElementById('agents');

let pointer = { x: 0.5, y: 0.5 };
let orient = { beta: 0, gamma: 0 };
let particles = new Float32Array(N * 4); // x,y,vx,vy
let agentWeights = []; // each: Float32Array of MLP weights (simplified 4-8-4 ~ 100 floats)
let fitness = new Float32Array(AGENTS);
let leader = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Init particles
for (let i = 0; i < N; i++) {
  particles[i*4] = Math.random();
  particles[i*4+1] = Math.random();
  particles[i*4+2] = (Math.random()-0.5)*0.01;
  particles[i*4+3] = (Math.random()-0.5)*0.01;
}

// Init random MLP weights (toy: 4 in -> 8 hidden -> 4 out forces)
function randomWeights() {
  const w = new Float32Array(4*8 + 8*4 + 8 + 4); // rough
  for (let i = 0; i < w.length; i++) w[i] = (Math.random()-0.5)*0.4;
  return w;
}
for (let a = 0; a < AGENTS; a++) agentWeights.push(randomWeights());

// Pointer
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / canvas.width;
  pointer.y = e.clientY / canvas.height;
});
canvas.addEventListener('pointerdown', e => {
  pointer.x = e.clientX / canvas.width;
  pointer.y = e.clientY / canvas.height;
});

// DeviceOrientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = (e.beta || 0) / 90;
    orient.gamma = (e.gamma || 0) / 90;
  });
}

// Simple CPU MLP force (fallback + reference)
function mlpForce(weights, px, py, vx, vy, pxAttr, pyAttr, ob, og) {
  // Extremely simplified: linear-ish mapping for demo
  const dx = pxAttr - px;
  const dy = pyAttr - py;
  const bias = weights[0]*0.01;
  const fx = dx * (0.02 + weights[1]*0.01) + ob * weights[2]*0.005 + vx * -0.1;
  const fy = dy * (0.02 + weights[3]*0.01) + og * weights[4]*0.005 + vy * -0.1;
  return [fx + bias, fy + bias];
}

// Competition step
function compete() {
  // Fitness ~ inverse average distance to pointer + cohesion proxy
  for (let a = 0; a < AGENTS; a++) {
    let sum = 0;
    const w = agentWeights[a];
    for (let i = 0; i < N; i += 4) { // subsample
      const [fx, fy] = mlpForce(w, particles[i], particles[i+1], particles[i+2], particles[i+3], pointer.x, pointer.y, orient.beta, orient.gamma);
      sum += Math.hypot(fx, fy);
    }
    fitness[a] = -sum; // higher better (smaller forces when near equilibrium-ish)
  }
  let best = 0;
  for (let a = 1; a < AGENTS; a++) if (fitness[a] > fitness[best]) best = a;
  leader = best;
  fitEl.textContent = fitness[leader].toFixed(4);

  // Mutate weakest
  let worst = 0;
  for (let a = 1; a < AGENTS; a++) if (fitness[a] < fitness[worst]) worst = a;
  if (Math.random() < 0.05) {
    const src = agentWeights[leader];
    const dst = agentWeights[worst];
    for (let i = 0; i < dst.length; i++) {
      dst[i] = src[i] + (Math.random()-0.5)*0.08;
    }
  }
  renderAgents();
}

function renderAgents() {
  agentsEl.innerHTML = '';
  for (let a = 0; a < AGENTS; a++) {
    const card = document.createElement('div');
    card.className = 'agent-card' + (a === leader ? ' leader' : '');
    card.textContent = `A${a} ${fitness[a].toFixed(3)}`;
    agentsEl.appendChild(card);
  }
}

// IndexedDB seal
const DB_NAME = 'f223-seal';
async function seal() {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(Array.from(agentWeights[leader]), 'leader');
  statusEl.textContent = 'Sealed leader';
}
async function reloadSealed() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('leader');
    req.onsuccess = () => {
      if (req.result) {
        agentWeights[0] = new Float32Array(req.result);
        statusEl.textContent = 'Reloaded sealed genome';
      }
    };
  } catch (e) { statusEl.textContent = 'No sealed genome'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reload').onclick = reloadSealed;

// Main loop (CPU path; WebGPU path would replace force computation)
function step() {
  // Apply forces from leader MLP for demo (full multi-agent would assign particles to agents)
  const w = agentWeights[leader];
  for (let i = 0; i < N; i++) {
    const base = i*4;
    const [fx, fy] = mlpForce(w, particles[base], particles[base+1], particles[base+2], particles[base+3], pointer.x, pointer.y, orient.beta, orient.gamma);
    particles[base+2] = Math.max(-0.05, Math.min(0.05, particles[base+2] + fx));
    particles[base+3] = Math.max(-0.05, Math.min(0.05, particles[base+3] + fy));
    particles[base] = (particles[base] + particles[base+2] + 1) % 1;
    particles[base+1] = (particles[base+1] + particles[base+3] + 1) % 1;
  }
  if (Math.random() < 0.1) compete();

  // Draw
  ctx.fillStyle = 'rgba(10,10,20,0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#6cf';
  for (let i = 0; i < N; i++) {
    const x = particles[i*4] * canvas.width;
    const y = particles[i*4+1] * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI*2);
    ctx.fill();
  }
  // Attractor
  ctx.fillStyle = '#f66';
  ctx.beginPath();
  ctx.arc(pointer.x * canvas.width, pointer.y * canvas.height, 6, 0, Math.PI*2);
  ctx.fill();

  requestAnimationFrame(step);
}

statusEl.textContent = 'CPU fallback active (WebGPU kernel path scaffolded in SPEC)';
renderAgents();
step();
