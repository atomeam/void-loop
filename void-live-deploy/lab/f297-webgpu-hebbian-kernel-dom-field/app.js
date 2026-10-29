const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const orbs = [];
const NUM_ORBS = 6;
let particles = [];
const NUM_PARTICLES = 120;
let weights = new Float32Array(16 * 16); // 16x16 association grid, CPU mirror
let gpuDevice = null;
let gpuContext = null;
let particleBuffer = null;
let weightBuffer = null;
let uniformBuffer = null;
let computePipeline = null;
let renderPipeline = null;
let bindGroup = null;
let useGPU = false;
let pointer = { x: 0, y: 0, down: false, vx: 0, vy: 0 };
let lastX = 0, lastY = 0;
let frame = 0;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Create DOM orbs
for (let i = 0; i < NUM_ORBS; i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = '•';
  el.style.left = (Math.random() * (innerWidth - 80) + 40) + 'px';
  el.style.top = (Math.random() * (innerHeight - 80) + 40) + 'px';
  document.body.appendChild(el);
  orbs.push({
    el,
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top),
    vx: 0, vy: 0,
    id: i
  });
}

// Particles (CPU always, GPU optional)
for (let i = 0; i < NUM_PARTICLES; i++) {
  particles.push({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2
  });
}

// Initialize weights randomly small
for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.1;

async function initWebGPU() {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not available — Canvas2D + CPU Hebbian';
    return;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no adapter');
    gpuDevice = await adapter.requestDevice();
    gpuContext = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    gpuContext.configure({ device: gpuDevice, format, alphaMode: 'opaque' });

    // Simple compute: update particles toward weighted regions (stub)
    const computeShader = gpuDevice.createShaderModule({
      code: `
        struct Particle { pos: vec2f, vel: vec2f };
        @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
        @group(0) @binding(1) var<storage, read> weights: array<f32>;
        @group(0) @binding(2) var<uniform> uni: vec4f; // pointer xy, frame, teach

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3u) {
          let i = gid.x;
          if (i >= arrayLength(&particles)) { return; }
          var p = particles[i];
          // Sample nearest weight cell as mild attractor bias
          let gx = i32(clamp(p.pos.x / uni.z, 0.0, 15.0));
          let gy = i32(clamp(p.pos.y / uni.w, 0.0, 15.0));
          let w = weights[gy * 16 + gx];
          p.vel += vec2f(w * 0.02, w * 0.01);
          p.vel *= 0.98;
          p.pos += p.vel;
          // Bounds
          if (p.pos.x < 0.0 || p.pos.x > uni.z) { p.vel.x *= -1.0; }
          if (p.pos.y < 0.0 || p.pos.y > uni.w) { p.vel.y *= -1.0; }
          particles[i] = p;
        }
      `
    });

    computePipeline = gpuDevice.createComputePipeline({
      layout: 'auto',
      compute: { module: computeShader, entryPoint: 'main' }
    });

    // Buffers
    particleBuffer = gpuDevice.createBuffer({
      size: NUM_PARTICLES * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    weightBuffer = gpuDevice.createBuffer({
      size: weights.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    uniformBuffer = gpuDevice.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    bindGroup = gpuDevice.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: weightBuffer } },
        { binding: 2, resource: { buffer: uniformBuffer } }
      ]
    });

    // Upload initial
    const pData = new Float32Array(NUM_PARTICLES * 4);
    particles.forEach((p, i) => {
      pData[i*4] = p.x; pData[i*4+1] = p.y; pData[i*4+2] = p.vx; pData[i*4+3] = p.vy;
    });
    gpuDevice.queue.writeBuffer(particleBuffer, 0, pData);
    gpuDevice.queue.writeBuffer(weightBuffer, 0, weights);

    useGPU = true;
    statusEl.textContent = 'WebGPU compute kernel active — Hebbian field learning';
  } catch (e) {
    console.warn(e);
    statusEl.textContent = 'WebGPU init failed — CPU fallback';
    useGPU = false;
  }
}

function hebbianUpdate(x, y, strength) {
  const gx = Math.floor(Math.max(0, Math.min(15, x / innerWidth * 16)));
  const gy = Math.floor(Math.max(0, Math.min(15, y / innerHeight * 16)));
  const idx = gy * 16 + gx;
  // Local Hebbian: strengthen association with motion direction proxy
  const dir = Math.atan2(pointer.vy, pointer.vx);
  weights[idx] += strength * 0.05 * Math.cos(dir);
  // Decay neighbors slightly
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const n = (gy + dy) * 16 + (gx + dx);
      if (n >= 0 && n < weights.length && n !== idx) weights[n] *= 0.995;
    }
  }
  if (useGPU && weightBuffer) {
    gpuDevice.queue.writeBuffer(weightBuffer, 0, weights);
  }
}

