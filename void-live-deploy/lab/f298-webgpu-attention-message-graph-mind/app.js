const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const cards = [];
const NUM_CARDS = 5;
let nodes = [];
const MAX_NODES = 48;
let gpuDevice = null;
let gpuContext = null;
let nodeBuffer = null;
let uniformBuffer = null;
let computePipeline = null;
let bindGroup = null;
let useGPU = false;
let pointer = { x: 0, y: 0, down: false, vx: 0, vy: 0 };
let lastX = 0, lastY = 0;
let frame = 0;
let queryEmbed = new Float32Array([0.5, 0.2, -0.1, 0.3]);

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Create DOM concept cards
for (let i = 0; i < NUM_CARDS; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = 'concept';
  el.style.left = (Math.random() * (innerWidth - 100) + 40) + 'px';
  el.style.top = (Math.random() * (innerHeight - 70) + 40) + 'px';
  document.body.appendChild(el);
  cards.push({
    el,
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top),
    vx: 0, vy: 0,
    id: i
  });
}

// Nodes (CPU always, GPU optional)
function spawnNode(x, y) {
  if (nodes.length >= MAX_NODES) nodes.shift();
  nodes.push({
    x, y,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    embed: new Float32Array([Math.random()*0.4-0.2, Math.random()*0.4-0.2, Math.random()*0.4-0.2, Math.random()*0.4-0.2]),
    mag: 0
  });
}
for (let i = 0; i < 24; i++) spawnNode(Math.random()*innerWidth, Math.random()*innerHeight);

async function initWebGPU() {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not available — Canvas2D + CPU message passing';
    return;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no adapter');
    gpuDevice = await adapter.requestDevice();
    gpuContext = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    gpuContext.configure({ device: gpuDevice, format, alphaMode: 'opaque' });

    // Compute: simple residual attention-style update (stub neighborhood)
    const computeShader = gpuDevice.createShaderModule({
      code: `
        struct Node { pos: vec2f, vel: vec2f, embed: vec4f };
        @group(0) @binding(0) var<storage, read_write> nodes: array<Node>;
        @group(0) @binding(1) var<uniform> uni: vec4f; // pointer xy, frame, queryStrength

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3u) {
          let i = gid.x;
          if (i >= arrayLength(&nodes)) { return; }
          var n = nodes[i];
          // Mild residual toward query direction (proxy for attention bias)
          let q = vec4f(0.4, 0.1, -0.2, 0.25);
          n.embed = n.embed * 0.98 + q * 0.02 * uni.w;
          n.vel *= 0.99;
          n.pos += n.vel * 0.5;
          if (n.pos.x < 0.0 || n.pos.x > uni.z) { n.vel.x *= -1.0; }
          if (n.pos.y < 0.0 || n.pos.y > uni.w) { n.vel.y *= -1.0; }
          nodes[i] = n;
        }
      `
    });

    computePipeline = gpuDevice.createComputePipeline({
      layout: 'auto',
      compute: { module: computeShader, entryPoint: 'main' }
    });

    nodeBuffer = gpuDevice.createBuffer({
      size: MAX_NODES * 32, // pos2 + vel2 + embed4 = 8 floats = 32 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    uniformBuffer = gpuDevice.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    bindGroup = gpuDevice.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: nodeBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } }
      ]
    });

    uploadNodes();
    useGPU = true;
    statusEl.textContent = 'WebGPU compute attention kernel active — message-passing graph';
  } catch (e) {
    console.warn(e);
    statusEl.textContent = 'WebGPU init failed — CPU fallback';
    useGPU = false;
  }
}

function uploadNodes() {
  if (!useGPU || !nodeBuffer) return;
  const data = new Float32Array(MAX_NODES * 8);
  nodes.forEach((n, i) => {
    if (i >= MAX_NODES) return;
    data[i*8] = n.x; data[i*8+1] = n.y;
    data[i*8+2] = n.vx; data[i*8+3] = n.vy;
    data[i*8+4] = n.embed[0]; data[i*8+5] = n.embed[1];
    data[i*8+6] = n.embed[2]; data[i*8+7] = n.embed[3];
  });
  gpuDevice.queue.writeBuffer(nodeBuffer, 0, data);
}

function messagePassCPU(queryStrength = 0) {
  // Simple attention-like: each node looks at nearby, residual update toward average + query
  const nextEmbeds = nodes.map(n => new Float32Array(n.embed));
  nodes.forEach((n, i) => {
    let sum = new Float32Array(4);
    let wsum = 0;
    nodes.forEach((m, j) => {
      if (i === j) return;
      const dx = m.x - n.x, dy = m.y - n.y;
      const d2 = dx*dx + dy*dy + 40;
      const att = Math.exp(-d2 / 8000) * (0.5 + queryStrength * 0.5);
      for (let k = 0; k < 4; k++) sum[k] += m.embed[k] * att;
      wsum += att;
    });
    if (wsum > 0.01) {
      for (let k = 0; k < 4; k++) {
        const agg = sum[k] / wsum;
        nextEmbeds[i][k] = n.embed[k] * 0.92 + agg * 0.08 + queryEmbed[k] * queryStrength * 0.04;
      }
    }
    // mild velocity from embed magnitude
    const mag = Math.hypot(...nextEmbeds[i]);
    n.mag = mag;
    n.vx += (nextEmbeds[i][0] - nextEmbeds[i][1]) * 0.02;
    n.vy += (nextEmbeds[i][2] - nextEmbeds[i][3]) * 0.02;
    n.vx *= 0.96; n.vy *= 0.96;
    n.x += n.vx; n.y += n.vy;
    if (n.x < 10 || n.x > innerWidth - 10) n.vx *= -1;
    if (n.y < 10 || n.y > innerHeight - 10) n.vy *= -1;
  });
  nodes.forEach((n, i) => n.embed = nextEmbeds[i]);
}

