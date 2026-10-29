const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.width = window.innerWidth * dpr;
  H = canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize); resize();

const N = 320;
const GRID = { cols: 8, rows: 6 };
const particles = [];
for (let i = 0; i < N; i++) particles.push({ x: Math.random()*W, y: Math.random()*H, vx: 0, vy: 0, hue: Math.random()*60+180 });

let field = []; // flat: for each cell: angle, mag
function randomField() {
  field = [];
  for (let i = 0; i < GRID.cols * GRID.rows; i++) {
    field.push(Math.random()*Math.PI*2, 0.6 + Math.random()*1.4);
  }
  return field.slice();
}
randomField();

let pointer = { x: W/2, y: H/2, down: false, attract: 0 };
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX * dpr; pointer.y = e.clientY * dpr; });
canvas.addEventListener('pointerdown', () => pointer.down = true);
canvas.addEventListener('pointerup', () => pointer.down = false);

let orientation = { alpha: 0, beta: 0 };
window.addEventListener('deviceorientation', e => {
  if (e.alpha != null) orientation.alpha = e.alpha;
  if (e.beta != null) orientation.beta = e.beta;
});

// Audio
let audioCtx, oscs = [];
function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 4; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0.04;
    o.type = i % 2 ? 'sine' : 'triangle';
    o.frequency.value = 110 + i * 55;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    oscs.push({ o, g });
  }
}
document.body.addEventListener('pointerdown', startAudio, { once: true });

// Worker mind
let worker, bestGenome = null, fitness = 0, metrics = { div: 0, curl: 0, disp: 0 };
const workerCode = `
let pop = [];
function randGenome() {
  const g = [];
  for (let i = 0; i < 48; i++) g.push(Math.random()*Math.PI*2, 0.5+Math.random()*1.5);
  return g;
}
for (let i = 0; i < 6; i++) pop.push({ g: randGenome(), f: 0 });
function mutate(g) {
  const n = g.slice();
  for (let k = 0; k < 4; k++) {
    const i = Math.floor(Math.random()*n.length);
    n[i] += (Math.random()-0.5)*0.4;
    if (i%2===0) n[i] = ((n[i] % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    else n[i] = Math.max(0.2, Math.min(2.5, n[i]));
  }
  return n;
}
self.onmessage = e => {
  const m = e.data;
  // simple fitness proxy from main
  const score = (m.disp||0)*0.6 + Math.min(1, (m.interact||0))*0.4 - Math.abs((m.energy||1)-1)*0.2;
  // update best of pop (simplified: replace worst)
  let worst = 0;
  for (let i = 1; i < pop.length; i++) if (pop[i].f < pop[worst].f) worst = i;
  if (score > pop[worst].f) { pop[worst] = { g: m.genome || pop[0].g, f: score }; }
  // evolve
  pop.sort((a,b) => b.f - a.f);
  for (let i = 2; i < pop.length; i++) pop[i] = { g: mutate(pop[i%2].g), f: 0 };
  const best = pop[0];
  self.postMessage({ genome: best.g, fitness: best.f });
};
`;
try {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    bestGenome = e.data.genome;
    fitness = e.data.fitness;
    if (bestGenome) field = bestGenome.slice();
    document.getElementById('fit').textContent = fitness.toFixed(2);
  };
} catch (err) { console.warn('Worker blocked', err); }

function sampleField(x, y) {
  const gx = (x / W) * (GRID.cols - 1);
  const gy = (y / H) * (GRID.rows - 1);
  const i = Math.floor(gx), j = Math.floor(gy);
  const fx = gx - i, fy = gy - j;
  const idx = (jj, ii) => {
    const c = Math.max(0, Math.min(GRID.cols-1, ii));
    const r = Math.max(0, Math.min(GRID.rows-1, jj));
    return (r * GRID.cols + c) * 2;
  };
  // bilinear of angle/mag (approx)
  const a00 = field[idx(j,i)] || 0, m00 = field[idx(j,i)+1] || 1;
  const a10 = field[idx(j,i+1)] || 0, m10 = field[idx(j,i+1)+1] || 1;
  const a01 = field[idx(j+1,i)] || 0, m01 = field[idx(j+1,i)+1] || 1;
  const a11 = field[idx(j+1,i+1)] || 0, m11 = field[idx(j+1,i+1)+1] || 1;
  const ang = a00*(1-fx)*(1-fy) + a10*fx*(1-fy) + a01*(1-fx)*fy + a11*fx*fy;
  const mag = m00*(1-fx)*(1-fy) + m10*fx*(1-fy) + m01*(1-fx)*fy + m11*fx*fy;
  // orientation bias
  const bias = (orientation.alpha || 0) * 0.002;
  return { vx: Math.cos(ang + bias) * mag * 2.2, vy: Math.sin(ang + bias) * mag * 2.2 };
}

