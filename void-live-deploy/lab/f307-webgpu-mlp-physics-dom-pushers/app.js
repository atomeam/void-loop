'use strict';
const N = 512; // particles
const AGENTS = 3;
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Tiny MLP: 5 in (beta, gamma, px, py, energy) → 3 out (fx, fy, bias)
class TinyMLP {
  constructor(seed = Math.random()) {
    this.w1 = new Float32Array(5 * 8).map(() => (Math.random() - 0.5) * 0.4);
    this.b1 = new Float32Array(8).fill(0);
    this.w2 = new Float32Array(8 * 3).map(() => (Math.random() - 0.5) * 0.3);
    this.b2 = new Float32Array(3).fill(0);
    this.fitness = 0;
    this.energy = 1;
  }
  forward(x) { // x: Float32Array[5]
    const h = new Float32Array(8);
    for (let i = 0; i < 8; i++) {
      let s = this.b1[i];
      for (let j = 0; j < 5; j++) s += x[j] * this.w1[j * 8 + i];
      h[i] = Math.tanh(s);
    }
    const o = new Float32Array(3);
    for (let i = 0; i < 3; i++) {
      let s = this.b2[i];
      for (let j = 0; j < 8; j++) s += h[j] * this.w2[j * 3 + i];
      o[i] = Math.tanh(s);
    }
    return o;
  }
  mutate(rate = 0.08) {
    const m = new TinyMLP();
    m.w1 = this.w1.map(v => v + (Math.random() - 0.5) * rate);
    m.b1 = this.b1.map(v => v + (Math.random() - 0.5) * rate * 0.5);
    m.w2 = this.w2.map(v => v + (Math.random() - 0.5) * rate);
    m.b2 = this.b2.map(v => v + (Math.random() - 0.5) * rate * 0.5);
    return m;
  }
  serialize() { return { w1: Array.from(this.w1), b1: Array.from(this.b1), w2: Array.from(this.w2), b2: Array.from(this.b2) }; }
  static deserialize(o) {
    const m = new TinyMLP();
    m.w1.set(o.w1); m.b1.set(o.b1); m.w2.set(o.w2); m.b2.set(o.b2);
    return m;
  }
}

const agents = Array.from({length: AGENTS}, () => new TinyMLP());
let champ = 0;
let gen = 0;

// Orientation
let orient = { beta: 0, gamma: 0 };
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.beta = (e.beta || 0) / 90;
    orient.gamma = (e.gamma || 0) / 90;
  });
}

// Pointer
let pointer = { x: 0.5, y: 0.5 };
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
});

// Particles CPU fallback / WebGPU state
let particles = Array.from({length: N}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2
}));

// DOM cards (hybrid)
const cards = [];
for (let i = 0; i < 4; i++) {
  const c = document.createElement('div');
  c.className = 'card';
  c.textContent = 'C' + i;
  c.style.left = (20 + i * 18) + '%';
  c.style.top = (30 + (i % 2) * 20) + '%';
  c.dataset.i = i;
  document.body.appendChild(c);
  cards.push({ el: c, x: parseFloat(c.style.left), y: parseFloat(c.style.top), vx: 0, vy: 0, claim: -1 });
  // drag
  let drag = false, ox, oy;
  c.addEventListener('pointerdown', e => { drag = true; ox = e.clientX; oy = e.clientY; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - ox) / W * 100, dy = (e.clientY - oy) / H * 100;
    cards[i].x = Math.max(5, Math.min(90, cards[i].x + dx));
    cards[i].y = Math.max(5, Math.min(90, cards[i].y + dy));
    ox = e.clientX; oy = e.clientY;
  });
  c.addEventListener('pointerup', () => { drag = false; });
}

// WebGPU setup
let gpu = null, device, pipeline, posBuf, velBuf, forceUniform, readBuf;
async function initWebGPU() {
  if (!navigator.gpu) { document.getElementById('status').textContent = 'No WebGPU — CPU fallback'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    const shader = `
      struct Particle { pos: vec2<f32>, vel: vec2<f32> };
      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<uniform> force: vec4<f32>; // fx,fy,bias,dt
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        if (i >= ${N}u) { return; }
        var p = particles[i];
        let f = force.xy * 0.15 + vec2<f32>(force.z * 0.05, force.z * 0.03);
        p.vel = p.vel * 0.98 + f;
        p.pos = p.pos + p.vel;
        // bounds
        if (p.pos.x < 0.0 || p.pos.x > 1.0) { p.vel.x *= -0.8; p.pos.x = clamp(p.pos.x, 0.0, 1.0); }
        if (p.pos.y < 0.0 || p.pos.y > 1.0) { p.vel.y *= -0.8; p.pos.y = clamp(p.pos.y, 0.0, 1.0); }
        particles[i] = p;
      }
    `;
    const module = device.createShaderModule({ code: shader });
    pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    // buffers
    const data = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      data[i*4] = Math.random(); data[i*4+1] = Math.random();
      data[i*4+2] = (Math.random()-0.5)*0.01; data[i*4+3] = (Math.random()-0.5)*0.01;
    }
    posBuf = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, mappedAtCreation: true });
    new Float32Array(posBuf.getMappedRange()).set(data); posBuf.unmap();
    forceUniform = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    readBuf = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    gpu = { device, pipeline, posBuf, forceUniform, readBuf };
    document.getElementById('status').textContent = 'WebGPU compute active';
    document.getElementById('mP').textContent = N;
  } catch (e) {
    document.getElementById('status').textContent = 'WebGPU init failed — CPU';
  }
}
initWebGPU();

