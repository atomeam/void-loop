const canvas = document.getElementById('void');
const ctx = canvas.getContext('2d', { alpha: false });
const statusEl = document.getElementById('status');
let W, H, N = 420;
let boids = [];
let params = { align: 1.2, coh: 0.8, sep: 1.5, maxSpeed: 2.4, maxForce: 0.08 };
let reward = 0;
let morph = 0;
let audioCtx, oscs = [];

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

function rand(a, b) { return a + Math.random() * (b - a); }
function initBoids() {
  boids = [];
  for (let i = 0; i < N; i++) {
    boids.push({
      x: rand(0, W), y: rand(0, H),
      vx: rand(-1, 1), vy: rand(-1, 1),
      ax: 0, ay: 0
    });
  }
}
initBoids();

// Local RL / evolutionary mind in Worker
const workerCode = `
let pop = Array.from({length: 6}, () => ({
  p: { align: 0.5+Math.random()*2, coh: 0.4+Math.random()*1.5, sep: 0.6+Math.random()*2, maxSpeed: 1.5+Math.random()*2, maxForce: 0.04+Math.random()*0.1 },
  fit: 0
}));
let best = pop[0];
self.onmessage = (e) => {
  const { reward, stats } = e.data;
  // simple fitness: interaction reward + velocity entropy proxy
  const entropy = stats.vVar || 0.5;
  pop.forEach(g => {
    g.fit = reward * 2 + entropy * 0.3 + Math.random() * 0.1;
  });
  pop.sort((a,b) => b.fit - a.fit);
  best = pop[0];
  // mutate top half
  for (let i = 3; i < 6; i++) {
    const p = pop[Math.floor(Math.random()*3)].p;
    pop[i].p = {
      align: Math.max(0.2, p.align + (Math.random()-0.5)*0.4),
      coh: Math.max(0.2, p.coh + (Math.random()-0.5)*0.3),
      sep: Math.max(0.3, p.sep + (Math.random()-0.5)*0.5),
      maxSpeed: Math.max(1, p.maxSpeed + (Math.random()-0.5)*0.4),
      maxForce: Math.max(0.02, p.maxForce + (Math.random()-0.5)*0.02)
    };
    pop[i].fit = 0;
  }
  self.postMessage({ best: best.p, fit: best.fit });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  params = e.data.best;
  morph = Math.min(1, (e.data.fit || 0) / 8);
  document.documentElement.style.setProperty('--morph', morph);
  document.documentElement.style.setProperty('--hue', 180 + morph * 140);
  statusEl.textContent = `fit ${e.data.fit.toFixed(2)} | align ${params.align.toFixed(2)} | morph ${morph.toFixed(2)}`;
  updateAudio();
};

function stepBoids() {
  const { align, coh, sep, maxSpeed, maxForce } = params;
  let vxSum = 0, vySum = 0, vVar = 0;
  for (const b of boids) {
    let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0, sn = 0;
    for (const o of boids) {
      if (o === b) continue;
      const dx = o.x - b.x, dy = o.y - b.y;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d < 60) {
        ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; n++;
        if (d < 24) { sx -= dx / d; sy -= dy / d; sn++; }
      }
    }
    if (n) {
      ax = (ax / n - b.vx) * align;
      ay = (ay / n - b.vy) * align;
      cx = (cx / n - b.x) * coh;
      cy = (cy / n - b.y) * coh;
    }
    if (sn) { sx *= sep; sy *= sep; }
    b.ax = Math.max(-maxForce, Math.min(maxForce, ax + cx + sx));
    b.ay = Math.max(-maxForce, Math.min(maxForce, ay + cy + sy));
  }
  for (const b of boids) {
    b.vx = Math.max(-maxSpeed, Math.min(maxSpeed, b.vx + b.ax));
    b.vy = Math.max(-maxSpeed, Math.min(maxSpeed, b.vy + b.ay));
    b.x = (b.x + b.vx + W) % W;
    b.y = (b.y + b.vy + H) % H;
    vxSum += b.vx; vySum += b.vy;
  }
  const meanVx = vxSum / N, meanVy = vySum / N;
  for (const b of boids) vVar += (b.vx - meanVx) ** 2 + (b.vy - meanVy) ** 2;
  return { vVar: vVar / N / 4, density: N / (W * H) * 1e6 };
}

function draw() {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `hsl(${180 + morph * 140}, 70%, 60%)`;
  for (const b of boids) {
    ctx.fillRect(b.x, b.y, 2.2, 2.2);
  }
}

let lastMind = 0;
function loop(t) {
  const stats = stepBoids();
  draw();
  if (t - lastMind > 800) {
    worker.postMessage({ reward, stats });
    reward *= 0.85; // decay
    lastMind = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Interaction as reward
canvas.addEventListener('pointermove', (e) => {
  const mx = e.clientX, my = e.clientY;
  for (const b of boids) {
    const dx = mx - b.x, dy = my - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 80) {
      b.vx += (dx / d) * 0.4;
      b.vy += (dy / d) * 0.4;
      reward += 0.02;
    }
  }
});
document.getElementById('seed').onclick = () => {
  for (let i = 0; i < 40; i++) {
    boids[i].x = W/2 + rand(-40,40);
    boids[i].y = H/2 + rand(-40,40);
    boids[i].vx = rand(-2,2); boids[i].vy = rand(-2,2);
  }
  reward += 1.5;
};

// Web Audio morph
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = ['sine','triangle','sawtooth'][i];
    o.frequency.value = 80 + i * 40;
    g.gain.value = 0.04;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    oscs.push({ o, g });
  }
}
function updateAudio() {
  if (!audioCtx) return;
  const base = 90 + morph * 180;
  oscs.forEach((s, i) => {
    s.o.frequency.setTargetAtTime(base + i * 30 + params.align * 10, audioCtx.currentTime, 0.2);
    s.g.gain.setTargetAtTime(0.02 + morph * 0.06, audioCtx.currentTime, 0.3);
  });
}
document.body.addEventListener('pointerdown', initAudio, { once: true });

// Seal to IndexedDB
document.getElementById('seal').onclick = async () => {
  const idb = await new Promise((res, rej) => {
    const r = indexedDB.open('f025-genomes', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('g', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = idb.transaction('g', 'readwrite');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(params) + morph)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('').slice(0,16));
  tx.objectStore('g').put({ id: Date.now(), params, morph, hash, t: new Date().toISOString() });
  statusEl.textContent = `sealed ${hash}`;
};

// Optional orientation bias
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma != null) {
      const bias = e.gamma / 90;
      for (const b of boids) b.vx += bias * 0.01;
    }
  });
}
