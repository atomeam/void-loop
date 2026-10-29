const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const genEl = document.getElementById('gen');
const fitEl = document.getElementById('fit');
const varEl = document.getElementById('var');
const crossEl = document.getElementById('cross');
const sealsEl = document.getElementById('seals');

let W = 64, H = 40, C = 3; // channels
let grid = new Float32Array(W * H * C);
let next = new Float32Array(W * H * C);
let useWebGPU = false;
let device, pipeline, buffers;
let worker;
let bestGenome = { da: 0.2, db: 0.1, dc: 0.15, ra: 0.04, rb: 0.02, rc: 0.03, fa: 0.5, fb: 0.3 };
let gen = 0, fit = 0;
let pointer = { x: 0.5, y: 0.5, down: false };
let cards = [];
let audioCtx, oscs = [];

function idx(x, y, c) { return (y * W + x) * C + c; }

function initGrid() {
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random() * 0.2;
  // seed center
  const cx = W/2|0, cy = H/2|0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (cx+dx>=0 && cx+dx<W && cy+dy>=0 && cy+dy<H) {
      grid[idx(cx+dx, cy+dy, 0)] = 0.8;
      grid[idx(cx+dx, cy+dy, 1)] = 0.4;
    }
  }
}

function stepField(genome) {
  const { da, db, dc, ra, rb, rc } = genome;
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      for (let c = 0; c < C; c++) {
        const i = idx(x, y, c);
        const d = c===0 ? da : c===1 ? db : dc;
        const r = c===0 ? ra : c===1 ? rb : rc;
        let lap = -grid[i];
        lap += grid[idx(x+1,y,c)] + grid[idx(x-1,y,c)] + grid[idx(x,y+1,c)] + grid[idx(x,y-1,c)];
        lap *= 0.25;
        const a = grid[idx(x,y,0)], b = grid[idx(x,y,1)], cat = grid[idx(x,y,2)];
        let react = 0;
        if (c === 0) react = r * a * (1 - a) * (1 - b) + 0.01 * cat;
        else if (c === 1) react = r * b * (1 - b) * a - 0.005 * cat;
        else react = r * cat * (a + b) * 0.5 - 0.01 * cat;
        next[i] = Math.max(0, Math.min(1, grid[i] + d * lap + react));
      }
    }
  }
  [grid, next] = [next, grid];
}

function sampleMetrics() {
  let means = [0,0,0], vars = [0,0,0];
  const n = W * H;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < C; c++) means[c] += grid[i*C + c];
  }
  means = means.map(m => m / n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < C; c++) {
      const d = grid[i*C + c] - means[c];
      vars[c] += d*d;
    }
  }
  vars = vars.map(v => v / n);
  // simple cross proxy
  let cross = 0;
  for (let i = 0; i < n; i++) {
    cross += grid[i*C] * grid[i*C+1];
  }
  cross = cross / n - means[0]*means[1];
  return { means, vars, cross: Math.abs(cross), varSum: vars.reduce((a,b)=>a+b,0) };
}

function render() {
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W*H; i++) {
    const a = grid[i*C], b = grid[i*C+1], c = grid[i*C+2];
    img.data[i*4] = Math.min(255, a*255);
    img.data[i*4+1] = Math.min(255, b*255);
    img.data[i*4+2] = Math.min(255, c*255);
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // scale to fill
  ctx.drawImage(canvas, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
}

function createCards() {
  const container = document.getElementById('cards');
  const labels = ['Activator', 'Inhibitor', 'Catalyst', 'Balance', 'Echo'];
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = labels[i];
    el.style.left = (20 + i*15) + '%';
    el.style.top = (30 + (i%3)*15) + '%';
    container.appendChild(el);
    cards.push({ el, x: 0.2 + i*0.15, y: 0.3 + (i%3)*0.15, dragging: false });
    el.addEventListener('pointerdown', e => { cards[i].dragging = true; e.target.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => cards[i].dragging = false);
    el.addEventListener('pointermove', e => {
      if (!cards[i].dragging) return;
      const rect = canvas.getBoundingClientRect();
      cards[i].x = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      cards[i].y = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
      // inject
      const gx = (cards[i].x * W) | 0, gy = (cards[i].y * H) | 0;
      if (gx>1 && gx<W-1 && gy>1 && gy<H-1) {
        grid[idx(gx, gy, i%3)] = Math.min(1, grid[idx(gx, gy, i%3)] + 0.4);
      }
    });
  }
}

function updateCards(metrics) {
  cards.forEach((card, i) => {
    const rx = (card.x * (W-2) + 1) | 0;
    const ry = (card.y * (H-2) + 1) | 0;
    const a = grid[idx(rx, ry, 0)], b = grid[idx(rx, ry, 1)], c = grid[idx(rx, ry, 2)];
    const energy = (a + b + c) / 3;
    const tx = (card.x * 100) + (a - 0.5) * 4;
    const ty = (card.y * 100) + (b - 0.5) * 4;
    const scale = 0.85 + energy * 0.4;
    const hue = (c * 120 + i * 40) % 360;
    card.el.style.left = tx + '%';
    card.el.style.top = ty + '%';
    card.el.style.transform = `scale(${scale}) rotateY(${(a-b)*20}deg)`;
    card.el.style.filter = `hue-rotate(${hue}deg) brightness(${0.8 + energy})`;
    card.el.style.opacity = 0.6 + energy * 0.4;
  });
}

function morph(metrics) {
  const intensity = Math.min(1, metrics.varSum * 4 + Math.abs(metrics.cross) * 8);
  document.body.style.filter = `hue-rotate(${intensity*40}deg) contrast(${1 + intensity*0.3}) blur(${intensity*1.5}px)`;
  document.body.style.transform = `scale(${1 + intensity*0.02})`;
}

function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 80 + i*40;
    gain.gain.value = 0.02;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    oscs.push({ osc, gain });
  }
}

