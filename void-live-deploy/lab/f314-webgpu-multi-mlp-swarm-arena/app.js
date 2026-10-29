const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const fitnessEl = document.getElementById('fitness');
const hashEl = document.getElementById('hash');
const exportTa = document.getElementById('export');

let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 4;
const N_PER = 96;
const TOTAL = N_AGENTS * N_PER;
const COLORS = ['#ff6b6b','#4ecdc4','#ffe66d','#a29bfe'];

let genomes = [];
let fitness = new Array(N_AGENTS).fill(0);
let bestIdx = 0;
let resources = [];
let pointer = {x: W/2, y: H/2};
let orient = {beta: 0, gamma: 0};

// Simple MLP 4→6→2
function createGenome() {
  const w1 = Array.from({length: 4*6}, () => (Math.random()-0.5)*1.2);
  const b1 = Array.from({length: 6}, () => (Math.random()-0.5)*0.5);
  const w2 = Array.from({length: 6*2}, () => (Math.random()-0.5)*1.2);
  const b2 = Array.from({length: 2}, () => (Math.random()-0.5)*0.5);
  return {w1, b1, w2, b2};
}
function mlpForward(g, x) { // x len 4
  const h = new Array(6).fill(0);
  for (let i=0; i<6; i++) {
    let s = g.b1[i];
    for (let j=0; j<4; j++) s += g.w1[i*4+j] * x[j];
    h[i] = Math.tanh(s);
  }
  const o = new Array(2).fill(0);
  for (let i=0; i<2; i++) {
    let s = g.b2[i];
    for (let j=0; j<6; j++) s += g.w2[i*6+j] * h[j];
    o[i] = Math.tanh(s) * 0.8;
  }
  return o;
}
function mutate(g, rate=0.15) {
  const ng = JSON.parse(JSON.stringify(g));
  const keys = ['w1','b1','w2','b2'];
  keys.forEach(k => {
    for (let i=0; i<ng[k].length; i++) {
      if (Math.random() < rate) ng[k][i] += (Math.random()-0.5)*0.4;
    }
  });
  return ng;
}

for (let i=0; i<N_AGENTS; i++) genomes.push(createGenome());

// Particles
let particles = [];
function initParticles() {
  particles = [];
  for (let a=0; a<N_AGENTS; a++) {
    for (let i=0; i<N_PER; i++) {
      particles.push({
        agent: a,
        x: Math.random()*W, y: Math.random()*H,
        vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2
      });
    }
  }
}
initParticles();

// WebGPU setup
let gpuDevice = null;
let gpuBuffer = null;
let forceBuffer = null;
let pipeline = null;
let bindGroup = null;
let useGPU = false;

