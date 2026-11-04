const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const probes = [];
for (let i = 0; i < 3; i++) {
  const p = document.createElement('div');
  p.className = 'probe';
  p.textContent = `probe ${i}`;
  document.body.appendChild(p);
  probes.push(p);
}

let device, context, pipeline, uniformBuffer, bindGroup;
let mlpWeights = null;
let sealedWeights = null;
let params = new Float32Array(16); // 4 spheres * (x,y,z,r)
let time = 0;
let pointer = { x: 0.5, y: 0.5 };
let orient = { beta: 0, gamma: 0 };
let injection = 0;

function randn() { return (Math.random() * 2 - 1) * 0.5; }
function initMLP() {
  // 4→8→6
  mlpWeights = {
    w1: new Float32Array(4 * 8).map(randn),
    b1: new Float32Array(8).map(randn),
    w2: new Float32Array(8 * 6).map(randn),
    b2: new Float32Array(6).map(randn)
  };
}
function relu(x) { return Math.max(0, x); }
function forwardMLP(input) {
  const h = new Float32Array(8);
  for (let i = 0; i < 8; i++) {
    let s = mlpWeights.b1[i];
    for (let j = 0; j < 4; j++) s += input[j] * mlpWeights.w1[j * 8 + i];
    h[i] = relu(s);
  }
  const out = new Float32Array(6);
  for (let i = 0; i < 6; i++) {
    let s = mlpWeights.b2[i];
    for (let j = 0; j < 8; j++) s += h[j] * mlpWeights.w2[j * 6 + i];
    out[i] = Math.tanh(s);
  }
  return out;
}

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function sealGenome() {
  const ser = JSON.stringify({
    w1: Array.from(mlpWeights.w1), b1: Array.from(mlpWeights.b1),
    w2: Array.from(mlpWeights.w2), b2: Array.from(mlpWeights.b2)
  });
  sealedWeights = ser;
  const h = await sha256(ser);
  statusEl.textContent = `Sealed: ${h}`;
  try {
    const db = await openDB();
    const tx = db.transaction('minds', 'readwrite');
    tx.objectStore('minds').put({ id: 'current', data: ser });
    await tx.complete;
  } catch (e) { console.warn(e); }
}
function transfer() {
  if (!sealedWeights) return;
  const o = JSON.parse(sealedWeights);
  mlpWeights.w1.set(o.w1); mlpWeights.b1.set(o.b1);
  mlpWeights.w2.set(o.w2); mlpWeights.b2.set(o.b2);
  statusEl.textContent = 'Transferred sealed genome';
}
async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('minds', 'readonly');
    const req = tx.objectStore('minds').get('current');
    req.onsuccess = () => {
      if (req.result) {
        sealedWeights = req.result.data;
        transfer();
        statusEl.textContent = 'Restored from IndexedDB';
      }
    };
  } catch (e) { statusEl.textContent = 'No restore'; }
}
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f505-mind', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('minds', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

const shaderCode = `
struct Uniforms {
  spheres: array<vec4f, 4>,
  time: f32,
  aspect: f32,
  pad: vec2f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

fn sdSphere(p: vec3f, r: f32) -> f32 { return length(p) - r; }
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
fn scene(p: vec3f) -> f32 {
  var d = 10.0;
  for (var i = 0u; i < 4u; i++) {
    let c = u.spheres[i].xyz;
    let r = u.spheres[i].w;
    d = smin(d, sdSphere(p - c, r), 0.35);
  }
  return d;
}
fn normal(p: vec3f) -> vec3f {
  let e = vec2f(0.001, 0.0);
  return normalize(vec3f(
    scene(p + e.xyy) - scene(p - e.xyy),
    scene(p + e.yxy) - scene(p - e.yxy),
    scene(p + e.yyx) - scene(p - e.yyx)
  ));
}
@fragment
fn main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let res = vec2f(800.0, 600.0); // approximate; real aspect passed
  let uv = (fragCoord.xy / res) * 2.0 - 1.0;
  let ro = vec3f(0.0, 0.0, 3.5);
  let rd = normalize(vec3f(uv.x * u.aspect, uv.y, -1.2));
  var t = 0.0;
  var hit = false;
  for (var i = 0; i < 64; i++) {
    let p = ro + rd * t;
    let d = scene(p);
    if (d < 0.002) { hit = true; break; }
    t += d * 0.8;
    if (t > 8.0) break;
  }
  if (!hit) {
    return vec4f(0.02, 0.02, 0.06, 1.0);
  }
  let p = ro + rd * t;
  let n = normal(p);
  let light = normalize(vec3f(0.6, 0.8, 0.4));
  let diff = max(dot(n, light), 0.0);
  let col = vec3f(0.4 + 0.3 * n.x, 0.5 + 0.2 * n.y, 0.7) * (0.3 + 0.7 * diff);
  col += 0.05 * sin(u.time + p.x * 3.0);
  return vec4f(col, 1.0);
}
`;

