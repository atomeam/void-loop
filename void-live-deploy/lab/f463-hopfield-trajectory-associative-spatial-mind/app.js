const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_PARTICLES = 350;
const DIM = 16;
const MAX_PAT = 8;
const N_ATTR = 5;
let tiltX = 0, tiltY = 0;
let pointer = {x: W/2, y: H/2, down: false};
let db;
let currentPath = [];
let patterns = []; // array of Float32Array dim
let Wmat = Array.from({length: DIM}, () => new Float32Array(DIM)); // weight matrix
let recalled = new Float32Array(DIM);
let energy = 0;

const particles = Array.from({length: N_PARTICLES}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

function sampleTrajectory(path) {
  if (path.length < 4) return null;
  const v = new Float32Array(DIM);
  // simple features: binned direction + speed + curvature proxies
  const steps = Math.min(path.length - 1, 8);
  for (let i = 0; i < steps; i++) {
    const p0 = path[Math.floor(i * (path.length-1) / steps)];
    const p1 = path[Math.floor((i+1) * (path.length-1) / steps)];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const ang = Math.atan2(dy, dx);
    const spd = Math.hypot(dx, dy);
    const bin = Math.floor(((ang + Math.PI) / (2*Math.PI)) * 8) % 8;
    v[bin] += spd * 0.01;
    v[8 + (i % 8)] += Math.abs(dx) * 0.005 + Math.abs(dy) * 0.005;
  }
  // normalize
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i]*v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

function storePattern(v) {
  if (patterns.length >= MAX_PAT) patterns.shift();
  patterns.push(v);
  // outer product update (normalized)
  for (let i = 0; i < DIM; i++) {
    for (let j = 0; j < DIM; j++) {
      Wmat[i][j] += v[i] * v[j] * 0.8;
    }
  }
  // symmetrize and slight diagonal damp
  for (let i = 0; i < DIM; i++) {
    for (let j = i+1; j < DIM; j++) {
      const avg = (Wmat[i][j] + Wmat[j][i]) * 0.5;
      Wmat[i][j] = Wmat[j][i] = avg;
    }
    Wmat[i][i] *= 0.95;
  }
  document.getElementById('npat').textContent = patterns.length;
  updateCards();
}

function retrieve(query) {
  let s = query ? new Float32Array(query) : new Float32Array(DIM).map(() => (Math.random()-0.5)*0.5);
  for (let iter = 0; iter < 4; iter++) {
    const ns = new Float32Array(DIM);
    for (let i = 0; i < DIM; i++) {
      let sum = 0;
      for (let j = 0; j < DIM; j++) sum += Wmat[i][j] * s[j];
      ns[i] = Math.tanh(sum * 0.6);
    }
    s = ns;
  }
  // energy estimate
  energy = 0;
  for (let i = 0; i < DIM; i++) {
    for (let j = 0; j < DIM; j++) energy -= 0.5 * Wmat[i][j] * s[i] * s[j];
  }
  document.getElementById('energy').textContent = energy.toFixed(2);
  return s;
}

function decodeToAttractors(v) {
  const atts = [];
  // synthetic path from vector features
  let x = W * 0.5, y = H * 0.5;
  for (let k = 0; k < N_ATTR; k++) {
    const ang = (v[k % 8] - 0.5) * Math.PI * 2;
    const spd = 40 + Math.abs(v[8 + (k % 8)]) * 80;
    x += Math.cos(ang) * spd;
    y += Math.sin(ang) * spd;
    x = Math.max(50, Math.min(W-50, x));
    y = Math.max(50, Math.min(H-50, y));
    atts.push({x, y, str: 0.8 + Math.abs(v[k%DIM])*0.5, hue: (k*60 + v[0]*180) % 360});
  }
  return atts;
}

function updateCards() {
  const cards = document.getElementById('cards');
  cards.innerHTML = '';
  patterns.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h4>Memory ${idx+1}</h4>Click to recall`;
    const mini = document.createElement('canvas');
    mini.className = 'mini';
    mini.width = 140; mini.height = 40;
    const mctx = mini.getContext('2d');
    // simple preview: dots along decoded
    const atts = decodeToAttractors(p);
    mctx.strokeStyle = '#8cf';
    mctx.beginPath();
    atts.forEach((a,i) => {
      const px = (a.x / W) * 140, py = (a.y / H) * 40;
      if (i===0) mctx.moveTo(px, py); else mctx.lineTo(px, py);
    });
    mctx.stroke();
    card.appendChild(mini);
    card.onclick = () => { recalled = retrieve(p); };
    cards.appendChild(card);
  });
}

function step() {
  const atts = decodeToAttractors(recalled);
  const gx = tiltX * 0.25, gy = tiltY * 0.25;
  particles.forEach(p => {
    let fx = gx, fy = gy;
    atts.forEach(a => {
      const dx = a.x - p.x, dy = a.y - p.y;
      const d2 = dx*dx + dy*dy + 120;
      const d = Math.sqrt(d2);
      const f = a.str * 600 / d2;
      fx += (dx / d) * f;
      fy += (dy / d) * f;
    });
    p.vx = (p.vx + fx) * 0.91;
    p.vy = (p.vy + fy) * 0.91;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.4;
    if (p.y < 0 || p.y > H) p.vy *= -0.4;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  });
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const atts = decodeToAttractors(recalled);
  atts.forEach(a => {
    const grd = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 50);
    grd.addColorStop(0, `hsla(${a.hue},70%,55%,0.7)`);
    grd.addColorStop(1, `hsla(${a.hue},70%,30%,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 40, 0, Math.PI*2);
    ctx.fill();
  });
  // current path
  if (currentPath.length > 1) {
    ctx.strokeStyle = 'rgba(150,200,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentPath[0].x, currentPath[0].y);
    currentPath.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200,220,255,0.55)';
  particles.forEach(p => {
    ctx.fillRect(p.x-1, p.y-1, 2, 2);
  });
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointerdown', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.down = true;
  currentPath = [{x: pointer.x, y: pointer.y}];
});
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (pointer.down) currentPath.push({x: pointer.x, y: pointer.y});
});
canvas.addEventListener('pointerup', e => {
  pointer.down = false;
  if (currentPath.length > 5) {
    const v = sampleTrajectory(currentPath);
    if (v) {
      storePattern(v);
      recalled = retrieve(v);
    }
  }
  currentPath = [];
});

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 40;
    tiltY = (e.beta || 0) / 40;
  });
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f463', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  try {
    db = db || await openDB();
    const tx = db.transaction('seal', 'readwrite');
    const data = {patterns: patterns.map(p => Array.from(p)), W: Wmat.map(r => Array.from(r)), n: patterns.length};
    tx.objectStore('seal').put(data, 'memory');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (memory only)'; }
};
document.getElementById('load').onclick = async () => {
  try {
    db = db || await openDB();
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('memory');
    req.onsuccess = () => {
      if (req.result) {
        patterns = req.result.patterns.map(a => new Float32Array(a));
        Wmat = req.result.W.map(a => new Float32Array(a));
        document.getElementById('npat').textContent = patterns.length;
        if (patterns.length) recalled = retrieve(patterns[0]);
        updateCards();
        document.getElementById('status').textContent = 'Loaded memory';
      }
    };
  } catch(e) {}
};
document.getElementById('clear').onclick = () => {
  patterns = [];
  Wmat = Array.from({length: DIM}, () => new Float32Array(DIM));
  document.getElementById('npat').textContent = 0;
  updateCards();
  document.getElementById('status').textContent = 'Patterns cleared';
};

// initial random recall
recalled = retrieve(null);
setTimeout(() => { if (patterns.length === 0) updateCards(); }, 100);
