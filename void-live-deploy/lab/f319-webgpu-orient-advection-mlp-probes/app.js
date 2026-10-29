const canvas = document.getElementById('c');
const status = document.getElementById('status');
const probesEl = document.getElementById('probes');
let device, context, format;
let densityIn, densityOut, velocityBuf, paramsBuf;
let pipeline, bindGroupLayout, bindGroups = [];
let ping = 0;
const GRID = 128;
const WORKGROUP = 8;

// Tiny MLP: 4 inputs (beta, gamma, dBeta, dGamma) -> 2 outputs (velScale, diffScale)
const W1 = [[0.4, -0.2, 0.3, 0.1], [0.1, 0.5, -0.3, 0.2], [-0.2, 0.1, 0.4, -0.1]];
const B1 = [0.1, -0.1, 0.0];
const W2 = [[0.6, -0.3, 0.2], [0.2, 0.5, -0.4]];
const B2 = [0.8, 0.4];
function sigmoid(x) { return 1/(1+Math.exp(-x)); }
function mlpForward(inputs) {
  const h = W1.map((row, i) => sigmoid(row.reduce((s, w, j) => s + w * inputs[j], B1[i])));
  return W2.map((row, i) => sigmoid(row.reduce((s, w, j) => s + w * h[j], B2[i])));
}

let lastBeta = 0, lastGamma = 0, velScale = 1.0, diffScale = 0.1;
let mouseX = 0.5, mouseY = 0.5, useMouse = true;

function updateMLP(beta, gamma) {
  const dB = beta - lastBeta, dG = gamma - lastGamma;
  lastBeta = beta; lastGamma = gamma;
  const [vs, ds] = mlpForward([beta/90, gamma/90, dB/10, dG/10]);
  velScale = 0.2 + vs * 1.5;
  diffScale = 0.02 + ds * 0.15;
}

// Probes
const probes = [];
for (let i = 0; i < 5; i++) {
  const p = document.createElement('div');
  p.className = 'probe';
  p.style.left = (20 + i*15) + '%';
  p.style.top = (30 + (i%2)*20) + '%';
  p.textContent = i+1;
  p.dataset.idx = i;
  probesEl.appendChild(p);
  probes.push({ el: p, x: 0.2 + i*0.15, y: 0.3 + (i%2)*0.2, inject: false });
  p.addEventListener('click', () => { probes[i].inject = true; p.classList.add('active'); setTimeout(() => p.classList.remove('active'), 200); });
}

async function init() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available'; return; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { status.textContent = 'No GPU adapter'; return; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const densitySize = GRID * GRID * 4;
  densityIn = device.createBuffer({ size: densitySize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  densityOut = device.createBuffer({ size: densitySize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  velocityBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  // Init density with some blobs
  const initData = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const dx = x/GRID - 0.5, dy = y/GRID - 0.5;
    initData[y*GRID + x] = Math.exp(-(dx*dx + dy*dy)*20) * 0.8 + Math.random()*0.05;
  }
  device.queue.writeBuffer(densityIn, 0, initData);

  const shaderCode = `
@group(0) @binding(0) var<storage, read> densityIn: array<f32>;
@group(0) @binding(1) var<storage, read_write> densityOut: array<f32>;
@group(0) @binding(2) var<uniform> velocity: vec2f;
@group(0) @binding(3) var<uniform> params: vec2f; // velScale, diffScale

fn idx(x: i32, y: i32) -> u32 {
  let xx = (x + ${GRID}) % ${GRID};
  let yy = (y + ${GRID}) % ${GRID};
  return u32(yy * ${GRID} + xx);
}

@compute @workgroup_size(${WORKGROUP}, ${WORKGROUP})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  if (x >= ${GRID} || y >= ${GRID}) { return; }
  let i = u32(y * ${GRID} + x);
  let v = velocity * params.x;
  let srcX = f32(x) - v.x * 2.0;
  let srcY = f32(y) - v.y * 2.0;
  let sx = i32(floor(srcX)); let sy = i32(floor(srcY));
  let tx = srcX - f32(sx); let ty = srcY - f32(sy);
  let d00 = densityIn[idx(sx, sy)];
  let d10 = densityIn[idx(sx+1, sy)];
  let d01 = densityIn[idx(sx, sy+1)];
  let d11 = densityIn[idx(sx+1, sy+1)];
  let d = mix(mix(d00, d10, tx), mix(d01, d11, tx), ty);
  // simple diffusion
  let n = (densityIn[idx(x-1,y)] + densityIn[idx(x+1,y)] + densityIn[idx(x,y-1)] + densityIn[idx(x,y+1)]) * 0.25;
  d = mix(d, n, params.y);
  // decay + inject later from CPU
  densityOut[i] = clamp(d * 0.995, 0.0, 1.0);
}
`;

  const module = device.createShaderModule({ code: shaderCode });
  bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ]
  });
  pipeline = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }), compute: { module, entryPoint: 'main' } });

  bindGroups[0] = device.createBindGroup({ layout: bindGroupLayout, entries: [
    { binding: 0, resource: { buffer: densityIn } },
    { binding: 1, resource: { buffer: densityOut } },
    { binding: 2, resource: { buffer: velocityBuf } },
    { binding: 3, resource: { buffer: paramsBuf } },
  ]});
  bindGroups[1] = device.createBindGroup({ layout: bindGroupLayout, entries: [
    { binding: 0, resource: { buffer: densityOut } },
    { binding: 1, resource: { buffer: densityIn } },
    { binding: 2, resource: { buffer: velocityBuf } },
    { binding: 3, resource: { buffer: paramsBuf } },
  ]});

  // Simple render: we'll use a separate pass or just copy to texture later; for prototype, use readback for probes and CSS or simple fill
  status.textContent = 'WebGPU ready. Tilt or drag to advect.';
  requestAnimationFrame(frame);
}

