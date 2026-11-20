const status = document.getElementById('status');
const canvas = document.getElementById('c');
const portalsEl = document.getElementById('portals');

// ---- Local Genetic Programming Mind ----
const OPS = ['+', '-', '*', 'sin', 'abs', 'min', 'x', 'y', 'z', '0.5', '1.0'];
function randomTree(depth = 0) {
  if (depth > 3 || Math.random() < 0.3) return OPS[Math.floor(Math.random() * OPS.length)];
  const op = OPS[Math.floor(Math.random() * 6)]; // binary/unary
  if (['sin','abs'].includes(op)) return [op, randomTree(depth+1)];
  return [op, randomTree(depth+1), randomTree(depth+1)];
}
function evalTree(tree, x, y, z) {
  if (typeof tree === 'string') {
    if (tree === 'x') return x;
    if (tree === 'y') return y;
    if (tree === 'z') return z;
    return parseFloat(tree);
  }
  const [op, a, b] = tree;
  const va = evalTree(a, x, y, z);
  if (op === 'sin') return Math.sin(va);
  if (op === 'abs') return Math.abs(va);
  const vb = evalTree(b, x, y, z);
  if (op === '+') return va + vb;
  if (op === '-') return va - vb;
  if (op === '*') return va * vb;
  if (op === 'min') return Math.min(va, vb);
  return 0;
}
function mutate(tree) {
  if (Math.random() < 0.4 || typeof tree === 'string') return randomTree(0);
  const [op, a, b] = tree;
  if (Math.random() < 0.5) return [op, mutate(a), b];
  return [op, a, mutate(b || a)];
}

let population = Array.from({length: 8}, () => ({ tree: randomTree(), fitness: 0 }));
let active = 0;
let frame = 0;
let dwell = 0;
let lastGaze = { x: 0.5, y: 0.5 };

// ---- Gaze ----
window.addEventListener('pointermove', e => {
  lastGaze.x = e.clientX / innerWidth;
  lastGaze.y = e.clientY / innerHeight;
});
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) lastGaze.x = (e.gamma || 0) / 90 + 0.5;
    if (e.alpha != null) lastGaze.y = (e.beta || 0) / 180 + 0.5;
  });
}

// ---- SDF evaluation (CPU for portals + fallback) ----
function sdSphere(p, c, r) {
  return Math.hypot(p[0]-c[0], p[1]-c[1], p[2]-c[2]) - r;
}
function sdBox(p, c, b) {
  const d = [Math.abs(p[0]-c[0])-b[0], Math.abs(p[1]-c[1])-b[1], Math.abs(p[2]-c[2])-b[2]];
  return Math.min(Math.max(d[0], d[1], d[2]), 0) + Math.hypot(Math.max(d[0],0), Math.max(d[1],0), Math.max(d[2],0));
}
function currentModifier(p) {
  try {
    return evalTree(population[active].tree, p[0], p[1], p[2]) * 0.15;
  } catch { return 0; }
}
function sdScene(p) {
  const s1 = sdSphere(p, [0,0,0], 1.2);
  const s2 = sdSphere(p, [1.5,0.5,0], 0.8);
  const b1 = sdBox(p, [-1.2,-0.4,0.5], [0.6,0.6,0.6]);
  let d = Math.min(s1, s2, b1);
  d += currentModifier(p);
  return d;
}

// ---- Portals ----
const portalCount = 5;
const portals = [];
for (let i = 0; i < portalCount; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `P${i+1}`;
  portalsEl.appendChild(el);
  portals.push({ el, screenX: 0.2 + i * 0.15, screenY: 0.7 });
}

function updatePortals() {
  portals.forEach((p, i) => {
    // Simple projection: ray from camera through screen point
    const sx = (p.screenX - 0.5) * 2;
    const sy = (0.5 - p.screenY) * 2;
    const ro = [0, 0, -4];
    const rd = [sx * 0.8, sy * 0.8, 1];
    const len = Math.hypot(...rd);
    rd[0]/=len; rd[1]/=len; rd[2]/=len;
    let t = 0.1, hit = 10;
    for (let s = 0; s < 32; s++) {
      const pos = [ro[0]+rd[0]*t, ro[1]+rd[1]*t, ro[2]+rd[2]*t];
      const d = sdScene(pos);
      if (d < 0.02) { hit = t; break; }
      t += Math.max(d, 0.05);
      if (t > 8) break;
    }
    const residual = hit - 2.5;
    const tx = (p.screenX * innerWidth - 45) + residual * 40;
    const ty = (p.screenY * innerHeight - 30) + Math.sin(frame * 0.02 + i) * 10;
    const rot = residual * 15;
    p.el.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
  });
}

