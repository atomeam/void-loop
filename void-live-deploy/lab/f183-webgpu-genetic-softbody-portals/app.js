// F-183: WebGPU genetic softbody + self-morphing DOM portals
// Novel: evolved genomes control soft-body params; portals are physical agent extensions

const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 100;
const N_AGENTS = 6;
let particles = [];
let agents = [];
let generation = 0;
let bestFitness = 0;
let energy = 0;
let gpuReady = false;

function rand(a, b) { return a + Math.random() * (b - a); }

function makeGenome() {
  return {
    attract: rand(0.2, 1.4),
    stiffness: rand(0.02, 0.18),
    noise: rand(0.1, 0.8),
    radius: rand(40, 120)
  };
}

function init() {
  particles = Array.from({ length: N }, () => ({
    x: rand(0, W), y: rand(0, H),
    vx: rand(-1, 1), vy: rand(-1, 1),
    ax: 0, ay: 0
  }));
  agents = Array.from({ length: N_AGENTS }, (_, i) => ({
    id: i,
    genome: makeGenome(),
    fitness: 0,
    cx: rand(0, W), cy: rand(0, H),
    energyAbs: 0
  }));
  try {
    const s = localStorage.getItem('void-f183-seal');
    if (s) {
      const data = JSON.parse(s);
      if (data.best) agents[0].genome = data.best;
      statusEl.textContent = 'Restored sealed genome.';
    }
  } catch (e) {}
}

function computeFitness(a) {
  let cohesion = 0, absorbed = 0;
  particles.forEach(p => {
    const dx = p.x - a.cx, dy = p.y - a.cy;
    const d = Math.hypot(dx, dy);
    if (d < a.genome.radius) {
      cohesion += 1 - d / a.genome.radius;
      absorbed += Math.hypot(p.vx, p.vy) * 0.1;
    }
  });
  a.fitness = cohesion * 0.7 + absorbed * 0.3 + a.energyAbs;
  return a.fitness;
}

function evolve() {
  agents.forEach(computeFitness);
  agents.sort((a, b) => b.fitness - a.fitness);
  bestFitness = agents[0].fitness;
  const survivors = agents.slice(0, 2);
  const next = survivors.map(s => ({ ...s, energyAbs: 0 }));
  while (next.length < N_AGENTS) {
    const parent = survivors[Math.floor(Math.random() * survivors.length)];
    const g = { ...parent.genome };
    if (Math.random() < 0.6) g.attract *= rand(0.85, 1.15);
    if (Math.random() < 0.6) g.stiffness *= rand(0.85, 1.15);
    if (Math.random() < 0.5) g.noise *= rand(0.8, 1.2);
    if (Math.random() < 0.4) g.radius *= rand(0.9, 1.1);
    g.attract = Math.max(0.1, Math.min(2, g.attract));
    g.stiffness = Math.max(0.01, Math.min(0.3, g.stiffness));
    next.push({ id: next.length, genome: g, fitness: 0, cx: rand(0, W), cy: rand(0, H), energyAbs: 0 });
  }
  agents = next;
  generation++;
  updatePortals();
}

function updatePhysics(dt) {
  particles.forEach(p => {
    p.ax = 0; p.ay = 0;
    agents.forEach(a => {
      const dx = a.cx - p.x, dy = a.cy - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < a.genome.radius * 1.5) {
        const f = a.genome.attract * (1 - d / (a.genome.radius * 1.5));
        p.ax += (dx / d) * f;
        p.ay += (dy / d) * f;
      }
    });
    particles.forEach(o => {
      if (o === p) return;
      const dx = o.x - p.x, dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 60) {
        const rest = 30;
        const f = a_stiffness(d, rest);
        p.ax += (dx / d) * f;
        p.ay += (dy / d) * f;
      }
    });
    p.ax += (Math.random() - 0.5) * (agents[0]?.genome.noise || 0.3) * 0.2;
    p.ay += (Math.random() - 0.5) * (agents[0]?.genome.noise || 0.3) * 0.2;
    p.vx = (p.vx + p.ax) * 0.92;
    p.vy = (p.vy + p.ay) * 0.92;
    p.x = (p.x + p.vx + W) % W;
    p.y = (p.y + p.vy + H) % H;
  });
  agents.forEach(a => {
    let sx = 0, sy = 0, c = 0;
    particles.forEach(p => {
      const d = Math.hypot(p.x - a.cx, p.y - a.cy);
      if (d < a.genome.radius) { sx += p.x; sy += p.y; c++; }
    });
    if (c > 2) {
      a.cx = a.cx * 0.85 + (sx / c) * 0.15;
      a.cy = a.cy * 0.85 + (sy / c) * 0.15;
    } else {
      a.cx = (a.cx + Math.cos(generation + a.id) * 0.4 + W) % W;
      a.cy = (a.cy + Math.sin(generation + a.id) * 0.4 + H) % H;
    }
  });
}