function stepCPU() {
  // Apply field to particles
  particles.forEach(p => {
    const gx = Math.floor(Math.max(0, Math.min(15, p.x / innerWidth * 16)));
    const gy = Math.floor(Math.max(0, Math.min(15, p.y / innerHeight * 16)));
    const w = weights[gy * 16 + gx];
    p.vx += w * 0.03;
    p.vy += w * 0.02;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > innerWidth) p.vx *= -1;
    if (p.y < 0 || p.y > innerHeight) p.vy *= -1;
  });

  // Orbs attracted to high-weight regions + mild repulsion
  orbs.forEach(o => {
    let fx = 0, fy = 0;
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        const w = weights[j * 16 + i];
        if (Math.abs(w) > 0.05) {
          const tx = (i + 0.5) / 16 * innerWidth;
          const ty = (j + 0.5) / 16 * innerHeight;
          const dx = tx - o.x, dy = ty - o.y;
          const d2 = dx*dx + dy*dy + 100;
          fx += dx * w / d2 * 80;
          fy += dy * w / d2 * 80;
        }
      }
    }
    // Pointer influence
    const pdx = pointer.x - o.x, pdy = pointer.y - o.y;
    const pd = Math.sqrt(pdx*pdx + pdy*pdy) + 40;
    fx += pdx / pd * 12;
    fy += pdy / pd * 12;
    o.vx += fx * 0.01; o.vy += fy * 0.01;
    o.vx *= 0.92; o.vy *= 0.92;
    o.x += o.vx; o.y += o.vy;
    o.x = Math.max(20, Math.min(innerWidth - 60, o.x));
    o.y = Math.max(20, Math.min(innerHeight - 60, o.y));
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
    const mag = Math.hypot(o.vx, o.vy);
    o.el.style.transform = `scale(${1 + mag * 0.02})`;
    o.el.textContent = mag > 1.5 ? '⚡' : '•';
  });
}

function drawCPU() {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Draw weight field as faint grid
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      const w = weights[j * 16 + i];
      const a = Math.min(0.4, Math.abs(w) * 2);
      ctx.fillStyle = w > 0 ? `rgba(92,225,230,${a})` : `rgba(255,107,157,${a})`;
      ctx.fillRect(i / 16 * canvas.width, j / 16 * canvas.height, canvas.width / 16, canvas.height / 16);
    }
  }
  // Particles
  ctx.fillStyle = '#5ce1e688';
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

async function loop() {
  frame++;
  if (pointer.down) {
    pointer.vx = pointer.x - lastX;
    pointer.vy = pointer.y - lastY;
    lastX = pointer.x; lastY = pointer.y;
    if (Math.hypot(pointer.vx, pointer.vy) > 1) hebbianUpdate(pointer.x, pointer.y, 1.0);
  }

  if (useGPU && gpuDevice) {
    const uni = new Float32Array([pointer.x, pointer.y, innerWidth, innerHeight]);
    gpuDevice.queue.writeBuffer(uniformBuffer, 0, uni);
    const encoder = gpuDevice.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(NUM_PARTICLES / 64));
    pass.end();
    gpuDevice.queue.submit([encoder.finish()]);
    // Note: for full readback we'd map buffer; here CPU orbs still driven by mirrored weights
  }

  stepCPU();
  if (!useGPU) drawCPU();
  else {
    // Simple clear + let CSS orbs shine; optional future render pipeline
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0c10cc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCPU(); // hybrid overlay for now
    }
  }

  requestAnimationFrame(loop);
}

// Pointer
canvas.addEventListener('pointerdown', e => {
  pointer.down = true;
  pointer.x = e.clientX; pointer.y = e.clientY;
  lastX = pointer.x; lastY = pointer.y;
  hebbianUpdate(pointer.x, pointer.y, 2.0); // strong teach on click
});
canvas.addEventListener('pointermove', e => {
  if (!pointer.down) {
    pointer.x = e.clientX; pointer.y = e.clientY;
  } else {
    pointer.x = e.clientX; pointer.y = e.clientY;
  }
});
canvas.addEventListener('pointerup', () => { pointer.down = false; });
canvas.addEventListener('pointerleave', () => { pointer.down = false; });

// Orbs draggable for extra teaching
orbs.forEach(o => {
  let dragging = false;
  o.el.addEventListener('pointerdown', e => {
    dragging = true;
    e.stopPropagation();
    o.el.setPointerCapture(e.pointerId);
  });
  o.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    o.x = e.clientX - 36; o.y = e.clientY - 36;
    hebbianUpdate(o.x, o.y, 1.5);
  });
  o.el.addEventListener('pointerup', () => { dragging = false; });
});

// IndexedDB
const DB_NAME = 'void-f297-hebbian';
const STORE = 'weights';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ weights: Array.from(weights), gen: Date.now() }, 'champion');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (in-memory)'; }
}
async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('champion');
    req.onsuccess = () => {
      if (req.result && req.result.weights) {
        weights = new Float32Array(req.result.weights);
        if (useGPU && weightBuffer) gpuDevice.queue.writeBuffer(weightBuffer, 0, weights);
        statusEl.textContent = 'Loaded sealed weights';
      } else statusEl.textContent = 'No sealed weights';
    };
  } catch (e) { statusEl.textContent = 'Load failed'; }
}
function reset() {
  for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.05;
  if (useGPU && weightBuffer) gpuDevice.queue.writeBuffer(weightBuffer, 0, weights);
  statusEl.textContent = 'Weights reset';
}

document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;
document.getElementById('reset').onclick = reset;

initWebGPU().then(() => loop());
