const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 110;
const particles = [];
const h = 18; // kernel radius base
const mass = 1;
const restDensity = 1.2;
const dt = 0.016;

// Simple MLP: 6 inputs -> 12 hidden -> 3 outputs (visc, pressure, radiusScale)
const mlp = {
  w1: Array(12).fill(0).map(() => Array(6).fill(0).map(() => (Math.random()-0.5)*0.4)),
  b1: Array(12).fill(0).map(() => (Math.random()-0.5)*0.2),
  w2: Array(3).fill(0).map(() => Array(12).fill(0).map(() => (Math.random()-0.5)*0.4)),
  b2: Array(3).fill(0).map(() => (Math.random()-0.5)*0.2)
};
function tanh(x) { return Math.tanh(x); }
function mlpForward(x) {
  const h = mlp.b1.map((b,i) => tanh(mlp.w1[i].reduce((s,w,j)=>s+w*x[j], b)));
  return mlp.b2.map((b,i) => tanh(mlp.w2[i].reduce((s,w,j)=>s+w*h[j], b)));
}

// Sensor state
let orient = { beta: 0, gamma: 0 };
let pointer = { x: W/2, y: H/2, vx: 0, vy: 0 };
let lastPointer = { x: W/2, y: H/2 };

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}
canvas.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - lastPointer.x;
  pointer.vy = e.clientY - lastPointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
});

function initParticles() {
  particles.length = 0;
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * W * 0.7 + W*0.15,
      y: Math.random() * H * 0.7 + H*0.15,
      vx: (Math.random()-0.5)*2,
      vy: (Math.random()-0.5)*2,
      density: restDensity,
      pressure: 0,
      fitness: 1,
      hue: Math.random()*60 + 180,
      id: i
    });
  }
}
initParticles();

function hashWeights() {
  const s = JSON.stringify(mlp).slice(0, 800);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).slice(0, 8);
}

document.getElementById('seal').onclick = async () => {
  const id = hashWeights();
  const snapshot = particles.slice(0, 8).map(p => ({x:p.x|0, y:p.y|0, f:p.fitness.toFixed(2)}));
  const data = { id, mlp, snapshot, t: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-sph', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(data, id);
    document.getElementById('status').textContent = `Sealed id: ${id}`;
  } catch(e) {
    localStorage.setItem('sph-seal-'+id, JSON.stringify(data));
    document.getElementById('status').textContent = `Sealed (LS) id: ${id}`;
  }
};

document.getElementById('reset').onclick = initParticles;

// WebXR stub
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { document.getElementById('status').textContent = 'WebXR not available'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    document.getElementById('status').textContent = 'XR session started (hand proxy active)';
    // In full impl would track joints; here we note fallback
    session.end();
  } catch(e) {
    document.getElementById('status').textContent = 'XR failed — using pointer/orient';
  }
};

function poly6(r, h) {
  if (r >= h || r < 0) return 0;
  const q = h*h - r*r;
  return 315/(64*Math.PI*Math.pow(h,9)) * q*q*q;
}
function spikyGrad(r, h) {
  if (r >= h || r <= 0) return 0;
  return -45/(Math.PI*Math.pow(h,6)) * Math.pow(h-r, 2);
}

let frame = 0;
function step() {
  // Inputs for MLP
  const tiltX = orient.gamma / 90;
  const tiltY = orient.beta / 90;
  const px = (pointer.x / W - 0.5) * 2;
  const py = (pointer.y / H - 0.5) * 2;
  const pvx = Math.max(-1, Math.min(1, pointer.vx / 20));
  const pvy = Math.max(-1, Math.min(1, pointer.vy / 20));
  let meanDens = 0;
  particles.forEach(p => meanDens += p.density);
  meanDens /= N;
  const inputs = [tiltX, tiltY, px, py, pvx, (meanDens - restDensity)];
  const outs = mlpForward(inputs);
  const viscosity = 0.08 + (outs[0]+1)*0.12;
  const pressureK = 0.4 + (outs[1]+1)*0.6;
  const radiusScale = 0.85 + (outs[2]+1)*0.3;
  const kernel = h * radiusScale;

  // Density
  for (let i = 0; i < N; i++) {
    let dens = 0;
    const pi = particles[i];
    for (let j = 0; j < N; j++) {
      const pj = particles[j];
      const dx = pi.x - pj.x, dy = pi.y - pj.y;
      const r = Math.hypot(dx, dy);
      dens += mass * poly6(r, kernel);
    }
    pi.density = Math.max(0.1, dens);
    pi.pressure = pressureK * (pi.density - restDensity);
  }

  // Forces + transfer
  const transfers = [];
  for (let i = 0; i < N; i++) {
    const pi = particles[i];
    let fx = 0, fy = 0;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const pj = particles[j];
      const dx = pi.x - pj.x, dy = pi.y - pj.y;
      const r = Math.hypot(dx, dy);
      if (r < kernel && r > 0.1) {
        const grad = spikyGrad(r, kernel);
        const press = (pi.pressure + pj.pressure) / (2 * pi.density * pj.density);
        fx -= mass * press * grad * dx / r;
        fy -= mass * press * grad * dy / r;
        // viscosity
        const visc = viscosity * mass * (pj.vx - pi.vx) / pj.density * (kernel - r);
        fx += visc * dx / r;
        fy += visc * dy / r;
        // fitness transfer
        const keI = pi.vx*pi.vx + pi.vy*pi.vy;
        const keJ = pj.vx*pj.vx + pj.vy*pj.vy;
        pi.fitness = 1 / (1 + keI);
        if (pi.fitness > pj.fitness + 0.15 && r < kernel*0.6 && Math.random() < 0.02) {
          // seal-transfer a bit of "behavior" (hue shift toward winner)
          pj.hue = pj.hue * 0.7 + pi.hue * 0.3;
          transfers.push({x: (pi.x+pj.x)/2, y: (pi.y+pj.y)/2});
        }
      }
    }
    // gravity from orient + pointer attract
    fx += tiltX * 0.4 + (pointer.x - pi.x) * 0.0008;
    fy += tiltY * 0.4 + (pointer.y - pi.y) * 0.0008;
    // bounds
    if (pi.x < 10) fx += 2; if (pi.x > W-10) fx -= 2;
    if (pi.y < 10) fy += 2; if (pi.y > H-10) fy -= 2;

    pi.vx += fx * dt;
    pi.vy += fy * dt;
    pi.vx *= 0.98;
    pi.vy *= 0.98;
    pi.x += pi.vx;
    pi.y += pi.vy;
  }

  // Render
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    const alpha = 0.45 + p.fitness * 0.4;
    ctx.fillStyle = `hsla(${p.hue}, 70%, 55%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5 + p.density * 0.4, 0, Math.PI*2);
    ctx.fill();
  }
  // pointer marker
  ctx.strokeStyle = '#8cf';
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI*2);
  ctx.stroke();

  // transfer flashes
  transfers.forEach(t => {
    const el = document.createElement('div');
    el.className = 'transfer';
    el.textContent = '⇄';
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
  });

  frame++;
  if (frame % 60 === 0) {
    document.getElementById('status').textContent = `visc:${viscosity.toFixed(2)} press:${pressureK.toFixed(2)} r:${radiusScale.toFixed(2)} dens:${meanDens.toFixed(2)}`;
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
