const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

let population = [];
let currentGenome = null;
let fitnessMap = new Float32Array(64*64);
let portals = [];
let opfsRoot = null;
let generation = 0;

async function initOPFS() {
  try {
    opfsRoot = await navigator.storage.getDirectory();
    const fh = await opfsRoot.getFileHandle('population.json', { create: false }).catch(() => null);
    if (fh) {
      const file = await fh.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      population = data.population || [];
      generation = data.generation || 0;
      status.textContent = `Loaded gen ${generation} from OPFS (${population.length} genomes)`;
    } else {
      initPopulation();
      await savePopulation();
      status.textContent = 'Initialized new population in OPFS';
    }
  } catch (e) {
    console.warn('OPFS failed:', e);
    initPopulation();
    status.textContent = 'OPFS unavailable — session only';
  }
  if (population.length) currentGenome = population[0];
  createPortals();
  requestAnimationFrame(loop);
}

function initPopulation() {
  population = [];
  for (let i = 0; i < 10; i++) {
    population.push({
      seed: Math.random() * 10000 | 0,
      scale: 0.02 + Math.random() * 0.05,
      octaves: 3 + (Math.random()*3|0),
      persistence: 0.4 + Math.random()*0.3,
      fitness: 0
    });
  }
}

async function savePopulation() {
  if (!opfsRoot) return;
  try {
    const fh = await opfsRoot.getFileHandle('population.json', { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify({ population, generation }));
    await w.close();
  } catch (e) { console.warn(e); }
}

function noise(x, y, g) {
  // Simple value noise
  let val = 0, amp = 1, freq = g.scale, max = 0;
  for (let o = 0; o < g.octaves; o++) {
    const nx = x * freq + g.seed, ny = y * freq + g.seed * 1.3;
    val += Math.sin(nx) * Math.cos(ny) * amp + Math.sin(nx*1.7 + ny*0.8) * amp * 0.5;
    max += amp;
    amp *= g.persistence;
    freq *= 2;
  }
  return (val / max + 1) * 0.5;
}

function renderTerrain() {
  if (!currentGenome) return;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const h = noise(x, y, currentGenome);
      const c = h * 255 | 0;
      const idx = (y * W + x) * 4;
      d[idx] = c * 0.4; d[idx+1] = c * 0.7; d[idx+2] = c; d[idx+3] = 255;
      if (x+1 < W) { d[idx+4] = d[idx]; d[idx+5] = d[idx+1]; d[idx+6] = d[idx+2]; d[idx+7] = 255; }
    }
  }
  ctx.putImageData(img, 0, 0);
  // Fitness overlay
  ctx.fillStyle = 'rgba(255,100,100,0.15)';
  for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) {
    if (fitnessMap[i*64+j] > 0.1) {
      ctx.fillRect(j * W/64, i * H/64, W/64, H/64);
    }
  }
}

function createPortals() {
  document.querySelectorAll('.portal').forEach(p => p.remove());
  portals = [];
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'P' + i;
    el.style.left = (Math.random()*W|0) + 'px';
    el.style.top = (Math.random()*H|0) + 'px';
    document.body.appendChild(el);
    portals.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0 });
    makeDraggable(el, portals[portals.length-1]);
  }
}

function makeDraggable(el, p) {
  let dx=0, dy=0, drag=false;
  el.onpointerdown = e => { drag=true; dx=e.clientX-p.x; dy=e.clientY-p.y; el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if (!drag) return; p.x = e.clientX - dx; p.y = e.clientY - dy; el.style.left = p.x+'px'; el.style.top = p.y+'px'; injectFitness(p.x, p.y, 2); };
  el.onpointerup = () => drag=false;
}

function injectFitness(x, y, amt=1) {
  const ix = Math.min(63, Math.max(0, x / W * 64 | 0));
  const iy = Math.min(63, Math.max(0, y / H * 64 | 0));
  fitnessMap[iy*64 + ix] = Math.min(1, fitnessMap[iy*64 + ix] + amt * 0.1);
}

canvas.onpointermove = e => injectFitness(e.clientX, e.clientY, 0.5);

function updatePortals() {
  if (!currentGenome) return;
  portals.forEach(p => {
    // Seek local high noise
    let best = 0, bx = p.x, by = p.y;
    for (let dx = -20; dx <= 20; dx += 10) for (let dy = -20; dy <= 20; dy += 10) {
      const nx = p.x + dx, ny = p.y + dy;
      if (nx < 0 || nx > W || ny < 0 || ny > H) continue;
      const h = noise(nx, ny, currentGenome);
      if (h > best) { best = h; bx = nx; by = ny; }
    }
    p.vx += (bx - p.x) * 0.02;
    p.vy += (by - p.y) * 0.02;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(30, Math.min(W-30, p.x));
    p.y = Math.max(30, Math.min(H-30, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `scale(${0.6 + best})`;
  });
}

function evaluateFitness() {
  // Simple: average fitness under portals + global coverage
  let total = 0;
  portals.forEach(p => {
    const ix = Math.min(63, Math.max(0, p.x / W * 64 | 0));
    const iy = Math.min(63, Math.max(0, p.y / H * 64 | 0));
    total += fitnessMap[iy*64 + ix];
  });
  return total / portals.length;
}

function evolve() {
  // Rank by current fitness (shared for simplicity; real would re-eval)
  const fit = evaluateFitness();
  population.forEach(g => g.fitness = fit * (0.5 + Math.random()*0.5)); // noisy
  population.sort((a,b) => b.fitness - a.fitness);
  const next = population.slice(0, 4); // elites
  while (next.length < 10) {
    const a = population[Math.random()*4|0];
    const b = population[Math.random()*4|0];
    next.push({
      seed: Math.random() < 0.5 ? a.seed : b.seed,
      scale: (a.scale + b.scale)/2 + (Math.random()-0.5)*0.005,
      octaves: Math.random() < 0.5 ? a.octaves : b.octaves,
      persistence: (a.persistence + b.persistence)/2 + (Math.random()-0.5)*0.05,
      fitness: 0
    });
  }
  population = next;
  currentGenome = population[0];
  generation++;
  fitnessMap.fill(0);
  status.textContent = `Generation ${generation} sealed. Best fitness ~${fit.toFixed(2)}`;
  savePopulation();
}

document.getElementById('seal').onclick = evolve;
document.getElementById('reset').onclick = async () => { initPopulation(); generation=0; await savePopulation(); status.textContent='Reset'; currentGenome=population[0]; };

function loop() {
  renderTerrain();
  updatePortals();
  requestAnimationFrame(loop);
}

initOPFS();