async function initWebGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'WebGPU not available — Canvas2D fallback'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no adapter');
    gpuDevice = await adapter.requestDevice();
    const shader = `
      struct Particle { x: f32, y: f32, vx: f32, vy: f32, agent: f32 };
      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<storage, read> forces: array<vec2f>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) gid: vec3u) {
        let i = gid.x;
        if (i >= ${TOTAL}) { return; }
        var p = particles[i];
        let a = u32(p.agent);
        let f = forces[a];
        p.vx += f.x * 0.15;
        p.vy += f.y * 0.15;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0.0 || p.x > ${W}.0) { p.vx *= -0.8; p.x = clamp(p.x, 0.0, ${W}.0); }
        if (p.y < 0.0 || p.y > ${H}.0) { p.vy *= -0.8; p.y = clamp(p.y, 0.0, ${H}.0); }
        particles[i] = p;
      }
    `;
    const module = gpuDevice.createShaderModule({ code: shader });
    pipeline = gpuDevice.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    // Buffers
    const particleData = new Float32Array(TOTAL * 5);
    gpuBuffer = gpuDevice.createBuffer({
      size: particleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    forceBuffer = gpuDevice.createBuffer({
      size: N_AGENTS * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    bindGroup = gpuDevice.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gpuBuffer } },
        { binding: 1, resource: { buffer: forceBuffer } }
      ]
    });
    useGPU = true;
    statusEl.textContent = 'WebGPU compute active — multi-MLP swarm competition';
    uploadParticles();
  } catch (e) {
    console.warn(e);
    statusEl.textContent = 'WebGPU init failed — Canvas2D fallback';
  }
}
function uploadParticles() {
  if (!useGPU) return;
  const data = new Float32Array(TOTAL * 5);
  particles.forEach((p, i) => {
    data[i*5] = p.x; data[i*5+1] = p.y; data[i*5+2] = p.vx; data[i*5+3] = p.vy; data[i*5+4] = p.agent;
  });
  gpuDevice.queue.writeBuffer(gpuBuffer, 0, data);
}
async function readbackParticles() {
  if (!useGPU) return;
  const staging = gpuDevice.createBuffer({
    size: TOTAL * 20,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  const enc = gpuDevice.createCommandEncoder();
  enc.copyBufferToBuffer(gpuBuffer, 0, staging, 0, TOTAL * 20);
  gpuDevice.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(staging.getMappedRange());
  particles.forEach((p, i) => {
    p.x = data[i*5]; p.y = data[i*5+1]; p.vx = data[i*5+2]; p.vy = data[i*5+3];
  });
  staging.unmap();
}

// IndexedDB
let db;
const req = indexedDB.open('void-f314', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('genomes', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; };
function seal() {
  if (!db) return;
  const g = genomes[bestIdx];
  const json = JSON.stringify(g);
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(json)).then(buf => {
    const hash = Array.from(new Uint8Array(buf)).slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({id:'champ', genome:g, fitness:fitness[bestIdx], hash, ts:Date.now()});
    hashEl.textContent = 'Sealed: ' + hash;
    exportTa.value = JSON.stringify({hash, genome:g, fitness:fitness[bestIdx]});
  });
}
function loadSealed() {
  if (!db) return;
  const tx = db.transaction('genomes');
  tx.objectStore('genomes').get('champ').onsuccess = e => {
    if (e.target.result) {
      genomes[bestIdx] = e.target.result.genome;
      hashEl.textContent = 'Loaded: ' + e.target.result.hash;
    }
  };
}

// Events
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('click', e => {
  resources.push({x: e.clientX, y: e.clientY, life: 300});
  if (resources.length > 8) resources.shift();
});
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}
document.getElementById('evolve').onclick = () => {
  // Mutate non-best from best
  for (let i=0; i<N_AGENTS; i++) if (i !== bestIdx) genomes[i] = mutate(genomes[bestIdx]);
  statusEl.textContent = 'Mutated offspring from champion';
};
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = loadSealed;
document.getElementById('inject').onclick = () => {
  try {
    const data = JSON.parse(exportTa.value);
    if (data.genome) {
      genomes[0] = data.genome;
      statusEl.textContent = 'Injected genome into agent 0';
    }
  } catch(e) {}
};

function computeSwarmStats() {
  const stats = Array.from({length:N_AGENTS}, () => ({sx:0,sy:0,svx:0,svy:0,n:0}));
  particles.forEach(p => {
    const s = stats[p.agent];
    s.sx += p.x; s.sy += p.y; s.svx += p.vx; s.svy += p.vy; s.n++;
  });
  stats.forEach(s => {
    if (s.n) { s.sx/=s.n; s.sy/=s.n; s.svx/=s.n; s.svy/=s.n; }
  });
  return stats;
}

function stepCPU() {
  const stats = computeSwarmStats();
  const forces = new Array(N_AGENTS);
  for (let a=0; a<N_AGENTS; a++) {
    const s = stats[a];
    const input = [
      (s.sx - W/2)/W,
      (s.sy - H/2)/H,
      (pointer.x - s.sx)/W,
      (pointer.y - s.sy)/H
    ];
    // optional orient bias
    input[0] += orient.gamma * 0.005;
    input[1] += orient.beta * 0.005;
    forces[a] = mlpForward(genomes[a], input);
  }
  // Apply forces + simple cohesion/repulsion
  particles.forEach(p => {
    const f = forces[p.agent];
    p.vx += f[0] * 0.2;
    p.vy += f[1] * 0.2;
    // cohesion to own mean
    const s = stats[p.agent];
    p.vx += (s.sx - p.x) * 0.001;
    p.vy += (s.sy - p.y) * 0.001;
    // resource attraction
    resources.forEach(r => {
      const dx = r.x - p.x, dy = r.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      p.vx += dx / d2 * 8;
      p.vy += dy / d2 * 8;
    });
    p.vx *= 0.97; p.vy *= 0.97;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) { p.vx *= -0.7; p.x = Math.max(0, Math.min(W, p.x)); }
    if (p.y < 0 || p.y > H) { p.vy *= -0.7; p.y = Math.max(0, Math.min(H, p.y)); }
  });
  // Fitness: cohesion + resource proximity
  fitness.fill(0);
  particles.forEach(p => {
    const s = stats[p.agent];
    const coh = 1 / (1 + Math.hypot(p.x-s.sx, p.y-s.sy)/50);
    let prox = 0;
    resources.forEach(r => prox += 1 / (1 + Math.hypot(p.x-r.x, p.y-r.y)/40));
    fitness[p.agent] += coh + prox;
  });
  bestIdx = fitness.indexOf(Math.max(...fitness));
  resources.forEach(r => r.life--);
  resources = resources.filter(r => r.life > 0);
}

