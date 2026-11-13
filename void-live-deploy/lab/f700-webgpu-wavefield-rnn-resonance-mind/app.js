const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
const N = 128; // grid size
let width, height, cellW, cellH;
function resize() {
  width = canvas.width = innerWidth;
  height = canvas.height = innerHeight;
  cellW = width / N;
  cellH = height / N;
}
addEventListener('resize', resize);
resize();

// Simple wave field (height + velocity)
let h = new Float32Array(N * N);
let v = new Float32Array(N * N);
let h2 = new Float32Array(N * N);

// Tiny Elman RNN
const H = 16;
const I = 6;
let hidden = new Float32Array(H);
let Whh = new Float32Array(H * H);
let Wxh = new Float32Array(H * I);
let Wout = new Float32Array(6 * H);
function rand(a) { for (let i = 0; i < a.length; i++) a[i] = (Math.random() - 0.5) * 0.4; }
rand(Whh); rand(Wxh); rand(Wout);
function rnnStep(input) {
  const next = new Float32Array(H);
  for (let i = 0; i < H; i++) {
    let s = 0;
    for (let j = 0; j < H; j++) s += Whh[i * H + j] * hidden[j];
    for (let j = 0; j < I; j++) s += Wxh[i * I + j] * input[j];
    next[i] = Math.tanh(s);
  }
  hidden.set(next);
  const out = new Float32Array(6);
  for (let i = 0; i < 6; i++) {
    let s = 0;
    for (let j = 0; j < H; j++) s += Wout[i * H + j] * hidden[j];
    out[i] = Math.tanh(s);
  }
  return out;
}

// User input
let ptrX = 0.5, ptrY = 0.5, ptrVx = 0, ptrVy = 0;
let oriX = 0, oriY = 0, pinch = 0;
canvas.addEventListener('pointermove', e => {
  const nx = e.clientX / width, ny = e.clientY / height;
  ptrVx = nx - ptrX; ptrVy = ny - ptrY;
  ptrX = nx; ptrY = ny;
});
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    oriX = (e.gamma || 0) / 90;
    oriY = (e.beta || 0) / 180;
  });
}

// Portals
const portals = [];
for (let i = 0; i < 4; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = '…';
  portalsEl.appendChild(el);
  portals.push({ el, x: Math.random(), y: Math.random(), phrase: '' });
}
const words = ['echo','flux','latent','weave','pulse','drift','node','seed','form','void','verse','mind','field','peak','resonate','causal'];
function projectHidden() {
  let idx = 0;
  for (let i = 0; i < H; i++) idx += Math.abs(hidden[i]);
  const w1 = words[Math.floor(idx * 3) % words.length];
  const w2 = words[Math.floor(idx * 7 + hidden[0]*10) % words.length];
  return `${w1} ${w2}`;
}

function findPeaks(count) {
  const peaks = [];
  const step = 4;
  for (let y = step; y < N - step; y += step) {
    for (let x = step; x < N - step; x += step) {
      const i = y * N + x;
      if (h[i] > 0.4) peaks.push({ x: x / N, y: y / N, e: h[i] });
    }
  }
  peaks.sort((a, b) => b.e - a.e);
  return peaks.slice(0, count);
}

let useGPU = false;
let gpuDevice, pipeline, bindGroup, bufH, bufV;
async function initGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    gpuDevice = await adapter.requestDevice();
    // Minimal compute shader for wave step (simplified for prototype)
    const shader = `
      @group(0) @binding(0) var<storage, read_write> height: array<f32>;
      @group(0) @binding(1) var<storage, read_write> vel: array<f32>;
      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let x = gid.x; let y = gid.y;
        if (x >= ${N}u || y >= ${N}u) { return; }
        let i = y * ${N}u + x;
        // simple laplacian-ish + damping (placeholder; full kernel would be larger)
        var lap = 0.0;
        if (x > 0u && x < ${N-1}u && y > 0u && y < ${N-1}u) {
          lap = height[i-1] + height[i+1] + height[i-${N}] + height[i+${N}] - 4.0 * height[i];
        }
        vel[i] = vel[i] * 0.98 + lap * 0.15;
        height[i] += vel[i];
      }
    `;
    const module = gpuDevice.createShaderModule({ code: shader });
    pipeline = gpuDevice.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    // Buffers would be created and bound; for brevity of prototype we fall back often
    useGPU = true;
    statusEl.textContent = 'WebGPU ready (simplified kernel)';
  } catch (e) {
    console.warn(e);
    useGPU = false;
  }
}
initGPU();

function cpuWaveStep(sources) {
  // sources: array of {x,y,amp,freq}
  const c2 = 0.15, damp = 0.98;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const lap = h[i-1] + h[i+1] + h[i-N] + h[i+N] - 4 * h[i];
      v[i] = v[i] * damp + lap * c2;
    }
  }
  // inject sources
  for (const s of sources) {
    const ix = Math.floor(s.x * N), iy = Math.floor(s.y * N);
    if (ix > 1 && ix < N-2 && iy > 1 && iy < N-2) {
      const i = iy * N + ix;
      h[i] += s.amp * Math.sin(performance.now() * 0.01 * s.freq);
    }
  }
  for (let i = 0; i < h.length; i++) {
    h[i] += v[i];
    h[i] = Math.max(-2, Math.min(2, h[i]));
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const val = (h[i] + 1) * 0.5;
    const c = Math.floor(Math.max(0, Math.min(1, val)) * 255);
    img.data[i*4] = c * 0.4;
    img.data[i*4+1] = c * 0.6;
    img.data[i*4+2] = c;
    img.data[i*4+3] = 255;
  }
  // scale up
  const tmp = document.createElement('canvas');
  tmp.width = N; tmp.height = N;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, width, height);
}

let t0 = performance.now();
function loop() {
  const input = [ptrVx * 8, ptrVy * 8, oriX, oriY, pinch, (performance.now() - t0) * 0.001];
  const out = rnnStep(input);
  const sources = [
    { x: 0.5 + out[0]*0.3, y: 0.5 + out[1]*0.3, amp: 0.8 + out[2]*0.4, freq: 1 + out[3] },
    { x: 0.3 + out[4]*0.2, y: 0.7 + out[5]*0.2, amp: 0.5, freq: 1.5 }
  ];
  cpuWaveStep(sources); // GPU path sketched; CPU always works
  render();
  const peaks = findPeaks(4);
  const phrase = projectHidden();
  peaks.forEach((p, i) => {
    if (portals[i]) {
      portals[i].el.style.left = (p.x * 100) + '%';
      portals[i].el.style.top = (p.y * 100) + '%';
      portals[i].el.textContent = phrase + ' ' + (i+1);
      portals[i].el.style.transform = `translate(-50%,-50%) scale(${1 + p.e * 0.3})`;
    }
  });
  requestAnimationFrame(loop);
}
loop();

// Seal
document.getElementById('seal').onclick = async () => {
  const data = { hidden: Array.from(hidden), Whh: Array.from(Whh), h: Array.from(h.slice(0, 256)) };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f700', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('mind');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind', 'readwrite');
    tx.objectStore('mind').put(data, 'state');
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (memory only)'; }
};

// Simple XR request
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { statusEl.textContent = 'No WebXR'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['hand-tracking'] });
    statusEl.textContent = 'XR active (hand tracking if granted)';
    // full integration would map hands to input; prototype acknowledges
  } catch (e) { statusEl.textContent = 'XR denied or unavailable'; }
};

statusEl.textContent = 'Pointer / orientation drive the mind · Seal persists';
