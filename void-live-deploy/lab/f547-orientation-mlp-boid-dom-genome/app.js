const N = 10;
const cards = [];
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const cohEl = document.getElementById('coh');
const sepEl = document.getElementById('sep');
const aliEl = document.getElementById('ali');

// MLP: 12 inputs (orient hist 6 + pointer 4 + speed 2) → 8 → 4
const IN = 12, H = 8, OUT = 4;
let W1 = new Float32Array(IN * H);
let B1 = new Float32Array(H);
let W2 = new Float32Array(H * OUT);
let B2 = new Float32Array(OUT);

function randn() { return (Math.random() * 2 - 1) * 0.3; }
function initWeights() {
  for (let i = 0; i < W1.length; i++) W1[i] = randn();
  for (let i = 0; i < B1.length; i++) B1[i] = randn() * 0.1;
  for (let i = 0; i < W2.length; i++) W2[i] = randn();
  for (let i = 0; i < B2.length; i++) B2[i] = randn() * 0.1;
}
function relu(x) { return x > 0 ? x : 0; }
function forward(input) {
  const h = new Float32Array(H);
  for (let j = 0; j < H; j++) {
    let s = B1[j];
    for (let i = 0; i < IN; i++) s += input[i] * W1[i * H + j];
    h[j] = relu(s);
  }
  const o = new Float32Array(OUT);
  for (let k = 0; k < OUT; k++) {
    let s = B2[k];
    for (let j = 0; j < H; j++) s += h[j] * W2[j * OUT + k];
    o[k] = 0.1 + 1.9 / (1 + Math.exp(-s)); // sigmoid to [0.1,2]
  }
  return o;
}

// Sensors
let orient = { beta: 0, gamma: 0 };
let orientHist = new Float32Array(6);
let pointer = { x: 0, y: 0, vx: 0, vy: 0 };
let lastPx = 0, lastPy = 0;
let hasOrient = false;

function onOrient(e) {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
  hasOrient = true;
  orientHist.copyWithin(0, 2);
  orientHist[4] = orient.beta / 90;
  orientHist[5] = orient.gamma / 90;
}
if (window.DeviceOrientationEvent) {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission().then(p => {
        if (p === 'granted') window.addEventListener('deviceorientation', onOrient);
      }).catch(() => {});
    }, { once: true });
    statusEl.textContent = 'Tap to enable orientation';
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
}

stage.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.vx = e.clientX - lastPx;
  pointer.vy = e.clientY - lastPy;
  lastPx = e.clientX;
  lastPy = e.clientY;
  if (!hasOrient) {
    orientHist.copyWithin(0, 2);
    orientHist[4] = pointer.vx * 0.02;
    orientHist[5] = pointer.vy * 0.02;
  }
});

// Boids
function spawn() {
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'verse-card';
    el.innerHTML = `<div class="id">C${i}</div><div class="fit">0.00</div>`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
    stage.appendChild(el);
    cards.push({
      el, x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      fitness: 0, id: i
    });
  }
}

