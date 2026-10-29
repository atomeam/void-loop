const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const errEl = document.getElementById('err');
const entEl = document.getElementById('ent');
const probesDiv = document.getElementById('probes');
const chrome = document.getElementById('chrome');
const xrbtn = document.getElementById('xrbtn');

let gl, gpu, adapter, device, context;
let particles = [];
const N = 800;
let worker;
let predictionError = 0;
let entropy = 0;
let params = { attract: 0.5, diffuse: 0.3, noise: 0.1 };

function initParticles() {
  particles = Array.from({length: N}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random()-0.5)*2,
    vy: (Math.random()-0.5)*2,
    hue: Math.random()*360
  }));
}

function setupCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const ctx = canvas.getContext('2d');
  return ctx;
}

let ctx = setupCanvas();
initParticles();

// Simple WebGPU check and fallback to Canvas2D (full GPU compute path prepared)
async function tryWebGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available, Canvas2D mode'; return false; }
  try {
    adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    status.textContent = 'WebGPU ready (compute path stub)';
    return true;
  } catch(e) {
    status.textContent = 'WebGPU failed, Canvas2D';
    return false;
  }
}

tryWebGPU();

// Blob Worker for online learning agent
const workerCode = `
let net = { w: [0.1, -0.05, 0.2, 0.05], b: 0.0 }; // tiny linear policy: field samples -> force delta
let lr = 0.01;
self.onmessage = (e) => {
  const { samples, userAction, currentParams } = e.data;
  // Predict next user force from samples
  let pred = net.b;
  for (let i=0; i<samples.length && i<net.w.length; i++) pred += samples[i] * net.w[i];
  const target = userAction || 0;
  const err = pred - target;
  // Online GD
  for (let i=0; i<net.w.length; i++) net.w[i] -= lr * err * (samples[i]||0);
  net.b -= lr * err;
  // Adapt params toward reducing error
  const newAttract = Math.max(0, Math.min(1, currentParams.attract - err * 0.05));
  const newDiffuse = Math.max(0, Math.min(1, currentParams.diffuse + Math.abs(err)*0.02));
  self.postMessage({ error: Math.abs(err), params: { attract: newAttract, diffuse: newDiffuse, noise: currentParams.noise }, net });
};
`;
worker = new Worker(URL.createObjectURL(new Blob([workerCode])));
worker.onmessage = (e) => {
  predictionError = e.data.error;
  params = e.data.params;
  errEl.textContent = predictionError.toFixed(3);
  // Morph chrome based on error
  chrome.style.opacity = 0.3 + predictionError * 0.5;
  chrome.style.transform = `scale(${1 + predictionError}) rotate(${predictionError*20}deg)`;
  chrome.style.background = `hsl(${(predictionError*360)%360}, 50%, 20%)`;
};

let mouseX = canvas.width/2, mouseY = canvas.height/2, mouseDown = false;
canvas.addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; });
canvas.addEventListener('pointerdown', () => mouseDown = true);
canvas.addEventListener('pointerup', () => mouseDown = false);

// Probes: DOM embodiments that agent can "query"
function spawnProbe(x, y) {
  const p = document.createElement('div');
  p.className = 'probe';
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  probesDiv.appendChild(p);
  p.addEventListener('pointerdown', ev => {
    // Drag injects impulse
    const startX = ev.clientX, startY = ev.clientY;
    const onMove = me => {
      const dx = me.clientX - startX, dy = me.clientY - startY;
      // Apply to nearby particles
      for (let pt of particles) {
        const ddx = pt.x - p.offsetLeft, ddy = pt.y - p.offsetTop;
        if (Math.hypot(ddx,ddy) < 100) {
          pt.vx += dx * 0.01; pt.vy += dy * 0.01;
        }
      }
    };
    const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
  return p;
}

// Spawn a few initial probes
for (let i=0; i<3; i++) spawnProbe(100 + i*150, 100);

function step() {
  // Sample field near probes/mouse for worker
  const samples = [];
  // Simple density samples
  for (let i=0; i<4; i++) {
    const px = mouseX + (i-1.5)*50, py = mouseY;
    let dens = 0;
    for (let pt of particles) if (Math.hypot(pt.x-px, pt.y-py)<40) dens++;
    samples.push(dens / 20);
  }
  const userAction = mouseDown ? 1 : (Math.hypot(mouseX - canvas.width/2, mouseY - canvas.height/2)/canvas.width * 2 -1);
  worker.postMessage({ samples, userAction, currentParams: params });

  // Update particles with adapted params (Canvas2D sim; WebGPU compute would replace this)
  for (let pt of particles) {
    // Attraction to mouse if high attract
    const dx = mouseX - pt.x, dy = mouseY - pt.y;
    const dist = Math.hypot(dx,dy) || 1;
    pt.vx += (dx/dist) * params.attract * 0.1;
    pt.vy += (dy/dist) * params.attract * 0.1;
    // Diffuse / noise
    pt.vx += (Math.random()-0.5) * params.noise;
    pt.vy += (Math.random()-0.5) * params.noise;
    pt.vx *= (1 - params.diffuse * 0.01);
    pt.vy *= (1 - params.diffuse * 0.01);
    pt.x += pt.vx; pt.y += pt.vy;
    // Bounds
    if (pt.x<0 || pt.x>canvas.width) pt.vx *= -1;
    if (pt.y<0 || pt.y>canvas.height) pt.vy *= -1;
    pt.hue = (pt.hue + 0.5) % 360;
  }

  // Entropy approx
  entropy = particles.reduce((s,pt)=>s + Math.abs(pt.vx)+Math.abs(pt.vy),0)/N;
  entEl.textContent = entropy.toFixed(2);

  // Draw
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for (let pt of particles) {
    ctx.fillStyle = `hsl(${pt.hue}, 70%, 60%)`;
    ctx.fillRect(pt.x-1, pt.y-1, 2, 2);
  }

  requestAnimationFrame(step);
}
step();

// WebXR optional
xrbtn.onclick = async () => {
  if (!navigator.xr) { alert('WebXR not supported'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    status.textContent = 'WebXR session active (spatial control stub)';
    // In full impl: render loop with XRFrame, hand tracking for forces
    session.end(); // stub for prototype
  } catch(e) { status.textContent = 'WebXR failed: ' + e.message; }
};

window.onresize = () => { canvas.width=innerWidth; canvas.height=innerHeight; };
