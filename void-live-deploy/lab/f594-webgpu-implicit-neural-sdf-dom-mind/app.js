const statusEl = document.getElementById('status');
const canvas = document.getElementById('canvas');
const scene = document.getElementById('scene');

// Tiny MLP SDF: 3 → 16 → 16 → 1
const H = 16;
let w1 = new Float32Array(3 * H);
let b1 = new Float32Array(H);
let w2 = new Float32Array(H * H);
let b2 = new Float32Array(H);
let w3 = new Float32Array(H);
let b3 = new Float32Array(1);

function randn() { return (Math.random() * 2 - 1) * 0.5; }
function initWeights() {
  for (let i = 0; i < w1.length; i++) w1[i] = randn();
  for (let i = 0; i < b1.length; i++) b1[i] = randn() * 0.1;
  for (let i = 0; i < w2.length; i++) w2[i] = randn();
  for (let i = 0; i < b2.length; i++) b2[i] = randn() * 0.1;
  for (let i = 0; i < w3.length; i++) w3[i] = randn();
  b3[0] = randn() * 0.1;
}
initWeights();

function relu(x) { return Math.max(0, x); }

function evalSDF(x, y, z) {
  // Layer 1
  const h1 = new Float32Array(H);
  for (let i = 0; i < H; i++) {
    h1[i] = w1[i*3]*x + w1[i*3+1]*y + w1[i*3+2]*z + b1[i];
    h1[i] = relu(h1[i]);
  }
  // Layer 2
  const h2 = new Float32Array(H);
  for (let i = 0; i < H; i++) {
    let s = b2[i];
    for (let j = 0; j < H; j++) s += w2[i*H + j] * h1[j];
    h2[i] = relu(s);
  }
  // Output
  let o = b3[0];
  for (let j = 0; j < H; j++) o += w3[j] * h2[j];
  return o; // distance-like
}

// Samples for local evolution
const samples = []; // {x,y,z, target}
function addSample(x, y, z, target = 0) {
  samples.push({x, y, z, target});
  if (samples.length > 64) samples.shift();
}

function evolve() {
  if (samples.length < 4) return;
  // Simple mutation + selection on a few weights
  const fitness = () => {
    let err = 0;
    for (const s of samples) {
      const d = evalSDF(s.x, s.y, s.z);
      err += (d - s.target) ** 2;
    }
    return -err;
  };
  let best = fitness();
  const backup = [w1.slice(), b1.slice(), w2.slice(), b2.slice(), w3.slice(), b3.slice()];
  for (let trial = 0; trial < 8; trial++) {
    // Mutate a random subset
    const idx = Math.floor(Math.random() * w3.length);
    const old = w3[idx];
    w3[idx] += (Math.random() - 0.5) * 0.2;
    const f = fitness();
    if (f > best) best = f;
    else w3[idx] = old;
  }
  // Occasional larger reset of unused
  if (Math.random() < 0.05) {
    for (let i = 0; i < 4; i++) w1[Math.floor(Math.random()*w1.length)] *= 0.9;
  }
}

// DOM nodes
const nodes = [];
const labels = ['Idea', 'Memory', 'Question', 'Link', 'Pattern', 'Doubt', 'Spark', 'Echo', 'Seed', 'Verse', 'Flow', 'Core'];
for (let i = 0; i < 12; i++) {
  const el = document.createElement('div');
  el.className = 'node';
  el.textContent = labels[i];
  el.onclick = () => {
    const rect = el.getBoundingClientRect();
    // Rough world pos from screen (simplified)
    addSample((rect.left / window.innerWidth - 0.5) * 4, (0.5 - rect.top / window.innerHeight) * 4, 0, 0);
    statusEl.textContent = `Seeded ${labels[i]}`;
  };
  scene.appendChild(el);
  nodes.push({el, phase: Math.random() * Math.PI * 2, orbit: 1.2 + Math.random() * 1.5});
}

// WebGPU setup
let device, context, pipeline, uniformBuffer;
async function initGPU() {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU unavailable — Canvas2D fallback';
    return false;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const shader = `
    @group(0) @binding(0) var<uniform> weights: array<f32, 600>; // packed
    struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
    @vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
      var p = array<vec2f, 6>(vec2f(-1,-1), vec2f(1,-1), vec2f(-1,1), vec2f(-1,1), vec2f(1,-1), vec2f(1,1));
      var o: VSOut;
      o.pos = vec4f(p[i], 0, 1);
      o.uv = p[i];
      return o;
    }
    fn sdf(p: vec3f) -> f32 {
      // Simplified evaluation using first few weights for demo speed
      let x = p.x; let y = p.y; let z = p.z;
      var h = 0.0;
      for (var i = 0u; i < 8u; i++) {
        h += weights[i] * x + weights[i+8u] * y + weights[i+16u] * z;
      }
      return length(p) - 1.2 + 0.3 * sin(h * 2.0 + p.x);
    }
    @fragment fn fs(in: VSOut) -> @location(0) vec4f {
      let ro = vec3f(0, 0, 3.5);
      let rd = normalize(vec3f(in.uv * 1.5, -1.0));
      var t = 0.0;
      var col = vec3f(0.02, 0.03, 0.06);
      for (var i = 0; i < 48; i++) {
        let p = ro + rd * t;
        let d = sdf(p);
        if (d < 0.01) {
          col = vec3f(0.2, 0.5, 0.9) * (1.0 - t*0.15);
          break;
        }
        t += d * 0.8;
        if (t > 8.0) break;
      }
      return vec4f(col, 1.0);
    }
  `;
  const module = device.createShaderModule({ code: shader });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });
  uniformBuffer = device.createBuffer({ size: 600 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  statusEl.textContent = 'WebGPU raymarcher active';
  return true;
}

function packWeights() {
  const data = new Float32Array(600);
  data.set(w1, 0);
  data.set(b1, w1.length);
  // partial for shader simplicity
  return data;
}

let gpuReady = false;
initGPU().then(ok => { gpuReady = ok; });

// Interaction
canvas.addEventListener('pointerdown', e => {
  const x = (e.clientX / window.innerWidth - 0.5) * 4;
  const y = (0.5 - e.clientY / window.innerHeight) * 4;
  addSample(x, y, 0.2, 0);
  statusEl.textContent = `Sculpted at (${x.toFixed(1)}, ${y.toFixed(1)})`;
});

// Main loop
let lastEvolve = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (gpuReady && device) {
    device.queue.writeBuffer(uniformBuffer, 0, packWeights());
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.03, b: 0.06, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    }));
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Position DOM nodes on approximate surface
  const time = t * 0.001;
  nodes.forEach((n, i) => {
    const a = n.phase + time * 0.4 + i * 0.5;
    let px = Math.cos(a) * n.orbit;
    let py = Math.sin(a * 0.7) * n.orbit * 0.6;
    let pz = Math.sin(a * 1.3) * 0.8;
    // Project toward surface (simple radial push)
    const d = evalSDF(px, py, pz);
    const scale = 1.0 / (1.0 + Math.abs(d));
    px *= scale; py *= scale;
    const sx = (px / 4 + 0.5) * window.innerWidth - 60;
    const sy = (0.5 - py / 4) * window.innerHeight - 35;
    n.el.style.transform = `translate3d(${sx}px, ${sy}px, ${pz * 40}px) rotateY(${a}rad)`;
    n.el.style.opacity = 0.7 + 0.3 * Math.cos(time + i);
  });

  if (t - lastEvolve > 1500) {
    evolve();
    lastEvolve = t;
  }
}
requestAnimationFrame(frame);

statusEl.textContent = 'Ready — click to sculpt the mind volume';