function updateBoids(weights) {
  const [cohW, sepW, aliW, attrW] = weights;
  cohEl.textContent = cohW.toFixed(2);
  sepEl.textContent = sepW.toFixed(2);
  aliEl.textContent = aliW.toFixed(2);

  const attractor = { x: pointer.x, y: pointer.y };

  for (let i = 0; i < cards.length; i++) {
    const a = cards[i];
    let cx = 0, cy = 0, sx = 0, sy = 0, ax = 0, ay = 0, n = 0;
    for (let j = 0; j < cards.length; j++) {
      if (i === j) continue;
      const b = cards[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 140) {
        // cohesion
        cx += b.x; cy += b.y; n++;
        // alignment
        ax += b.vx; ay += b.vy;
        // separation
        if (d < 60) {
          sx -= dx / d; sy -= dy / d;
        }
      }
    }
    let fx = 0, fy = 0;
    if (n > 0) {
      cx /= n; cy /= n;
      fx += (cx - a.x) * cohW * 0.008;
      fy += (cy - a.y) * cohW * 0.008;
      ax /= n; ay /= n;
      fx += ax * aliW * 0.04;
      fy += ay * aliW * 0.04;
    }
    fx += sx * sepW * 0.15;
    fy += sy * sepW * 0.15;
    // attractor
    const adx = attractor.x - a.x, ady = attractor.y - a.y;
    const ad = Math.hypot(adx, ady) || 1;
    if (ad < 400) {
      fx += (adx / ad) * attrW * 0.12;
      fy += (ady / ad) * attrW * 0.12;
    }
    // mild center pull
    fx += (innerWidth / 2 - a.x) * 0.0008;
    fy += (innerHeight / 2 - a.y) * 0.0008;

    a.vx = (a.vx + fx) * 0.96;
    a.vy = (a.vy + fy) * 0.96;
    const sp = Math.hypot(a.vx, a.vy);
    if (sp > 4) { a.vx = a.vx / sp * 4; a.vy = a.vy / sp * 4; }
    a.x += a.vx;
    a.y += a.vy;
    // wrap
    if (a.x < -50) a.x = innerWidth + 50;
    if (a.x > innerWidth + 50) a.x = -50;
    if (a.y < -50) a.y = innerHeight + 50;
    if (a.y > innerHeight + 50) a.y = -50;

    a.el.style.transform = `translate(${a.x - 46}px, ${a.y - 34}px)`;
    a.fitness = Math.min(1, sp / 3 + n * 0.05);
    a.el.querySelector('.fit').textContent = a.fitness.toFixed(2);
  }

  // proximity transfer
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i], b = cards[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 70 && Math.abs(a.fitness - b.fitness) > 0.05) {
        const winner = a.fitness > b.fitness ? a : b;
        const loser = winner === a ? b : a;
        // sealed transfer: blend a small slice of weights toward winner (simulates genome share)
        const blend = 0.08;
        for (let k = 0; k < W1.length; k++) W1[k] = W1[k] * (1 - blend) + (Math.random() * 0.01 - 0.005);
        // visual
        winner.el.classList.add('pulse');
        setTimeout(() => winner.el.classList.remove('pulse'), 300);
        statusEl.textContent = `Genome transfer C${winner.id} → C${loser.id}`;
      }
    }
  }
}

function buildInput() {
  const inp = new Float32Array(IN);
  for (let i = 0; i < 6; i++) inp[i] = orientHist[i] || 0;
  inp[6] = pointer.vx * 0.05;
  inp[7] = pointer.vy * 0.05;
  inp[8] = (pointer.x / innerWidth - 0.5) * 2;
  inp[9] = (pointer.y / innerHeight - 0.5) * 2;
  let avgSp = 0;
  for (const c of cards) avgSp += Math.hypot(c.vx, c.vy);
  inp[10] = avgSp / (cards.length || 1) / 3;
  inp[11] = hasOrient ? 1 : 0;
  return inp;
}

// IndexedDB
const DB = 'f547-boid-mlp';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('weights');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveWeights() {
  try {
    const db = await openDB();
    const tx = db.transaction('weights', 'readwrite');
    tx.objectStore('weights').put({ W1: Array.from(W1), B1: Array.from(B1), W2: Array.from(W2), B2: Array.from(B2) }, 'mlp');
    statusEl.textContent = 'Genome sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (session only)'; }
}
async function loadWeights() {
  try {
    const db = await openDB();
    const tx = db.transaction('weights', 'readonly');
    const req = tx.objectStore('weights').get('mlp');
    return new Promise(res => {
      req.onsuccess = () => {
        if (req.result) {
          W1 = new Float32Array(req.result.W1);
          B1 = new Float32Array(req.result.B1);
          W2 = new Float32Array(req.result.W2);
          B2 = new Float32Array(req.result.B2);
          statusEl.textContent = 'Loaded sealed genome';
          res(true);
        } else res(false);
      };
      req.onerror = () => res(false);
    });
  } catch { return false; }
}

document.getElementById('seal').onclick = saveWeights;
document.getElementById('reset').onclick = () => { initWeights(); statusEl.textContent = 'Weights reset'; };

async function loop() {
  const inp = buildInput();
  const w = forward(inp);
  updateBoids(w);
  requestAnimationFrame(loop);
}

(async () => {
  initWeights();
  await loadWeights();
  spawn();
  statusEl.textContent = hasOrient ? 'Orientation active' : 'Pointer proxy active — move mouse';
  loop();
})();