function updateAudio(metrics) {
  if (!audioCtx) return;
  oscs.forEach((o, i) => {
    o.osc.frequency.value = 60 + metrics.means[i] * 200;
    o.gain.gain.value = 0.01 + metrics.vars[i] * 0.08;
  });
}

function setupWorker() {
  const code = `
    let pop = Array.from({length: 6}, () => ({
      da: 0.15 + Math.random()*0.2, db: 0.08 + Math.random()*0.15, dc: 0.1 + Math.random()*0.2,
      ra: 0.02 + Math.random()*0.04, rb: 0.01 + Math.random()*0.03, rc: 0.015 + Math.random()*0.03,
      fit: 0
    }));
    function mutate(g) {
      const n = {...g};
      for (const k of Object.keys(n)) if (k !== 'fit') n[k] *= 0.9 + Math.random()*0.2;
      return n;
    }
    self.onmessage = e => {
      const { metrics, interact } = e.data;
      const base = metrics.varSum * 2 + Math.abs(metrics.cross) * 5 + interact * 0.3;
      pop.forEach(g => g.fit = base * (0.8 + Math.random()*0.4));
      pop.sort((a,b) => b.fit - a.fit);
      const best = pop[0];
      for (let i = 2; i < pop.length; i++) pop[i] = mutate(best);
      self.postMessage({ genome: best, gen: (e.data.gen||0)+1, fit: best.fit });
    };
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    bestGenome = e.data.genome;
    gen = e.data.gen;
    fit = e.data.fit;
    genEl.textContent = gen;
    fitEl.textContent = fit.toFixed(2);
  };
}

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    statusEl.textContent = 'WebGPU available (compute path sketched; using Canvas2D for reliability)';
    return false; // for this prototype keep Canvas2D reliable; full compute in future
  } catch (e) { return false; }
}

function seal() {
  const data = JSON.stringify({ genome: bestGenome, fit, gen, ts: Date.now() });
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then(buf => {
    const hash = Array.from(new Uint8Array(buf)).slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
    const req = indexedDB.open('void-seals', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals', { keyPath: 'hash' });
    req.onsuccess = () => {
      const tx = req.result.transaction('seals', 'readwrite');
      tx.objectStore('seals').put({ hash, data, ts: Date.now() });
      sealsEl.textContent = 'Sealed: ' + hash;
    };
  });
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initGrid(); gen = 0; };
canvas.addEventListener('pointerdown', e => { pointer.down = true; startAudio(); });
canvas.addEventListener('pointerup', () => pointer.down = false);
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  pointer.x = (e.clientX - r.left) / r.width;
  pointer.y = (e.clientY - r.top) / r.height;
  if (pointer.down) {
    const gx = (pointer.x * W)|0, gy = (pointer.y * H)|0;
    if (gx>1 && gx<W-1 && gy>1 && gy<H-1) grid[idx(gx,gy,0)] = Math.min(1, grid[idx(gx,gy,0)] + 0.3);
  }
});

async function main() {
  resize();
  initGrid();
  createCards();
  await tryWebGPU();
  if (!useWebGPU) statusEl.textContent = 'Canvas2D multi-channel lattice + evolutionary Worker mind';
  setupWorker();
  let lastMind = 0;
  function loop(t) {
    stepField(bestGenome);
    const metrics = sampleMetrics();
    varEl.textContent = metrics.varSum.toFixed(3);
    crossEl.textContent = metrics.cross.toFixed(3);
    updateCards(metrics);
    morph(metrics);
    updateAudio(metrics);
    render();
    if (t - lastMind > 800) {
      lastMind = t;
      const interact = cards.some(c => c.dragging) ? 1 : (pointer.down ? 0.5 : 0);
      if (worker) worker.postMessage({ metrics, interact, gen });
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
main();
