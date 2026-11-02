const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const root = document.documentElement;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// --- SDF primitives ---
function sdSphere(p, c, r) {
  return Math.hypot(p.x - c.x, p.y - c.y) - r;
}
function sdBox(p, c, b) {
  const dx = Math.abs(p.x - c.x) - b.x;
  const dy = Math.abs(p.y - c.y) - b.y;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function evaluateSDF(p, genome) {
  // genome: array of {type, x, y, r or w/h, weight}
  let d = 1e6;
  for (const g of genome) {
    let sd;
    if (g.type === 'sphere') {
      sd = sdSphere(p, {x: g.x, y: g.y}, g.r);
    } else {
      sd = sdBox(p, {x: g.x, y: g.y}, {x: g.w, y: g.h});
    }
    d = smin(d, sd * g.weight, 40);
  }
  return d;
}

function randomGenome() {
  const n = 4 + Math.floor(Math.random() * 3);
  const g = [];
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.6) {
      g.push({
        type: 'sphere',
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 40 + Math.random() * 120,
        weight: 0.6 + Math.random() * 0.8
      });
    } else {
      g.push({
        type: 'box',
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        w: 30 + Math.random() * 80,
        h: 30 + Math.random() * 80,
        weight: 0.6 + Math.random() * 0.8
      });
    }
  }
  return g;
}

let currentGenome = randomGenome();
let particles = [];
const MAX_PARTICLES = 350;

function initParticles() {
  particles = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: 0, vy: 0,
      age: Math.random() * 100
    });
  }
}
initParticles();

// Pointer fitness
let pointer = { x: -999, y: -999, active: false };
let pointerHistory = [];
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
  pointerHistory.push({x: e.clientX, y: e.clientY, t: performance.now()});
  if (pointerHistory.length > 30) pointerHistory.shift();
});
canvas.addEventListener('pointerleave', () => { pointer.active = false; });

// Evolution Worker (simple GA inline for self-contained; in real would be Worker)
let generation = 0;
let population = Array.from({length: 12}, randomGenome);
let bestFitness = 0;
let diversity = 0.3;

function computeFitness(genome) {
  // Sample a few points near pointer or random
  let score = 0;
  const samples = pointer.active ? pointerHistory.slice(-8) : [];
  if (samples.length === 0) {
    for (let i = 0; i < 6; i++) {
      samples.push({x: Math.random()*canvas.width, y: Math.random()*canvas.height});
    }
  }
  for (const s of samples) {
    const d = Math.abs(evaluateSDF(s, genome));
    score += Math.exp(-d / 60); // higher when surface near sample
  }
  // diversity bonus: spread of primitives
  const xs = genome.map(g => g.x);
  const spread = Math.max(...xs) - Math.min(...xs);
  score += spread / canvas.width * 2;
  return score / (samples.length + 1);
}

function evolve() {
  // Tournament + mutate
  const scored = population.map(g => ({g, f: computeFitness(g)}));
  scored.sort((a,b) => b.f - a.f);
  bestFitness = scored[0].f;
  const next = [scored[0].g, scored[1].g]; // elites
  while (next.length < population.length) {
    const parent = scored[Math.floor(Math.random()*4)].g;
    const child = JSON.parse(JSON.stringify(parent));
    // mutate
    for (const prim of child) {
      if (Math.random() < 0.3) prim.x += (Math.random()-0.5)*80;
      if (Math.random() < 0.3) prim.y += (Math.random()-0.5)*80;
      if (prim.r && Math.random() < 0.3) prim.r = Math.max(20, prim.r + (Math.random()-0.5)*40);
      if (prim.w && Math.random() < 0.3) prim.w = Math.max(15, prim.w + (Math.random()-0.5)*30);
      if (prim.h && Math.random() < 0.3) prim.h = Math.max(15, prim.h + (Math.random()-0.5)*30);
      prim.x = Math.max(0, Math.min(canvas.width, prim.x));
      prim.y = Math.max(0, Math.min(canvas.height, prim.y));
    }
    if (Math.random() < 0.1 && child.length < 7) {
      child.push(randomGenome()[0]);
    }
    next.push(child);
  }
  population = next;
  currentGenome = scored[0].g;
  generation++;
  // diversity ~ variance of fitness or primitive count spread
  diversity = Math.min(1, scored.reduce((s,x) => s + x.f, 0) / scored.length / 5);
}

// Particle update toward SDF=0
function updateParticles() {
  for (const p of particles) {
    const d = evaluateSDF(p, currentGenome);
    // gradient approx
    const eps = 4;
    const dx = evaluateSDF({x: p.x+eps, y: p.y}, currentGenome) - d;
    const dy = evaluateSDF({x: p.x, y: p.y+eps}, currentGenome) - d;
    const len = Math.hypot(dx, dy) || 1;
    // move toward zero
    const force = -d * 0.08;
    p.vx += (dx / len) * force;
    p.vy += (dy / len) * force;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.x += p.vx;
    p.y += p.vy;
    // wrap or bounce soft
    if (p.x < 0 || p.x > canvas.width) p.vx *= -0.5;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(canvas.width, p.x));
    p.y = Math.max(0, Math.min(canvas.height, p.y));
    p.age++;
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10, 10, 18, 0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    const d = Math.abs(evaluateSDF(p, currentGenome));
    const hue = (p.age * 0.5 + d) % 360;
    const alpha = Math.max(0.2, 1 - d / 80);
    ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.2, 3 - d/40), 0, Math.PI*2);
    ctx.fill();
  }
  // draw faint SDF zero hint (sample grid optional, skipped for perf)
}

// Seal / restore
let db;
const req = indexedDB.open('F493Sculptor', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('forms', {keyPath: 'id'});
};
req.onsuccess = e => { db = e.target.result; };
req.onerror = () => console.warn('IDB unavailable');

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function seal() {
  const payload = JSON.stringify(currentGenome);
  const hash = await sha256(payload);
  if (db) {
    const tx = db.transaction('forms', 'readwrite');
    tx.objectStore('forms').put({id: 'last', hash, genome: currentGenome, t: Date.now()});
  }
  statusEl.textContent += ' · sealed ' + hash.slice(0,8);
  setTimeout(() => updateStatus(), 2000);
}

function restore() {
  if (!db) return;
  const tx = db.transaction('forms', 'readonly');
  const get = tx.objectStore('forms').get('last');
  get.onsuccess = () => {
    if (get.result) {
      currentGenome = get.result.genome;
      population[0] = currentGenome;
      statusEl.textContent += ' · restored';
    }
  };
}

function updateStatus() {
  statusEl.textContent = `diversity ${diversity.toFixed(2)} · fitness ${bestFitness.toFixed(2)} · particles ${particles.length} · generation ${generation}`;
  root.style.setProperty('--diversity', diversity.toFixed(3));
  root.style.setProperty('--fitness', Math.min(1, bestFitness / 4).toFixed(3));
}

document.getElementById('sealBtn').onclick = seal;
document.getElementById('restoreBtn').onclick = restore;
document.getElementById('resetBtn').onclick = () => {
  population = Array.from({length: 12}, randomGenome);
  currentGenome = population[0];
  generation = 0;
  initParticles();
};
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

let lastEvolve = 0;
function loop(t) {
  if (t - lastEvolve > 600) {
    evolve();
    lastEvolve = t;
  }
  updateParticles();
  draw();
  updateStatus();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
