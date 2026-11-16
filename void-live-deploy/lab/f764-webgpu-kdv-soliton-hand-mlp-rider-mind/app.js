const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const N = 256;
const dt = 0.08;
const dx = 1;
let u = new Float32Array(N);
let uNext = new Float32Array(N);
let riders = [];
let bestWeights = null;
let frame = 0;
let gpu = null;
let orient = { beta: 0, gamma: 0 };
let handX = -1;
let pointerX = N/2;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Simple MLP
function createMLP() {
  const w1 = Array.from({length:6*4}, () => (Math.random()-0.5)*0.8);
  const b1 = Array.from({length:4}, () => (Math.random()-0.5)*0.2);
  const w2 = Array.from({length:4*2}, () => (Math.random()-0.5)*0.8);
  const b2 = Array.from({length:2}, () => (Math.random()-0.5)*0.2);
  return { w1, b1, w2, b2 };
}
function forward(m, inp) {
  const h = new Array(4).fill(0);
  for (let i=0;i<4;i++) {
    let s = m.b1[i];
    for (let j=0;j<6;j++) s += inp[j] * m.w1[j*4 + i];
    h[i] = Math.tanh(s);
  }
  const o = new Array(2).fill(0);
  for (let i=0;i<2;i++) {
    let s = m.b2[i];
    for (let j=0;j<4;j++) s += h[j] * m.w2[j*2 + i];
    o[i] = Math.tanh(s);
  }
  return o;
}
function cloneWeights(m) { return { w1:[...m.w1], b1:[...m.b1], w2:[...m.w2], b2:[...m.b2] }; }

function initWave() {
  for (let i=0;i<N;i++) u[i] = 0;
  // small seed
  const c = N/2;
  for (let i=-8;i<=8;i++) {
    const idx = (c+i+N)%N;
    u[idx] += 0.6 * Math.exp(-i*i/12);
  }
}

function inject(x, amp=1.2) {
  const i0 = Math.floor(x) % N;
  for (let k=-6;k<=6;k++) {
    const i = (i0 + k + N) % N;
    u[i] += amp * Math.exp(-k*k/8);
  }
}

// Finite-difference KdV step (periodic)
function stepKdV() {
  const uu = u;
  for (let i=0;i<N;i++) {
    const im = uu[(i-1+N)%N];
    const ip = uu[(i+1)%N];
    const imm = uu[(i-2+N)%N];
    const ipp = uu[(i+2)%N];
    const ux = (ip - im) / (2*dx);
    const uxxx = (ipp - 2*ip + 2*im - imm) / (2*dx*dx*dx);
    const ut = -uu[i]*ux - uxxx;
    uNext[i] = uu[i] + dt * ut;
  }
  // soft clamp
  for (let i=0;i<N;i++) u[i] = Math.max(-2, Math.min(4, uNext[i]));
}

// WebGPU path (optional, falls back silently)
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const shader = `
      @group(0) @binding(0) var<storage, read> u : array<f32>;
      @group(0) @binding(1) var<storage, read_write> uNext : array<f32>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
        let i = gid.x;
        if (i >= ${N}u) { return; }
        let N = ${N}u;
        let im = u[(i + N - 1u) % N];
        let ip = u[(i + 1u) % N];
        let imm = u[(i + N - 2u) % N];
        let ipp = u[(i + 2u) % N];
        let ux = (ip - im) * 0.5;
        let uxxx = (ipp - 2.0*ip + 2.0*im - imm) * 0.5;
        let ut = -u[i]*ux - uxxx;
        uNext[i] = clamp(u[i] + ${dt} * ut, -2.0, 4.0);
      }
    `;
    const module = device.createShaderModule({ code: shader });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    const bufU = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const bufNext = device.createBuffer({ size: N*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const bind = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufU } },
        { binding: 1, resource: { buffer: bufNext } }
      ]
    });
    gpu = { device, pipeline, bufU, bufNext, bind };
    statusEl.textContent += ' · WebGPU KdV kernel ready';
  } catch(e) { console.warn(e); }
}

