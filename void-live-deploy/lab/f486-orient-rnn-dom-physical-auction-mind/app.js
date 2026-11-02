const N = 6;
const H = 4;
const IN = 5;
const agents = [];
let orient = {x: 0, y: 0};
let attractor = null;
let running = true;
const arena = document.getElementById('arena');
const statusEl = document.getElementById('status');
const attractorEl = document.getElementById('attractor');

function randn() { return (Math.random() * 2 - 1) * 0.3; }
function makeWeights() {
  return {
    Wxh: Float32Array.from({length: H * IN}, randn),
    Whh: Float32Array.from({length: H * H}, randn),
    Why: Float32Array.from({length: 2 * H}, randn),
    bh: Float32Array.from({length: H}, () => 0),
    by: Float32Array.from({length: 2}, () => 0)
  };
}
function cloneWeights(w) {
  return { Wxh: w.Wxh.slice(), Whh: w.Whh.slice(), Why: w.Why.slice(), bh: w.bh.slice(), by: w.by.slice() };
}
function mutate(w, rate = 0.08) {
  const keys = ['Wxh','Whh','Why','bh','by'];
  keys.forEach(k => {
    for (let i = 0; i < w[k].length; i++) if (Math.random() < rate) w[k][i] += randn() * 0.4;
  });
  return w;
}
async function hashWeights(w) {
  const buf = new Float32Array([...w.Wxh, ...w.Whh, ...w.Why, ...w.bh, ...w.by]);
  const hash = await crypto.subtle.digest('SHA-256', buf.buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 12);
}

function rnnForward(agent, x) {
  const {Wxh, Whh, bh, Why, by} = agent.w;
  const h = agent.h;
  const newH = new Float32Array(H);
  for (let i = 0; i < H; i++) {
    let s = bh[i];
    for (let j = 0; j < IN; j++) s += Wxh[i * IN + j] * x[j];
    for (let j = 0; j < H; j++) s += Whh[i * H + j] * h[j];
    newH[i] = Math.tanh(s);
  }
  agent.h = newH;
  const out = new Float32Array(2);
  for (let i = 0; i < 2; i++) {
    let s = by[i];
    for (let j = 0; j < H; j++) s += Why[i * H + j] * newH[j];
    out[i] = Math.tanh(s) * 0.8;
  }
  return out;
}

function spawnAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = String(i);
  arena.appendChild(el);
  const agent = {
    el, i,
    x: 80 + Math.random() * (innerWidth - 160),
    y: 80 + Math.random() * (innerHeight - 160),
    vx: 0, vy: 0,
    h: Float32Array.from({length: H}, () => 0),
    w: makeWeights(),
    fitness: 0.5,
    hue: (i * 60) % 360
  };
  agents.push(agent);
  return agent;
}
for (let i = 0; i < N; i++) spawnAgent(i);

function updateStatus(msg) { statusEl.textContent = msg; }

document.getElementById('orientBtn').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') window.addEventListener('deviceorientation', onOrient);
    }).catch(() => {});
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
  updateStatus('Orientation requested');
};
function onOrient(e) {
  orient.x = (e.gamma || 0) / 45;
  orient.y = (e.beta || 0) / 45;
  orient.x = Math.max(-1, Math.min(1, orient.x));
  orient.y = Math.max(-1, Math.min(1, orient.y));
}

arena.onclick = (ev) => {
  const rect = arena.getBoundingClientRect();
  attractor = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  attractorEl.style.left = attractor.x + 'px';
  attractorEl.style.top = attractor.y + 'px';
  attractorEl.style.opacity = '1';
};

document.addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});
document.getElementById('sealBtn').onclick = seal;
document.getElementById('restoreBtn').onclick = restore;
document.getElementById('resetBtn').onclick = () => { agents.forEach(a => { a.w = makeWeights(); a.h.fill(0); a.fitness = 0.5; }); updateStatus('Reset genomes'); };

