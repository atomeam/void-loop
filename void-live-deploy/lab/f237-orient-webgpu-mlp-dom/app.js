const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const orientEl = document.getElementById('orient');
const agentsEl = document.getElementById('agents');
const N = 4096;
const AGENT_COUNT = 4;

let device, context, pipeline, bindGroup, particleBuffer, uniformBuffer;
let particles = new Float32Array(N * 4); // x,y,vx,vy
let gravity = { x: 0, y: 0.0002 };
let agents = [];
let sealed = null;

class TinyMLP {
  constructor() {
    // 2-in (orient delta), 4-hidden, 2-out (force offset)
    this.w1 = Array.from({length: 8}, () => Math.random()*0.4-0.2);
    this.b1 = Array.from({length: 4}, () => Math.random()*0.2-0.1);
    this.w2 = Array.from({length: 8}, () => Math.random()*0.4-0.2);
    this.b2 = Array.from({length: 2}, () => Math.random()*0.2-0.1);
  }
  forward(dx, dy) {
    const h = [];
    for (let i = 0; i < 4; i++) {
      let s = this.b1[i] + this.w1[i*2]*dx + this.w1[i*2+1]*dy;
      h.push(Math.tanh(s));
    }
    const out = [];
    for (let i = 0; i < 2; i++) {
      let s = this.b2[i];
      for (let j = 0; j < 4; j++) s += this.w2[i*4+j] * h[j];
      out.push(Math.tanh(s) * 0.0004);
    }
    return out;
  }
  genome() { return { w1: this.w1.slice(), b1: this.b1.slice(), w2: this.w2.slice(), b2: this.b2.slice() }; }
  load(g) { this.w1 = g.w1; this.b1 = g.b1; this.w2 = g.w2; this.b2 = g.b2; }
  mutate(rate=0.15) {
    const mut = a => a.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = mut(this.w1); this.b1 = mut(this.b1);
    this.w2 = mut(this.w2); this.b2 = mut(this.b2);
  }
}

function initAgents() {
  agents = [];
  for (let i = 0; i < AGENT_COUNT; i++) {
    const a = {
      id: i,
      color: `hsl(${i*90},70%,60%)`,
      mlp: new TinyMLP(),
      score: 0,
      center: { x: 0.25 + (i%2)*0.5, y: 0.25 + Math.floor(i/2)*0.5 },
      active: i === 0
    };
    agents.push(a);
  }
  renderAgents();
}

function renderAgents() {
  agentsEl.innerHTML = agents.map(a => `
    <div class="agent ${a.active?'active':''}" data-id="${a.id}">
      Agent ${a.id} <span class="score">${a.score.toFixed(0)}</span>
      <div style="font-size:0.7rem;color:#888">center ${(a.center.x*100|0)}%,${(a.center.y*100|0)}%</div>
    </div>
  `).join('');
  agentsEl.querySelectorAll('.agent').forEach(el => {
    el.onclick = () => {
      agents.forEach(a => a.active = false);
      agents[+el.dataset.id].active = true;
      renderAgents();
    };
  });
}

async function initWebGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'WebGPU not available'; return false; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { statusEl.textContent = 'No GPU adapter'; return false; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const shader = device.createShaderModule({
    code: `
      struct Particle { pos: vec2f, vel: vec2f };
      struct Uniforms { gravity: vec2f, time: f32, pad: f32 };
      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<uniform> uni: Uniforms;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3u) {
        let i = id.x;
        if (i >= ${N}) { return; }
        var p = particles[i];
        p.vel += uni.gravity * 0.016;
        // soft bounds
        if (p.pos.x < 0.0 || p.pos.x > 1.0) { p.vel.x *= -0.6; p.pos.x = clamp(p.pos.x, 0.0, 1.0); }
        if (p.pos.y < 0.0 || p.pos.y > 1.0) { p.vel.y *= -0.6; p.pos.y = clamp(p.pos.y, 0.0, 1.0); }
        p.pos += p.vel;
        p.vel *= 0.995;
        particles[i] = p;
      }
    `
  });

  pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'main' }
  });

  particleBuffer = device.createBuffer({
    size: particles.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });
  uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } }
    ]
  });

  // init particles
  for (let i = 0; i < N; i++) {
    particles[i*4] = Math.random();
    particles[i*4+1] = Math.random();
    particles[i*4+2] = (Math.random()-0.5)*0.002;
    particles[i*4+3] = (Math.random()-0.5)*0.002;
  }
  device.queue.writeBuffer(particleBuffer, 0, particles);
  statusEl.textContent = 'WebGPU compute ready · tilt or drag';
  return true;
}

let lastOrient = { x: 0, y: 0 };
let time = 0;