async function gpuStep() {
  if (!gpu) { stepKdV(); return; }
  const { device, pipeline, bufU, bufNext, bind } = gpu;
  device.queue.writeBuffer(bufU, 0, u);
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.dispatchWorkgroups(Math.ceil(N/64));
  pass.end();
  enc.copyBufferToBuffer(bufNext, 0, bufU, 0, N*4);
  device.queue.submit([enc.finish()]);
  await device.queue.onSubmittedWorkDone();
  const staging = device.createBuffer({ size: N*4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const enc2 = device.createCommandEncoder();
  enc2.copyBufferToBuffer(bufU, 0, staging, 0, N*4);
  device.queue.submit([enc2.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  u.set(new Float32Array(staging.getMappedRange()));
  staging.unmap();
}

function spawnRiders() {
  riders = [];
  for (let i=0;i<5;i++) {
    const el = document.createElement('div');
    el.className = 'rider';
    el.textContent = 'R'+(i+1);
    document.body.appendChild(el);
    const m = bestWeights ? cloneWeights(bestWeights) : createMLP();
    riders.push({ el, mlp: m, x: 40 + i*40, fitness: 0, best: false });
  }
}

function updateRiders() {
  let maxF = -Infinity, bestIdx = 0;
  riders.forEach((r, idx) => {
    const ix = Math.floor(r.x) % N;
    const h = u[ix];
    const slope = (u[(ix+1)%N] - u[(ix-1+N)%N]) * 0.5;
    const hDist = handX < 0 ? 1 : Math.abs(r.x - handX)/N;
    const inp = [h*0.5, slope, orient.beta/90, orient.gamma/90, hDist, Math.min(1, r.fitness*0.01)];
    const out = forward(r.mlp, inp);
    const bias = out[0] * 1.8;
    const gain = 0.6 + out[1]*0.4;
    // advect roughly with local "velocity" (negative slope for rightward solitons)
    r.x = (r.x - slope * 2.2 * gain + bias + N) % N;
    r.fitness += Math.max(0, h) * 0.02;
    if (r.fitness > maxF) { maxF = r.fitness; bestIdx = idx; }
    // position
    const px = (r.x / N) * canvas.width;
    const py = canvas.height * 0.55 - h * 80;
    r.el.style.left = px + 'px';
    r.el.style.top = py + 'px';
    r.el.style.transform = `translate(-50%,-100%) scale(${0.8 + Math.max(0,h)*0.3})`;
  });
  riders.forEach((r,i) => {
    r.best = i === bestIdx;
    r.el.classList.toggle('best', r.best);
  });
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.beginPath();
  ctx.strokeStyle = '#7af';
  ctx.lineWidth = 2;
  const baseY = canvas.height * 0.55;
  for (let i=0;i<N;i++) {
    const x = (i / N) * canvas.width;
    const y = baseY - u[i] * 80;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  // markers
  ctx.fillStyle = '#fff';
  riders.forEach(r => {
    const x = (r.x / N) * canvas.width;
    const y = baseY - u[Math.floor(r.x)%N] * 80;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI*2);
    ctx.fill();
  });
}

async function loop() {
  frame++;
  if (gpu) await gpuStep(); else stepKdV();
  updateRiders();
  draw();
  if (frame % 60 === 0) {
    const best = riders.reduce((a,b)=>a.fitness>b.fitness?a:b);
    statusEl.textContent = `Solitons live · Best fitness ${best.fitness.toFixed(1)} · ${gpu?'WebGPU':'JS'} · ${handX>=0?'hand':'pointer'}`;
  }
  requestAnimationFrame(loop);
}

// Persistence
const DB_NAME = 'verse-f764-kdv';
function saveBest() {
  const best = riders.reduce((a,b)=>a.fitness>b.fitness?a:b);
  bestWeights = cloneWeights(best.mlp);
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(bestWeights, 'best');
  };
  // transfer to others
  riders.forEach(r => { if (!r.best) r.mlp = cloneWeights(bestWeights); });
  statusEl.textContent = 'Sealed & transferred best genome';
}
function loadBest() {
  return new Promise(res => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes','readonly');
      const get = tx.objectStore('genomes').get('best');
      get.onsuccess = () => { bestWeights = get.result || null; res(); };
      get.onerror = () => res();
    };
    req.onerror = () => res();
  });
}

// Input
canvas.addEventListener('pointermove', e => {
  pointerX = (e.clientX / canvas.width) * N;
  handX = pointerX;
  if (e.buttons) inject(pointerX, 0.4);
});
canvas.addEventListener('pointerdown', e => {
  pointerX = (e.clientX / canvas.width) * N;
  inject(pointerX, 1.4);
});
document.getElementById('seal').onclick = saveBest;
document.getElementById('reset').onclick = () => { initWave(); riders.forEach(r=>r.fitness=0); };

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// WebXR hand (best-effort)
async function tryXR() {
  if (!navigator.xr) return;
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if (!supported) return;
    statusEl.textContent += ' · WebXR available (enter VR for hands)';
    // For prototype we keep inline/pointer; full session left as extension
  } catch (e) { console.debug("lab f764-webgpu-kdv-soliton-hand-mlp-rider-mind:", e); }
}

// Boot
(async () => {
  await loadBest();
  initWave();
  spawnRiders();
  await tryWebGPU();
  await tryXR();
  statusEl.textContent = 'Soliton riders ready — move pointer to inject waves';
  loop();
})();
