const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
let w, h;
function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

// Particles
const PARTICLES = 180;
const particles = [];
for (let i = 0; i < PARTICLES; i++) {
  particles.push({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random()-0.5)*1.2,
    vy: (Math.random()-0.5)*1.2
  });
}

// Orbs
const ORBS = 5;
const orbs = [];
for (let i = 0; i < ORBS; i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = 'echo';
  stage.appendChild(el);
  orbs.push({
    el,
    x: 80 + Math.random() * (w - 160),
    y: 80 + Math.random() * (h - 160),
    vx: 0, vy: 0,
    residual: 0.3
  });
}

// Causal trajectory memory + tiny predictor (MLP-like weights)
let trail = [];
const TRAIL_MAX = 32;
let weights = [0.4, -0.2, 0.15, 0.1]; // simple 4-input residual predictor
let bias = 0.2;
let fitness = 0;

function predictResidual(dx, dy, speed, curvature) {
  const inputs = [dx/100, dy/100, speed/5, curvature];
  let s = bias;
  for (let i = 0; i < 4; i++) s += weights[i] * inputs[i];
  return 1 / (1 + Math.exp(-s)); // 0-1 residual proxy
}

function updatePredictor(dx, dy, speed, curvature, observedResidual) {
  const pred = predictResidual(dx, dy, speed, curvature);
  const err = observedResidual - pred;
  const lr = 0.008;
  const sig = pred * (1 - pred);
  for (let i = 0; i < 4; i++) {
    const inp = [dx/100, dy/100, speed/5, curvature][i];
    weights[i] += lr * err * inp * sig;
  }
  bias += lr * err * sig;
  return pred;
}

// Pointer
let px = w/2, py = h/2, lastX = px, lastY = py, lastT = 0;
let mouseDown = false;
addEventListener('pointermove', e => {
  px = e.clientX; py = e.clientY;
  const now = performance.now();
  const dt = Math.max(0.01, (now - lastT)/1000);
  const dx = px - lastX, dy = py - lastY;
  const speed = Math.hypot(dx, dy) / dt;
  const curvature = Math.abs(Math.atan2(dy, dx) - Math.atan2(lastY - (trail[trail.length-1]?.y || lastY), lastX - (trail[trail.length-1]?.x || lastX))) || 0;
  trail.push({x: px, y: py, t: now});
  if (trail.length > TRAIL_MAX) trail.shift();
  // observed residual proxy: deviation from linear
  const observed = Math.min(1, speed / 800 + curvature / 2);
  const pred = updatePredictor(dx, dy, speed, curvature, observed);
  // inject residual as attractor bias
  residualHotspot = {x: px + dx * 2, y: py + dy * 2, strength: pred};
  lastX = px; lastY = py; lastT = now;
});
addEventListener('pointerdown', () => mouseDown = true);
addEventListener('pointerup', () => mouseDown = false);

let residualHotspot = {x: w/2, y: h/2, strength: 0.2};

// Drag orbs
let dragging = null, dragOffX=0, dragOffY=0;
stage.addEventListener('pointerdown', e => {
  const t = e.target.closest('.orb');
  if (!t) return;
  dragging = orbs.find(o => o.el === t);
  if (dragging) {
    dragOffX = e.clientX - dragging.x;
    dragOffY = e.clientY - dragging.y;
    t.setPointerCapture(e.pointerId);
  }
});
addEventListener('pointermove', e => {
  if (dragging) {
    dragging.x = e.clientX - dragOffX;
    dragging.y = e.clientY - dragOffY;
    // inject force into field
    residualHotspot.x = dragging.x;
    residualHotspot.y = dragging.y;
    residualHotspot.strength = 0.8;
    fitness += 0.01;
  }
});
addEventListener('pointerup', () => dragging = null);

