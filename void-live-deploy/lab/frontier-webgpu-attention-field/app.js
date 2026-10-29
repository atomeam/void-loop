const canvas = document.getElementById('c');
const status = document.getElementById('status');
const queryInput = document.getElementById('query');
let device, context, format, pipeline, particleBuffer, uniformBuffer;
let particles = [];
const N = 128;

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return [(h & 255)/255, ((h>>8)&255)/255, ((h>>16)&255)/255];
}

function initParticles() {
  const concepts = ['ledger','webgpu','attention','local-ai','spatial','void','canvas','particle','cluster','assimilate','frontier','novel','compute','shader','interaction'];
  particles = [];
  for (let i = 0; i < N; i++) {
    const label = concepts[i % concepts.length] + (i > concepts.length ? i : '');
    const feat = hashStr(label);
    particles.push({
      x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2,
      vx: 0, vy: 0,
      feat, label, size: 4 + Math.random()*4
    });
  }
}

async function initWebGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available — falling back to 2D canvas'; return false; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  status.textContent = 'WebGPU device acquired. Using GPU compute for forces.';
  return true;
}

const computeWGSL = `
@group(0) @binding(0) var<storage, read_write> particles: array<vec4f>;
@group(0) @binding(1) var<storage, read> features: array<vec4f>;
@group(0) @binding(2) var<uniform> params: vec4f;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }
  var p = particles[i];
  var force = vec2f(0);
  let toMouse = params.xy - p.xy;
  let distM = length(toMouse) + 0.01;
  force += toMouse / distM * 0.02;
  for (var j = 0u; j < 8u; j++) {
    let other = particles[(i + j * 16u) % arrayLength(&particles)];
    let d = p.xy - other.xy;
    let dist = length(d) + 0.05;
    force += d / dist * 0.01;
  }
  let f = features[i];
  let sim = dot(f.xy, params.zw);
  force += toMouse / distM * sim * 0.05;
  p.zw = p.zw * 0.95 + force;
  p.xy += p.zw * 0.016;
  particles[i] = p;
}
`;

let computePipeline, bindGroup, featureBuffer;

async function setupCompute() {
  if (!device) return;
  const module = device.createShaderModule({ code: computeWGSL });
  computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' }
  });
  const posData = new Float32Array(N * 4);
  const featData = new Float32Array(N * 4);
  particles.forEach((p, i) => {
    posData.set([p.x, p.y, p.vx, p.vy], i*4);
    featData.set([p.feat[0], p.feat[1], p.feat[2], 0], i*4);
  });
  particleBuffer = device.createBuffer({ size: posData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  featureBuffer = device.createBuffer({ size: featData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(particleBuffer, 0, posData);
  device.queue.writeBuffer(featureBuffer, 0, featData);
  uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: featureBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer } }
    ]
  });
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let mouse = {x: 0, y: 0};
canvas.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / canvas.width - 0.5) * 2;
  mouse.y = -(e.clientY / canvas.height - 0.5) * 2;
});

async function frame() {
  if (device && computePipeline) {
    const qFeat = hashStr(queryInput.value || 'void');
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([mouse.x, mouse.y, qFeat[0], qFeat[1]]));
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(N / 64));
    pass.end();
    const staging = device.createBuffer({ size: particleBuffer.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    encoder.copyBufferToBuffer(particleBuffer, 0, staging, 0, particleBuffer.size);
    device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(staging.getMappedRange());
    particles.forEach((p, i) => {
      p.x = data[i*4]; p.y = data[i*4+1]; p.vx = data[i*4+2]; p.vy = data[i*4+3];
    });
    staging.unmap();
  } else {
    particles.forEach(p => {
      const toM = {x: mouse.x - p.x, y: mouse.y - p.y};
      const d = Math.hypot(toM.x, toM.y) + 0.01;
      p.vx = p.vx*0.95 + toM.x/d*0.02;
      p.vy = p.vy*0.95 + toM.y/d*0.02;
      p.x += p.vx*0.016; p.y += p.vy*0.016;
    });
  }
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  particles.forEach(p => {
    const sx = (p.x + 1) * canvas.width / 2;
    const sy = (1 - p.y) * canvas.height / 2;
    ctx.beginPath();
    ctx.arc(sx, sy, p.size, 0, Math.PI*2);
    const sim = Math.max(0, p.feat[0]*0.5 + 0.5);
    ctx.fillStyle = `hsl(${sim*180 + 200}, 70%, 60%)`;
    ctx.fill();
    if (p.size > 5) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(p.label.slice(0,12), sx+6, sy);
    }
  });
  requestAnimationFrame(frame);
}

document.getElementById('spawn').onclick = () => {
  const label = queryInput.value || 'query';
  const feat = hashStr(label);
  particles[0] = { x: 0, y: 0, vx: 0, vy: 0, feat, label, size: 12 };
  status.textContent = 'Query particle spawned: ' + label;
};
document.getElementById('add').onclick = () => {
  const label = prompt('New concept label:', 'novel-combo') || 'new';
  const feat = hashStr(label);
  particles.push({ x: Math.random()*2-1, y: Math.random()*2-1, vx: 0, vy: 0, feat, label, size: 6 });
  status.textContent = 'Added: ' + label;
};

(async () => {
  initParticles();
  const ok = await initWebGPU();
  if (ok) await setupCompute();
  frame();
})();
