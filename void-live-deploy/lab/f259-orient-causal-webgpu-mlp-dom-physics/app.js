// F259: DeviceOrientation as causal input to WebGPU softbody physics.
// Tiny local MLP predicts stabilizer forces. Hybrid DOM orbs embody particles.
// IndexedDB persists MLP weights + snapshot. Branches away from attention/residual/volumetric/NCA lattices.

const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const N = 64; // particles
let particles = new Float32Array(N * 4); // x,y,vx,vy
let forces = new Float32Array(N * 2);
let mlpWeights = new Float32Array(32); // tiny MLP: input 4 (tilt+vel stats) -> hidden 4 -> output 2
let orient = { beta: 0, gamma: 0 }; // device orientation
let mouse = { x: 0, y: 0, down: false };
let gpu = null;
let device = null;
let pipeline = null;
let buffers = {};

function initParticles() {
  for (let i = 0; i < N; i++) {
    particles[i*4] = Math.random() * canvas.width;
    particles[i*4+1] = Math.random() * canvas.height;
    particles[i*4+2] = (Math.random()-0.5)*2;
    particles[i*4+3] = (Math.random()-0.5)*2;
  }
  // random MLP init
  for (let i = 0; i < mlpWeights.length; i++) mlpWeights[i] = (Math.random()-0.5)*0.1;
}

function mlpPredict(inVec) { // simple 4->4->2 MLP, tanh
  const h = new Float32Array(4);
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (let j = 0; j < 4; j++) s += inVec[j] * mlpWeights[i*4 + j];
    h[i] = Math.tanh(s);
  }
  const out = new Float32Array(2);
  for (let i = 0; i < 2; i++) {
    let s = 0;
    for (let j = 0; j < 4; j++) s += h[j] * mlpWeights[16 + i*4 + j];
    out[i] = Math.tanh(s) * 20; // force scale
  }
  return out;
}

function computeStats() {
  let vx = 0, vy = 0, cx = 0, cy = 0;
  for (let i = 0; i < N; i++) {
    cx += particles[i*4]; cy += particles[i*4+1];
    vx += particles[i*4+2]; vy += particles[i*4+3];
  }
  return [orient.beta/90, orient.gamma/90, vx/N/5, vy/N/5];
}

function stepPhysics(dt) {
  const stats = computeStats();
  const stab = mlpPredict(stats); // causal stabilizer from orientation+vel
  const gx = Math.sin(orient.gamma * Math.PI/180) * 80 + stab[0];
  const gy = Math.sin(orient.beta * Math.PI/180) * 80 + stab[1];
  const mx = mouse.down ? (mouse.x - canvas.width/2) * 0.5 : 0;
  const my = mouse.down ? (mouse.y - canvas.height/2) * 0.5 : 0;

  for (let i = 0; i < N; i++) {
    let fx = gx + mx * 0.1;
    let fy = gy + my * 0.1;
    // softbody springs to neighbors (simple)
    for (let j = 1; j <= 2; j++) {
      const k = (i + j) % N;
      const dx = particles[k*4] - particles[i*4];
      const dy = particles[k*4+1] - particles[i*4+1];
      const dist = Math.hypot(dx, dy) || 1;
      const rest = 40;
      const force = (dist - rest) * 0.05;
      fx += dx/dist * force;
      fy += dy/dist * force;
    }
    // damping + bounds
    forces[i*2] = fx - particles[i*4+2] * 0.2;
    forces[i*2+1] = fy - particles[i*4+3] * 0.2;
  }
  for (let i = 0; i < N; i++) {
    particles[i*4+2] += forces[i*2] * dt;
    particles[i*4+3] += forces[i*2+1] * dt;
    particles[i*4] += particles[i*4+2] * dt;
    particles[i*4+1] += particles[i*4+3] * dt;
    // soft bounds
    if (particles[i*4] < 0 || particles[i*4] > canvas.width) particles[i*4+2] *= -0.7;
    if (particles[i*4+1] < 0 || particles[i*4+1] > canvas.height) particles[i*4+3] *= -0.7;
    particles[i*4] = Math.max(0, Math.min(canvas.width, particles[i*4]));
    particles[i*4+1] = Math.max(0, Math.min(canvas.height, particles[i*4+1]));
  }
}

