const N = 192; // particles
const NC = 5;  // curator cards
let particles = new Float32Array(N * 4); // x,y,vx,vy
let energy = 0;
let orientation = { beta: 0, gamma: 0 };
let hasOrient = false;
let hasMic = false;
let analyser = null;
let freqData = null;
let gpu = null;
let mode = 'js';
let forceScale = 1.0;
let dragging = null;
let dragOffset = {x:0,y:0};

function rand(a=1) { return (Math.random()*2-1)*a; }
function initParticles() {
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < N; i++) {
    particles[i*4]   = w/2 + rand(200);
    particles[i*4+1] = h/2 + rand(150);
    particles[i*4+2] = rand(0.5);
    particles[i*4+3] = rand(0.5);
  }
}
initParticles();

const arena = document.getElementById('arena');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const cards = [];
for (let i = 0; i < NC; i++) {
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = `<div>C${i}<br><span class="fit">0.0</span></div>`;
  d.dataset.i = i;
  arena.appendChild(d);
  cards.push(d);
  d.addEventListener('pointerdown', e => {
    dragging = i;
    const r = d.getBoundingClientRect();
    dragOffset.x = e.clientX - r.left;
    dragOffset.y = e.clientY - r.top;
    d.setPointerCapture(e.pointerId);
  });
}
window.addEventListener('pointermove', e => {
  if (dragging === null) return;
  const c = cards[dragging];
  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;
  c.style.transform = `translate(${x}px, ${y}px)`;
  const cx = x + 45, cy = y + 28;
  for (let i = 0; i < N; i++) {
    const dx = cx - particles[i*4];
    const dy = cy - particles[i*4+1];
    const d2 = dx*dx + dy*dy;
    if (d2 < 12000) {
      const f = 0.08 / Math.sqrt(d2 + 40);
      particles[i*4+2] += dx * f;
      particles[i*4+3] += dy * f;
    }
  }
});
window.addEventListener('pointerup', () => { dragging = null; });

document.getElementById('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    hasMic = true;
    document.getElementById('status').textContent = 'Mic live';
  } catch (e) {
    document.getElementById('status').textContent = 'Mic denied (pointer seeds)';
  }
};
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') startOrient(); }).catch(() => startOrient());
  } else startOrient();
};
function startOrient() {
  window.addEventListener('deviceorientation', e => {
    orientation.beta = Math.max(-1, Math.min(1, (e.beta || 0) / 90));
    orientation.gamma = Math.max(-1, Math.min(1, (e.gamma || 0) / 90));
    hasOrient = true;
  });
  document.getElementById('status').textContent = 'Orientation live';
}
document.getElementById('seal').onclick = sealLeader;
document.getElementById('reset').onclick = () => { initParticles(); forceScale = 1; energy = 0; };

async function sealLeader() {
  try {
    const db = await idb();
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ id: 'leader', forceScale, energy, t: Date.now() });
    if (typeof BroadcastChannel !== 'undefined') {
      new BroadcastChannel('f214').postMessage({ type: 'seal', forceScale, energy });
    }
    document.getElementById('status').textContent = `Sealed scale ${forceScale.toFixed(2)}`;
  } catch { document.getElementById('status').textContent = 'Seal failed'; }
}
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f214', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
if (typeof BroadcastChannel !== 'undefined') {
  new BroadcastChannel('f214').onmessage = e => {
    if (e.data?.type === 'seal') {
      forceScale = e.data.forceScale || forceScale;
      document.getElementById('status').textContent = 'Peer sealed scale received';
    }
  };
}

function getAudioForces() {
  if (!hasMic || !analyser) return new Float32Array(8).fill(0);
  analyser.getByteFrequencyData(freqData);
  const bins = new Float32Array(8);
  const step = Math.floor(freqData.length / 8);
  for (let b = 0; b < 8; b++) {
    let s = 0;
    for (let i = 0; i < step; i++) s += freqData[b*step + i];
    bins[b] = (s / step / 255) * forceScale;
  }
  return bins;
}

function stepJS() {
  const bins = getAudioForces();
  const w = window.innerWidth, h = window.innerHeight;
  energy = 0;
  const ox = orientation.gamma * 0.4;
  const oy = orientation.beta * 0.4;
  for (let i = 0; i < N; i++) {
    const b = i % 8;
    let ax = bins[b] * (i % 2 ? 1 : -0.6) + ox;
    let ay = bins[(b+3)%8] * (i % 3 ? 1 : -0.5) + oy;
    particles[i*4+2] = particles[i*4+2] * 0.92 + ax * 0.8;
    particles[i*4+3] = particles[i*4+3] * 0.92 + ay * 0.8;
    particles[i*4]   += particles[i*4+2];
    particles[i*4+1] += particles[i*4+3];
    if (particles[i*4] < 0 || particles[i*4] > w) particles[i*4+2] *= -0.6;
    if (particles[i*4+1] < 0 || particles[i*4+1] > h) particles[i*4+3] *= -0.6;
    particles[i*4] = Math.max(0, Math.min(w, particles[i*4]));
    particles[i*4+1] = Math.max(0, Math.min(h, particles[i*4+1]));
    energy += Math.abs(particles[i*4+2]) + Math.abs(particles[i*4+3]);
  }
  forceScale = forceScale * 0.995 + Math.min(2, energy / N / 2) * 0.005;
}

