const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const COLS = 80, ROWS = 50;
let grid = new Int16Array(COLS * ROWS);
let next = new Int16Array(COLS * ROWS);
const cellW = () => W / COLS, cellH = () => H / ROWS;

function idx(x, y) { return y * COLS + x; }

// Init near critical
for (let i = 0; i < grid.length; i++) grid[i] = 2 + Math.floor(Math.random() * 3);

// Evolved params
let params = { threshold: 4, injectRate: 0.15, biasX: 0, biasY: 0 };
let bestFitness = 0;
const pop = Array.from({length: 8}, () => ({...params, fitness: 0}));

// DOM cards
const cards = [];
function spawnCard(x, y, mag) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = `Cascade ${mag}`;
  el.style.left = (x * cellW()) + 'px';
  el.style.top = (y * cellH()) + 'px';
  el.dataset.mag = mag;
  document.body.appendChild(el);
  cards.push({el, x, y, mag, life: 300});
  if (cards.length > 8) {
    const old = cards.shift();
    old.el.remove();
  }
  makeDraggable(el);
}

function makeDraggable(el) {
  let ox, oy, dragging = false;
  el.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
    // inject grains at card
    const cx = Math.floor((e.clientX) / cellW());
    const cy = Math.floor((e.clientY) / cellH());
    if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) grid[idx(cx, cy)] += 2;
  });
  el.addEventListener('pointerup', () => dragging = false);
}

// Pointer inject
let mx = COLS/2, my = ROWS/2;
canvas.addEventListener('pointermove', e => {
  mx = Math.floor(e.clientX / cellW());
  my = Math.floor(e.clientY / cellH());
});
canvas.addEventListener('pointerdown', () => grid[idx(Math.max(0,Math.min(COLS-1,mx)), Math.max(0,Math.min(ROWS-1,my)))] += 5);

// DeviceMotion bias
window.addEventListener('devicemotion', e => {
  if (e.accelerationIncludingGravity) {
    params.biasX = (e.accelerationIncludingGravity.x || 0) * 0.05;
    params.biasY = (e.accelerationIncludingGravity.y || 0) * 0.05;
  }
});

let avalancheCount = 0;
function step() {
  // inject
  if (Math.random() < params.injectRate) {
    let ix = Math.max(0, Math.min(COLS-1, mx + Math.round(params.biasX * 5)));
    let iy = Math.max(0, Math.min(ROWS-1, my + Math.round(params.biasY * 5)));
    grid[idx(ix, iy)]++;
  }

  // topple
  next.set(grid);
  let avSize = 0;
  for (let y = 1; y < ROWS-1; y++) {
    for (let x = 1; x < COLS-1; x++) {
      const i = idx(x, y);
      if (grid[i] >= params.threshold) {
        next[i] -= 4;
        next[idx(x+1,y)]++; next[idx(x-1,y)]++; next[idx(x,y+1)]++; next[idx(x,y-1)]++;
        avSize++;
      }
    }
  }
  grid.set(next);
  if (avSize > 8) {
    avalancheCount++;
    spawnCard(mx, my, avSize);
  }
  document.getElementById('av').textContent = avalancheCount;
  document.getElementById('th').textContent = params.threshold.toFixed(1);

  // evolve occasionally
  if (Math.random() < 0.02) {
    const fit = avSize * 0.1 + Math.random(); // simple diversity proxy
    if (fit > bestFitness) {
      bestFitness = fit;
      // mutate pop
      for (let p of pop) {
        p.threshold = Math.max(3, Math.min(6, params.threshold + (Math.random()-0.5)*0.5));
        p.injectRate = Math.max(0.05, Math.min(0.4, params.injectRate + (Math.random()-0.5)*0.05));
        p.fitness = fit;
      }
      params = {...pop[Math.floor(Math.random()*pop.length)]};
    }
  }
}

function render() {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const h = grid[idx(x,y)];
      const c = Math.min(255, h * 40);
      const r = c, g = 100 + c*0.5, b = 255 - c*0.5;
      const px0 = Math.floor(x * cellW()), py0 = Math.floor(y * cellH());
      const px1 = Math.floor((x+1) * cellW()), py1 = Math.floor((y+1) * cellH());
      for (let py = py0; py < py1 && py < H; py++) {
        for (let px = px0; px < px1 && px < W; px++) {
          const i = (py * W + px) * 4;
          d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // update cards morph
  cards.forEach(c => {
    c.life--;
    const s = 1 + c.mag * 0.01;
    c.el.style.transform = `scale(${s})`;
    c.el.style.filter = `hue-rotate(${c.mag * 2}deg)`;
    c.el.style.opacity = Math.max(0.3, c.life / 300);
    if (c.life <= 0) { c.el.remove(); }
  });
  cards.splice(0, cards.length, ...cards.filter(c => c.life > 0));
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}
loop();

// Seal
document.getElementById('seal').onclick = async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('verse-sandpile', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({params, gridHash: Array.from(grid.slice(0,100)), cards: cards.length, ts: Date.now()}, 'best');
  alert('Sealed to IndexedDB');
};

document.getElementById('reset').onclick = () => {
  for (let i = 0; i < grid.length; i++) grid[i] = 2 + Math.floor(Math.random()*3);
  avalancheCount = 0;
  cards.forEach(c => c.el.remove());
  cards.length = 0;
};