async function stepGPU() {
  if (!useGPU) { stepCPU(); return; }
  const stats = computeSwarmStats();
  const forceData = new Float32Array(N_AGENTS * 2);
  for (let a=0; a<N_AGENTS; a++) {
    const s = stats[a];
    const input = [(s.sx-W/2)/W, (s.sy-H/2)/H, (pointer.x-s.sx)/W, (pointer.y-s.sy)/H];
    input[0] += orient.gamma * 0.005;
    input[1] += orient.beta * 0.005;
    const f = mlpForward(genomes[a], input);
    forceData[a*2] = f[0]; forceData[a*2+1] = f[1];
  }
  gpuDevice.queue.writeBuffer(forceBuffer, 0, forceData);
  const enc = gpuDevice.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(TOTAL/64));
  pass.end();
  gpuDevice.queue.submit([enc.finish()]);
  // Occasional readback for fitness and render
  if (Math.random() < 0.1) await readbackParticles();
  // Simple fitness from last known positions
  fitness.fill(0);
  particles.forEach(p => {
    const s = stats[p.agent];
    fitness[p.agent] += 1 / (1 + Math.hypot(p.x-s.sx, p.y-s.sy)/60);
  });
  bestIdx = fitness.indexOf(Math.max(...fitness));
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  // resources
  ctx.fillStyle = '#fff';
  resources.forEach(r => {
    ctx.beginPath(); ctx.arc(r.x, r.y, 6, 0, Math.PI*2); ctx.fill();
  });
  // particles
  particles.forEach(p => {
    ctx.fillStyle = COLORS[p.agent];
    ctx.beginPath(); ctx.arc(p.x, p.y, p.agent === bestIdx ? 3.5 : 2.2, 0, Math.PI*2); ctx.fill();
  });
  // pointer
  ctx.strokeStyle = '#888';
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI*2); ctx.stroke();
}

let last = 0;
async function loop(t) {
  if (t - last > 16) {
    if (useGPU) await stepGPU(); else stepCPU();
    render();
    fitnessEl.innerHTML = fitness.map((f,i) => 
      `<span class="swarm" style="background:${COLORS[i]}"></span>${f.toFixed(1)}`
    ).join(' &nbsp; ') + ` &nbsp; champ: ${bestIdx}`;
    last = t;
  }
  requestAnimationFrame(loop);
}

initWebGPU().then(() => requestAnimationFrame(loop));