// WebGPU setup (compute optional; fallback always works)
async function initGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'No WebGPU — Canvas2D fallback'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no adapter');
    device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();
    const context = canvas.getContext('webgpu');
    context.configure({ device, format, alphaMode: 'premultiplied' });
    // simple render pipeline placeholder; physics stays CPU for reliability
    statusEl.textContent = 'WebGPU ready (physics on CPU for stability)';
    gpu = { device, context, format };
  } catch (e) {
    statusEl.textContent = 'WebGPU failed: ' + e.message + ' — Canvas2D';
  }
}

function render() {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // draw springs
  ctx.strokeStyle = 'rgba(100,180,255,0.3)';
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const k = (i + 1) % N;
    ctx.moveTo(particles[i*4], particles[i*4+1]);
    ctx.lineTo(particles[k*4], particles[k*4+1]);
  }
  ctx.stroke();
  // particles
  for (let i = 0; i < N; i++) {
    ctx.fillStyle = `hsl(${i * 360 / N}, 70%, 60%)`;
    ctx.beginPath();
    ctx.arc(particles[i*4], particles[i*4+1], 4, 0, Math.PI*2);
    ctx.fill();
  }
  // orientation indicator
  ctx.fillStyle = '#fff';
  ctx.fillText(`Tilt β:${orient.beta.toFixed(1)} γ:${orient.gamma.toFixed(1)}`, 10, canvas.height - 20);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// DOM embodiments: 4 interactive orbs that pull particles
const orbs = [];
function createOrbs() {
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'phys-ui';
    el.textContent = 'UI' + i;
    el.style.left = (100 + i*80) + 'px';
    el.style.top = '80px';
    document.body.appendChild(el);
    orbs.push({ el, x: 100 + i*80, y: 80, dragging: false });
    el.addEventListener('pointerdown', (e) => { orbs[i].dragging = true; e.preventDefault(); });
  }
}
window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  orbs.forEach(o => {
    if (o.dragging) {
      o.x = e.clientX; o.y = e.clientY;
      o.el.style.left = o.x + 'px';
      o.el.style.top = o.y + 'px';
    }
  });
});
window.addEventListener('pointerup', () => {
  mouse.down = false;
  orbs.forEach(o => o.dragging = false);
});
window.addEventListener('pointerdown', (e) => { if (!e.target.classList.contains('phys-ui')) mouse.down = true; });

// DeviceOrientation causal input
window.addEventListener('deviceorientation', (e) => {
  if (e.beta != null) orient.beta = e.beta;
  if (e.gamma != null) orient.gamma = e.gamma;
});

// IndexedDB persistence
const IDB_NAME = 'F259-void-physics';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('state');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function saveState() {
  const db = await openDB();
  const tx = db.transaction('state', 'readwrite');
  tx.objectStore('state').put({ particles: Array.from(particles), mlp: Array.from(mlpWeights) }, 'snapshot');
  await tx.complete;
  statusEl.textContent = 'Saved to IndexedDB';
}
async function loadState() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('snapshot');
    req.onsuccess = () => {
      if (req.result) {
        particles.set(req.result.particles);
        mlpWeights.set(req.result.mlp);
        statusEl.textContent = 'Loaded from IndexedDB';
      } else statusEl.textContent = 'No snapshot in IDB';
    };
  } catch (e) { statusEl.textContent = 'IDB load failed'; }
}

document.getElementById('reset').onclick = () => { initParticles(); statusEl.textContent = 'Reset'; };
document.getElementById('save').onclick = saveState;
document.getElementById('load').onclick = loadState;

// main loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.032, (now - last) / 1000);
  last = now;
  // orb influence: pull nearby particles
  orbs.forEach(o => {
    for (let i = 0; i < N; i++) {
      const dx = o.x - particles[i*4];
      const dy = o.y - particles[i*4+1];
      const d2 = dx*dx + dy*dy;
      if (d2 < 10000) {
        particles[i*4+2] += dx * 0.001;
        particles[i*4+3] += dy * 0.001;
      }
    }
  });
  stepPhysics(dt);
  render();
  requestAnimationFrame(loop);
}

// init
initParticles();
createOrbs();
initGPU().then(() => {
  statusEl.textContent += ' | Ready. Tilt or drag.';
  requestAnimationFrame(loop);
});

// keyboard fallback for orientation (arrow keys)
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') orient.gamma -= 5;
  if (e.key === 'ArrowRight') orient.gamma += 5;
  if (e.key === 'ArrowUp') orient.beta -= 5;
  if (e.key === 'ArrowDown') orient.beta += 5;
});
