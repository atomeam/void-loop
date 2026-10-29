const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Particle swarm
const N = 180;
const particles = [];
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
    hue: 200 + Math.random() * 60
  });
}

// Pointer history for prediction
const hist = [];
const MAXH = 16;
let px = W/2, py = H/2;

// Floating memory orbs
const orbs = [];
for (let i = 0; i < 4; i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = 'mem' + i;
  el.style.setProperty('--oh', 30 + i * 70);
  document.body.appendChild(el);
  orbs.push({ el, x: 80 + i * 120, y: 80 + Math.random()*60, id: i });
  el.addEventListener('pointerdown', e => {
    e.target.setPointerCapture(e.pointerId);
    const o = orbs[i];
    const move = ev => { o.x = ev.clientX; o.y = ev.clientY; };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
}

// Worker: evolutionary linear predictors of pointer velocity from history
const workerCode = `
let pop = [];
const P = 10;
const G = 4; // genes: bias, hist weight, residual scale, cohesion boost
function rand() { return Math.random() * 2 - 1; }
for (let i = 0; i < P; i++) {
  pop.push({ genes: Array.from({length: G}, rand), fit: 0 });
}
function predict(genes, hist) {
  if (hist.length < 2) return { vx: 0, vy: 0 };
  const last = hist[hist.length-1];
  const prev = hist[hist.length-2];
  const vx = (last.x - prev.x) * genes[1] + genes[0];
  const vy = (last.y - prev.y) * genes[1] + genes[0];
  return { vx, vy };
}
self.onmessage = e => {
  const { residual, hist, coherence } = e.data;
  for (const ind of pop) {
    const pred = predict(ind.genes, hist);
    const err = Math.hypot(pred.vx, pred.vy); // simple proxy; real residual comes from main
    ind.fit = (1 - Math.min(1, residual)) * 0.6 + coherence * 0.3 + (1 - Math.min(1, err)) * 0.1 + Math.random()*0.02;
  }
  pop.sort((a,b) => b.fit - a.fit);
  const best = pop[0];
  const child = { genes: best.genes.map(g => g + (Math.random()-0.5)*0.25), fit: 0 };
  pop[P-1] = child;
  self.postMessage({ best: best.genes, gen: Date.now() % 10000 });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
let bestGenes = [0.1, 0.7, 0.4, 0.2];
let gen = 0;
worker.onmessage = e => {
  bestGenes = e.data.best;
  gen = e.data.gen;
  document.getElementById('gen').textContent = Math.floor(gen / 100);
};

// Interaction
addEventListener('pointermove', e => {
  px = e.clientX; py = e.clientY;
  hist.push({ x: px, y: py, t: performance.now() });
  if (hist.length > MAXH) hist.shift();
});

// Simple residual: difference between predicted and actual recent velocity
function computeResidual() {
  if (hist.length < 3) return 0.5;
  const last = hist[hist.length-1];
  const prev = hist[hist.length-2];
  const actualVx = last.x - prev.x;
  const actualVy = last.y - prev.y;
  const predVx = (prev.x - (hist[hist.length-3]?.x || prev.x)) * bestGenes[1] + bestGenes[0];
  const predVy = (prev.y - (hist[hist.length-3]?.y || prev.y)) * bestGenes[1] + bestGenes[0];
  return Math.min(1, Math.hypot(actualVx - predVx, actualVy - predVy) / 20);
}

let frame = 0;
function tick() {
  frame++;
  const residual = computeResidual();
  const conf = 1 - residual;
  document.getElementById('res').textContent = residual.toFixed(2);
  document.getElementById('conf').textContent = conf.toFixed(2);
  document.getElementById('n').textContent = particles.length;

  // Morph chrome
  const hue = 180 + residual * 140;
  document.documentElement.style.setProperty('--hue', hue);
  document.documentElement.style.setProperty('--glow', conf);

  // Update particles: cohesion modulated by residual + orbs as attractors
  const cohesion = 0.02 + bestGenes[3] * 0.03 * conf;
  const sep = 0.08 * residual;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let ax = 0, ay = 0, cnt = 0;
    for (let j = 0; j < particles.length; j++) {
      if (i === j) continue;
      const q = particles[j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 1600 && d2 > 1) {
        ax += dx / d2 * cohesion;
        ay += dy / d2 * cohesion;
        if (d2 < 400) { ax -= dx * sep; ay -= dy * sep; }
        cnt++;
      }
    }
    // Orbs attract
    for (const o of orbs) {
      const dx = o.x - p.x, dy = o.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 10000) { ax += dx / Math.max(d2, 100) * 0.15; ay += dy / Math.max(d2, 100) * 0.15; }
    }
    // Pointer weak attract
    ax += (px - p.x) * 0.0008;
    ay += (py - p.y) * 0.0008;
    p.vx = p.vx * 0.92 + ax;
    p.vy = p.vy * 0.92 + ay;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 4) { p.vx *= 4/sp; p.vy *= 4/sp; }
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
    p.hue = (p.hue + residual * 2) % 360;
  }

  // Draw
  ctx.fillStyle = `hsl(${hue}, 40%, 6%)`;
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, 0.85)`;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }

  // Update orbs
  for (const o of orbs) {
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
  }

  // Evolve occasionally
  if (frame % 30 === 0) {
    let coherence = 0;
    for (let i = 0; i < Math.min(30, particles.length); i++) {
      coherence += Math.hypot(particles[i].vx, particles[i].vy);
    }
    coherence = 1 - Math.min(1, coherence / 30 / 3);
    worker.postMessage({ residual, hist: hist.slice(-6), coherence });
  }

  requestAnimationFrame(tick);
}
tick();

// Seal
document.getElementById('seal').addEventListener('click', () => {
  try {
    localStorage.setItem('f049-best-genes', JSON.stringify(bestGenes));
    alert('Sealed best genes to localStorage');
  } catch (e) { alert('Seal failed: ' + e.message); }
});

// Load sealed if present
try {
  const saved = localStorage.getItem('f049-best-genes');
  if (saved) bestGenes = JSON.parse(saved);
} catch (e) {}