// ---- WebGPU or Canvas2D fallback ----
let gpu = null, ctx2d = null;
async function initGPU() {
  if (!navigator.gpu) throw new Error('no webgpu');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('no adapter');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const shader = device.createShaderModule({
    code: `
      struct Uniforms { frame: f32, modStrength: f32 };
      @group(0) @binding(0) var<uniform> u: Uniforms;
      @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
        var p = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
        return vec4f(p[i], 0, 1);
      }
      fn sdSphere(p: vec3f, c: vec3f, r: f32) -> f32 { return length(p-c) - r; }
      fn sdBox(p: vec3f, c: vec3f, b: vec3f) -> f32 {
        let d = abs(p-c) - b;
        return min(max(d.x, max(d.y, d.z)), 0.) + length(max(d, vec3f(0)));
      }
      fn modifier(p: vec3f) -> f32 {
        // Placeholder; real modifier injected via uniform strength + simple wave
        return sin(p.x*2. + u.frame*0.01) * cos(p.y*1.5) * u.modStrength;
      }
      fn sdScene(p: vec3f) -> f32 {
        let s1 = sdSphere(p, vec3f(0), 1.2);
        let s2 = sdSphere(p, vec3f(1.5,0.5,0), 0.8);
        let b1 = sdBox(p, vec3f(-1.2,-0.4,0.5), vec3f(0.6));
        return min(min(s1,s2), b1) + modifier(p);
      }
      @fragment fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
        let uv = (frag.xy / vec2f(${canvas.width}, ${canvas.height})) * 2. - 1.;
        let ro = vec3f(0, 0, -4);
        let rd = normalize(vec3f(uv.x * 0.9, uv.y * 0.9, 1.));
        var t = 0.1;
        var col = vec3f(0.02, 0.02, 0.05);
        for (var i = 0; i < 48; i++) {
          let p = ro + rd * t;
          let d = sdScene(p);
          if (d < 0.015) {
            let n = normalize(vec3f(
              sdScene(p+vec3f(0.01,0,0)) - sdScene(p-vec3f(0.01,0,0)),
              sdScene(p+vec3f(0,0.01,0)) - sdScene(p-vec3f(0,0.01,0)),
              sdScene(p+vec3f(0,0,0.01)) - sdScene(p-vec3f(0,0,0.01))
            ));
            let light = normalize(vec3f(0.6, 0.8, -0.4));
            let diff = max(dot(n, light), 0.);
            col = vec3f(0.3, 0.5, 0.9) * (0.2 + diff * 0.8);
            break;
          }
          t += max(d, 0.02);
          if (t > 10.) break;
        }
        return vec4f(col, 1.);
      }
    `
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vs' },
    fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  const uniformBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuf } }]
  });

  gpu = { device, context, pipeline, uniformBuf, bindGroup, format };
  status.textContent = 'WebGPU SDF raymarcher active';
}

function render2D() {
  if (!ctx2d) {
    ctx2d = canvas.getContext('2d');
    status.textContent = 'Canvas2D software raymarch (WebGPU unavailable)';
  }
  const w = canvas.width = innerWidth;
  const h = canvas.height = innerHeight;
  const img = ctx2d.createImageData(w, h);
  const data = img.data;
  // Low-res march for performance
  const step = 4;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const uvx = (x / w) * 2 - 1;
      const uvy = (y / h) * 2 - 1;
      const ro = [0,0,-4];
      const rd = [uvx*0.9, -uvy*0.9, 1];
      const len = Math.hypot(...rd); rd[0]/=len; rd[1]/=len; rd[2]/=len;
      let t = 0.1, col = [5,5,12];
      for (let s = 0; s < 24; s++) {
        const p = [ro[0]+rd[0]*t, ro[1]+rd[1]*t, ro[2]+rd[2]*t];
        const d = sdScene(p);
        if (d < 0.03) {
          col = [80 + d*200, 140, 220];
          break;
        }
        t += Math.max(d, 0.04);
        if (t > 8) break;
      }
      for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
        const i = ((y+dy)*w + (x+dx)) * 4;
        if (i < data.length) {
          data[i] = col[0]; data[i+1] = col[1]; data[i+2] = col[2]; data[i+3] = 255;
        }
      }
    }
  }
  ctx2d.putImageData(img, 0, 0);
}

async function loop() {
  frame++;
  // Gaze dwell reward
  const dx = lastGaze.x - 0.5, dy = lastGaze.y - 0.5;
  if (Math.hypot(dx, dy) < 0.25) dwell += 0.02;
  else dwell *= 0.98;
  population[active].fitness += dwell * 0.1;

  // Evolve periodically
  if (frame % 180 === 0) {
    population.sort((a,b) => b.fitness - a.fitness);
    const worst = population.length - 1;
    population[worst] = { tree: mutate(population[0].tree), fitness: population[0].fitness * 0.5 };
    active = 0;
    status.textContent = `Mind fitness ${population[0].fitness.toFixed(1)} | active tree depth evolving`;
  }

  updatePortals();

  if (gpu) {
    const { device, context, pipeline, uniformBuf, bindGroup } = gpu;
    device.queue.writeBuffer(uniformBuf, 0, new Float32Array([frame, Math.min(dwell, 2)]));
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
        loadOp: 'clear', storeOp: 'store'
      }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
  } else {
    render2D();
  }

  requestAnimationFrame(loop);
}

// ---- Seal / Export ----
const DB = 'verse-f839';
const CH = new BroadcastChannel('f839-sculpt');

async function seal() {
  const best = population[0];
  const data = { tree: best.tree, fitness: best.fitness, ts: Date.now() };
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(data, 'best');
    };
  } catch (e) { console.debug("lab f839-webgpu-gaze-sculpted-sdf-mind:", e); }
  CH.postMessage(data);
  status.textContent = 'Mind sealed & broadcast';
}

CH.onmessage = e => {
  if (e.data.fitness > population[0].fitness) {
    population[0] = { tree: e.data.tree, fitness: e.data.fitness };
    active = 0;
    status.textContent = 'Adopted stronger sculpted mind from another tab';
  }
};

document.getElementById('seal').onclick = seal;
document.getElementById('evolve').onclick = () => { frame = 179; };
document.getElementById('export').onclick = () => {
  const blob = new Blob([JSON.stringify({
    concept: 'F839-webgpu-gaze-sculpted-sdf-mind',
    best: population[0],
    portals: portals.map(p => ({ x: p.screenX, y: p.screenY })),
    note: 'Gaze-sculpted SDF genome. Verse is now Verse everywhere.'
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f839-sculpted-scene.json';
  a.click();
};

// Resize
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Start
initGPU().catch(() => {}).finally(() => requestAnimationFrame(loop));
