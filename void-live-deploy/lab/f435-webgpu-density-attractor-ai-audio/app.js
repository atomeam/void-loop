const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const audioBtn = document.getElementById('audioBtn');
const orbs = [document.getElementById('orb1'), document.getElementById('orb2')];

let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Particles
const N = 800;
const particles = Array.from({length: N}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: 0, vy: 0
}));

// Attractors managed by AI
let attractors = [];
let orientation = { beta: 0, gamma: 0 }; // tilt
let pointer = { x: W/2, y: H/2 };
let audioCtx = null;
let oscillators = [];
let density = 0;
let webgpu = false;
let gpuDevice = null;

// Orientation
window.addEventListener('deviceorientation', e => {
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
});
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('click', e => {
  attractors.push({ x: e.clientX, y: e.clientY, strength: 1, age: 0, id: Date.now() });
  if (attractors.length > 8) attractors.shift();
  postToWorker({ type: 'seed', x: e.clientX, y: e.clientY });
});

// Worker for local AI decision
const workerCode = `
let attractors = [];
self.onmessage = e => {
  const { type, data } = e.data;
  if (type === 'seed') {
    attractors.push({ ...data, strength: 1.2, age: 0 });
  }
  if (type === 'tick') {
    const { density, pointer } = data;
    // Simple decision: boost strong ones near density, prune weak
    attractors = attractors.map(a => ({ ...a, age: a.age + 1, strength: a.strength * 0.995 }))
      .filter(a => a.strength > 0.2 && a.age < 400);
    // Place new if density low and random
    if (density < 0.3 && Math.random() < 0.02 && attractors.length < 5) {
      attractors.push({
        x: pointer.x + (Math.random()-0.5)*200,
        y: pointer.y + (Math.random()-0.5)*200,
        strength: 0.8 + Math.random()*0.5,
        age: 0
      });
    }
    self.postMessage({ attractors });
  }
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  if (e.data.attractors) attractors = e.data.attractors;
};

function postToWorker(msg) { worker.postMessage(msg); }

// Audio
audioBtn.onclick = async () => {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  await audioCtx.resume();
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const panner = audioCtx.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.value = 180 + i * 80;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(audioCtx.destination);
    osc.start();
    oscillators.push({ osc, gain, panner });
  }
  statusEl.textContent = 'Spatial audio on. Tilt / click.';
};

// WebGPU init attempt
async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    gpuDevice = await adapter.requestDevice();
    webgpu = true;
    statusEl.textContent = 'WebGPU compute ready (CPU sim + GPU path noted).';
    return true;
  } catch (e) {
    return false;
  }
}
tryWebGPU();

// Simulation
function step() {
  const gX = orientation.gamma * 0.002;
  const gY = orientation.beta * 0.002;
  let sumX = 0, sumY = 0, count = 0;

  for (const p of particles) {
    // Gravity from orientation
    p.vx += gX;
    p.vy += gY;
    // Attractors
    for (const a of attractors) {
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const force = a.strength * 80 / d2;
      p.vx += dx * force * 0.001;
      p.vy += dy * force * 0.001;
    }
    // Damping
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.x += p.vx;
    p.y += p.vy;
    // Wrap
    if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
    sumX += p.x; sumY += p.y; count++;
  }

  density = Math.min(1, attractors.reduce((s, a) => s + a.strength, 0) / 6);
  document.documentElement.style.setProperty('--density', density.toFixed(2));
  document.documentElement.style.setProperty('--hue', (200 + density * 160).toFixed(0));

  // Morph orbs based on density / centroid
  const cx = sumX / count;
  const cy = sumY / count;
  orbs.forEach((orb, i) => {
    const ang = i * Math.PI + performance.now() * 0.0005;
    const r = 80 + density * 60;
    orb.style.left = (cx + Math.cos(ang) * r - 20) + 'px';
    orb.style.top = (cy + Math.sin(ang) * r - 20) + 'px';
    orb.style.transform = `scale(${0.8 + density * 0.6})`;
  });

  // Audio spatial
  if (audioCtx && oscillators.length) {
    attractors.forEach((a, i) => {
      if (oscillators[i]) {
        const pan = (a.x / W - 0.5) * 2;
        oscillators[i].panner.pan.value = pan;
        oscillators[i].osc.frequency.value = 160 + a.strength * 120 + density * 40;
      }
    });
  }

  // Tick AI
  if (Math.random() < 0.1) postToWorker({ type: 'tick', data: { density, pointer } });

  // Draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `hsl(${200 + density*160}, 70%, 60%)`;
  for (const p of particles) {
    ctx.fillRect(p.x, p.y, 2, 2);
  }
  // Attractors
  ctx.strokeStyle = '#fff8';
  attractors.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 12 + a.strength * 8, 0, Math.PI*2);
    ctx.stroke();
  });

  requestAnimationFrame(step);
}
step();

// IndexedDB seal of current state
async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('F261', 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({
      density, attractors: attractors.map(a => ({x:a.x, y:a.y, s:a.strength})),
      ts: Date.now()
    }, 'latest');
    statusEl.textContent += ' | Sealed to IndexedDB';
  } catch (e) { console.warn('f435-webgpu-density-attractor-ai-audio:', e); }
}
setInterval(seal, 8000);

statusEl.textContent = 'Ready. Tilt, click, enable audio. Offline-capable.';
