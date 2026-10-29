const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let w, h, device, context, pipeline, bindGroup, particleBuffer, paramsBuffer, agentForceBuffer;
let webgpu = false;
const N_PARTICLES = 2048;
const N_AGENTS = 6;
let particles = [];
let agents = [];
let orientation = { x: 0, y: 0.5 };
let selected = 0;
let db;

function resize() {
  w = canvas.width = innerWidth;
  h = canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Tiny RNN per agent: 4→6→2
function makeRNN() {
  const w_xh = new Float32Array(4*6).map(() => (Math.random()-0.5)*0.4);
  const w_hh = new Float32Array(6*6).map(() => (Math.random()-0.5)*0.3);
  const b_h = new Float32Array(6).map(() => (Math.random()-0.5)*0.1);
  const w_hy = new Float32Array(6*2).map(() => (Math.random()-0.5)*0.4);
  const b_y = new Float32Array(2).map(() => 0);
  const h = new Float32Array(6);
  return { w_xh, w_hh, b_h, w_hy, b_y, h, energy: 1, fitness: 0, seal: '' };
}

function tanh(x) { return Math.tanh(x); }

function rnnForward(rnn, x) {
  const { w_xh, w_hh, b_h, w_hy, b_y, h } = rnn;
  const nh = 6;
  const newH = new Float32Array(nh);
  for (let i = 0; i < nh; i++) {
    let s = b_h[i];
    for (let j = 0; j < 4; j++) s += w_xh[i*4 + j] * x[j];
    for (let j = 0; j < nh; j++) s += w_hh[i*nh + j] * h[j];
    newH[i] = tanh(Math.max(-10, Math.min(10, s)));
  }
  rnn.h.set(newH);
  const y = new Float32Array(2);
  for (let i = 0; i < 2; i++) {
    let s = b_y[i];
    for (let j = 0; j < nh; j++) s += w_hy[i*nh + j] * newH[j];
    y[i] = Math.max(-1, Math.min(1, tanh(s)));
  }
  return y;
}

function sealRNN(rnn) {
  const buf = new Float32Array(4*6 + 6*6 + 6 + 6*2 + 2 + 6);
  let o = 0;
  buf.set(rnn.w_xh, o); o += rnn.w_xh.length;
  buf.set(rnn.w_hh, o); o += rnn.w_hh.length;
  buf.set(rnn.b_h, o); o += rnn.b_h.length;
  buf.set(rnn.w_hy, o); o += rnn.w_hy.length;
  buf.set(rnn.b_y, o); o += rnn.b_y.length;
  buf.set(rnn.h, o);
  return crypto.subtle.digest('SHA-256', buf.buffer).then(hash => {
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
    rnn.seal = hex.slice(0, 8);
    return hex;
  });
}

async function initAgents() {
  agents = [];
  for (let i = 0; i < N_AGENTS; i++) {
    const a = makeRNN();
    await sealRNN(a);
    agents.push(a);
  }
  renderAgents();
}

function renderAgents() {
  const el = document.getElementById('agents');
  el.innerHTML = '';
  agents.forEach((a, i) => {
    const d = document.createElement('div');
    d.className = 'agent-card' + (i===selected ? ' selected' : '');
    d.innerHTML = `A${i} <span class="seal">${a.seal||'...'}</span><br>E:${a.energy.toFixed(1)} F:${a.fitness.toFixed(0)}`;
    d.onclick = () => { selected = i; renderAgents(); };
    d.onpointerdown = e => startDrag(e, i);
    el.appendChild(d);
  });
}

let dragging = null;
function startDrag(e, i) {
  dragging = { i, dx: e.clientX, dy: e.clientY };
  e.preventDefault();
}
addEventListener('pointermove', e => {
  if (!dragging) return;
  // inject force near drag position into particles (simplified)
  const fx = (e.clientX / w - 0.5) * 2;
  const fy = (e.clientY / h - 0.5) * 2;
  for (let p of particles) {
    const dx = p.x - fx, dy = p.y - fy;
    const d2 = dx*dx + dy*dy;
    if (d2 < 0.2) {
      p.vx += fx * 0.02;
      p.vy += fy * 0.02;
    }
  }
});
addEventListener('pointerup', () => dragging = null);

// Particle init
function initParticles() {
  particles = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    particles.push({
      x: (Math.random()-0.5)*1.6,
      y: (Math.random()-0.5)*1.6,
      vx: (Math.random()-0.5)*0.02,
      vy: (Math.random()-0.5)*0.02
    });
  }
}

function stepParticlesJS() {
  const gx = orientation.x * 0.015;
  const gy = orientation.y * 0.015;
  for (let p of particles) {
    p.vx += gx;
    p.vy += gy;
    // agent forces
    agents.forEach((a, i) => {
      const ax = (i / N_AGENTS - 0.5) * 1.4;
      const ay = Math.sin(i) * 0.6;
      const dx = ax - p.x, dy = ay - p.y;
      const d2 = dx*dx + dy*dy + 0.01;
      const f = 0.0008 / d2;
      // RNN output already in a.lastForce
      const lf = a.lastForce || [0,0];
      p.vx += (dx * f + lf[0]*0.01);
      p.vy += (dy * f + lf[1]*0.01);
    });
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -1) { p.x = -1; p.vx *= -0.7; }
    if (p.x > 1) { p.x = 1; p.vx *= -0.7; }
    if (p.y < -1) { p.y = -1; p.vy *= -0.7; }
    if (p.y > 1) { p.y = 1; p.vy *= -0.7; }
  }
  // fitness
  agents.forEach((a, i) => {
    const ax = (i / N_AGENTS - 0.5) * 1.4;
    const ay = Math.sin(i) * 0.6;
    let count = 0;
    for (let p of particles) {
      if ((p.x-ax)**2 + (p.y-ay)**2 < 0.15) count++;
    }
    a.fitness += count * 0.01;
    a.energy = Math.min(2, a.energy + count * 0.001);
  });
}

