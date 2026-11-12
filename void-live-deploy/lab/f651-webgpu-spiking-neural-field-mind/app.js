const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const N = 64;
const TAU = 20;
const THETA = 1.0;
const RESET = 0.0;
const REFRACT = 4;
let weights = new Float32Array(4); // simple global couplings: self, right, down, diag
weights.fill(0.15);
let mlpHidden = new Float32Array(4);
let learningRate = 0.002;
let spikeCounts = new Float32Array(N * N);
let lastSpikeRate = 0;
let useWebGPU = false;
let gpuDevice, gpuPipeline, gpuBindGroup, vBuffer, sBuffer, stimBuffer, wBuffer;
let jsV = new Float32Array(N * N);
let jsS = new Uint8Array(N * N);
let jsRef = new Uint8Array(N * N);
let stim = new Float32Array(N * N);
let running = true;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Simple MLP: input [rate, pointerSpeed, tiltDummy], hidden 4, output 4 deltas
function mlpForward(input) {
  // hard-coded tiny random-ish weights for demo; in real would be learned
  const h = new Float32Array(4);
  for (let i = 0; i < 4; i++) {
    h[i] = Math.tanh(input[0] * (0.5 + i*0.1) + input[1] * 0.3 + mlpHidden[i] * 0.2);
  }
  mlpHidden.set(h);
  const out = new Float32Array(4);
  for (let i = 0; i < 4; i++) out[i] = h[i] * 0.05;
  return out;
}

function updateMLP(rate) {
  const input = [rate, lastPointerSpeed || 0, 0];
  const delta = mlpForward(input);
  for (let i = 0; i < 4; i++) {
    weights[i] = Math.max(0, Math.min(0.8, weights[i] + delta[i] * learningRate * (rate > 0.05 ? 1 : -0.2)));
  }
}

async function initWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    gpuDevice = await adapter.requestDevice();
    const shader = `
      @group(0) @binding(0) var<storage, read_write> v: array<f32>;
      @group(0) @binding(1) var<storage, read_write> s: array<u32>;
      @group(0) @binding(2) var<storage, read> stim: array<f32>;
      @group(0) @binding(3) var<storage, read> w: array<f32>;
      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let x = gid.x; let y = gid.y;
        if (x >= ${N}u || y >= ${N}u) { return; }
        let i = y * ${N}u + x;
        var mem = v[i];
        // simple neighbor input
        var isyn = 0.0;
        if (x > 0u) { isyn += f32(s[i-1u]) * w[1]; }
        if (y > 0u) { isyn += f32(s[i-${N}u]) * w[2]; }
        isyn += f32(s[i]) * w[0];
        mem += (-mem / ${TAU}.0 + isyn + stim[i]) * 0.1;
        var spiked = 0u;
        if (mem > ${THETA}.0) {
          mem = ${RESET}.0;
          spiked = 1u;
        }
        v[i] = mem;
        s[i] = spiked;
      }
    `;
    const module = gpuDevice.createShaderModule({ code: shader });
    gpuPipeline = gpuDevice.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    vBuffer = gpuDevice.createBuffer({ size: N*N*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    sBuffer = gpuDevice.createBuffer({ size: N*N*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    stimBuffer = gpuDevice.createBuffer({ size: N*N*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    wBuffer = gpuDevice.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const bindGroupLayout = gpuPipeline.getBindGroupLayout(0);
    gpuBindGroup = gpuDevice.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: vBuffer } },
        { binding: 1, resource: { buffer: sBuffer } },
        { binding: 2, resource: { buffer: stimBuffer } },
        { binding: 3, resource: { buffer: wBuffer } }
      ]
    });
    // init V random
    const initV = new Float32Array(N*N);
    for (let i = 0; i < N*N; i++) initV[i] = Math.random() * 0.5;
    gpuDevice.queue.writeBuffer(vBuffer, 0, initV);
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

function jsStep() {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (jsRef[i] > 0) { jsRef[i]--; continue; }
      let isyn = jsS[i] * weights[0];
      if (x > 0) isyn += jsS[i-1] * weights[1];
      if (y > 0) isyn += jsS[i-N] * weights[2];
      jsV[i] += (-jsV[i] / TAU + isyn + stim[i]) * 0.15;
      if (jsV[i] > THETA) {
        jsV[i] = RESET;
        jsS[i] = 1;
        jsRef[i] = REFRACT;
        spikeCounts[i]++;
      } else {
        jsS[i] = 0;
      }
    }
  }
}

