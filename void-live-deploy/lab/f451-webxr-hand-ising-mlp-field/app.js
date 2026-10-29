const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const N = 64;
let device, context, format, pipeline, bindGroup, spinBuffer, displayPipeline, displayBind, paramsBuffer;
let spins = new Float32Array(N * N);
let beta = 1.2;
let xrSession = null, refSpace = null, handPos = [0, 0, -0.5];
let mlp = { w1: null, b1: null, w2: null, b2: null, lr: 0.01 };
function initMLP() {
  const h = 8;
  mlp.w1 = new Float32Array(3 * h).map(() => (Math.random()-0.5)*0.4);
  mlp.b1 = new Float32Array(h).map(() => (Math.random()-0.5)*0.2);
  mlp.w2 = new Float32Array(h).map(() => (Math.random()-0.5)*0.4);
  mlp.b2 = new Float32Array(1).map(() => 0);
}
function forwardMLP(x) {
  const h = 8, a = new Float32Array(h);
  for (let i = 0; i < h; i++) {
    let s = mlp.b1[i];
    for (let j = 0; j < 3; j++) s += x[j] * mlp.w1[j*h + i];
    a[i] = Math.tanh(s);
  }
  let out = mlp.b2[0];
  for (let i = 0; i < h; i++) out += a[i] * mlp.w2[i];
  return { out, a };
}
function trainMLP(x, target) {
  const { out, a } = forwardMLP(x);
  const err = target - out;
  for (let i = 0; i < 8; i++) mlp.w2[i] += mlp.lr * err * a[i];
  mlp.b2[0] += mlp.lr * err;
  for (let i = 0; i < 8; i++) {
    const d = err * mlp.w2[i] * (1 - a[i]*a[i]);
    for (let j = 0; j < 3; j++) mlp.w1[j*8 + i] += mlp.lr * d * x[j];
    mlp.b1[i] += mlp.lr * d;
  }
}
async function initWebGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'WebGPU not available'; return false; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { statusEl.textContent = 'No GPU adapter'; return false; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  const computeCode = `
  @group(0) @binding(0) var<storage, read_write> spins: array<f32>;
  @group(0) @binding(1) var<uniform> params: vec4f;
  @compute @workgroup_size(8,8)
  fn main(@builtin(global_invocation_id) gid: vec3u) {
    let n = u32(params.y);
    let i = gid.x; let j = gid.y;
    if (i >= n || j >= n) { return; }
    let idx = i + j * n;
    let s = spins[idx];
    let left = spins[((i+n-1)%n) + j*n];
    let right = spins[((i+1)%n) + j*n];
    let up = spins[i + ((j+n-1)%n)*n];
    let down = spins[i + ((j+1)%n)*n];
    let h = left + right + up + down;
    let dE = 2.0 * s * h;
    let p = 1.0 / (1.0 + exp(params.x * dE));
    let rnd = fract(sin(dot(vec2f(f32(i),f32(j)), vec2f(12.9898,78.233)) + params.z) * 43758.5453);
    if (rnd < p) { spins[idx] = -s; }
  }`;
  const computeModule = device.createShaderModule({ code: computeCode });
  pipeline = device.createComputePipeline({ layout: 'auto', compute: { module: computeModule, entryPoint: 'main' } });
  const displayCode = `
  struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
  @vertex fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
    var p = array<vec2f, 4>(vec2f(-1,-1), vec2f(1,-1), vec2f(-1,1), vec2f(1,1));
    var uv = array<vec2f, 4>(vec2f(0,1), vec2f(1,1), vec2f(0,0), vec2f(1,0));
    var o: VSOut; o.pos = vec4f(p[vi], 0, 1); o.uv = uv[vi]; return o;
  }
  @group(0) @binding(0) var<storage, read> spins: array<f32>;
  @fragment fn fs(in: VSOut) -> @location(0) vec4f {
    let n = ${N}u;
    let ix = u32(in.uv.x * f32(n));
    let iy = u32(in.uv.y * f32(n));
    let idx = ix + iy * n;
    let s = spins[idx];
    let c = select(vec3f(0.15,0.2,0.4), vec3f(0.9,0.7,0.3), s > 0);
    return vec4f(c, 1);
  }`;
  const displayModule = device.createShaderModule({ code: displayCode });
  displayPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: displayModule, entryPoint: 'vs' },
    fragment: { module: displayModule, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-strip' }
  });
  spinBuffer = device.createBuffer({ size: spins.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  paramsBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: spinBuffer } },
    { binding: 1, resource: { buffer: paramsBuffer } }
  ]});
  displayBind = device.createBindGroup({ layout: displayPipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: spinBuffer } }
  ]});
  for (let i = 0; i < spins.length; i++) spins[i] = Math.random() > 0.5 ? 1 : -1;
  device.queue.writeBuffer(spinBuffer, 0, spins);
  return true;
}
async function step() {
  if (!device) return;
  const x = [handPos[0]*2, handPos[1]*2, handPos[2]];
  const { out } = forwardMLP(x);
  beta = Math.max(0.1, Math.min(3.0, 1.5 + out * 0.8));
  let mag = 0; for (let i = 0; i < spins.length; i++) mag += spins[i]; mag /= spins.length;
  const target = mag > 0.3 ? -0.2 : (mag < -0.3 ? 0.2 : 0);
  trainMLP(x, target);
  const params = new Float32Array([beta, N, Math.random()*100, 0]);
  device.queue.writeBuffer(paramsBuffer, 0, params);
  const cmd = device.createCommandEncoder();
  const pass = cmd.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(N/8), Math.ceil(N/8));
  pass.end();
  const rpass = cmd.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0.05,0.05,0.08,1] }] });
  rpass.setPipeline(displayPipeline);
  rpass.setBindGroup(0, displayBind);
  rpass.draw(4);
  rpass.end();
  device.queue.submit([cmd.finish()]);
  statusEl.textContent = `β=${beta.toFixed(2)} mag≈${mag.toFixed(2)} hand=${handPos.map(v=>v.toFixed(2)).join(',')}`;
}
async function startXR() {
  if (!navigator.xr) { statusEl.textContent = 'WebXR not available — using pointer'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    refSpace = await xrSession.requestReferenceSpace('local');
    xrSession.addEventListener('end', () => { xrSession = null; });
    statusEl.textContent = 'XR session started (hand tracking if supported)';
    xrSession.requestAnimationFrame(onXRFrame);
  } catch (e) { statusEl.textContent = 'XR failed: ' + e.message; }
}
function onXRFrame(t, frame) {
  if (!xrSession) return;
  const input = xrSession.inputSources;
  for (const src of input) {
    if (src.hand) {
      const wrist = src.hand.get('wrist');
      if (wrist) {
        const wp = frame.getPose(wrist, refSpace);
        if (wp) handPos = [wp.transform.position.x, wp.transform.position.y, wp.transform.position.z];
      }
    }
  }
  step();
  xrSession.requestAnimationFrame(onXRFrame);
}
canvas.addEventListener('pointermove', e => {
  if (xrSession) return;
  const r = canvas.getBoundingClientRect();
  handPos = [(e.clientX - r.left)/r.width - 0.5, 0.5 - (e.clientY - r.top)/r.height, -0.4];
});
document.getElementById('xrBtn').onclick = startXR;
document.getElementById('resetBtn').onclick = () => {
  for (let i = 0; i < spins.length; i++) spins[i] = Math.random() > 0.5 ? 1 : -1;
  if (device) device.queue.writeBuffer(spinBuffer, 0, spins);
};
document.getElementById('saveBtn').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('state', 'readwrite');
  tx.objectStore('state').put({ id: 'ising', spins: Array.from(spins), mlp: { w1: Array.from(mlp.w1), b1: Array.from(mlp.b1), w2: Array.from(mlp.w2), b2: Array.from(mlp.b2) } });
  statusEl.textContent = 'State saved to IndexedDB';
};
async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f451', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function loadState() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('ising');
    req.onsuccess = () => {
      if (req.result) {
        spins.set(req.result.spins);
        if (device) device.queue.writeBuffer(spinBuffer, 0, spins);
        Object.assign(mlp, req.result.mlp);
        statusEl.textContent = 'Loaded persistent state';
      }
    };
  } catch (e) { console.warn('f451-webxr-hand-ising-mlp-field:', e); }
}
initMLP();
initWebGPU().then(ok => {
  if (ok) {
    loadState();
    setInterval(step, 50);
    statusEl.textContent = 'WebGPU Ising field ready · move pointer or enter XR';
  }
});
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();