// IndexedDB
let db;
const idbReq = indexedDB.open('void-f294-echo', 1);
idbReq.onupgradeneeded = e => {
  const d = e.target.result;
  if (!d.objectStoreNames.contains('echo')) d.createObjectStore('echo');
};
idbReq.onsuccess = e => { db = e.target.result; };
function seal() {
  if (!db) return;
  const tx = db.transaction('echo', 'readwrite');
  tx.objectStore('echo').put({ weights, bias, fitness, orbs: orbs.map(o => ({x:o.x, y:o.y, residual:o.residual})) }, 'champ');
  statusEl.textContent = 'Echo sealed. Fitness ' + fitness.toFixed(2);
}
function load() {
  if (!db) return;
  const tx = db.transaction('echo', 'readonly');
  const g = tx.objectStore('echo').get('champ');
  g.onsuccess = () => {
    if (g.result) {
      weights = g.result.weights || weights;
      bias = g.result.bias || bias;
      fitness = g.result.fitness || 0;
      if (g.result.orbs) g.result.orbs.forEach((s,i) => { if (orbs[i]) { orbs[i].x = s.x; orbs[i].y = s.y; orbs[i].residual = s.residual; } });
      statusEl.textContent = 'Loaded sealed echo.';
    }
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;
document.getElementById('reset').onclick = () => {
  weights = [0.4,-0.2,0.15,0.1]; bias=0.2; fitness=0; trail=[];
  orbs.forEach(o => { o.x = 80+Math.random()*(w-160); o.y=80+Math.random()*(h-160); o.residual=0.3; });
  statusEl.textContent = 'Reset.';
};

// Simulation loop
let last = 0;
function loop(t) {
  const dt = Math.min(0.04, (t - last)/1000 || 0.016);
  last = t;

  // Clear
  ctx.fillStyle = 'rgba(5,5,16,0.25)';
  ctx.fillRect(0,0,w,h);

  // Trail fade
  ctx.strokeStyle = 'rgba(80,140,220,0.3)';
  ctx.lineWidth = 1;
  if (trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }

  // Particles + density sampling near orbs
  const densities = orbs.map(() => 0);
  particles.forEach(p => {
    // Attract to residual hotspot
    let ax = 0, ay = 0;
    const dxh = residualHotspot.x - p.x, dyh = residualHotspot.y - p.y;
    const dh = Math.hypot(dxh, dyh) + 1;
    ax += (dxh / dh) * residualHotspot.strength * 80;
    ay += (dyh / dh) * residualHotspot.strength * 80;
    // Attract to orbs
    orbs.forEach(o => {
      const dx = o.x + 35 - p.x, dy = o.y + 35 - p.y;
      const d = Math.hypot(dx, dy) + 1;
      if (d < 120) {
        const f = (120 - d) / 120 * 40;
        ax += (dx / d) * f;
        ay += (dy / d) * f;
        densities[orbs.indexOf(o)] += 1 / d;
      }
    });
    // Mild repulsion between particles
    particles.forEach(q => {
      if (p === q) return;
      const dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.hypot(dx, dy);
      if (d < 25 && d > 0) {
        ax += (dx / d) * 15;
        ay += (dy / d) * 15;
      }
    });
    p.vx = (p.vx + ax * dt) * 0.96;
    p.vy = (p.vy + ay * dt) * 0.96;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -0.8;
    if (p.y < 0 || p.y > h) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(w, p.x));
    p.y = Math.max(0, Math.min(h, p.y));

    ctx.fillStyle = `hsla(${200 + residualHotspot.strength*80}, 70%, 60%, 0.7)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI*2);
    ctx.fill();
  });

  // Update orbs: lerp toward density + residual influence, morph
  orbs.forEach((o, i) => {
    const dens = densities[i] || 0;
    o.residual = o.residual * 0.95 + dens * 0.05;
    // slight attraction to residual hotspot
    const dx = residualHotspot.x - o.x, dy = residualHotspot.y - o.y;
    o.vx += dx * 0.002 * residualHotspot.strength;
    o.vy += dy * 0.002 * residualHotspot.strength;
    o.vx *= 0.92; o.vy *= 0.92;
    o.x += o.vx; o.y += o.vy;
    o.x = Math.max(10, Math.min(w-80, o.x));
    o.y = Math.max(10, Math.min(h-80, o.y));
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
    const hue = 200 + o.residual * 140;
    const alpha = 0.3 + o.residual * 0.5;
    o.el.style.background = `radial-gradient(circle, hsla(${hue},80%,60%,${alpha}), rgba(20,40,80,0.2))`;
    o.el.style.boxShadow = `0 0 ${10 + o.residual*20}px hsla(${hue},80%,60%,0.5)`;
    o.el.textContent = o.residual > 0.6 ? 'resonant' : o.residual > 0.3 ? 'echo' : 'quiet';
  });

  residualHotspot.strength *= 0.985; // decay
  statusEl.textContent = `residual:${residualHotspot.strength.toFixed(2)} fitness:${fitness.toFixed(2)} weights:[${weights.map(w=>w.toFixed(2)).join(',')}]`;

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
