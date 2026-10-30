const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const frame = document.getElementById('frame');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Particle system (Canvas2D fallback; WebGPU path noted in SPEC)
const N = 400;
const particles = [];
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: 0, vy: 0
  });
}

let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let predicted = { x: mouse.x, y: mouse.y };
let residual = 1.0;
let locked = null;
let lockTimer = 0;

canvas.addEventListener('pointermove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('pointerdown', e => {
  locked = { x: predicted.x, y: predicted.y };
  lockTimer = 180; // ~3s at 60fps
  statusEl.textContent = 'sealed';
});

// Worker: simple online predictor
const workerCode = `
let hist = [];
const MAX = 8;
let weights = [0.5, 0.3, 0.2]; // simple AR-like
self.onmessage = function(e) {
  const { dx, dy } = e.data;
  hist.push({dx, dy});
  if (hist.length > MAX) hist.shift();
  // crude LMS-style prediction of next velocity
  let pdx = 0, pdy = 0;
  const n = hist.length;
  for (let i = 0; i < n; i++) {
    const w = (i + 1) / n;
    pdx += hist[i].dx * w;
    pdy += hist[i].dy * w;
  }
  pdx /= n || 1;
  pdy /= n || 1;
  // residual proxy
  const last = hist[n-1] || {dx:0,dy:0};
  const res = Math.hypot(last.dx - pdx, last.dy - pdy);
  self.postMessage({ pdx, pdy, residual: Math.min(res / 20, 1) });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
let lastMouse = { x: mouse.x, y: mouse.y };

worker.onmessage = e => {
  const { pdx, pdy, residual: r } = e.data;
  predicted.x = mouse.x + pdx * 8;
  predicted.y = mouse.y + pdy * 8;
  residual = r;
};

function step() {
  // feed worker
  const dx = mouse.x - lastMouse.x;
  const dy = mouse.y - lastMouse.y;
  worker.postMessage({ dx, dy });
  lastMouse = { x: mouse.x, y: mouse.y };

  if (lockTimer > 0) lockTimer--;
  const attract = lockTimer > 0 ? locked : predicted;

  // update particles
  for (const p of particles) {
    // towards mouse
    let ax = (mouse.x - p.x) * 0.0008;
    let ay = (mouse.y - p.y) * 0.0008;
    // towards predicted / locked
    ax += (attract.x - p.x) * 0.0012;
    ay += (attract.y - p.y) * 0.0012;
    // noise
    ax += (Math.random() - 0.5) * 0.05;
    ay += (Math.random() - 0.5) * 0.05;
    p.vx = p.vx * 0.92 + ax;
    p.vy = p.vy * 0.92 + ay;
    p.x += p.vx;
    p.y += p.vy;
    // wrap
    if (p.x < 0) p.x += canvas.width;
    if (p.x > canvas.width) p.x -= canvas.width;
    if (p.y < 0) p.y += canvas.height;
    if (p.y > canvas.height) p.y -= canvas.height;
  }

  // morph UI from residual
  const conf = 1 - residual;
  document.documentElement.style.setProperty('--border-w', (3 + conf * 8) + 'px');
  document.documentElement.style.setProperty('--hue', (180 + conf * 80).toFixed(0));
  document.documentElement.style.setProperty('--seal', (0.2 + conf * 0.6).toFixed(2));
  if (lockTimer > 0) {
    statusEl.textContent = 'sealed (' + Math.ceil(lockTimer / 60) + 's)';
  } else {
    statusEl.textContent = residual < 0.4 ? 'confident echo' : 'echoing…';
  }

  // draw
  ctx.fillStyle = 'rgba(5,5,8,0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')}, 70%, 60%, 0.7)`;
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // ghost predicted
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(predicted.x, predicted.y, 6, 0, Math.PI * 2);
  ctx.fill();
  if (lockTimer > 0) {
    ctx.strokeStyle = 'rgba(255,220,100,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(locked.x, locked.y, 14, 0, Math.PI * 2);
    ctx.stroke();
  }

  requestAnimationFrame(step);
}
step();