let lastT = 0, frame = 0, interactCount = 0;
function step(t) {
  requestAnimationFrame(step);
  const dt = Math.min(32, t - lastT) / 16;
  lastT = t;
  frame++;

  // clear with trail
  ctx.fillStyle = 'rgba(10,10,18,0.18)';
  ctx.fillRect(0, 0, W, H);

  let sumDiv = 0, sumCurl = 0, sumDisp = 0, energy = 0;
  const cx = W/2, cy = H/2;

  for (const p of particles) {
    const f = sampleField(p.x, p.y);
    // pointer attractor when down
    if (pointer.down) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      f.vx += dx / d2 * 800;
      f.vy += dy / d2 * 800;
      if (d2 < 40000) interactCount++;
    }
    p.vx = p.vx * 0.92 + f.vx * 0.08;
    p.vy = p.vy * 0.92 + f.vy * 0.08;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // wrap
    if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;

    energy += p.vx*p.vx + p.vy*p.vy;
    sumDisp += Math.hypot(p.x - cx, p.y - cy);
    // simple local div/curl proxy
    sumDiv += f.vx + f.vy;
    sumCurl += f.vx - f.vy;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${p.hue + (fitness||0)*30}, 70%, 65%, 0.85)`;
    ctx.fill();
  }

  metrics.div = sumDiv / N;
  metrics.curl = sumCurl / N;
  metrics.disp = sumDisp / N / Math.hypot(W,H);
  energy /= N;

  // morph
  const morph = Math.min(1, Math.max(0, (Math.abs(metrics.div)*0.3 + Math.abs(metrics.curl)*0.3 + metrics.disp*0.4)));
  document.documentElement.style.setProperty('--morph', morph);
  document.documentElement.style.setProperty('--hue', 160 + morph * 120);
  document.documentElement.style.setProperty('--scale', 1 + morph * 0.04);
  document.documentElement.style.setProperty('--blur', morph * 1.5);
  document.getElementById('div').textContent = metrics.div.toFixed(2);
  document.getElementById('curl').textContent = metrics.curl.toFixed(2);
  document.getElementById('n').textContent = N;

  // audio
  if (oscs.length) {
    const base = 80 + Math.abs(metrics.curl)*40;
    oscs.forEach((s, i) => {
      s.o.frequency.setTargetAtTime(base * (1 + i*0.3) + (fitness||0)*20, audioCtx.currentTime, 0.1);
      s.g.gain.setTargetAtTime(0.03 + morph*0.04, audioCtx.currentTime, 0.1);
    });
  }

  // send to mind ~1Hz
  if (worker && frame % 60 === 0) {
    worker.postMessage({
      genome: field.slice(),
      disp: metrics.disp,
      interact: interactCount / 60,
      energy: energy / 4,
      div: metrics.div,
      curl: metrics.curl
    });
    interactCount = 0;
  }
}
requestAnimationFrame(step);

// Seal
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 16);
}
document.getElementById('seal').onclick = async () => {
  const id = await sha256(JSON.stringify({ field: field.slice(0,16), metrics, t: Date.now() }));
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f033', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({ id, field: field.slice(), metrics, at: new Date().toISOString() }, id);
    alert('Sealed: ' + id);
  } catch (e) { alert('Seal stored locally (IDB failed): ' + id); }
};
document.getElementById('reset').onclick = () => { randomField(); if (worker) worker.postMessage({ genome: field.slice(), disp:0.5, interact:0, energy:1 }); };
