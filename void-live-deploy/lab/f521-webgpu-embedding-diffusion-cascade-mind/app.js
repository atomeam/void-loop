const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const W = 64, H = 36, DIM = 4;
let device, pipeline, bindGroup, embBuf, nextBuf, paramsBuf, queryBuf;
let embeddings = new Float32Array(W * H * DIM);
let query = new Float32Array(DIM).fill(0.5);
let weights = new Float32Array(16); // 4x4 mix
let portals = [];
let gpuReady = false;

function initEmbeddings() {
  for (let i = 0; i < embeddings.length; i++) embeddings[i] = (Math.random() - 0.5) * 0.2;
}

async function initGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'WebGPU not available'; return; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { statusEl.textContent = 'No GPU adapter'; return; }
  device = await adapter.requestDevice();
  const shader = `
    @group(0) @binding(0) var<storage, read> emb: array<vec4f>;
    @group(0) @binding(1) var<storage, read_write> next: array<vec4f>;
    @group(0) @binding(2) var<uniform> params: vec4f; // w,h, mixScale, _
    @group(0) @binding(3) var<storage, read> mix: array<f32>; // 16 weights
    @compute @workgroup_size(8,8)
    fn main(@builtin(global_invocation_id) gid: vec3u) {
      let x = gid.x; let y = gid.y;
      if (x >= u32(params.x) || y >= u32(params.y)) { return; }
      let idx = y * u32(params.x) + x;
      var sum = emb[idx];
      var cnt = 1.0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) { continue; }
          let nx = i32(x) + dx; let ny = i32(y) + dy;
          if (nx >= 0 && nx < i32(params.x) && ny >= 0 && ny < i32(params.y)) {
            sum += emb[ny * i32(params.x) + nx];
            cnt += 1.0;
          }
        }
      }
      sum /= cnt;
      // residual mix
      var m = vec4f(0);
      for (var i = 0u; i < 4u; i++) {
        for (var j = 0u; j < 4u; j++) {
          m[i] += mix[i*4 + j] * sum[j];
        }
      }
      next[idx] = normalize(sum + m * params.z * 0.1) * 0.8;
    }
  `;
  const module = device.createShaderModule({ code: shader });
  pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  embBuf = device.createBuffer({ size: embeddings.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  nextBuf = device.createBuffer({ size: embeddings.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const mixBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: embBuf } },
      { binding: 1, resource: { buffer: nextBuf } },
      { binding: 2, resource: { buffer: paramsBuf } },
      { binding: 3, resource: { buffer: mixBuf } }
    ]
  });
  // init random weights
  for (let i = 0; i < 16; i++) weights[i] = (Math.random() - 0.5) * 0.4;
  device.queue.writeBuffer(mixBuf, 0, weights);
  gpuReady = true;
  statusEl.textContent = 'WebGPU ready – embedding cascade active';
}

function step() {
  if (!gpuReady) return;
  device.queue.writeBuffer(embBuf, 0, embeddings);
  const params = new Float32Array([W, H, 1.0, 0]);
  device.queue.writeBuffer(paramsBuf, 0, params);
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8));
  pass.end();
  enc.copyBufferToBuffer(nextBuf, 0, embBuf, 0, embeddings.byteLength);
  device.queue.submit([enc.finish()]);
  // read back occasionally for portals (simplified; in real would use mapAsync)
  // for demo, approximate on CPU sometimes
}

function render() {
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth; canvas.height = innerHeight;
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  if (!gpuReady) {
    ctx.fillStyle = '#406080';
    ctx.font = '16px sans-serif';
    ctx.fillText('WebGPU required for embedding cascade', 40, 40);
    return;
  }
  // Approximate viz: use local embeddings for heatmap (since readback is async heavy for demo)
  const cellW = canvas.width / W, cellH = canvas.height / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * DIM;
      let sim = 0;
      for (let d = 0; d < DIM; d++) sim += embeddings[i+d] * query[d];
      sim = Math.max(0, Math.min(1, (sim + 1) / 2));
      const r = Math.floor(sim * 40);
      const g = Math.floor(sim * 120);
      const b = Math.floor(180 + sim * 75);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x*cellW, y*cellH, cellW+1, cellH+1);
    }
  }
  // update portals
  portals.forEach((p, pi) => {
    const cx = (pi * 13 + 10) % W, cy = (pi * 7 + 5) % H;
    const i = (cy * W + cx) * DIM;
    let mag = 0; for (let d=0;d<DIM;d++) mag += embeddings[i+d]**2;
    mag = Math.sqrt(mag);
    p.style.left = (cx / W * canvas.width - 60) + 'px';
    p.style.top = (cy / H * canvas.height - 35) + 'px';
    p.textContent = `Concept ${pi}\nsim ${(mag*10).toFixed(1)}`;
  });
}

function inject(x, y, strength=0.3) {
  const gx = Math.floor(x / canvas.width * W);
  const gy = Math.floor(y / canvas.height * H);
  if (gx < 0 || gx >= W || gy < 0 || gy >= H) return;
  const i = (gy * W + gx) * DIM;
  for (let d = 0; d < DIM; d++) embeddings[i+d] += (Math.random()-0.5)*strength;
}

function setupPortals() {
  for (let i = 0; i < 5; i++) {
    const p = document.createElement('div');
    p.className = 'portal';
    p.textContent = `Portal ${i}`;
    let dragging = false, ox, oy;
    p.addEventListener('pointerdown', e => { dragging=true; ox=e.offsetX; oy=e.offsetY; e.target.setPointerCapture(e.pointerId); });
    p.addEventListener('pointermove', e => {
      if (!dragging) return;
      p.style.left = (e.clientX - ox) + 'px';
      p.style.top = (e.clientY - oy) + 'px';
      inject(e.clientX, e.clientY, 0.15);
    });
    p.addEventListener('pointerup', () => dragging=false);
    document.body.appendChild(p);
    portals.push(p);
  }
}

document.getElementById('reset').onclick = () => { initEmbeddings(); statusEl.textContent = 'Reset'; };
document.getElementById('evolve').onclick = () => {
  for (let i=0;i<16;i++) weights[i] += (Math.random()-0.5)*0.1;
  // would write to mixBuf
  statusEl.textContent = 'Mix weights evolved';
};
document.getElementById('seal').onclick = async () => {
  const hash = await crypto.subtle.digest('SHA-256', weights.buffer);
  const h = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  statusEl.textContent = `Sealed ${h}… (IndexedDB demo)`;
};
document.getElementById('query').onclick = () => {
  for (let d=0;d<DIM;d++) query[d] = Math.random();
  statusEl.textContent = 'Query embedding set';
};

canvas.addEventListener('pointermove', e => { if (e.buttons) inject(e.clientX, e.clientY); });
canvas.addEventListener('pointerdown', e => inject(e.clientX, e.clientY, 0.5));

initEmbeddings();
setupPortals();
initGPU().then(() => {
  function loop() {
    step();
    render();
    requestAnimationFrame(loop);
  }
  loop();
});
