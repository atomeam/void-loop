const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GRID = 64;
const dx = 1.0;
let height = new Float32Array(GRID * GRID);
let vel = new Float32Array(GRID * GRID);
let nextH = new Float32Array(GRID * GRID);

function idx(x, y) { return y * GRID + x; }
function initField() {
  for (let i = 0; i < height.length; i++) { height[i] = 0; vel[i] = 0; }
  for (let k = 0; k < 3; k++) {
    const x = 10 + Math.floor(Math.random() * (GRID-20));
    const y = 10 + Math.floor(Math.random() * (GRID-20));
    height[idx(x,y)] = 2 + Math.random();
  }
}

const POP = 8;
let genomes = Array.from({length: POP}, () => ({
  c2: 0.3 + Math.random()*0.4,
  damp: 0.98 + Math.random()*0.015,
  amp: 0.5 + Math.random()*1.5,
  bias: Math.random()*0.2,
  fitness: 0
}));
let bestIdx = 0;
let frame = 0;

function mutate(g) {
  const n = {...g};
  n.c2 = Math.max(0.05, Math.min(0.8, g.c2 + (Math.random()-0.5)*0.05));
  n.damp = Math.max(0.95, Math.min(0.999, g.damp + (Math.random()-0.5)*0.005));
  n.amp = Math.max(0.1, Math.min(3, g.amp + (Math.random()-0.5)*0.2));
  n.bias += (Math.random()-0.5)*0.05;
  n.fitness = 0;
  return n;
}

function selectAndEvolve() {
  let a = Math.floor(Math.random()*POP), b = Math.floor(Math.random()*POP);
  if (genomes[b].fitness > genomes[a].fitness) a = b;
  const child = mutate(genomes[a]);
  let worst = 0;
  for (let i = 1; i < POP; i++) if (genomes[i].fitness < genomes[worst].fitness) worst = i;
  genomes[worst] = child;
  bestIdx = genomes.reduce((bi, g, i) => g.fitness > genomes[bi].fitness ? i : bi, 0);
}

let ori = {beta:0, gamma:0};
let pointer = {x: W/2, y: H/2, vx:0, vy:0};
window.addEventListener('deviceorientation', e => {
  ori.beta = e.beta || 0;
  ori.gamma = e.gamma || 0;
});
window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

const riders = [];
function spawnRiders() {
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'rider';
    el.textContent = 'R' + i;
    el.style.left = (Math.random()*W*0.8) + 'px';
    el.style.top = (Math.random()*H*0.8) + 'px';
    document.body.appendChild(el);
    riders.push({el, gx: Math.floor(Math.random()*GRID), gy: Math.floor(Math.random()*GRID), fitness:0});
    el.addEventListener('click', () => {
      genomes[bestIdx].fitness += 5;
      el.classList.add('reward');
      setTimeout(() => el.classList.remove('reward'), 400);
      const g = genomes[bestIdx];
      height[idx(riders[i]?.gx||32, riders[i]?.gy||32)] += g.amp;
    });
  }
}

function stepWave() {
  const g = genomes[bestIdx];
  const c2 = g.c2;
  const damp = g.damp;
  for (let y = 1; y < GRID-1; y++) {
    for (let x = 1; x < GRID-1; x++) {
      const i = idx(x,y);
      const lap = height[idx(x-1,y)] + height[idx(x+1,y)] + height[idx(x,y-1)] + height[idx(x,y+1)] - 4*height[i];
      vel[i] = (vel[i] + c2 * lap) * damp;
      nextH[i] = height[i] + vel[i];
    }
  }
  const sx = Math.floor((pointer.x / W) * GRID);
  const sy = Math.floor((pointer.y / H) * GRID);
  if (sx > 1 && sx < GRID-2 && sy > 1 && sy < GRID-2) {
    height[idx(sx,sy)] += g.amp * 0.15 * (Math.abs(pointer.vx)+Math.abs(pointer.vy))*0.01 + Math.abs(ori.beta)*0.002;
  }
  const tmp = height; height = nextH; nextH = tmp;
  for (let i = 0; i < height.length; i++) height[i] = Math.max(-4, Math.min(4, height[i]));
}

function updateRiders() {
  for (const r of riders) {
    let bestA = -10, bx = r.gx, by = r.gy;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = Math.max(1, Math.min(GRID-2, r.gx + dx));
      const ny = Math.max(1, Math.min(GRID-2, r.gy + dy));
      const a = Math.abs(height[idx(nx,ny)]);
      if (a > bestA) { bestA = a; bx = nx; by = ny; }
    }
    r.gx = bx; r.gy = by;
    const px = (r.gx / GRID) * W;
    const py = (r.gy / GRID) * H;
    r.el.style.transform = `translate(${px - 36}px, ${py - 24}px) scale(${0.8 + bestA*0.15})`;
    r.fitness = bestA;
    genomes[bestIdx].fitness += bestA * 0.01;
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cellW = W / GRID, cellH = H / GRID;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const h = height[idx(x,y)];
      const n = (h + 4) / 8;
      ctx.fillStyle = `hsl(${200 + h*20}, 70%, ${30 + n*40}%)`;
      ctx.fillRect(x*cellW, y*cellH, cellW+1, cellH+1);
    }
  }
}

let anim = 0;
function loop() {
  frame++;
  stepWave();
  updateRiders();
  if (frame % 40 === 0) selectAndEvolve();
  render();
  statusEl.textContent = `genomes · best fit ${genomes[bestIdx].fitness.toFixed(1)} · c2 ${genomes[bestIdx].c2.toFixed(2)}`;
  if (genomes[bestIdx].fitness > 20 && frame % 120 === 0) {
    try {
      const ch = new BroadcastChannel('f636-genome');
      ch.postMessage({genome: genomes[bestIdx], ts: Date.now()});
    } catch (e) { console.debug("lab f636-webgpu-wave-dom-riders:", e); }
  }
  anim = requestAnimationFrame(loop);
}

async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f636', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('state');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({genomes, best: genomes[bestIdx], field: Array.from(height.slice(0,100))}, 'main');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'sealed';
  } catch(e) { statusEl.textContent = 'seal failed (session only)'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initField(); genomes.forEach(g => g.fitness=0); };

initField();
spawnRiders();
statusEl.textContent = 'running (Canvas2D wave)';
loop();

try {
  const ch = new BroadcastChannel('f636-genome');
  ch.onmessage = e => {
    if (e.data.genome && e.data.genome.fitness > genomes[bestIdx].fitness) {
      genomes[Math.floor(Math.random()*POP)] = {...e.data.genome, fitness: e.data.genome.fitness * 0.8};
    }
  };
} catch (e) { console.debug("lab f636-webgpu-wave-dom-riders:", e); }