async function initWebGPU() {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not available';
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { statusEl.textContent = 'No GPU adapter'; return; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  uniformBuffer = device.createBuffer({
    size: 16 * 4 + 16, // spheres + time/aspect
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const module = device.createShaderModule({ code: shaderCode });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: device.createShaderModule({ code: `@vertex fn main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
      let pos = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
      return vec4f(pos[i], 0, 1);
    }` }), entryPoint: 'main' },
    fragment: { module, entryPoint: 'main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });
  statusEl.textContent = 'WebGPU ready — move pointer or tilt';
}

function resize() {
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
window.addEventListener('resize', resize);
resize();

function updateParams() {
  const input = [
    (pointer.x - 0.5) * 2,
    (pointer.y - 0.5) * 2,
    orient.beta / 90,
    Math.sin(time * 0.5)
  ];
  const out = forwardMLP(input);
  // Map to 4 spheres: use out for first two, derive others
  const targets = [
    out[0] * 1.2, out[1] * 1.2, 0.2, 0.6 + out[2] * 0.4,
    out[3] * 1.2, out[4] * 1.2, -0.3, 0.55 + out[5] * 0.35,
    Math.sin(time) * 0.8, Math.cos(time * 0.7) * 0.8, 0.0, 0.5,
    Math.cos(time * 1.1) * 0.9, Math.sin(time * 0.9) * 0.9, 0.4, 0.45
  ];
  if (injection > 0) {
    targets[3] += 0.4 * injection;
    injection *= 0.95;
  }
  for (let i = 0; i < 16; i++) {
    params[i] += (targets[i] - params[i]) * 0.08;
  }
}

function frame(now) {
  time = now * 0.001;
  updateParams();
  if (device && pipeline) {
    const aspect = canvas.width / canvas.height;
    const data = new Float32Array(20);
    data.set(params, 0);
    data[16] = time;
    data[17] = aspect;
    device.queue.writeBuffer(uniformBuffer, 0, data);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.02, b: 0.06, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  // Simple probe projection (fixed offsets)
  probes.forEach((p, i) => {
    const ang = time + i * 2;
    const sx = (0.5 + 0.25 * Math.sin(ang)) * innerWidth;
    const sy = (0.5 + 0.2 * Math.cos(ang * 0.8)) * innerHeight;
    p.style.left = sx + 'px';
    p.style.top = sy + 'px';
    p.textContent = `\u03c6≈${params[i*4+3].toFixed(2)}`;
  });
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / innerWidth;
  pointer.y = e.clientY / innerHeight;
});
canvas.addEventListener('click', () => { injection = 1; statusEl.textContent = 'Injected'; });

window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient.beta = e.beta;
  if (e.gamma != null) orient.gamma = e.gamma;
});

document.getElementById('nucleate').onclick = () => { initMLP(); statusEl.textContent = 'Nucleated new genome'; };
document.getElementById('seal').onclick = sealGenome;
document.getElementById('transfer').onclick = transfer;
document.getElementById('restore').onclick = restore;
document.getElementById('clear').onclick = () => { sealedWeights = null; statusEl.textContent = 'Cleared seal'; };

initMLP();
initWebGPU().then(() => requestAnimationFrame(frame));
