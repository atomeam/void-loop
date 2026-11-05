const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const sealBtn = document.getElementById('seal');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GRID = 128;
const cellW = W / GRID, cellH = H / GRID;
const grid = new Uint8Array(GRID * GRID);
const ANTS = 24;
const ants = [];
let bestFitness = 0;
let bestGenome = null;

function randomGenome() {
  // Tiny MLP: 2 inputs → 4 hidden → 1 output (turn)
  const w1 = Array.from({length: 8}, () => Math.random()*2-1);
  const w2 = Array.from({length: 4}, () => Math.random()*2-1);
  return { w1, w2 };
}

function mlpForward(g, inputs) {
  // inputs: [cell, dir_norm]
  let h = [];
  for (let i = 0; i < 4; i++) {
    let s = g.w1[i*2] * inputs[0] + g.w1[i*2+1] * inputs[1];
    h.push(Math.tanh(s));
  }
  let o = 0;
  for (let i = 0; i < 4; i++) o += g.w2[i] * h[i];
  return Math.tanh(o);
}

for (let i = 0; i < ANTS; i++) {
  ants.push({
    x: Math.floor(Math.random() * GRID),
    y: Math.floor(Math.random() * GRID),
    dir: Math.floor(Math.random() * 4), // 0N 1E 2S 3W
    genome: randomGenome(),
    steps: 0,
    fitness: 0
  });
}

const portals = [];
for (let i = 0; i < 4; i++) {
  const p = document.createElement('div');
  p.className = 'portal';
  document.body.appendChild(p);
  portals.push(p);
}

const dirs = [[0,-1],[1,0],[0,1],[-1,0]];

function update() {
  for (const ant of ants) {
    const idx = ant.y * GRID + ant.x;
    const cell = grid[idx];
    const turn = mlpForward(ant.genome, [cell * 2 - 1, ant.dir / 2 - 1]);
    if (turn > 0) ant.dir = (ant.dir + 1) % 4; // right
    else ant.dir = (ant.dir + 3) % 4; // left
    grid[idx] = 1 - cell;
    ant.x = (ant.x + dirs[ant.dir][0] + GRID) % GRID;
    ant.y = (ant.y + dirs[ant.dir][1] + GRID) % GRID;
    ant.steps++;
    ant.fitness = ant.steps * 0.01 + Math.abs(turn);
    if (ant.fitness > bestFitness) {
      bestFitness = ant.fitness;
      bestGenome = ant.genome;
    }
  }
  // Simple portal follow top ants
  ants.sort((a,b) => b.fitness - a.fitness);
  for (let i = 0; i < 4; i++) {
    const a = ants[i];
    const px = (a.x / GRID) * W;
    const py = (a.y / GRID) * H;
    portals[i].style.left = px + 'px';
    portals[i].style.top = py + 'px';
    portals[i].style.transform = `scale(${1 + a.fitness * 0.05}) rotate(${a.dir * 90}deg)`;
    portals[i].style.filter = `hue-rotate(${a.dir * 90}deg)`;
  }
}

function draw() {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const v = grid[y * GRID + x] ? 180 : 20;
      const sx = Math.floor(x * cellW), sy = Math.floor(y * cellH);
      for (let dy = 0; dy < cellH; dy++) {
        for (let dx = 0; dx < cellW; dx++) {
          const i = ((sy + dy) * W + (sx + dx)) * 4;
          d[i] = v; d[i+1] = v + 40; d[i+2] = v + 80; d[i+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // Draw ants
  ctx.fillStyle = '#fff';
  for (const a of ants) {
    ctx.fillRect(a.x * cellW, a.y * cellH, cellW, cellH);
  }
}

function loop() {
  update();
  draw();
  status.textContent = `Ants: ${ANTS} | Best fitness: ${bestFitness.toFixed(2)} | Click to place | Seal to persist`;
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('click', e => {
  const x = Math.floor((e.clientX / W) * GRID);
  const y = Math.floor((e.clientY / H) * GRID);
  const ant = ants[Math.floor(Math.random() * ants.length)];
  ant.x = x; ant.y = y;
  ant.steps = 0;
});

// IndexedDB + BroadcastChannel for sealed genomes
const bc = new BroadcastChannel('f524-genomes');
bc.onmessage = e => {
  if (e.data.genome && e.data.fitness > bestFitness * 0.8) {
    const weakest = ants.reduce((m, a) => a.fitness < m.fitness ? a : m, ants[0]);
    weakest.genome = e.data.genome;
    status.textContent += ' | Genome adopted';
  }
};

sealBtn.onclick = async () => {
  if (!bestGenome) return;
  const data = JSON.stringify({ genome: bestGenome, fitness: bestFitness, ts: Date.now() });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('verse-f524', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ hash: hex, data }, hex);
  bc.postMessage({ genome: bestGenome, fitness: bestFitness, hash: hex });
  status.textContent = `Sealed: ${hex.slice(0,8)}… fitness ${bestFitness.toFixed(2)}`;
};

// Optional orientation bias (not core)
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta) {
      // mild global bias on new ants
    }
  });
}