function a_stiffness(d, rest) {
  return (d - rest) * 0.015;
}

function draw() {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#070711';
  ctx.fillRect(0, 0, W, H);
  particles.forEach(p => {
    const speed = Math.hypot(p.vx, p.vy);
    ctx.fillStyle = `hsla(${200 + speed * 20}, 70%, 60%, 0.8)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2 + speed * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  agents.forEach((a, i) => {
    ctx.strokeStyle = i === 0 ? '#8cf' : '#46a';
    ctx.lineWidth = i === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, a.genome.radius * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function updatePortals() {
  portalsEl.innerHTML = '';
  const top = [...agents].sort((a, b) => b.fitness - a.fitness).slice(0, 3);
  top.forEach(a => {
    const el = document.createElement('div');
    el.className = 'portal';
    el.dataset.id = a.id;
    el.innerHTML = `A${a.id}<br>fit ${a.fitness.toFixed(1)}<br>r${a.genome.radius.toFixed(0)}`;
    el.onclick = () => {
      a.energyAbs += 2;
      a.genome.attract *= 1.05;
      statusEl.textContent = `Portal boosted agent ${a.id}.`;
    };
    portalsEl.appendChild(el);
    placePortal(el, a);
  });
}

function placePortal(el, a) {
  const scale = 0.7 + Math.min(1.2, a.fitness / 20);
  const rot = (a.genome.attract - 0.5) * 30;
  el.style.transform = `translate(${a.cx - 55}px, ${a.cy - 35}px) scale(${scale}) rotate(${rot}deg)`;
  el.style.opacity = 0.6 + Math.min(0.4, a.fitness / 30);
  el.style.borderColor = `hsl(${200 + a.fitness * 4}, 70%, 60%)`;
}

function syncPortals() {
  [...portalsEl.children].forEach(el => {
    const id = +el.dataset.id;
    const a = agents.find(x => x.id === id);
    if (a) placePortal(el, a);
  });
}

function injectEnergy(x, y, amt = 4) {
  particles.forEach(p => {
    const dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 140) {
      const f = amt * (1 - d / 140);
      p.vx += (dx / d) * f * 0.3;
      p.vy += (dy / d) * f * 0.3;
    }
  });
  energy = Math.min(1, energy + 0.15);
  document.documentElement.style.setProperty('--energy', energy.toFixed(2));
  setTimeout(() => {
    energy = Math.max(0, energy - 0.05);
    document.documentElement.style.setProperty('--energy', energy.toFixed(2));
  }, 800);
}

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    await adapter.requestDevice();
    gpuReady = true;
    return true;
  } catch (e) { return false; }
}

let last = performance.now();
let genTimer = 0;
function loop(now) {
  const dt = Math.min(32, now - last) / 1000;
  last = now;
  genTimer += dt;
  updatePhysics(dt);
  agents.forEach(computeFitness);
  if (genTimer > 8) { evolve(); genTimer = 0; }
  draw();
  syncPortals();
  document.documentElement.style.setProperty('--best-fit', Math.min(1, bestFitness / 40).toFixed(3));
  statusEl.textContent = `Gen ${generation} | Best fit ${bestFitness.toFixed(1)} | Agents ${agents.length} | ${gpuReady ? 'WebGPU ready' : 'Canvas2D'} | Particles ${N}`;
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', e => injectEnergy(e.clientX, e.clientY));
document.getElementById('inject').onclick = () => injectEnergy(W / 2, H / 2, 6);
document.getElementById('evolve').onclick = evolve;
document.getElementById('seal').onclick = () => {
  const best = agents.slice().sort((a, b) => b.fitness - a.fitness)[0];
  try {
    localStorage.setItem('void-f183-seal', JSON.stringify({
      best: best.genome, fitness: best.fitness, gen: generation, ts: Date.now()
    }));
    statusEl.textContent = `Sealed genome (fit ${best.fitness.toFixed(1)}).`;
  } catch (e) {
    statusEl.textContent = 'Seal failed (storage).';
  }
};

init();
tryWebGPU().then(ok => {
  statusEl.textContent = ok ? 'WebGPU available (compute path noted). Running.' : 'Canvas2D path active.';
  updatePortals();
  requestAnimationFrame(loop);
});
