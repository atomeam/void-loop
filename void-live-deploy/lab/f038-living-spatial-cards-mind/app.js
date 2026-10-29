const W = 80, H = 50;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
let field = new Float32Array(W * H);
let next = new Float32Array(W * H);
let params = [0.18, 0.35, 0.04, 0.6]; // diffusion, reaction, decay, attractor
let cards = [];
let variance = 0;
let activity = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Init field with noise
for (let i = 0; i < field.length; i++) field[i] = Math.random() * 0.3;

// Living cards
const cardData = [
  { title: 'Seed', text: 'Drag to inject energy' },
  { title: 'Evolve', text: 'Fitness rewards co-location' },
  { title: 'Morph', text: 'Field variance warps chrome' },
  { title: 'Memory', text: 'Seal best genome' },
  { title: 'Verse', text: 'Spatial mind inhabits document' }
];
const cardsEl = document.getElementById('cards');
cardData.forEach((d, i) => {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<h3>${d.title}</h3><p>${d.text}</p>`;
  el.style.left = (15 + i * 18) + '%';
  el.style.top = (20 + (i % 3) * 18) + '%';
  cardsEl.appendChild(el);
  cards.push({ el, x: 0.2 + i * 0.15, y: 0.3 + (i % 3) * 0.15, vx: 0, vy: 0, dragging: false });
  makeDraggable(el, cards[cards.length - 1]);
});

function makeDraggable(el, card) {
  let ox = 0, oy = 0;
  el.addEventListener('pointerdown', e => {
    card.dragging = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!card.dragging) return;
    const nx = e.clientX - ox;
    const ny = e.clientY - oy;
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
    card.x = Math.max(0, Math.min(1, nx / window.innerWidth));
    card.y = Math.max(0, Math.min(1, ny / window.innerHeight));
    // Seed on drag
    seed(card.x, card.y, 0.8);
  });
  el.addEventListener('pointerup', () => { card.dragging = false; });
}

function seed(nx, ny, amt) {
  const cx = Math.floor(nx * W);
  const cy = Math.floor(ny * H);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = (cx + dx + W) % W;
      const y = (cy + dy + H) % H;
      const i = y * W + x;
      field[i] = Math.min(1, field[i] + amt * (1 - Math.hypot(dx, dy) / 3));
    }
  }
}

// Canvas click/touch seed
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  seed((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 0.6);
});

function step() {
  const [diff, reac, decay, attr] = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let s = field[i];
      // Laplacian (4-neigh)
      const n = field[((y-1+H)%H)*W + x];
      const sN = field[((y+1)%H)*W + x];
      const e = field[y*W + (x+1)%W];
      const w = field[y*W + (x-1+W)%W];
      const lap = n + sN + e + w - 4 * s;
      let ds = diff * lap + reac * s * (1 - s) - decay * s;
      // Attractor from cards
      for (const c of cards) {
        const dx = (x / W) - c.x;
        const dy = (y / H) - c.y;
        const dist = Math.hypot(dx, dy) + 0.02;
        ds += attr * Math.exp(-dist * 8) * 0.15;
      }
      next[i] = Math.max(0, Math.min(1, s + ds * 0.8));
    }
  }
  [field, next] = [next, field];

  // Metrics
  let sum = 0, sum2 = 0;
  for (let i = 0; i < field.length; i++) { sum += field[i]; sum2 += field[i]*field[i]; }
  const mean = sum / field.length;
  variance = sum2 / field.length - mean * mean;
  activity = mean;

  // Drive cards from regional samples
  cards.forEach(c => {
    const rx = Math.floor(c.x * W);
    const ry = Math.floor(c.y * H);
    let local = 0, cnt = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = (rx + dx + W) % W;
        const y = (ry + dy + H) % H;
        local += field[y * W + x];
        cnt++;
      }
    }
    local /= cnt;
    const sc = 0.85 + local * 0.4;
    const hue = local * 80;
    const op = 0.6 + local * 0.4;
    c.el.style.transform = `scale(${sc})`;
    c.el.style.filter = `hue-rotate(${hue}deg)`;
    c.el.style.opacity = op;
  });

  // Global morph
  document.documentElement.style.setProperty('--morph-hue', (variance * 400).toFixed(0));
  document.documentElement.style.setProperty('--morph-blur', (variance * 4).toFixed(2) + 'px');
  document.documentElement.style.setProperty('--morph-scale', (1 + variance * 0.05).toFixed(3));
  document.documentElement.style.setProperty('--morph-contrast', (1 + variance * 0.8).toFixed(2));
  document.getElementById('metrics').textContent = `var: ${variance.toFixed(3)} act: ${activity.toFixed(2)}`;
}

function render() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const sx = canvas.width / W;
  const sy = canvas.height / H;
  for (let y = 0; y < canvas.height; y++) {
    const gy = Math.min(H - 1, Math.floor(y / sy));
    for (let x = 0; x < canvas.width; x++) {
      const gx = Math.min(W - 1, Math.floor(x / sx));
      const v = field[gy * W + gx];
      const i = (y * canvas.width + x) * 4;
      const h = (v * 220 + 180) % 360;
      // simple HSL to RGB approx
      const c = v * 0.6;
      data[i] = Math.min(255, 40 + c * 180);
      data[i+1] = Math.min(255, 20 + c * 120);
      data[i+2] = Math.min(255, 60 + c * 200);
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Worker for evolution
let worker;
try {
  const code = `
    let pop = Array.from({length: 6}, () => [0.1+Math.random()*0.2, 0.2+Math.random()*0.3, 0.01+Math.random()*0.06, 0.3+Math.random()*0.5]);
    let best = pop[0].slice();
    function fit(p, metrics) {
      // Prefer higher variance + moderate activity + card responsiveness proxy
      return metrics.variance * 2 + metrics.activity * 0.5 - Math.abs(metrics.activity - 0.4);
    }
    self.onmessage = e => {
      const m = e.data;
      let scores = pop.map(p => fit(p, m));
      let bi = scores.indexOf(Math.max(...scores));
      best = pop[bi].slice();
      // Mutate
      for (let i = 0; i < pop.length; i++) {
        if (i === bi) continue;
        pop[i] = best.map((g, j) => Math.max(0.01, Math.min(0.8, g + (Math.random()-0.5)*0.08)));
      }
      self.postMessage({ best, fitness: scores[bi] });
    };
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => { params = e.data.best; };
} catch (err) {
  document.getElementById('status').textContent += ' · worker blocked';
}

let tick = 0;
function loop() {
  step();
  render();
  if (worker && tick % 30 === 0) {
    worker.postMessage({ variance, activity, cards: cards.length });
  }
  tick++;
  requestAnimationFrame(loop);
}
loop();

// Seal
async function seal() {
  const payload = JSON.stringify({ params, variance, activity, ts: Date.now() });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 12);
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f038-seals', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals', { keyPath: 'hash' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ hash, payload, date: new Date().toISOString() });
    document.getElementById('status').textContent = 'Sealed ' + hash;
  } catch (e) {
    document.getElementById('status').textContent = 'Seal local only ' + hash;
  }
}
document.getElementById('seal').onclick = seal;