async function initGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    const shader = `
      @group(0) @binding(0) var<storage, read_write> p: array<f32, ${N*4}>;
      @group(0) @binding(1) var<storage, read> bins: array<f32, 8>;
      @group(0) @binding(2) var<storage, read> orient: vec2<f32>;
      @group(0) @binding(3) var<storage, read> scale: f32;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        if (i >= ${N}u) { return; }
        let b = i % 8u;
        let ax = bins[b] * select(-0.6, 1.0, (i % 2u) == 0u) + orient.x;
        let ay = bins[(b+3u)%8u] * select(-0.5, 1.0, (i % 3u) == 0u) + orient.y;
        p[i*4u+2u] = p[i*4u+2u] * 0.92 + ax * 0.8 * scale;
        p[i*4u+3u] = p[i*4u+3u] * 0.92 + ay * 0.8 * scale;
        p[i*4u]   = p[i*4u] + p[i*4u+2u];
        p[i*4u+1u] = p[i*4u+1u] + p[i*4u+3u];
      }
    `;
    const module = device.createShaderModule({ code: shader });
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    const pBuffer = device.createBuffer({ size: N*4*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const binBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const orientBuffer = device.createBuffer({ size: 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const scaleBuffer = device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: pBuffer } },
        { binding: 1, resource: { buffer: binBuffer } },
        { binding: 2, resource: { buffer: orientBuffer } },
        { binding: 3, resource: { buffer: scaleBuffer } }
      ]
    });
    gpu = { device, pipeline, pBuffer, binBuffer, orientBuffer, scaleBuffer, bindGroup };
    mode = 'webgpu';
    return true;
  } catch { return false; }
}

async function stepGPU() {
  if (!gpu) return stepJS();
  const bins = getAudioForces();
  gpu.device.queue.writeBuffer(gpu.pBuffer, 0, particles);
  gpu.device.queue.writeBuffer(gpu.binBuffer, 0, bins);
  gpu.device.queue.writeBuffer(gpu.orientBuffer, 0, new Float32Array([orientation.gamma*0.4, orientation.beta*0.4]));
  gpu.device.queue.writeBuffer(gpu.scaleBuffer, 0, new Float32Array([forceScale]));
  const encoder = gpu.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(gpu.pipeline);
  pass.setBindGroup(0, gpu.bindGroup);
  pass.dispatchWorkgroups(Math.ceil(N/64));
  pass.end();
  const readBuffer = gpu.device.createBuffer({ size: N*4*4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  encoder.copyBufferToBuffer(gpu.pBuffer, 0, readBuffer, 0, N*4*4);
  gpu.device.queue.submit([encoder.finish()]);
  await readBuffer.mapAsync(GPUMapMode.READ);
  particles.set(new Float32Array(readBuffer.getMappedRange()));
  readBuffer.unmap();
  readBuffer.destroy();
  const w = window.innerWidth, h = window.innerHeight;
  energy = 0;
  for (let i = 0; i < N; i++) {
    if (particles[i*4] < 0 || particles[i*4] > w) particles[i*4+2] *= -0.6;
    if (particles[i*4+1] < 0 || particles[i*4+1] > h) particles[i*4+3] *= -0.6;
    particles[i*4] = Math.max(0, Math.min(w, particles[i*4]));
    particles[i*4+1] = Math.max(0, Math.min(h, particles[i*4+1]));
    energy += Math.abs(particles[i*4+2]) + Math.abs(particles[i*4+3]);
  }
  forceScale = forceScale * 0.995 + Math.min(2, energy / N / 2) * 0.005;
}

function updateCards() {
  for (let c = 0; c < NC; c++) {
    let sx = 0, sy = 0, cnt = 0, e = 0;
    const start = c * Math.floor(N / NC);
    for (let i = start; i < start + Math.floor(N / NC); i++) {
      sx += particles[i*4]; sy += particles[i*4+1]; cnt++;
      e += Math.abs(particles[i*4+2]) + Math.abs(particles[i*4+3]);
    }
    if (cnt) { sx /= cnt; sy /= cnt; }
    const scale = 0.7 + Math.min(1.2, e / cnt / 3);
    const hue = 180 + (e * 2) % 120;
    const card = cards[c];
    if (dragging !== c) {
      card.style.transform = `translate(${sx-45}px, ${sy-28}px) scale(${scale})`;
    }
    card.style.borderColor = `hsl(${hue}, 65%, 55%)`;
    card.querySelector('.fit').textContent = (e / cnt).toFixed(2);
  }
}

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#6cf8';
  for (let i = 0; i < N; i += 2) {
    ctx.beginPath();
    ctx.arc(particles[i*4], particles[i*4+1], 1.4, 0, 6.28);
    ctx.fill();
  }
}

async function loop() {
  if (mode === 'webgpu' && gpu) await stepGPU();
  else stepJS();
  updateCards();
  drawParticles();
  document.getElementById('pcount').textContent = N;
  document.getElementById('ccount').textContent = NC;
  document.getElementById('mode').textContent = mode;
  document.getElementById('energy').textContent = (energy / N).toFixed(2);
  requestAnimationFrame(loop);
}

(async () => {
  const ok = await initGPU();
  document.getElementById('status').textContent = ok ? 'WebGPU swarm live — enable mic' : 'JS swarm (no WebGPU) — enable mic';
  mode = ok ? 'webgpu' : 'js';
  try {
    const db = await idb();
    const req = db.transaction('state').objectStore('state').get('leader');
    req.onsuccess = () => { if (req.result) forceScale = req.result.forceScale || 1; };
  } catch {}
  loop();
})();
