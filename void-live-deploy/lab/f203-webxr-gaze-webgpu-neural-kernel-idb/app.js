const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GRID = 64;
let field = new Float32Array(GRID * GRID);
let next = new Float32Array(GRID * GRID);
let gaze = { x: 0.5, y: 0.5, energy: 0 };
let orient = { beta: 0, gamma: 0 };
let useWebGPU = false;
let device, pipeline, gridBuf, paramBuf, bindGroup;

// Tiny MLP: 4 in (gx, gy, tilt, local_energy) → 3 out (decay, diff, rec)
let weights = new Float32Array(4*3 + 3); // simple linear + bias
function initMLP() {
  for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.4;
}
initMLP();
function mlpForward(gx, gy, tilt, local) {
  const out = [0,0,0];
  for (let o = 0; o < 3; o++) {
    let s = weights[4*3 + o];
    s += weights[o*4 + 0] * gx;
    s += weights[o*4 + 1] * gy;
    s += weights[o*4 + 2] * tilt;
    s += weights[o*4 + 3] * local;
    out[o] = Math.tanh(s);
  }
  return out; // decay ~0.9-0.99, etc mapped later
}

// IndexedDB
let db;
const DB_NAME = 'f203-kernel';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('genomes')) d.createObjectStore('genomes');
      if (!d.objectStoreNames.contains('fields')) d.createObjectStore('fields');
    };
    r.onsuccess = e => { db = e.target.result; res(db); };
    r.onerror = rej;
  });
}
async function saveGenome(hash, w) {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ hash, weights: Array.from(w), t: Date.now() }, 'latest');
}
async function loadGenome() {
  if (!db) return null;
  return new Promise(res => {
    const tx = db.transaction('genomes', 'readonly');
    const r = tx.objectStore('genomes').get('latest');
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}
async function saveField() {
  if (!db) return;
  const tx = db.transaction('fields', 'readwrite');
  tx.objectStore('fields').put({ data: Array.from(field), t: Date.now() }, 'current');
}
async function loadField() {
  if (!db) return;
  const tx = db.transaction('fields', 'readonly');
  const r = tx.objectStore('fields').get('current');
  r.onsuccess = () => { if (r.result && r.result.data) field.set(r.result.data); };
}

function hashWeights(w) {
  let h = 2166136261;
  for (let i = 0; i < w.length; i++) {
    h ^= Math.floor(w[i] * 1000);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

// WebGPU init (best-effort)
async function initWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    const shader = device.createShaderModule({
      code: `
@group(0) @binding(0) var<storage, read_write> grid: array<f32>;
@group(0) @binding(1) var<uniform> params: vec4<f32>; // decay, diff, rec, energy
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let x = id.x; let y = id.y;
  if (x >= 64u || y >= 64u) { return; }
  let i = y * 64u + x;
  var n = 0.0; var c = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let nx = (x + u32(dx) + 64u) % 64u;
      let ny = (y + u32(dy) + 64u) % 64u;
      n += grid[ny * 64u + nx]; c += 1.0;
    }
  }
  n /= c;
  let cur = grid[i];
  let updated = params.x * cur + params.y * (n - cur) + params.z * params.w * 0.01;
  grid[i] = clamp(updated, 0.0, 1.0);
}
`
    });
    pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' }
    });
    gridBuf = device.createBuffer({ size: GRID*GRID*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    paramBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gridBuf } },
        { binding: 1, resource: { buffer: paramBuf } }
      ]
    });
    return true;
  } catch (e) { console.warn('WebGPU fail', e); return false; }
}

function cpuKernel(mod) {
  const decay = 0.92 + mod[0] * 0.05;
  const diff = 0.15 + mod[1] * 0.1;
  const rec = 0.3 + mod[2] * 0.2;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      let n = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = (x + dx + GRID) % GRID, ny = (y + dy + GRID) % GRID;
        n += field[ny * GRID + nx]; c++;
      }
      n /= c;
      let v = decay * field[i] + diff * (n - field[i]);
      // gaze deposit
      const gx = Math.floor(gaze.x * GRID), gy = Math.floor(gaze.y * GRID);
      if (Math.abs(x - gx) < 3 && Math.abs(y - gy) < 3) v += gaze.energy * rec * 0.05;
      next[i] = Math.max(0, Math.min(1, v));
    }
  }
  field.set(next);
}