const DB_NAME = 'f486-rnn-auction';
async function seal() {
  try {
    const db = await idbOpen();
    const tx = db.transaction('state', 'readwrite');
    const data = agents.map(a => ({
      x: a.x, y: a.y, vx: a.vx, vy: a.vy,
      h: Array.from(a.h), fitness: a.fitness,
      w: { Wxh: Array.from(a.w.Wxh), Whh: Array.from(a.w.Whh), Why: Array.from(a.w.Why), bh: Array.from(a.w.bh), by: Array.from(a.w.by) }
    }));
    tx.objectStore('state').put({ id: 1, data, t: Date.now() });
    await tx.complete;
    updateStatus('Sealed to IndexedDB');
  } catch (err) { updateStatus('Seal failed: ' + err.message); }
}
async function restore() {
  try {
    const db = await idbOpen();
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get(1);
    const res = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = reject; });
    if (!res || !res.data) { updateStatus('Nothing sealed'); return; }
    res.data.forEach((d, i) => {
      if (!agents[i]) return;
      const a = agents[i];
      a.x = d.x; a.y = d.y; a.vx = d.vx; a.vy = d.vy;
      a.h.set(d.h); a.fitness = d.fitness;
      a.w.Wxh.set(d.w.Wxh); a.w.Whh.set(d.w.Whh); a.w.Why.set(d.w.Why); a.w.bh.set(d.w.bh); a.w.by.set(d.w.by);
    });
    updateStatus('Restored from IndexedDB');
  } catch (err) { updateStatus('Restore failed'); }
}
function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = reject;
  });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(32, now - last) / 16;
  last = now;
  const w = innerWidth, h = innerHeight;
  agents.forEach(a => {
    const ax = attractor ? (attractor.x - a.x) / w : 0;
    const ay = attractor ? (attractor.y - a.y) / h : 0;
    const hn = Math.hypot(...a.h);
    const x = [orient.x, orient.y, ax, ay, hn];
    const force = rnnForward(a, x);
    a.vx += force[0] * 0.4 + orient.x * 0.25;
    a.vy += force[1] * 0.4 + orient.y * 0.25;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx * dt * 4;
    a.y += a.vy * dt * 4;
    if (a.x < 30) { a.x = 30; a.vx *= -0.5; }
    if (a.x > w - 30) { a.x = w - 30; a.vx *= -0.5; }
    if (a.y < 30) { a.y = 30; a.vy *= -0.5; }
    if (a.y > h - 30) { a.y = h - 30; a.vy *= -0.5; }
    const ke = a.vx * a.vx + a.vy * a.vy;
    const center = 1 - Math.hypot(a.x - w/2, a.y - h/2) / Math.hypot(w, h);
    a.fitness = a.fitness * 0.98 + (1 - Math.min(1, ke * 2) + center * 0.3) * 0.02;
    const scale = 0.8 + Math.min(1.4, hn * 0.5);
    const rot = Math.atan2(a.vy, a.vx) * 20;
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    a.el.style.setProperty('--hue', a.hue + hn * 40);
    a.el.style.setProperty('--scale', scale);
    a.el.style.setProperty('--rot', rot + 'deg');
    a.el.style.setProperty('--glow', 6 + hn * 12);
  });
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const a = agents[i], b = agents[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 52 && d > 0) {
        const overlap = 52 - d;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * overlap * 0.5; b.x += nx * overlap * 0.5;
        a.vx -= nx * 0.3; b.vx += nx * 0.3;
        a.vy -= ny * 0.3; b.vy += ny * 0.3;
        if (Math.random() < 0.15) {
          const winner = a.fitness > b.fitness ? a : b;
          const loser = winner === a ? b : a;
          loser.w = mutate(cloneWeights(winner.w));
          hashWeights(winner.w).then(hsh => updateStatus(`Transfer ${winner.i}→${loser.i} #${hsh}`));
        }
      }
    }
  }
  if (running) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
updateStatus('Ready · tilt or click · S seal');
