const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const N = 800; // particles
let particles = [];
let keys = []; // Float32Array per particle, dim=4
let portals = [];
let gpuDevice, gpuContext, pipeline, computePipeline, buffers;
let useGPU = false;
let query = [0,0,0,0]; // from pointer / orient
let orientation = {beta:0, gamma:0};
const DB_NAME = 'verse-f734-attn';
const BC_NAME = 'f734-genome';

function rand(a,b){ return a + Math.random()*(b-a); }

function initParticles(count) {
  particles = [];
  keys = [];
  for (let i=0; i<count; i++) {
    particles.push({x: rand(-1,1), y: rand(-1,1), vx: rand(-0.01,0.01), vy: rand(-0.01,0.01)});
    keys.push(new Float32Array([rand(-1,1), rand(-1,1), rand(-1,1), rand(-1,1)]));
  }
}

function createPortals() {
  document.querySelectorAll('.portal').forEach(el => el.remove());
  portals = [];
  for (let i=0; i<6; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = `Portal ${i+1}`;
    el.style.left = (20 + i*12) + '%';
    el.style.top = (30 + (i%3)*15) + '%';
    document.body.appendChild(el);
    portals.push({el, x:0, y:0, key: new Float32Array(4)});
    el.addEventListener('pointerdown', startDrag);
  }
}

let dragging = null;
function startDrag(e) {
  dragging = {el: e.target, ox: e.clientX - e.target.offsetLeft, oy: e.clientY - e.target.offsetTop};
  e.target.setPointerCapture(e.pointerId);
}
document.addEventListener('pointermove', e => {
  if (!dragging) return;
  dragging.el.style.left = (e.clientX - dragging.ox) + 'px';
  dragging.el.style.top = (e.clientY - dragging.oy) + 'px';
  // inject key into nearest particle
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left)/rect.width)*2 - 1;
  const py = -(((e.clientY - rect.top)/rect.height)*2 - 1);
  let nearest = 0, best = 1e9;
  for (let i=0; i<particles.length; i++) {
    const d = (particles[i].x-px)**2 + (particles[i].y-py)**2;
    if (d < best) { best = d; nearest = i; }
  }
  for (let k=0; k<4; k++) keys[nearest][k] = (keys[nearest][k] + (Math.random()-0.5)*0.3);
});
document.addEventListener('pointerup', () => dragging = null);

function attentionStep() {
  // pure JS attention: query from pointer or orient
  const subsample = 64;
  let scores = [];
  let sumExp = 0;
  const q = query;
  for (let s=0; s<subsample; s++) {
    const i = Math.floor(Math.random()*particles.length);
    let dot = 0;
    for (let k=0; k<4; k++) dot += q[k] * keys[i][k];
    const exp = Math.exp(dot * 2);
    scores.push({i, exp});
    sumExp += exp;
  }
  // weighted average of keys as latent
  const latent = [0,0,0,0];
  for (const s of scores) {
    const w = s.exp / sumExp;
    for (let k=0; k<4; k++) latent[k] += w * keys[s.i][k];
  }
  return latent;
}

function updatePortals(latent) {
  portals.forEach((p, idx) => {
    const phase = (Date.now()*0.001 + idx) % (Math.PI*2);
    const ox = Math.sin(phase + latent[0]) * 80;
    const oy = Math.cos(phase + latent[1]) * 60;
    p.el.style.transform = `translate(${ox}px, ${oy}px) scale(${0.8 + Math.abs(latent[2])*0.6}) rotate(${latent[3]*40}deg)`;
    const hue = (180 + latent[0]*80) % 360;
    p.el.style.borderColor = `hsl(${hue}, 70%, 60%)`;
    p.el.style.background = `hsla(${hue}, 40%, 20%, 0.75)`;
  });
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (Math.abs(p.x) > 1.2) p.vx *= -0.9;
    if (Math.abs(p.y) > 1.2) p.vy *= -0.9;
    // mild attraction toward query
    p.vx += (query[0] - p.x) * 0.0005;
    p.vy += (query[1] - p.y) * 0.0005;
  }
}

async function initWebGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available — Canvas2D fallback'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    gpuDevice = await adapter.requestDevice();
    gpuContext = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    gpuContext.configure({device: gpuDevice, format, alphaMode: 'opaque'});
    // simple compute + render would go here; for brevity we keep JS particles and draw via Canvas2D overlay or note
    useGPU = true;
    status.textContent = 'WebGPU ready (compute path reserved; visual via Canvas2D for this prototype)';
  } catch(e) {
    status.textContent = 'WebGPU init failed: ' + e.message;
  }
}

function draw() {
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth; canvas.height = innerHeight;
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const sx = (p.x + 1) * 0.5 * canvas.width;
    const sy = (1 - (p.y + 1) * 0.5) * canvas.height;
    ctx.fillStyle = `hsla(${180 + p.x*40}, 80%, 60%, 0.35)`;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.2, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function loop() {
  updateParticles();
  // update query from pointer or orient
  query[0] = (orientation.gamma || 0) / 45;
  query[1] = (orientation.beta || 0) / 45;
  // pointer override if recent
  const latent = attentionStep();
  updatePortals(latent);
  draw();
  requestAnimationFrame(loop);
}

// pointer query
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  query[0] = ((e.clientX - rect.left)/rect.width)*2 - 1;
  query[1] = -(((e.clientY - rect.top)/rect.height)*2 - 1);
});

document.getElementById('btnGpu').onclick = initWebGPU;
document.getElementById('btnOrient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') window.addEventListener('deviceorientation', onOrient); });
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
};
function onOrient(e) {
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
  status.textContent = `Orient β${orientation.beta.toFixed(0)} γ${orientation.gamma.toFixed(0)}`;
}
document.getElementById('btnSeal').onclick = async () => {
  const genome = {particles: particles.slice(0,200), keys: keys.slice(0,200).map(k=>Array.from(k)), ts: Date.now()};
  try {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes', {keyPath: 'ts'});
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(genome);
      status.textContent = 'Genome sealed to IndexedDB';
    };
  } catch(e) { status.textContent = 'Seal failed (in-memory)'; }
  try { new BroadcastChannel(BC_NAME).postMessage(genome); } catch (e) { console.debug("lab f734-webgpu-attention-particle-dom-mind:", e); }
};
document.getElementById('btnReset').onclick = () => { initParticles(N); status.textContent = 'Reset'; };

initParticles(N);
createPortals();
loop();
status.textContent = 'Ready — move pointer or enable orientation / GPU';