let lastPointerSpeed = 0;
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  const gx = Math.floor(px * N);
  const gy = Math.floor(py * N);
  lastPointerSpeed = Math.hypot(e.movementX, e.movementY) / 20;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && x < N && y >= 0 && y < N) {
        const ii = y * N + x;
        stim[ii] = Math.min(2, stim[ii] + 0.8 * Math.exp(-(dx*dx+dy*dy)));
      }
    }
  }
});
canvas.addEventListener('pointerdown', e => { /* same as move for burst */ });

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cellW = canvas.width / N;
  const cellH = canvas.height / N;
  let totalSpikes = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const spike = useWebGPU ? 0 : jsS[i]; // simplified; in full would readback
      totalSpikes += spike;
      if (spike || stim[i] > 0.1) {
        const intensity = Math.min(1, (spike ? 1 : 0) + stim[i] * 0.5);
        ctx.fillStyle = `rgba(${100 + intensity*155}, ${80 + intensity*100}, ${200 + intensity*55}, ${0.6 + intensity*0.4})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
      }
    }
  }
  // decay stim
  for (let i = 0; i < stim.length; i++) stim[i] *= 0.92;
  lastSpikeRate = totalSpikes / (N * N);
  updateMLP(lastSpikeRate);
  statusEl.textContent = `WebGPU: ${useWebGPU ? 'yes' : 'JS fallback'} | rate: ${lastSpikeRate.toFixed(3)} | w0: ${weights[0].toFixed(3)}`;
}

async function loop() {
  if (!running) return;
  if (useWebGPU && gpuDevice) {
    gpuDevice.queue.writeBuffer(stimBuffer, 0, stim);
    gpuDevice.queue.writeBuffer(wBuffer, 0, weights);
    const encoder = gpuDevice.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(gpuPipeline);
    pass.setBindGroup(0, gpuBindGroup);
    pass.dispatchWorkgroups(Math.ceil(N/8), Math.ceil(N/8));
    pass.end();
    // note: for demo we don't readback every frame to keep simple; spikes visualized via stim/approx
    gpuDevice.queue.submit([encoder.finish()]);
  } else {
    jsStep();
  }
  render();
  requestAnimationFrame(loop);
}

document.getElementById('seal').onclick = () => {
  const data = {
    weights: Array.from(weights),
    rate: lastSpikeRate,
    timestamp: Date.now(),
    hash: Array.from(weights).reduce((a,b)=>a+b,0).toFixed(4)
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f651-spiking-genome.json';
  a.click();
  // PNG
  canvas.toBlob(b => {
    const aa = document.createElement('a');
    aa.href = URL.createObjectURL(b);
    aa.download = 'f651-spike-density.png';
    aa.click();
  });
  // IndexedDB simple
  try {
    const req = indexedDB.open('verse-f651', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(data, 'best');
    };
  } catch (e) { console.debug("lab f651-webgpu-spiking-neural-field-mind:", e); }
  statusEl.textContent = 'Sealed! JSON + PNG downloaded.';
};

document.getElementById('reset').onclick = () => {
  weights.fill(0.15);
  jsV.fill(0.3);
  statusEl.textContent = 'Weights reset.';
};

// try load
try {
  const req = indexedDB.open('verse-f651', 1);
  req.onsuccess = e => {
    const db = e.target.result;
    if (db.objectStoreNames.contains('genomes')) {
      const tx = db.transaction('genomes', 'readonly');
      const get = tx.objectStore('genomes').get('best');
      get.onsuccess = () => {
        if (get.result && get.result.weights) {
          weights.set(get.result.weights);
          statusEl.textContent = 'Restored sealed weights.';
        }
      };
    }
  };
} catch (e) { console.debug("lab f651-webgpu-spiking-neural-field-mind:", e); }

initWebGPU().then(ok => {
  useWebGPU = ok;
  if (!ok) {
    for (let i = 0; i < N*N; i++) jsV[i] = Math.random() * 0.4;
  }
  statusEl.textContent = ok ? 'WebGPU ready — drag to stimulate' : 'JS fallback — drag to stimulate';
  loop();
});