function step() {
  if (!device) return;
  time += 0.016;
  // apply agent MLPs to gravity offset for their cluster (simplified: global + active agent)
  const active = agents.find(a => a.active) || agents[0];
  const dx = gravity.x - lastOrient.x;
  const dy = gravity.y - lastOrient.y;
  const force = active.mlp.forward(dx * 1000, dy * 1000);
  const g = { x: gravity.x + force[0], y: gravity.y + force[1] };

  const uni = new Float32Array([g.x, g.y, time, 0]);
  device.queue.writeBuffer(uniformBuffer, 0, uni);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(N / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);

  // score: rough density near agent centers (readback every few frames is expensive; approximate client-side)
  if (Math.floor(time*60) % 30 === 0) {
    // simple client score from last known (not full readback)
    agents.forEach(a => {
      let s = 0;
      for (let i = 0; i < Math.min(256, N); i++) {
        const px = particles[i*4], py = particles[i*4+1];
        const d = Math.hypot(px - a.center.x, py - a.center.y);
        if (d < 0.15) s += 1;
      }
      a.score = a.score * 0.95 + s * 0.05;
    });
    renderAgents();
  }
  lastOrient = { ...gravity };
  requestAnimationFrame(step);
}

// Orientation
window.addEventListener('deviceorientation', e => {
  if (e.beta == null) return;
  // beta: -180..180 front-back, gamma: left-right
  gravity.x = (e.gamma || 0) * 0.00001;
  gravity.y = (e.beta || 0) * 0.00001;
  orientEl.textContent = `α:${(e.alpha||0)|0} β:${(e.beta||0)|0} γ:${(e.gamma||0)|0}`;
});

// Mouse drag as fallback orientation
let dragging = false;
canvas.addEventListener('pointerdown', () => dragging = true);
canvas.addEventListener('pointerup', () => dragging = false);
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  gravity.x = ((e.clientX - r.left) / r.width - 0.5) * 0.0004;
  gravity.y = ((e.clientY - r.top) / r.height - 0.5) * 0.0004;
  orientEl.textContent = `drag x:${gravity.x.toFixed(5)} y:${gravity.y.toFixed(5)}`;
});

document.getElementById('seal').onclick = async () => {
  const top = agents.slice().sort((a,b) => b.score - a.score)[0];
  sealed = { id: top.id, genome: top.mlp.genome(), score: top.score, t: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f237', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(sealed, 'last');
    statusEl.textContent = `Sealed Agent ${top.id} genome (score ${top.score.toFixed(0)})`;
    // transfer: mutate into others
    agents.forEach(a => { if (a.id !== top.id) a.mlp.load(top.mlp.genome()); a.mlp.mutate(0.2); });
  } catch (e) {
    statusEl.textContent = 'IndexedDB seal failed (in-memory only)';
  }
};

document.getElementById('reset').onclick = () => {
  initAgents();
  for (let i = 0; i < N; i++) {
    particles[i*4] = Math.random();
    particles[i*4+1] = Math.random();
  }
  if (device) device.queue.writeBuffer(particleBuffer, 0, particles);
  statusEl.textContent = 'Reset';
};

(async () => {
  initAgents();
  const ok = await initWebGPU();
  if (ok) {
    // try load seal
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('f237', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej();
      });
      const tx = db.transaction('seals', 'readonly');
      const req = tx.objectStore('seals').get('last');
      req.onsuccess = () => {
        if (req.result) {
          sealed = req.result;
          agents[0].mlp.load(sealed.genome);
          statusEl.textContent += ' · restored sealed genome';
        }
      };
    } catch {}
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    // simple render loop using 2D fallback overlay? For pure compute we need a render pass; for demo use CPU points on a 2D overlay or note.
    // Add a 2D canvas overlay for visibility
    const overlay = document.createElement('canvas');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    document.body.appendChild(overlay);
    const octx = overlay.getContext('2d');
    function render2d() {
      overlay.width = window.innerWidth;
      overlay.height = window.innerHeight;
      octx.clearRect(0,0,overlay.width,overlay.height);
      octx.fillStyle = '#6cf';
      // sample points (full readback too slow; use last written particles which we don't update client-side fully)
      // For demo, animate client-side approximation
      for (let i = 0; i < 400; i++) {
        const x = particles[i*4] * overlay.width;
        const y = particles[i*4+1] * overlay.height;
        octx.fillRect(x, y, 2, 2);
      }
      // agent wells
      agents.forEach(a => {
        octx.strokeStyle = a.color;
        octx.beginPath();
        octx.arc(a.center.x*overlay.width, a.center.y*overlay.height, 40, 0, Math.PI*2);
        octx.stroke();
      });
      requestAnimationFrame(render2d);
    }
    render2d();
    step();
  }
})();
