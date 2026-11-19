const LATENT = 4;
const INPUT = 6;
const FACETS = 6;
let device, pipeline, bindGroup, latentBuf, inputBuf, weightsBuf;
let latent = new Float32Array(LATENT);
let weights = new Float32Array( (LATENT+INPUT)*16 + 16*LATENT ); // tiny residual MLP
let orient = { beta: 0, gamma: 0, dbeta: 0, dgamma: 0 };
let ptr = { x: 0, y: 0, dx: 0, dy: 0 };
let facets = [];
let traj = [];
let running = false;
let clickBias = 0;

function randn() { return (Math.random()*2-1)*0.3; }
function initWeights() {
  for (let i = 0; i < weights.length; i++) weights[i] = randn();
}

async function initGPU() {
  if (!navigator.gpu) { status.textContent = "no WebGPU"; return false; }
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  const shader = `
    @group(0) @binding(0) var<storage, read_write> latent: array<f32>;
    @group(0) @binding(1) var<storage, read> input: array<f32>;
    @group(0) @binding(2) var<storage, read> weights: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      var x: array<f32,4>;
      for (var i=0u; i<4u; i++) { x[i] = latent[i]; }
      var inp: array<f32,6>;
      for (var i=0u; i<6u; i++) { inp[i] = input[i]; }
      // residual MLP: (4+6)->16->4
      var h: array<f32,16>;
      var wOff = 0u;
      for (var o=0u; o<16u; o++) {
        var s = 0.0;
        for (var i=0u; i<4u; i++) { s += x[i] * weights[wOff]; wOff++; }
        for (var i=0u; i<6u; i++) { s += inp[i] * weights[wOff]; wOff++; }
        h[o] = tanh(s);
      }
      var dx: array<f32,4>;
      for (var o=0u; o<4u; o++) {
        var s = 0.0;
        for (var i=0u; i<16u; i++) { s += h[i] * weights[wOff]; wOff++; }
        dx[o] = s * 0.15;
      }
      // 8 Euler steps
      for (var step=0u; step<8u; step++) {
        for (var i=0u; i<4u; i++) { x[i] += dx[i]; }
        // recompute dx (simplified, reuse)
      }
      for (var i=0u; i<4u; i++) { latent[i] = x[i] * 0.98; } // soft bound
    }
  `;
  const module = device.createShaderModule({ code: shader });
  pipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "main" } });
  latentBuf = device.createBuffer({ size: LATENT*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  inputBuf = device.createBuffer({ size: INPUT*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  weightsBuf = device.createBuffer({ size: weights.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(weightsBuf, 0, weights);
  bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: latentBuf } },
    { binding: 1, resource: { buffer: inputBuf } },
    { binding: 2, resource: { buffer: weightsBuf } },
  ]});
  return true;
}

function createFacets() {
  const stage = document.getElementById("stage");
  for (let i = 0; i < FACETS; i++) {
    const d = document.createElement("div");
    d.className = "facet";
    d.style.background = `hsla(${200 + i*30},70%,60%,0.22)`;
    stage.appendChild(d);
    facets.push(d);
  }
}

function updateCrystal(lat) {
  facets.forEach((f, i) => {
    const a = lat[i % LATENT];
    const rot = (a * 80 + i * 25) % 360;
    const sc = 0.7 + Math.abs(a) * 0.6;
    const z = (i - FACETS/2) * 40 + a * 60;
    f.style.transform = `translateZ(${z}px) rotateX(${rot}deg) rotateY(${rot*0.7}deg) scale(${sc})`;
    f.style.opacity = 0.4 + Math.abs(a)*0.5;
  });
}

const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
function plotTraj() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (traj.length < 2) return;
  ctx.strokeStyle = "#8cf";
  ctx.beginPath();
  traj.forEach((p, i) => {
    const x = 10 + (i/traj.length)*200;
    const y = 60 + p[0]*40;
    i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
  });
  ctx.stroke();
}

async function frame() {
  if (!running) return;
  const inp = new Float32Array([
    orient.dbeta*0.02, orient.dgamma*0.02,
    ptr.dx*0.01, ptr.dy*0.01,
    clickBias, Math.sin(performance.now()*0.001)
  ]);
  clickBias *= 0.92;
  device.queue.writeBuffer(inputBuf, 0, inp);
  device.queue.writeBuffer(latentBuf, 0, latent);
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  device.queue.submit([enc.finish()]);
  // simple readback (for demo; production would use mapAsync properly)
  const staging = device.createBuffer({ size: LATENT*4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const enc2 = device.createCommandEncoder();
  enc2.copyBufferToBuffer(latentBuf, 0, staging, 0, LATENT*4);
  device.queue.submit([enc2.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(staging.getMappedRange());
  latent.set(data);
  staging.unmap();
  staging.destroy();
  updateCrystal(latent);
  traj.push([...latent]);
  if (traj.length > 80) traj.shift();
  plotTraj();
  requestAnimationFrame(frame);
}

document.getElementById("start").onclick = async () => {
  status.textContent = "init...";
  initWeights();
  createFacets();
  if (await initGPU()) {
    running = true;
    status.textContent = "crystal evolving";
    // orientation
    window.addEventListener("deviceorientation", e => {
      orient.dbeta = (e.beta||0) - orient.beta;
      orient.dgamma = (e.gamma||0) - orient.gamma;
      orient.beta = e.beta||0;
      orient.gamma = e.gamma||0;
    });
    window.addEventListener("pointermove", e => {
      ptr.dx = e.movementX || (e.clientX - ptr.x);
      ptr.dy = e.movementY || (e.clientY - ptr.y);
      ptr.x = e.clientX; ptr.y = e.clientY;
    });
    window.addEventListener("click", () => { clickBias = 1.2; });
    requestAnimationFrame(frame);
  }
};

document.getElementById("seal").onclick = async () => {
  try {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle("f784-ode-crystal.json", { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify({ weights: Array.from(weights), traj: traj.slice(-20) }));
    await w.close();
    status.textContent = "sealed to OPFS";
  } catch(e) { status.textContent = "OPFS unavailable"; }
};

const status = document.getElementById("status");
status.textContent = "click Start";