function stepCards() {
  cards.forEach(c => {
    let fx = 0, fy = 0;
    nodes.forEach(n => {
      if (n.mag > 0.15) {
        const dx = n.x - c.x, dy = n.y - c.y;
        const d2 = dx*dx + dy*dy + 120;
        fx += dx * n.mag / d2 * 60;
        fy += dy * n.mag / d2 * 60;
      }
    });
    const pdx = pointer.x - c.x, pdy = pointer.y - c.y;
    const pd = Math.sqrt(pdx*pdx + pdy*pdy) + 50;
    fx += pdx / pd * 8;
    fy += pdy / pd * 8;
    c.vx += fx * 0.012; c.vy += fy * 0.012;
    c.vx *= 0.9; c.vy *= 0.9;
    c.x += c.vx; c.y += c.vy;
    c.x = Math.max(20, Math.min(innerWidth - 100, c.x));
    c.y = Math.max(20, Math.min(innerHeight - 70, c.y));
    c.el.style.left = c.x + 'px';
    c.el.style.top = c.y + 'px';
    const energy = Math.min(1.4, 0.8 + Math.hypot(c.vx, c.vy) * 0.15);
    c.el.style.transform = `scale(${energy})`;
    c.el.style.opacity = 0.7 + Math.min(0.3, energy * 0.2);
  });
}

function drawCPU() {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#07090d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Edges
  ctx.strokeStyle = '#7af0ff22';
  ctx.lineWidth = 1;
  nodes.forEach((n, i) => {
    nodes.forEach((m, j) => {
      if (j <= i) return;
      const dx = m.x - n.x, dy = m.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d < 140) {
        const a = (1 - d/140) * 0.4 * Math.min(1, (n.mag + m.mag));
        ctx.strokeStyle = `rgba(122,240,255,${a})`;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
      }
    });
  });
  // Nodes
  nodes.forEach(n => {
    const r = 3 + n.mag * 4;
    ctx.fillStyle = `hsla(${200 + n.embed[0]*80}, 80%, 60%, 0.85)`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

async function loop() {
  frame++;
  let qStr = 0;
  if (pointer.down) {
    pointer.vx = pointer.x - lastX;
    pointer.vy = pointer.y - lastY;
    lastX = pointer.x; lastY = pointer.y;
    if (Math.hypot(pointer.vx, pointer.vy) > 2) {
      qStr = 1.2;
      queryEmbed[0] = Math.sin(frame * 0.01) * 0.3;
      queryEmbed[1] = Math.cos(frame * 0.013) * 0.3;
      if (nodes.length < MAX_NODES && Math.random() < 0.08) spawnNode(pointer.x, pointer.y);
    }
  }

  if (useGPU && gpuDevice) {
    const uni = new Float32Array([pointer.x, pointer.y, innerWidth, qStr]);
    gpuDevice.queue.writeBuffer(uniformBuffer, 0, uni);
    const encoder = gpuDevice.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(MAX_NODES / 64));
    pass.end();
    gpuDevice.queue.submit([encoder.finish()]);
    // CPU still drives for hybrid consistency and cards
  }

  messagePassCPU(qStr);
  if (useGPU) uploadNodes();
  stepCards();
  drawCPU(); // always draw for visibility; GPU compute updates embeddings in background

  requestAnimationFrame(loop);
}

// Pointer
canvas.addEventListener('pointerdown', e => {
  pointer.down = true;
  pointer.x = e.clientX; pointer.y = e.clientY;
  lastX = pointer.x; lastY = pointer.y;
  spawnNode(pointer.x, pointer.y);
});
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
});
canvas.addEventListener('pointerup', () => { pointer.down = false; });
canvas.addEventListener('pointerleave', () => { pointer.down = false; });

// Cards draggable for query injection
cards.forEach(c => {
  let dragging = false;
  c.el.addEventListener('pointerdown', e => {
    dragging = true;
    e.stopPropagation();
    c.el.setPointerCapture(e.pointerId);
  });
  c.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    c.x = e.clientX - 44; c.y = e.clientY - 28;
    queryEmbed[2] = (c.x / innerWidth - 0.5) * 0.4;
    queryEmbed[3] = (c.y / innerHeight - 0.5) * 0.4;
  });
  c.el.addEventListener('pointerup', () => { dragging = false; });
});

// IndexedDB
const DB_NAME = 'void-f298-attn-graph';
const STORE = 'graph';
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
    const serial = nodes.map(n => ({ x: n.x, y: n.y, embed: Array.from(n.embed) }));
    tx.objectStore(STORE).put({ nodes: serial, gen: Date.now() }, 'champion');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Sealed graph to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (in-memory)'; }
}
async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('champion');
    req.onsuccess = () => {
      if (req.result && req.result.nodes) {
        nodes = req.result.nodes.map(s => ({
          x: s.x, y: s.y, vx: 0, vy: 0,
          embed: new Float32Array(s.embed),
          mag: 0
        }));
        if (useGPU) uploadNodes();
        statusEl.textContent = 'Loaded sealed graph';
      } else statusEl.textContent = 'No sealed graph';
    };
  } catch (e) { statusEl.textContent = 'Load failed'; }
}
function reset() {
  nodes = [];
  for (let i = 0; i < 20; i++) spawnNode(Math.random()*innerWidth, Math.random()*innerHeight);
  if (useGPU) uploadNodes();
  statusEl.textContent = 'Graph reset';
}

document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;
document.getElementById('reset').onclick = reset;

initWebGPU().then(() => loop());
