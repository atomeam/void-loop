const canvas = document.getElementById('canvas');
const hudEnergy = document.getElementById('energy');
const hudGen = document.getElementById('gen');
const hudStatus = document.getElementById('status');
const probesEl = document.getElementById('probes');
const sealBtn = document.getElementById('seal-btn');

let device, context, format, pipeline, bindGroup, uniformBuffer, stateBufferA, stateBufferB;
let gridW = 128, gridH = 128;
let step = 0;
let energy = 0;
let generation = 0;
let seeds = [];

async function initWebGPU() {
  if (!navigator.gpu) {
    hudStatus.textContent = 'WebGPU unsupported — Canvas2D fallback';
    initFallback();
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { initFallback(); return; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const shader = `
    @group(0) @binding(0) var<storage, read> stateIn: array<f32>;
    @group(0) @binding(1) var<storage, read_write> stateOut: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4f; // dt, seedX, seedY, energyBias

    fn hash(p: vec2f) -> f32 {
      return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
    }

    @compute @workgroup_size(8, 8)
    fn main(@builtin(global_invocation_id) gid: vec3u) {
      let w = 128u;
      let h = 128u;
      let x = gid.x;
      let y = gid.y;
      if (x >= w || y >= h) { return; }
      let i = y * w + x;
      let c = stateIn[i];

      // simple NCA-like: neighbor average + reaction
      var sum = 0.0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          let nx = (x + u32(dx + w)) % w;
          let ny = (y + u32(dy + h)) % h;
          sum += stateIn[ny * w + nx];
        }
      }
      let avg = sum / 9.0;
      let reaction = sin(avg * 3.14159 * 2.0 + params.z) * 0.15;
      var next = mix(c, avg, 0.35) + reaction * params.x;

      // seed deposit
      let dxs = f32(x) - params.y;
      let dys = f32(y) - params.w;
      let dist = length(vec2f(dxs, dys));
      if (dist < 4.0) {
        next = mix(next, 1.0, 0.4);
      }

      stateOut[i] = clamp(next, 0.0, 1.0);
    }
  `;

  const module = device.createShaderModule({ code: shader });
  pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' }
  });

  const size = gridW * gridH * 4;
  stateBufferA = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  stateBufferB = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  // init random state
  const initData = new Float32Array(gridW * gridH);
  for (let i = 0; i < initData.length; i++) initData[i] = Math.random() * 0.3;
  device.queue.writeBuffer(stateBufferA, 0, initData);

  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: stateBufferA } },
      { binding: 1, resource: { buffer: stateBufferB } },
      { binding: 2, resource: { buffer: uniformBuffer } }
    ]
  });

  hudStatus.textContent = 'WebGPU NCA running';
  requestAnimationFrame(frame);
}

function frame() {
  step++;
  if (!device) return;
  const seed = seeds[seeds.length - 1] || {x: gridW/2, y: gridH/2};
  const params = new Float32Array([0.8, seed.x, seed.y, energy * 0.5]);
  device.queue.writeBuffer(uniformBuffer, 0, params);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(gridW/8), Math.ceil(gridH/8));
  pass.end();
  device.queue.submit([encoder.finish()]);

  // swap
  [stateBufferA, stateBufferB] = [stateBufferB, stateBufferA];
  // recreate bindGroup for swap (simplified; in real would double-buffer properly)
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: stateBufferA } },
      { binding: 1, resource: { buffer: stateBufferB } },
      { binding: 2, resource: { buffer: uniformBuffer } }
    ]
  });

  // sample energy (approx by reading back periodically — simplified here)
  if (step % 10 === 0) {
    energy = 0.3 + Math.sin(step * 0.02) * 0.2 + Math.random() * 0.1;
    hudEnergy.textContent = energy.toFixed(2);
    document.documentElement.style.setProperty('--hue', (energy * 360) % 360);
    document.documentElement.style.setProperty('--scale', 1 + energy * 0.05);
    document.documentElement.style.setProperty('--blur', (energy * 2) + 'px');
    document.documentElement.style.setProperty('--light', (15 + energy * 20) + '%');
  }

  // draw to canvas via copy or simple render (omitted full render for brevity; use clear + overlay)
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: energy*0.2, g: 0.1, b: 0.3, a: 1 },
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  renderPass.end();
  device.queue.submit([encoder.finish()]);

  requestAnimationFrame(frame);
}

function initFallback() {
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 512;
  function draw() {
    ctx.fillStyle = `hsl(${(energy*360)%360}, 50%, 20%)`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    // simple particle fallback
    requestAnimationFrame(draw);
  }
  draw();
}

// interaction
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * gridW;
  const y = ((e.clientY - rect.top) / rect.height) * gridH;
  seeds.push({x, y});
  if (seeds.length > 8) seeds.shift();
  // spawn probe
  const probe = document.createElement('div');
  probe.className = 'probe';
  probe.style.left = e.clientX + 'px';
  probe.style.top = e.clientY + 'px';
  probe.onclick = () => sealPattern({x, y, energy, t: Date.now()});
  probesEl.appendChild(probe);
  setTimeout(() => probe.remove(), 4000);
});

// worker for mind / evolution
const workerCode = `
let gen = 0;
self.onmessage = (e) => {
  gen++;
  const fitness = e.data.energy || 0;
  // simple hill-climb on a "rule bias"
  const bias = (Math.random() - 0.5) * 0.1 + fitness * 0.05;
  self.postMessage({ gen, bias, fitness });
};
`;
const worker = new Worker(URL.createObjectURL(new Blob([workerCode])));
worker.onmessage = (e) => {
  generation = e.data.gen;
  hudGen.textContent = generation;
  // apply bias somehow (stored)
};
setInterval(() => worker.postMessage({ energy }), 1000);

async function sealPattern(data) {
  const id = 'nca-' + Date.now();
  const record = { id, ...data, sealed: true };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f313-nca', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('patterns', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('patterns', 'readwrite');
    tx.objectStore('patterns').put(record);
    hudStatus.textContent = 'sealed ' + id.slice(-6);
  } catch (err) {
    hudStatus.textContent = 'seal failed (no IDB)';
  }
}

sealBtn.onclick = () => sealPattern({ energy, gen: generation, seeds: seeds.length, t: Date.now() });

// orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta) {
      document.documentElement.style.setProperty('--hue', ((e.beta + 90) * 2) % 360);
    }
  });
}

initWebGPU();
