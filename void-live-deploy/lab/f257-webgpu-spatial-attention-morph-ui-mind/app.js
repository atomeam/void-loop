const W = 8, H = 6, N = W * H, D = 16, HEADS = 2;
const cards = [];
let embeddings = new Float32Array(N * D);
let fitness = new Float32Array(N);
let query = new Float32Array(D);
let attn = new Float32Array(N);
let pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0 };
let gpu = null, device = null, pipeline = null, bindGroup = null;
let buffers = {};
let lastSeal = 0;
const statusEl = document.getElementById('status');

function initEmbeddings() {
  for (let i = 0; i < embeddings.length; i++) embeddings[i] = (Math.random() - 0.5) * 0.4;
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function sealChampion() {
  let best = 0, bestF = -1;
  for (let i = 0; i < N; i++) if (fitness[i] > bestF) { bestF = fitness[i]; best = i; }
  const slice = embeddings.slice(best * D, (best + 1) * D);
  const json = JSON.stringify({ emb: Array.from(slice), fitness: bestF, ts: Date.now() });
  const hash = hashStr(json);
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f257-mind', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ json, hash }, 'champion');
    await new Promise(r => tx.oncomplete = r);
    const bc = new BroadcastChannel('f257-seals');
    bc.postMessage({ json, hash });
    statusEl.textContent = `Sealed #${best} hash:${hash.slice(0,8)}`;
  } catch (e) {
    statusEl.textContent = 'Seal in-memory only';
  }
}

async function loadSeal() {
  try {
    const db = await new Promise((res) => {
      const r = indexedDB.open('f257-mind', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
    if (!db) return;
    const tx = db.transaction('seals', 'readonly');
    const req = tx.objectStore('seals').get('champion');
    await new Promise(r => req.onsuccess = r);
    if (req.result) {
      const data = JSON.parse(req.result.json);
      let worst = 0, worstF = Infinity;
      for (let i = 0; i < N; i++) if (fitness[i] < worstF) { worstF = fitness[i]; worst = i; }
      for (let j = 0; j < D; j++) embeddings[worst * D + j] = data.emb[j] || 0;
      statusEl.textContent = 'Loaded sealed genome';
    }
  } catch {}
}

function mutate() {
  for (let i = 0; i < N; i++) {
    if (Math.random() < 0.15) {
      for (let j = 0; j < D; j++) embeddings[i * D + j] += (Math.random() - 0.5) * 0.08;
    }
  }
  for (let i = 0; i < N; i++) fitness[i] *= 0.92;
}

function jsAttention() {
  const scale = 1 / Math.sqrt(D);
  let maxS = -Infinity, sum = 0;
  const scores = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = 0; j < D; j++) s += embeddings[i * D + j] * query[j];
    scores[i] = s * scale;
    if (scores[i] > maxS) maxS = scores[i];
  }
  for (let i = 0; i < N; i++) {
    scores[i] = Math.exp(scores[i] - maxS);
    sum += scores[i];
  }
  for (let i = 0; i < N; i++) attn[i] = scores[i] / (sum || 1);
}

async function setupGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read> embeddings: array<f32>;
        @group(0) @binding(1) var<storage, read> query: array<f32>;
        @group(0) @binding(2) var<storage, read_write> attn: array<f32>;
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
          let i = gid.x;
          if (i >= ${N}u) { return; }
          var s = 0.0;
          for (var j = 0u; j < ${D}u; j++) {
            s += embeddings[i * ${D}u + j] * query[j];
          }
          attn[i] = s / ${Math.sqrt(D)};
        }
      `
    });
    pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    buffers.emb = device.createBuffer({ size: embeddings.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    buffers.q = device.createBuffer({ size: query.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    buffers.a = device.createBuffer({ size: attn.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    buffers.read = device.createBuffer({ size: attn.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers.emb } },
        { binding: 1, resource: { buffer: buffers.q } },
        { binding: 2, resource: { buffer: buffers.a } }
      ]
    });
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

async function gpuAttention() {
  if (!device) return jsAttention();
  device.queue.writeBuffer(buffers.emb, 0, embeddings);
  device.queue.writeBuffer(buffers.q, 0, query);
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(N / 64));
  pass.end();
  enc.copyBufferToBuffer(buffers.a, 0, buffers.read, 0, attn.byteLength);
  device.queue.submit([enc.finish()]);
  await buffers.read.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(buffers.read.getMappedRange());
  attn.set(data);
  buffers.read.unmap();
  let maxS = -Infinity, sum = 0;
  for (let i = 0; i < N; i++) if (attn[i] > maxS) maxS = attn[i];
  for (let i = 0; i < N; i++) { attn[i] = Math.exp(attn[i] - maxS); sum += attn[i]; }
  for (let i = 0; i < N; i++) attn[i] /= sum || 1;
}

function updateQuery() {
  query.fill(0);
  query[0] = pointer.x * 2 - 1;
  query[1] = pointer.y * 2 - 1;
  query[2] = pointer.dx * 4;
  query[3] = pointer.dy * 4;
  query[4] = Math.hypot(pointer.dx, pointer.dy);
  for (let i = 5; i < D; i++) query[i] = (Math.random() - 0.5) * 0.05;
}

function positionCards() {
  const energy = attn.reduce((a, b) => a + b * b, 0);
  const entropy = -attn.reduce((a, p) => a + (p > 1e-6 ? p * Math.log(p) : 0), 0) / Math.log(N);
  document.documentElement.style.setProperty('--attn-energy', Math.min(1, energy * 8).toFixed(3));
  document.documentElement.style.setProperty('--attn-entropy', entropy.toFixed(3));

  cards.forEach((card, i) => {
    const tx = (i % W) / (W - 1);
    const ty = Math.floor(i / W) / (H - 1);
    const a = attn[i];
    const px = (tx * 0.7 + 0.15 + (pointer.x - 0.5) * a * 0.3) * window.innerWidth;
    const py = (ty * 0.6 + 0.2 + (pointer.y - 0.5) * a * 0.25) * window.innerHeight;
    const sc = 0.6 + a * 2.2;
    const rot = (a - 0.5) * 30;
    card.style.transform = `translate(${px - 36}px, ${py - 36}px) scale(${sc}) rotate(${rot}deg)`;
    card.style.opacity = 0.45 + a * 0.55;
    card.classList.toggle('high', a > 0.12);
    card.textContent = `#${i}\n${a.toFixed(2)}`;
    const dist = Math.hypot(pointer.x - tx, pointer.y - ty);
    if (dist < 0.18 && a > 0.08) fitness[i] += 0.15;
  });
}

