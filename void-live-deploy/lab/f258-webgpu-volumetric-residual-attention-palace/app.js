const canvas = document.getElementById('gpu-canvas');
const status = document.getElementById('status');
let device, context, pipeline, computePipeline, volumeBuffer, paramsBuffer;
const SIZE = 32;
const VOLUME = SIZE * SIZE * SIZE;
const portals = [];
let residual = 0.3, entropy = 0.5;
let orientation = { beta: 0, gamma: 0 };
let pointerHist = [];

async function initWebGPU() {
  if (!navigator.gpu) {
    status.textContent = 'WebGPU unavailable — 2D fallback';
    return false;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { status.textContent = 'WebGPU unavailable — 2D fallback'; return false; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  volumeBuffer = device.createBuffer({
    size: VOLUME * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });

  paramsBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const computeWGSL = `
    @group(0) @binding(0) var<storage, read_write> volume: array<vec4<f32>>;
    @group(0) @binding(1) var<uniform> params: vec4<f32>;
    @compute @workgroup_size(4,4,4)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      let i = id.z * ${SIZE}u * ${SIZE}u + id.y * ${SIZE}u + id.x;
      if (i >= ${VOLUME}u) { return; }
      var v = volume[i];
      var sum = v;
      let offs = array<vec3<i32>,6>(vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));
      var cnt = 1.0;
      for (var k = 0u; k < 6u; k++) {
        let n = vec3<i32>(id) + offs[k];
        if (all(n >= vec3(0)) && all(n < vec3(${SIZE}))) {
          let ni = u32(n.z) * ${SIZE}u * ${SIZE}u + u32(n.y) * ${SIZE}u + u32(n.x);
          sum += volume[ni];
          cnt += 1.0;
        }
      }
      let avg = sum / cnt;
      let attn = 0.5 + 0.5 * sin(params.x * 3.14 + v.x * 2.0);
      v.x = mix(v.x, avg.x, 0.08 * attn * (1.0 + params.y));
      v.w = max(0.0, v.w * 0.99 + (attn - 0.5) * 0.02);
      volume[i] = v;
    }
  `;
  const computeModule = device.createShaderModule({ code: computeWGSL });
  computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: computeModule, entryPoint: 'main' }
  });

  const renderWGSL = `
    @group(0) @binding(0) var<storage, read> volume: array<vec4<f32>>;
    @group(0) @binding(1) var<uniform> params: vec4<f32>;
    struct VSOut { @builtin(position) pos: vec4<f32>; @location(0) uv: vec2<f32>; };
    @vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
      var p = array<vec2<f32>,3>(vec2(-1,-1), vec2(3,-1), vec2(-1,3));
      var out: VSOut;
      out.pos = vec4(p[i], 0, 1);
      out.uv = p[i] * 0.5 + 0.5;
      return out;
    }
    @fragment fn fs(in: VSOut) -> @location(0) vec4<f32> {
      let z = u32(params.z * ${SIZE}.0);
      let x = u32(in.uv.x * ${SIZE}.0);
      let y = u32(in.uv.y * ${SIZE}.0);
      let i = z * ${SIZE}u * ${SIZE}u + y * ${SIZE}u + x;
      let v = volume[i];
      let col = vec3(v.x, v.y * 0.5 + 0.5, v.z * 0.5 + 0.5) * (0.4 + v.w);
      return vec4(col, 1.0);
    }
  `;
  const renderModule = device.createShaderModule({ code: renderWGSL });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: renderModule, entryPoint: 'vs' },
    fragment: { module: renderModule, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  const data = new Float32Array(VOLUME * 4);
  for (let i = 0; i < VOLUME; i++) {
    data[i*4] = Math.random() * 0.4;
    data[i*4+1] = Math.random() - 0.5;
    data[i*4+2] = Math.random() - 0.5;
    data[i*4+3] = Math.random() * 0.2;
  }
  device.queue.writeBuffer(volumeBuffer, 0, data);
  status.textContent = 'WebGPU volume live — tilt / drag portals';
  return true;
}