async function gpuKernel(mod) {
  if (!device) return cpuKernel(mod);
  const decay = 0.92 + mod[0] * 0.05;
  const diff = 0.15 + mod[1] * 0.1;
  const rec = 0.3 + mod[2] * 0.2;
  device.queue.writeBuffer(gridBuf, 0, field);
  device.queue.writeBuffer(paramBuf, 0, new Float32Array([decay, diff, rec, gaze.energy]));
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(8, 8);
  pass.end();
  // copy back (simplified; real would use mapAsync)
  device.queue.submit([enc.finish()]);
  // For demo, also run CPU to keep visualization in sync (full readback omitted for simplicity)
  cpuKernel(mod);
}

function sampleField(fx, fy) {
  const x = Math.floor(fx * GRID) % GRID, y = Math.floor(fy * GRID) % GRID;
  return field[y * GRID + x] || 0;
}

const probes = [
  { el: document.getElementById('p1'), tx: 0.3, ty: 0.3 },
  { el: document.getElementById('p2'), tx: 0.7, ty: 0.4 },
  { el: document.getElementById('p3'), tx: 0.5, ty: 0.7 }
];

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const cellW = W / GRID, cellH = H / GRID;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const v = field[y * GRID + x];
      if (v > 0.02) {
        const hue = 200 + v * 80;
        ctx.fillStyle = `hsla(${hue},70%,${40 + v*40}%,${0.3 + v*0.5})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
      }
    }
  }
  // probes
  probes.forEach((p, i) => {
    const e = sampleField(p.tx, p.ty);
    const px = p.tx * W + Math.sin(performance.now()/800 + i) * 20;
    const py = p.ty * H + Math.cos(performance.now()/900 + i) * 15;
    p.el.style.left = (px - 40) + 'px';
    p.el.style.top = (py - 25) + 'px';
    p.el.style.transform = `scale(${0.8 + e * 0.6})`;
    p.el.style.background = `hsla(${220 + e*60},60%,${30 + e*30}%,0.75)`;
    p.el.textContent = `P${i+1} e:${e.toFixed(2)}`;
  });
}

let last = 0;
async function loop(t) {
  const dt = t - last; last = t;
  gaze.energy *= 0.92;
  const tilt = (orient.beta + orient.gamma) / 180;
  const local = sampleField(gaze.x, gaze.y);
  const mod = mlpForward(gaze.x, gaze.y, tilt, local);
  if (useWebGPU) await gpuKernel(mod); else cpuKernel(mod);
  render();
  requestAnimationFrame(loop);
}

// Input
canvas.addEventListener('pointermove', e => {
  gaze.x = e.clientX / W;
  gaze.y = e.clientY / H;
  gaze.energy = Math.min(1, gaze.energy + 0.08);
});
canvas.addEventListener('pointerdown', e => { gaze.energy = 1; });

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

document.getElementById('seal').onclick = async () => {
  const h = hashWeights(weights);
  await saveGenome(h, weights);
  statusEl.textContent = `Sealed ${h}`;
};
document.getElementById('inject').onclick = async () => {
  const g = await loadGenome();
  if (g && g.weights) {
    weights.set(g.weights);
    // light mutation
    for (let i = 0; i < weights.length; i++) weights[i] += (Math.random()-0.5)*0.05;
    statusEl.textContent = `Injected ${g.hash}`;
  }
};
document.getElementById('clear').onclick = () => { field.fill(0); };

(async () => {
  await openDB();
  await loadField();
  const g = await loadGenome();
  if (g && g.weights) weights.set(g.weights);
  useWebGPU = await initWebGPU();
  statusEl.textContent = useWebGPU ? 'WebGPU kernel active' : 'CPU kernel (WebGPU unavailable)';
  setInterval(saveField, 5000);
  requestAnimationFrame(loop);
})();