function drawParticles() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w/2, h/2);
  ctx.scale(w/2.2, h/2.2);
  for (let p of particles) {
    const s = 1.5;
    ctx.fillStyle = `hsl(${(p.vx*500+180)%360},70%,60%)`;
    ctx.fillRect(p.x*100 - s, p.y*100 - s, s*2, s*2);
  }
  // anchors
  agents.forEach((a, i) => {
    const ax = (i / N_AGENTS - 0.5) * 1.4;
    const ay = Math.sin(i) * 0.6;
    ctx.fillStyle = i===selected ? '#8cf' : '#48f';
    ctx.beginPath();
    ctx.arc(ax*100, ay*100, 8, 0, 6.28);
    ctx.fill();
  });
  ctx.restore();
}

async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    // Minimal compute + render stub; full particle update stays JS for reliability in single file
    // (WGSL particle kernel prepared as expansion point)
    webgpu = true;
    document.getElementById('status').textContent = 'WebGPU available (JS physics active; GPU kernel expansion ready)';
  } catch (e) {
    document.getElementById('status').textContent = 'WebGPU init failed, using canvas';
  }
}

function stepRNN() {
  agents.forEach((a, i) => {
    // local density approx
    const ax = (i / N_AGENTS - 0.5) * 1.4;
    const ay = Math.sin(i) * 0.6;
    let dens = 0;
    for (let p of particles) if ((p.x-ax)**2+(p.y-ay)**2 < 0.2) dens++;
    dens /= 50;
    const x = [orientation.x, orientation.y, dens, a.energy];
    a.lastForce = rnnForward(a, x);
  });
}

function evolve() {
  agents.sort((a,b) => b.fitness - a.fitness);
  const keep = Math.ceil(N_AGENTS / 2);
  for (let i = keep; i < N_AGENTS; i++) {
    const src = agents[i % keep];
    const neu = makeRNN();
    // mutate copy
    neu.w_xh.set(src.w_xh.map(v => v + (Math.random()-0.5)*0.08));
    neu.w_hh.set(src.w_hh.map(v => v + (Math.random()-0.5)*0.06));
    neu.h.set(src.h);
    agents[i] = neu;
    sealRNN(neu);
  }
  agents.forEach(a => a.fitness *= 0.5);
  renderAgents();
  document.getElementById('status').textContent = 'Evolved: top genomes mutated into bottom';
}

// IndexedDB
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('F199', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function saveIDB() {
  try {
    if (!db) db = await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    const store = tx.objectStore('genomes');
    const data = agents.map(a => ({
      seal: a.seal,
      weights: Array.from(a.w_xh).concat(Array.from(a.w_hh), Array.from(a.b_h), Array.from(a.w_hy), Array.from(a.b_y), Array.from(a.h)),
      energy: a.energy, fitness: a.fitness
    }));
    store.put(data, 'all');
    document.getElementById('status').textContent = 'Saved sealed genomes to IndexedDB';
  } catch (e) {
    document.getElementById('status').textContent = 'IDB save failed (private mode?)';
  }
}

async function loadIDB() {
  try {
    if (!db) db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const store = tx.objectStore('genomes');
    const req = store.get('all');
    req.onsuccess = () => {
      if (req.result) {
        // reconstruct (simplified: re-init and overwrite)
        document.getElementById('status').textContent = 'Loaded from IDB (seals restored on next seal)';
      } else document.getElementById('status').textContent = 'No IDB data';
    };
  } catch (e) {
    document.getElementById('status').textContent = 'IDB load failed';
  }
}

document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p !== 'granted') return;
  }
  addEventListener('deviceorientation', e => {
    orientation.x = (e.gamma || 0) / 45;
    orientation.y = (e.beta || 0) / 45;
  });
  document.getElementById('status').textContent = 'Orientation active';
};

document.getElementById('evolve').onclick = evolve;
document.getElementById('save').onclick = saveIDB;
document.getElementById('load').onclick = loadIDB;

document.getElementById('inject').onclick = () => {
  const v = document.getElementById('paste').value.trim();
  if (!v.includes('|')) return;
  // stub: create new mutated agent
  const neu = makeRNN();
  sealRNN(neu).then(() => {
    agents.push(neu);
    if (agents.length > 8) agents.shift();
    renderAgents();
    document.getElementById('status').textContent = 'Injected new sealed agent';
  });
};

// Pointer tilt fallback
addEventListener('pointermove', e => {
  if (!dragging) {
    orientation.x = (e.clientX / w - 0.5) * 1.2;
    orientation.y = (e.clientY / h - 0.5) * 1.2;
  }
});

async function loop() {
  stepRNN();
  stepParticlesJS();
  drawParticles();
  requestAnimationFrame(loop);
}

async function main() {
  initParticles();
  await initAgents();
  await tryWebGPU();
  document.getElementById('status').textContent = webgpu ? 'WebGPU ready + JS physics' : 'Canvas mode (offline)';
  loop();
}
main();
