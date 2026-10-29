const canvas = document.getElementById('c');
const gl = canvas.getContext('webgpu');
let device, context, format, pipeline, bindGroup, uniformBuffer, particleBuffer;
const N = 1024; // particles representing hypervector projections
let particles = new Float32Array(N * 4); // x,y,z,assoc
const cards = [];
let memory = new Map(); // concept -> hypervector (simplified 32-dim binary-ish)
const DIM = 32;

function randHV() {
  const v = new Float32Array(DIM);
  for (let i=0; i<DIM; i++) v[i] = Math.random() > 0.5 ? 1 : -1;
  return v;
}

function bind(a, b) {
  const v = new Float32Array(DIM);
  for (let i=0; i<DIM; i++) v[i] = a[i] * b[i]; // XOR-like for bipolar
  return v;
}

function similarity(a, b) {
  let s = 0;
  for (let i=0; i<DIM; i++) s += a[i] * b[i];
  return s / DIM;
}

async function initGPU() {
  if (!navigator.gpu) { document.getElementById('status').textContent = 'WebGPU not available — Canvas fallback'; return; }
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const shader = `
    @group(0) @binding(0) var<storage, read> particles: array<vec4f>;
    @vertex fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
      let p = particles[vi];
      return vec4f(p.xy * 0.8, p.z, 1.0);
    }
    @fragment fn fs() -> @location(0) vec4f { return vec4f(0.4, 0.7, 1.0, 0.8); }
  `;
  const module = device.createShaderModule({ code: shader });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'point-list' }
  });

  particleBuffer = device.createBuffer({ size: particles.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: particleBuffer } }]
  });

  // init particles
  for (let i=0; i<N; i++) {
    particles[i*4] = (Math.random()-0.5)*2;
    particles[i*4+1] = (Math.random()-0.5)*2;
    particles[i*4+2] = (Math.random()-0.5)*0.5;
    particles[i*4+3] = 0;
  }
  device.queue.writeBuffer(particleBuffer, 0, particles);
}

function updateParticles() {
  // project memory associations into spatial clusters
  let idx = 0;
  memory.forEach((hv, concept) => {
    const simBase = similarity(hv, randHV()); // dummy
    for (let k=0; k<8 && idx<N; k++, idx++) {
      const ang = (idx / N) * Math.PI * 2;
      particles[idx*4] = Math.cos(ang) * (0.3 + simBase*0.4);
      particles[idx*4+1] = Math.sin(ang) * (0.3 + simBase*0.4);
      particles[idx*4+2] = (Math.random()-0.5)*0.3;
    }
  });
  // fill rest with noise
  while (idx < N) {
    particles[idx*4] = (Math.random()-0.5)*1.8;
    particles[idx*4+1] = (Math.random()-0.5)*1.8;
    particles[idx*4+2] = (Math.random()-0.5)*0.4;
    idx++;
  }
  if (device) device.queue.writeBuffer(particleBuffer, 0, particles);
}

function spawnCard(concept, x, y) {
  const card = document.createElement('div');
  card.className = 'card';
  card.textContent = concept;
  card.style.left = (x * 40 + 50) + '%';
  card.style.top = (y * 40 + 50) + '%';
  card.draggable = true;
  card.onpointerdown = (e) => { /* reinforce */ };
  document.body.appendChild(card);
  cards.push(card);
}

document.getElementById('bind').onclick = () => {
  const c = document.getElementById('concept').value.trim();
  if (!c) return;
  if (!memory.has(c)) memory.set(c, randHV());
  // bind to a random existing or self
  const keys = [...memory.keys()];
  if (keys.length > 1) {
    const other = keys[Math.floor(Math.random()*keys.length)];
    if (other !== c) memory.set(c, bind(memory.get(c), memory.get(other)));
  }
  updateParticles();
  spawnCard(c, Math.random()-0.5, Math.random()-0.5);
  document.getElementById('status').textContent = `Bound "${c}" — ${memory.size} concepts in palace`;
};

document.getElementById('seal').onclick = () => {
  const data = { memory: Object.fromEntries([...memory].map(([k,v]) => [k, Array.from(v)])) };
  localStorage.setItem('f450-hdc', JSON.stringify(data));
  document.getElementById('status').textContent = 'Sealed to localStorage';
};

document.getElementById('load').onclick = () => {
  const raw = localStorage.getItem('f450-hdc');
  if (raw) {
    const data = JSON.parse(raw);
    memory = new Map(Object.entries(data.memory).map(([k,v]) => [k, new Float32Array(v)]));
    updateParticles();
    document.getElementById('status').textContent = `Loaded ${memory.size} concepts`;
  }
};

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

async function frame() {
  if (device && context) {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r:0.05, g:0.05, b:0.1, a:1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(N);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  requestAnimationFrame(frame);
}

initGPU().then(() => frame());
