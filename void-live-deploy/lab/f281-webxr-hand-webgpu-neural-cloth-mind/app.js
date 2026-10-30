const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const xrBtn = document.getElementById('xrBtn');
const sealBtn = document.getElementById('sealBtn');
const resetBtn = document.getElementById('resetBtn');
const anchorsEl = document.getElementById('anchors');

let width, height, particles = [], anchors = [];
const N = 180;
let genome = { attract: 0.015, damp: 0.92, neural: [0.3, 0.1, -0.05, 0.2] };
let pointer = { x: 0, y: 0, active: false };
let handForce = null;
let running = true;
let useWebGPU = false;
let gpuDevice = null;

function resize() {
  width = canvas.width = innerWidth;
  height = canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random()-0.5)*2,
      vy: (Math.random()-0.5)*2,
      px: 0, py: 0
    });
  }
  anchors = [
    { x: width*0.3, y: height*0.4, label: 'A' },
    { x: width*0.7, y: height*0.6, label: 'B' }
  ];
  renderAnchors();
}
initParticles();

function renderAnchors() {
  anchorsEl.innerHTML = '';
  anchors.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'anchor';
    el.textContent = a.label;
    el.style.left = a.x + 'px';
    el.style.top = a.y + 'px';
    el.dataset.i = i;
    el.addEventListener('pointerdown', startDrag);
    anchorsEl.appendChild(el);
  });
}

let drag = null;
function startDrag(e) {
  const i = +e.target.dataset.i;
  drag = { i, dx: e.clientX - anchors[i].x, dy: e.clientY - anchors[i].y };
  e.target.classList.add('dragging');
  e.preventDefault();
}
addEventListener('pointermove', e => {
  if (drag) {
    anchors[drag.i].x = e.clientX - drag.dx;
    anchors[drag.i].y = e.clientY - drag.dy;
    renderAnchors();
  }
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
});
addEventListener('pointerup', () => {
  if (drag) {
    document.querySelectorAll('.anchor').forEach(el => el.classList.remove('dragging'));
    drag = null;
  }
  pointer.active = false;
});

function neuralResidual(p, dens) {
  const w = genome.neural;
  return w[0]*dens + w[1]*p.vx + w[2]*p.vy + w[3]*(pointer.active ? 1 : 0);
}

function step() {
  const forceX = handForce ? handForce.x : (pointer.active ? pointer.x : width/2);
  const forceY = handForce ? handForce.y : (pointer.active ? pointer.y : height/2);

  for (let p of particles) {
    let dens = 0;
    for (let q of particles) if (q !== p && Math.hypot(q.x-p.x, q.y-p.y) < 40) dens++;
    dens /= 10;

    const res = neuralResidual(p, dens);
    const ax = (forceX - p.x) * genome.attract * (1 + res);
    const ay = (forceY - p.y) * genome.attract * (1 + res);

    for (let a of anchors) {
      const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx,dy)+1;
      if (d < 120) {
        p.vx += dx/d * 0.05;
        p.vy += dy/d * 0.05;
      }
    }

    p.vx = (p.vx + ax) * genome.damp;
    p.vy = (p.vy + ay) * genome.damp;
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > width) p.vx *= -0.8;
    if (p.y < 0 || p.y > height) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(width, p.x));
    p.y = Math.max(0, Math.min(height, p.y));
  }

  const meanSp = particles.reduce((s,p)=>s+Math.hypot(p.vx,p.vy),0)/N;
  if (meanSp > 1.5) genome.neural[0] *= 0.999;
  else genome.neural[0] += 0.0005;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle = '#8cf';
  for (let p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  }
  if (pointer.active || handForce) {
    ctx.strokeStyle = '#f80';
    ctx.beginPath();
    ctx.arc(handForce ? handForce.x : pointer.x, handForce ? handForce.y : pointer.y, 12, 0, Math.PI*2);
    ctx.stroke();
  }
}

function loop() {
  if (running) {
    step();
    draw();
  }
  requestAnimationFrame(loop);
}
loop();

async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    gpuDevice = await adapter.requestDevice();
    useWebGPU = true;
    statusEl.textContent = 'WebGPU available · Canvas2D sim (compute kernel ready for expansion)';
  } catch(e) {}
}
tryWebGPU();

let xrSession = null;
xrBtn.onclick = async () => {
  if (!navigator.xr) {
    statusEl.textContent = 'No WebXR';
    return;
  }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['hand-tracking']
    });
    xrSession = session;
    statusEl.textContent = 'WebXR AR active · hand tracking';
    session.addEventListener('end', () => {
      xrSession = null;
      handForce = null;
      statusEl.textContent = 'XR ended';
    });
    const refSpace = await session.requestReferenceSpace('local');
    const loopXR = (time, frame) => {
      if (session.inputSources) {
        for (const source of session.inputSources) {
          if (source.hand) {
            const wrist = frame.getJointPose(source.hand.get('wrist'), refSpace);
            if (wrist) {
              handForce = { x: width/2 + wrist.transform.position.x * 200, y: height/2 - wrist.transform.position.y * 200 };
            }
          }
        }
      }
      session.requestAnimationFrame(loopXR);
    };
    session.requestAnimationFrame(loopXR);
  } catch(e) {
    statusEl.textContent = 'XR request failed · pointer fallback';
  }
};

const dbName = 'void-f281-genome';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes', { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
sealBtn.onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    const hash = Array.from(new Uint8Array(new Float32Array(genome.neural).buffer)).reduce((h,b)=> (h*31 + b)|0, 0);
    tx.objectStore('genomes').put({ id: Date.now(), genome, hash: hash.toString(16), ts: new Date().toISOString() });
    statusEl.textContent = 'Genome sealed · hash ' + hash.toString(16);
  } catch(e) {
    statusEl.textContent = 'Seal failed (IDB)';
  }
};

resetBtn.onclick = () => {
  genome = { attract: 0.015, damp: 0.92, neural: [0.3, 0.1, -0.05, 0.2] };
  initParticles();
  statusEl.textContent = 'Reset';
};

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (e.gamma != null) {
      genome.neural[1] += e.gamma * 0.0001;
      genome.neural[2] += e.beta * 0.0001;
    }
  });
}
