const canvas = document.getElementById('c');
const status = document.getElementById('status');
const W = () => canvas.width = window.innerWidth * devicePixelRatio;
const H = () => canvas.height = window.innerHeight * devicePixelRatio;
W(); H();
window.onresize = () => { W(); H(); };

// Tiny MLP
const IN = 6, HID = 8, OUT = 8;
let weights = new Float32Array(IN*HID + HID*OUT);
function randWeights() {
  for (let i = 0; i < weights.length; i++) weights[i] = (Math.random()-0.5)*0.4;
}
randWeights();

function mlp(input) {
  const h = new Float32Array(HID);
  for (let j = 0; j < HID; j++) {
    let s = 0;
    for (let i = 0; i < IN; i++) s += input[i] * weights[j*IN + i];
    h[j] = Math.tanh(s);
  }
  const o = new Float32Array(OUT);
  const off = IN*HID;
  for (let j = 0; j < OUT; j++) {
    let s = 0;
    for (let i = 0; i < HID; i++) s += h[i] * weights[off + j*HID + i];
    o[j] = Math.tanh(s);
  }
  return o;
}

// Pointer residual
let lastX = 0, lastY = 0, lastVX = 0, lastVY = 0;
let residual = [0,0,0];
canvas.onpointermove = e => {
  const vx = e.clientX - lastX;
  const vy = e.clientY - lastY;
  const predVX = lastVX * 0.85;
  const predVY = lastVY * 0.85;
  residual[0] = (vx - predVX) * 0.02;
  residual[1] = (vy - predVY) * 0.02;
  residual[2] = Math.hypot(residual[0], residual[1]);
  lastVX = vx; lastVY = vy;
  lastX = e.clientX; lastY = e.clientY;
};

// Orientation
let orient = [0,0];
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient[0] = (e.beta / 90) * 0.5;
  if (e.gamma != null) orient[1] = (e.gamma / 90) * 0.5;
});

// WebGPU setup
let device, context, pipeline, uniformBuffer;
async function initGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available'; return false; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { status.textContent = 'No WebGPU adapter'; return false; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const shader = `
struct Params {
  spheres: array<vec4f, 3>,
  torus: vec2f,
  mix: f32,
  time: f32,
};
@group(0) @binding(0) var<uniform> p: Params;

fn sdSphere(p: vec3f, r: f32) -> f32 { return length(p) - r; }
fn sdTorus(p: vec3f, t: vec2f) -> f32 {
  let q = vec2f(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5*(b-a)/k, 0., 1.);
  return mix(b, a, h) - k*h*(1.-h);
}

fn map(pos: vec3f) -> f32 {
  var d = 100.;
  for (var i = 0; i < 3; i++) {
    d = smin(d, sdSphere(pos - p.spheres[i].xyz, p.spheres[i].w), p.mix);
  }
  d = smin(d, sdTorus(pos, p.torus), p.mix);
  return d;
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let pos = array(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
  return vec4f(pos[i], 0, 1);
}

@fragment fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let uv = (frag.xy / vec2f(${canvas.width}, ${canvas.height}) - 0.5) * vec2f(1., ${canvas.height}/${canvas.width});
  var ro = vec3f(0, 0, 3.5);
  var rd = normalize(vec3f(uv, -1.2));
  var t = 0.;
  var hit = false;
  for (var i = 0; i < 64; i++) {
    let pos = ro + rd * t;
    let d = map(pos);
    if (d < 0.002) { hit = true; break; }
    t += d;
    if (t > 12.) break;
  }
  if (!hit) return vec4f(0.05, 0.05, 0.08, 1);
  let pos = ro + rd * t;
  let e = 0.001;
  let n = normalize(vec3f(
    map(pos+vec3f(e,0,0)) - map(pos-vec3f(e,0,0)),
    map(pos+vec3f(0,e,0)) - map(pos-vec3f(0,e,0)),
    map(pos+vec3f(0,0,e)) - map(pos-vec3f(0,0,e))
  ));
  let light = normalize(vec3f(1, 1.5, -0.5));
  let diff = clamp(dot(n, light), 0., 1.);
  let col = vec3f(0.4 + 0.3*sin(p.time), 0.5 + 0.2*cos(p.time*0.7), 0.7) * (0.2 + 0.8*diff);
  return vec4f(col, 1);
}
`;
  const module = device.createShaderModule({ code: shader });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });
  uniformBuffer = device.createBuffer({ size: 16*4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  return true;
}

let gpuReady = false;
initGPU().then(ok => { gpuReady = ok; if (ok) status.textContent = 'Ready — move or tilt to sculpt'; });

// Animation
let t0 = performance.now();
function frame() {
  const time = (performance.now() - t0) * 0.001;
  const input = [orient[0], orient[1], residual[0], residual[1], residual[2], Math.sin(time*0.5)];
  const out = mlp(input);
  // Map to params
  const spheres = [
    [out[0]*1.5, out[1]*1.2, out[2]*0.8, 0.4 + out[3]*0.3],
    [out[4]*1.2, out[5]*1.5, 0.3, 0.35 + Math.abs(out[0])*0.2],
    [Math.sin(time*0.3)*0.8, out[6]*1., -0.4, 0.3]
  ];
  const torus = [1.1 + out[7]*0.4, 0.25];
  const mix = 0.4 + Math.abs(out[1])*0.3;

  if (gpuReady && device) {
    const data = new Float32Array(16);
    // spheres as vec4
    for (let i = 0; i < 3; i++) {
      data[i*4] = spheres[i][0]; data[i*4+1] = spheres[i][1]; data[i*4+2] = spheres[i][2]; data[i*4+3] = spheres[i][3];
    }
    data[12] = torus[0]; data[13] = torus[1]; data[14] = mix; data[15] = time;
    device.queue.writeBuffer(uniformBuffer, 0, data);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0.05,0.05,0.08,1] }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding:0, resource: { buffer: uniformBuffer } }] }));
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Reward / mutate on click
canvas.onclick = () => {
  // Gentle mutation toward current preferred
  for (let i = 0; i < weights.length; i++) {
    weights[i] += (Math.random()-0.5)*0.05;
    weights[i] = Math.max(-2, Math.min(2, weights[i]));
  }
  status.textContent = 'Rewarded — shape favored';
};

// Seal
document.getElementById('seal').onclick = async () => {
  const data = { weights: Array.from(weights), time: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f686', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put(data, 'current');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) { console.debug("lab f686-webgpu-sdf-raymarch-mlp-art:", e); }
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f686-sdf-genome.json';
  a.click();
  status.textContent = 'Sealed & downloaded';
};

// Screenshot
document.getElementById('shot').onclick = () => {
  canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'f686-sculpt.png';
    a.click();
  });
};

// Restore
(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f686', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal');
    const req = tx.objectStore('seal').get('current');
    req.onsuccess = () => {
      if (req.result && req.result.weights) {
        weights = new Float32Array(req.result.weights);
        status.textContent = 'Restored sealed genome';
      }
    };
  } catch (e) { console.debug("lab f686-webgpu-sdf-raymarch-mlp-art:", e); }
})();