const workerCode = `
let policy = new Float32Array(8).map(() => Math.random()*2-1);
let best = policy.slice();
let bestFit = 1e9;
self.onmessage = (e) => {
  const { residual, entropy, tilt, hist } = e.data;
  const pred = policy[0]*tilt.beta + policy[1]*tilt.gamma + policy[2]*hist + policy[3]*residual;
  const err = Math.abs(pred - residual);
  if (err < bestFit) { bestFit = err; best = policy.slice(); }
  for (let i = 0; i < policy.length; i++) {
    policy[i] += (Math.random()-0.5)*0.1;
    policy[i] = Math.max(-2, Math.min(2, policy[i]));
  }
  self.postMessage({ policy: Array.from(best), fit: bestFit, residualBias: best[0] });
};
`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(workerBlob));
worker.onmessage = (e) => {
  residual = Math.min(1, Math.max(0, residual * 0.9 + e.data.residualBias * 0.1));
  document.documentElement.style.setProperty('--residual', residual.toFixed(3));
  document.documentElement.style.setProperty('--entropy', entropy.toFixed(3));
  document.documentElement.style.setProperty('--hue', (180 + residual * 120).toFixed(0));
};

function createPortals(n = 5) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.style.left = (20 + Math.random()*60) + '%';
    el.style.top = (20 + Math.random()*60) + '%';
    el.style.setProperty('--h', 180 + Math.random()*120);
    document.body.appendChild(el);
    portals.push({ el, x: Math.random(), y: Math.random(), z: Math.random(), vx: 0, vy: 0 });
    el.addEventListener('pointerdown', (ev) => {
      el.setPointerCapture(ev.pointerId);
      el._drag = true;
    });
    el.addEventListener('pointermove', (ev) => {
      if (!el._drag) return;
      el.style.left = ev.clientX - 32 + 'px';
      el.style.top = ev.clientY - 32 + 'px';
    });
    el.addEventListener('pointerup', () => {
      el._drag = false;
      sealFragment(el);
    });
  }
}

function sealFragment(el) {
  const frag = { t: Date.now(), residual, entropy, h: el.style.getPropertyValue('--h') };
  const key = 'f258-seal-' + Date.now();
  try {
    const dbReq = indexedDB.open('f258-palace', 1);
    dbReq.onupgradeneeded = () => dbReq.result.createObjectStore('seals');
    dbReq.onsuccess = () => {
      const tx = dbReq.result.transaction('seals', 'readwrite');
      tx.objectStore('seals').put(frag, key);
    };
  } catch {}
  residual = Math.min(1, residual + 0.15);
  status.textContent = 'Sealed genome fragment → persistent attractor';
}

function updatePortals() {
  portals.forEach((p, i) => {
    if (p.el._drag) return;
    p.x += (Math.sin(Date.now()*0.001 + i) * 0.002);
    p.y += (Math.cos(Date.now()*0.0008 + i) * 0.002);
    p.x = Math.max(0.1, Math.min(0.9, p.x));
    p.y = Math.max(0.1, Math.min(0.9, p.y));
    p.el.style.left = (p.x * 100) + '%';
    p.el.style.top = (p.y * 100) + '%';
    const scale = 0.7 + residual * 0.8;
    const rot = residual * 30;
    p.el.style.transform = `translateZ(${residual*40}px) rotateY(${rot}deg) scale(${scale})`;
  });
}

async function frame() {
  if (device && computePipeline) {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    const bind = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: volumeBuffer } },
        { binding: 1, resource: { buffer: paramsBuffer } }
      ]
    });
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(SIZE/4), Math.ceil(SIZE/4), Math.ceil(SIZE/4));
    pass.end();

    const view = context.getCurrentTexture().createView();
    const rpass = encoder.beginRenderPass({
      colorAttachments: [{ view, clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
    });
    rpass.setPipeline(pipeline);
    const rbind = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: volumeBuffer } },
        { binding: 1, resource: { buffer: paramsBuffer } }
      ]
    });
    rpass.setBindGroup(0, rbind);
    rpass.draw(3);
    rpass.end();
    device.queue.submit([encoder.finish()]);

    const params = new Float32Array([residual, entropy, (Date.now() % 10000)/10000, orientation.beta * 0.01]);
    device.queue.writeBuffer(paramsBuffer, 0, params);
  }
  entropy = 0.3 + Math.sin(Date.now()*0.0005)*0.2 + residual*0.3;
  worker.postMessage({ residual, entropy, tilt: orientation, hist: pointerHist.slice(-4).reduce((a,b)=>a+b,0) });
  updatePortals();
  requestAnimationFrame(frame);
}

window.addEventListener('deviceorientation', (e) => {
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
});
canvas.addEventListener('pointermove', (e) => {
  pointerHist.push(e.clientX / window.innerWidth);
  if (pointerHist.length > 16) pointerHist.shift();
});

createPortals();
initWebGPU().then(() => requestAnimationFrame(frame));
