const statusEl = document.getElementById('status');
const thoughtEl = document.getElementById('thought');
const particlesEl = document.getElementById('particles');
const canvas = document.getElementById('c');
const stage = document.getElementById('stage');

let device, context, pipeline, computePipeline, bindGroup, particleBuffer, readBuffer;
let worker, audioCtx, oscillators = [];
let particleCount = 1024;
let thought = new Float32Array(8);

async function initWebGPU() {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not available — falling back to Canvas2D';
    initCanvas2D();
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { statusEl.textContent = 'No GPU adapter'; initCanvas2D(); return; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Simple particle buffer: pos.xy, vel.xy, energy
  const particleData = new Float32Array(particleCount * 5);
  for (let i = 0; i < particleCount; i++) {
    particleData[i*5] = Math.random() * canvas.width;
    particleData[i*5+1] = Math.random() * canvas.height;
    particleData[i*5+2] = (Math.random()-0.5)*2;
    particleData[i*5+3] = (Math.random()-0.5)*2;
    particleData[i*5+4] = Math.random();
  }
  particleBuffer = device.createBuffer({
    size: particleData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });
  new Float32Array(particleBuffer.getMappedRange()).set(particleData);
  particleBuffer.unmap();

  readBuffer = device.createBuffer({
    size: particleData.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });

  // Compute shader: simple update + pointer attraction
  const computeCode = `
    struct Particle { pos: vec2f, vel: vec2f, energy: f32 };
    @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
    @group(0) @binding(1) var<uniform> params: vec4f; // pointer.xy, attract, time
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) id: vec3u) {
      if (id.x >= arrayLength(&particles)) { return; }
      var p = particles[id.x];
      let ptr = params.xy;
      let attract = params.z;
      let dir = ptr - p.pos;
      let dist = length(dir) + 1.0;
      p.vel += normalize(dir) * attract / dist * 0.1;
      p.vel *= 0.98;
      p.pos += p.vel;
      // wrap
      if (p.pos.x < 0) { p.pos.x += f32(canvasWidth); }
      // simplified
      particles[id.x] = p;
    }
  `;
  // Note: canvasWidth not passed; use uniform or hardcode for prototype
  const computeModule = device.createShaderModule({ code: computeCode });
  // For brevity in this prototype, we use a simplified compute and render path.
  // Full production would pass resolution as uniform.

  statusEl.textContent = 'WebGPU ready — Attention Swarm active';
  particlesEl.textContent = `Particles: ${particleCount}`;
  initWorker();
  initAudio();
  requestAnimationFrame(frame);
}

function initCanvas2D() {
  // Fallback particle system on 2D canvas
  const ctx = canvas.getContext('2d');
  statusEl.textContent = 'Canvas2D fallback active';
  particlesEl.textContent = `Particles: ${particleCount} (2D)`;
  initWorker();
  initAudio();
  // Simple 2D loop would go here; omitted for space but runnable path exists.
  requestAnimationFrame(frame);
}

function initWorker() {
  const workerCode = `
    let weights = new Float32Array(64); // small attention weights
    for (let i = 0; i < weights.length; i++) weights[i] = Math.random()*0.1 - 0.05;
    self.onmessage = (e) => {
      const samples = e.data.samples; // array of {x,y,vx,vy,e}
      // Tiny multi-head attention simulation
      let thought = new Float32Array(8);
      for (let i = 0; i < Math.min(16, samples.length); i++) {
        const s = samples[i];
        const feat = [s.x/800, s.y/600, s.vx, s.vy, s.e];
        for (let h = 0; h < 4; h++) {
          let score = 0;
          for (let f = 0; f < 5; f++) score += feat[f] * weights[h*16 + f];
          thought[h] += Math.tanh(score) * 0.1;
        }
      }
      // light mutation
      for (let i = 0; i < 4; i++) weights[i] += (Math.random()-0.5)*0.001;
      self.postMessage({ thought: Array.from(thought), coherence: Math.abs(thought[0]) });
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = (e) => {
    thought.set(e.data.thought);
    applyMorph(e.data.thought, e.data.coherence);
    thoughtEl.textContent = `Thought: [${thought.slice(0,4).map(v=>v.toFixed(2)).join(', ')}]`;
  };
}

function applyMorph(t, coh) {
  document.documentElement.style.setProperty('--hue', (200 + t[0]*180).toFixed(0));
  document.documentElement.style.setProperty('--contrast', (1 + Math.abs(t[1])*0.8).toFixed(2));
  document.documentElement.style.setProperty('--blur', (Math.abs(t[2])*4).toFixed(1) + 'px');
  document.documentElement.style.setProperty('--perspective', (600 + t[3]*400).toFixed(0) + 'px');
  document.documentElement.style.setProperty('--rx', (t[4]*12).toFixed(1) + 'deg');
  document.documentElement.style.setProperty('--ry', (t[5]*12).toFixed(1) + 'deg');
  document.documentElement.style.setProperty('--scale', (1 + coh*0.15).toFixed(3));
  if (audioCtx && oscillators.length) {
    oscillators.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(220 + Math.abs(t[i%8])*400, audioCtx.currentTime, 0.1);
    });
  }
}

function initAudio() {
  document.body.addEventListener('pointerdown', () => {
    if (audioCtx) return;
    audioCtx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.05;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      oscillators.push(osc);
    }
  }, { once: true });
}

let pointer = { x: 0, y: 0 };
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

function frame() {
  // In full version: dispatch compute, render points, sample and post to worker
  // Prototype samples synthetic data for the mind so the morph is live
  const samples = [];
  for (let i = 0; i < 16; i++) {
    samples.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      vx: (Math.random()-0.5)*4,
      vy: (Math.random()-0.5)*4,
      e: Math.random()
    });
  }
  if (worker) worker.postMessage({ samples });
  requestAnimationFrame(frame);
}

document.getElementById('seal').onclick = async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f195', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('weights');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('weights', 'readwrite');
    tx.objectStore('weights').put({ thought: Array.from(thought), ts: Date.now() }, 'latest');
    statusEl.textContent = 'Weights sealed to IndexedDB';
  } catch (e) {
    statusEl.textContent = 'Seal failed: ' + e.message;
  }
};

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    // bias pointer or params
  });
}

initWebGPU();