// IndexedDB
let db;
const req = indexedDB.open('f307-mlp', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
req.onsuccess = e => { db = e.target.result; loadChamp(); };
function sealChamp() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(agents[champ].serialize(), 'champ');
  document.getElementById('status').textContent = 'Champion sealed to IndexedDB';
}
function loadChamp() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const g = tx.objectStore('genomes').get('champ');
  g.onsuccess = () => {
    if (g.result) {
      agents[0] = TinyMLP.deserialize(g.result);
      document.getElementById('status').textContent = 'Loaded sealed champion';
    }
  };
}

// Step
let frame = 0, fieldEnergy = 0.5;
async function step() {
  // inputs
  const inp = new Float32Array([orient.beta, orient.gamma, pointer.x * 2 - 1, pointer.y * 2 - 1, fieldEnergy]);
  // agents forward, pick best by recent fitness (simple)
  let best = 0, bestF = -Infinity;
  agents.forEach((a, i) => {
    const o = a.forward(inp);
    a._out = o;
    a.fitness = a.fitness * 0.995 + Math.abs(o[0]) + Math.abs(o[1]) * 0.5; // dummy engagement
    if (a.fitness > bestF) { bestF = a.fitness; best = i; }
  });
  champ = best;
  const force = agents[champ]._out;

  // update physics
  if (gpu) {
    // upload force
    const fdata = new Float32Array([force[0], force[1], force[2], 0.016]);
    gpu.device.queue.writeBuffer(gpu.forceUniform, 0, fdata);
    const enc = gpu.device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(gpu.pipeline);
    const bg = gpu.device.createBindGroup({ layout: gpu.pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: gpu.posBuf } },
      { binding: 1, resource: { buffer: gpu.forceUniform } }
    ]});
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(N / 64));
    pass.end();
    // readback occasionally
    if (frame % 4 === 0) {
      enc.copyBufferToBuffer(gpu.posBuf, 0, gpu.readBuf, 0, N * 16);
    }
    gpu.device.queue.submit([enc.finish()]);
    if (frame % 4 === 0) {
      await gpu.readBuf.mapAsync(GPUMapMode.READ);
      const view = new Float32Array(gpu.readBuf.getMappedRange());
      for (let i = 0; i < N; i++) {
        particles[i].x = view[i*4] * W;
        particles[i].y = view[i*4+1] * H;
        particles[i].vx = view[i*4+2];
        particles[i].vy = view[i*4+3];
      }
      gpu.readBuf.unmap();
    }
  } else {
    // CPU
    particles.forEach(p => {
      p.vx = p.vx * 0.98 + force[0] * 0.15;
      p.vy = p.vy * 0.98 + force[1] * 0.15;
      p.x += p.vx * 60; p.y += p.vy * 60;
      if (p.x < 0 || p.x > W) p.vx *= -0.8;
      if (p.y < 0 || p.y > H) p.vy *= -0.8;
      p.x = Math.max(0, Math.min(W, p.x));
      p.y = Math.max(0, Math.min(H, p.y));
    });
  }

  // field energy from particle spread
  let cx = 0, cy = 0;
  particles.forEach(p => { cx += p.x; cy += p.y; });
  cx /= N; cy /= N;
  let varx = 0;
  particles.forEach(p => varx += (p.x - cx)**2);
  fieldEnergy = Math.min(1, Math.sqrt(varx / N) / 200);

  // push cards by nearby particles
  cards.forEach((c, i) => {
    let fx = 0, fy = 0, cnt = 0;
    particles.forEach(p => {
      const dx = (c.x / 100 * W - p.x), dy = (c.y / 100 * H - p.y);
      const d2 = dx*dx + dy*dy;
      if (d2 < 80*80) { fx += p.vx; fy += p.vy; cnt++; }
    });
    if (cnt) {
      c.vx = c.vx * 0.9 + fx / cnt * 0.05;
      c.vy = c.vy * 0.9 + fy / cnt * 0.05;
      c.x = Math.max(5, Math.min(90, c.x + c.vx * 0.3));
      c.y = Math.max(5, Math.min(90, c.y + c.vy * 0.3));
    }
    c.el.style.left = c.x + '%';
    c.el.style.top = c.y + '%';
    c.el.classList.toggle('claimed', i === champ % cards.length);
  });

  // render
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7cf';
  particles.forEach(p => {
    ctx.globalAlpha = 0.6;
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  });
  ctx.globalAlpha = 1;

  // HUD
  if (frame % 10 === 0) {
    document.getElementById('mF').textContent = agents[champ].fitness.toFixed(2);
    document.getElementById('mG').textContent = gen;
  }
  frame++;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Controls
document.getElementById('bReward').onclick = () => {
  agents.forEach(a => a.fitness += 0.5);
  gen++;
};
document.getElementById('bSeal').onclick = sealChamp;
document.getElementById('bSpawn').onclick = () => {
  const off = agents[champ].mutate();
  agents[(champ + 1) % AGENTS] = off;
  document.getElementById('status').textContent = 'Offspring spawned from champion';
};
document.getElementById('bReset').onclick = () => {
  agents.forEach((_, i) => agents[i] = new TinyMLP());
  gen = 0;
  document.getElementById('status').textContent = 'Reset agents';
};
