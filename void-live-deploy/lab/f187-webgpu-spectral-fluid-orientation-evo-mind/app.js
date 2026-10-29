const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const info = document.getElementById('info');
let device, context, pipeline, bindGroup, storageBuffer, uniformBuffer;
const W = 128, H = 72; // coarse grid
const echoes = [];
let genes = { viscosity: 0.15, forceGain: 1.2, morphAmp: 0.8 };
let bestFitness = 0;
let worker;
let orientation = { beta: 0, gamma: 0 };
let pointer = { x: 0.5, y: 0.5, vx: 0, vy: 0 };

async function initWebGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'no WebGPU — Canvas2D fallback notes'; return false; }
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Simple grid fluid: velocity + density storage
  const byteSize = W * H * 4 * 4; // vec4 per cell: vx,vy,density,vort
  storageBuffer = device.createBuffer({ size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  uniformBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  const shader = device.createShaderModule({
    code: `
      struct Uniforms { viscosity: f32, forceGain: f32, px: f32, py: f32, pvx: f32, pvy: f32, beta: f32, gamma: f32, time: f32 };
      @group(0) @binding(0) var<storage, read_write> field: array<vec4<f32>>;
      @group(0) @binding(1) var<uniform> u: Uniforms;

      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let x = i32(id.x); let y = i32(id.y);
        if (x >= ${W} || y >= ${H}) { return; }
        let idx = y * ${W} + x;
        var v = field[idx];
        // simple diffusion + advection proxy + force injection
        let force = vec2<f32>(u.pvx * u.forceGain + u.gamma * 0.01, u.pvy * u.forceGain + u.beta * 0.01);
        let dist = length(vec2<f32>(f32(x)/${W} - u.px, f32(y)/${H} - u.py));
        let inject = force * exp(-dist * dist * 20.0);
        v.xy += inject * 0.1;
        v.xy *= (1.0 - u.viscosity);
        // rough vorticity proxy
        v.w = abs(v.x - v.y) * 0.5;
        v.z = saturate(v.z * 0.98 + length(inject) * 0.2);
        field[idx] = v;
      }
    `
  });

  pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'main' }
  });

  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: storageBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } }
    ]
  });

  statusEl.textContent = 'WebGPU ready';
  return true;
}

function updateUniforms(t) {
  const data = new Float32Array([
    genes.viscosity, genes.forceGain, pointer.x, pointer.y, pointer.vx, pointer.vy,
    orientation.beta || 0, orientation.gamma || 0, t
  ]);
  device.queue.writeBuffer(uniformBuffer, 0, data);
}

function stepCompute(t) {
  updateUniforms(t);
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8));
  pass.end();
  device.queue.submit([encoder.finish()]);
}

// Fallback visual
const ctx2 = canvas.getContext('2d');
function renderFallback() {
  ctx2.fillStyle = '#0a0a12';
  ctx2.fillRect(0,0,canvas.width,canvas.height);
  ctx2.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')}, 70%, 50%, 0.3)`;
  for (let i=0;i<40;i++) {
    ctx2.beginPath();
    ctx2.arc(Math.random()*canvas.width, Math.random()*canvas.height, 2+Math.random()*4, 0, Math.PI*2);
    ctx2.fill();
  }
}

function createEcho(text) {
  const el = document.createElement('div');
  el.className = 'echo';
  el.textContent = text;
  el.style.left = (Math.random()*80+10)+'%';
  el.style.top = (Math.random()*70+10)+'%';
  document.body.appendChild(el);
  echoes.push({ el, vx: 0, vy: 0, age: 0 });
  return el;
}

function updateEchoes() {
  echoes.forEach(e => {
    e.age++;
    // advection proxy from pointer + orientation
    e.vx = (pointer.vx + (orientation.gamma||0)*0.002) * 0.3;
    e.vy = (pointer.vy + (orientation.beta||0)*0.002) * 0.3;
    const left = parseFloat(e.el.style.left) + e.vx;
    const top = parseFloat(e.el.style.top) + e.vy;
    e.el.style.left = Math.max(5, Math.min(85, left)) + '%';
    e.el.style.top = Math.max(5, Math.min(80, top)) + '%';
    const vort = Math.abs(e.vx - e.vy) * genes.morphAmp * 10;
    e.el.style.transform = `scale(${1 + vort*0.1}) rotate(${vort*5}deg)`;
    e.el.style.borderColor = `hsla(${parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hue')) + vort*20}, 70%, 60%, 0.7)`;
  });
}

function startWorker() {
  const code = `
    let pop = Array.from({length: 6}, () => ({ viscosity: 0.1 + Math.random()*0.2, forceGain: 0.8 + Math.random()*0.8, morphAmp: 0.5 + Math.random()*0.6, fit: 0 }));
    self.onmessage = e => {
      const { residual, coherence } = e.data;
      pop.forEach(g => g.fit = coherence - residual * 0.5 + Math.random()*0.05);
      pop.sort((a,b) => b.fit - a.fit);
      const best = pop[0];
      // mutate
      for (let i=2;i<pop.length;i++) {
        pop[i].viscosity = Math.max(0.01, Math.min(0.4, best.viscosity + (Math.random()-0.5)*0.05));
        pop[i].forceGain = Math.max(0.2, Math.min(2.5, best.forceGain + (Math.random()-0.5)*0.2));
        pop[i].morphAmp = Math.max(0.2, Math.min(1.5, best.morphAmp + (Math.random()-0.5)*0.15));
      }
      self.postMessage(best);
    };
  `;
  const blob = new Blob([code], {type: 'application/javascript'});
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    const g = e.data;
    if (g.fit > bestFitness) { bestFitness = g.fit; genes = g; }
  };
}

function loop(t = 0) {
  if (device) stepCompute(t * 0.001);
  else renderFallback();
  updateEchoes();
  // morph chrome
  const energy = Math.abs(pointer.vx) + Math.abs(pointer.vy) + Math.abs(orientation.beta||0)*0.1;
  document.documentElement.style.setProperty('--hue', (220 + energy * 40) % 360);
  if (worker && Math.random() < 0.02) {
    worker.postMessage({ residual: Math.random()*0.3, coherence: energy });
  }
  requestAnimationFrame(loop);
}

// inputs
window.addEventListener('pointermove', e => {
  const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight;
  pointer.vx = (nx - pointer.x) * 10;
  pointer.vy = (ny - pointer.y) * 10;
  pointer.x = nx; pointer.y = ny;
});
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
}
document.getElementById('seal').onclick = () => {
  localStorage.setItem('f187-genes', JSON.stringify(genes));
  statusEl.textContent = 'sealed';
};
document.getElementById('reset').onclick = () => {
  localStorage.removeItem('f187-genes');
  location.reload();
};

async function boot() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  const ok = await initWebGPU();
  const saved = localStorage.getItem('f187-genes');
  if (saved) try { genes = JSON.parse(saved); } catch {}
  startWorker();
  for (let i=0;i<5;i++) createEcho(['echo','vort','flow','mind','void'][i]);
  loop();
  statusEl.textContent = ok ? 'live' : 'fallback';
}
boot();