// For visualization without full render pipeline complexity, we periodically read density and draw to 2d context fallback, but prefer pure WebGPU.
// To keep single-file robust, add a 2D overlay or use render if possible. For simplicity, use canvas 2d for viz by reading back occasionally.
const ctx2d = document.createElement('canvas').getContext('2d');
ctx2d.canvas.width = GRID; ctx2d.canvas.height = GRID;
document.body.appendChild(ctx2d.canvas);
ctx2d.canvas.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; image-rendering:pixelated; pointer-events:none; z-index:1;';

async function readDensity() {
  const staging = device.createBuffer({ size: GRID*GRID*4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(ping ? densityOut : densityIn, 0, staging, 0, GRID*GRID*4);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(staging.getMappedRange());
  staging.unmap();
  staging.destroy();
  return data;
}

let frameCount = 0;
async function frame() {
  frameCount++;
  let beta = (mouseY - 0.5) * 90;
  let gamma = (mouseX - 0.5) * 90;
  if (!useMouse && window.orientationData) {
    beta = window.orientationData.beta || 0;
    gamma = window.orientationData.gamma || 0;
  }
  updateMLP(beta, gamma);
  const vx = Math.sin(gamma * Math.PI/180) * velScale;
  const vy = Math.sin(beta * Math.PI/180) * velScale;
  device.queue.writeBuffer(velocityBuf, 0, new Float32Array([vx, vy, 0, 0]));
  device.queue.writeBuffer(paramsBuf, 0, new Float32Array([velScale, diffScale, 0, 0]));

  // Inject from probes
  if (frameCount % 5 === 0) {
    const data = await readDensity();
    probes.forEach((p, i) => {
      const gx = Math.floor(p.x * GRID), gy = Math.floor(p.y * GRID);
      const di = gy * GRID + gx;
      if (p.inject) { data[di] = Math.min(1, data[di] + 0.3); p.inject = false; }
      const dens = data[di];
      p.el.style.background = `rgba(${100+dens*155}, ${200-dens*100}, 255, 0.6)`;
      p.el.style.transform = `scale(${0.8 + dens})`;
    });
    // write back modified
    device.queue.writeBuffer(ping ? densityOut : densityIn, 0, data);
  }

  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroups[ping]);
  pass.dispatchWorkgroups(GRID/WORKGROUP, GRID/WORKGROUP);
  pass.end();
  device.queue.submit([enc.finish()]);
  ping = 1 - ping;

  if (frameCount % 10 === 0) {
    const data = await readDensity();
    const img = ctx2d.createImageData(GRID, GRID);
    for (let i = 0; i < data.length; i++) {
      const v = Math.min(255, data[i] * 255);
      img.data[i*4] = v * 0.3; img.data[i*4+1] = v; img.data[i*4+2] = v * 1.2; img.data[i*4+3] = 255;
    }
    ctx2d.putImageData(img, 0, 0);
  }

  status.textContent = `velScale ${velScale.toFixed(2)} diff ${diffScale.toFixed(2)} tilt β${beta.toFixed(0)} γ${gamma.toFixed(0)}`;
  requestAnimationFrame(frame);
}

document.getElementById('reset').onclick = () => location.reload();
document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const res = await DeviceOrientationEvent.requestPermission();
    if (res === 'granted') useMouse = false;
  } else {
    useMouse = false;
  }
  window.addEventListener('deviceorientation', e => { window.orientationData = e; useMouse = false; });
};
canvas.addEventListener('pointermove', e => { if (useMouse) { mouseX = e.clientX / innerWidth; mouseY = e.clientY / innerHeight; } });
window.addEventListener('resize', () => { canvas.width = innerWidth; canvas.height = innerHeight; });

init();