function drawOverlay() {
  const c = document.getElementById('overlay');
  c.width = window.innerWidth; c.height = window.innerHeight;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < N; i++) {
    const tx = (i % W) / (W - 1);
    const ty = Math.floor(i / W) / (H - 1);
    const x = (tx * 0.7 + 0.15) * c.width;
    const y = (ty * 0.6 + 0.2) * c.height;
    ctx.fillStyle = `rgba(100,180,255,${0.2 + attn[i] * 0.8})`;
    ctx.beginPath();
    ctx.arc(x, y, 4 + attn[i] * 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,180,100,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pointer.x * c.width, pointer.y * c.height);
  ctx.lineTo(pointer.x * c.width + pointer.dx * 80, pointer.y * c.height + pointer.dy * 80);
  ctx.stroke();
}

async function loop() {
  updateQuery();
  if (gpu) await gpuAttention(); else jsAttention();
  positionCards();
  drawOverlay();
  if (Date.now() - lastSeal > 7000) {
    mutate();
    lastSeal = Date.now();
  }
  requestAnimationFrame(loop);
}

async function init() {
  initEmbeddings();
  const root = document.body;
  for (let i = 0; i < N; i++) {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = `#${i}`;
    card.onclick = () => { fitness[i] += 1.2; statusEl.textContent = `Clicked #${i} +fitness`; };
    root.appendChild(card);
    cards.push(card);
  }
  gpu = await setupGPU();
  statusEl.textContent = gpu ? 'WebGPU attention active' : 'JS attention fallback';
  await loadSeal();
  const bc = new BroadcastChannel('f257-seals');
  bc.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data.json);
      let worst = 0, wf = Infinity;
      for (let i = 0; i < N; i++) if (fitness[i] < wf) { wf = fitness[i]; worst = i; }
      for (let j = 0; j < D; j++) embeddings[worst * D + j] = data.emb[j] || 0;
      statusEl.textContent = 'Received peer genome';
    } catch {}
  };
  document.getElementById('seal').onclick = sealChampion;
  document.getElementById('reset').onclick = () => { initEmbeddings(); fitness.fill(0); statusEl.textContent = 'Reset'; };
  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX / window.innerWidth, ny = e.clientY / window.innerHeight;
    pointer.dx = nx - pointer.x; pointer.dy = ny - pointer.y;
    pointer.x = nx; pointer.y = ny;
  });
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    pointer.x = 0.5 + (e.gamma || 0) / 90 * 0.4;
    pointer.y = 0.5 + (e.beta || 0) / 90 * 0.3;
  });
  lastSeal = Date.now();
  loop();
}
init();
