const N_AGENTS = 5;
const RES_SIZE = 8;
const agents = [];
let orient = { beta: 0, gamma: 0 };
let attractor = null;
let db;

function randn() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.5; }
function spectralRadius(W, target = 0.85) {
  let v = Array(RES_SIZE).fill(0).map(() => randn());
  for (let i = 0; i < 20; i++) {
    const nv = Array(RES_SIZE).fill(0);
    for (let r = 0; r < RES_SIZE; r++) for (let c = 0; c < RES_SIZE; c++) nv[r] += W[r*RES_SIZE+c] * v[c];
    const n = Math.hypot(...nv) || 1;
    v = nv.map(x => x / n);
  }
  const nv = Array(RES_SIZE).fill(0);
  for (let r = 0; r < RES_SIZE; r++) for (let c = 0; c < RES_SIZE; c++) nv[r] += W[r*RES_SIZE+c] * v[c];
  const rho = Math.hypot(...nv) || 1;
  return W.map(w => w * target / rho);
}

function makeReservoir() {
  const W_res = Array(RES_SIZE * RES_SIZE).fill(0).map(() => randn() * 0.4);
  const scaled = spectralRadius(W_res);
  const W_in = Array(RES_SIZE * 5).fill(0).map(() => randn() * 0.5);
  const b = Array(RES_SIZE).fill(0).map(() => randn() * 0.1);
  const W_out = Array(3 * RES_SIZE).fill(0).map(() => randn() * 0.3);
  return { W_res: scaled, W_in, b, W_out, h: Array(RES_SIZE).fill(0) };
}

function stepReservoir(res, x) {
  const hNew = Array(RES_SIZE).fill(0);
  for (let r = 0; r < RES_SIZE; r++) {
    let s = res.b[r];
    for (let c = 0; c < RES_SIZE; c++) s += res.W_res[r * RES_SIZE + c] * res.h[c];
    for (let i = 0; i < 5; i++) s += res.W_in[r * 5 + i] * x[i];
    hNew[r] = Math.tanh(s);
  }
  res.h = hNew;
  const out = [0, 0, 0];
  for (let o = 0; o < 3; o++) {
    for (let c = 0; c < RES_SIZE; c++) out[o] += res.W_out[o * RES_SIZE + c] * res.h[c];
  }
  return out;
}

function hashReadout(W_out) {
  const str = W_out.map(v => v.toFixed(6)).join(',');
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  );
}

function mutateReadout(W, rate = 0.06) {
  return W.map(v => v + (Math.random() - 0.5) * rate);
}

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f488', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pop', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function seal() {
  if (!db) return;
  const data = agents.map(a => ({
    id: a.id, W_out: a.res.W_out, h: a.res.h,
    x: a.x, y: a.y, vx: a.vx, vy: a.vy, fitness: a.fitness
  }));
  const tx = db.transaction('pop', 'readwrite');
  data.forEach(d => tx.objectStore('pop').put(d));
  await new Promise(r => tx.oncomplete = r);
  status.textContent = `Sealed ${N_AGENTS} reservoirs.`;
}

async function restore() {
  if (!db) return;
  const tx = db.transaction('pop', 'readonly');
  const store = tx.objectStore('pop');
  const req = store.getAll();
  req.onsuccess = () => {
    const rows = req.result || [];
    rows.forEach(row => {
      const a = agents.find(x => x.id === row.id);
      if (a) {
        a.res.W_out = row.W_out;
        a.res.h = row.h;
        a.x = row.x; a.y = row.y; a.vx = row.vx; a.vy = row.vy; a.fitness = row.fitness;
      }
    });
    status.textContent = `Restored ${rows.length} agents.`;
  };
}

function createAgent(id) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.innerHTML = `<div class="label">R${id}</div>`;
  document.body.appendChild(el);
  return {
    id, el, res: makeReservoir(),
    x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
    vx: 0, vy: 0, fitness: 0.5, energy: 0
  };
}

function updateAgent(a, dt) {
  const ox = (orient.gamma || 0) / 45;
  const oy = (orient.beta || 0) / 45;
  let px = 0, py = 0;
  if (attractor) {
    px = (attractor.x - a.x) / window.innerWidth;
    py = (attractor.y - a.y) / window.innerHeight;
  }
  const energy = Math.hypot(...a.res.h);
  const x = [ox, oy, px, py, energy * 0.5];
  const out = stepReservoir(a.res, x);
  a.vx += out[0] * 0.8 + ox * 0.12;
  a.vy += out[1] * 0.8 + oy * 0.12;
  a.vx *= 0.92; a.vy *= 0.92;
  a.x += a.vx * dt * 60;
  a.y += a.vy * dt * 60;
  if (a.x < 40) { a.x = 40; a.vx *= -0.5; }
  if (a.x > window.innerWidth - 40) { a.x = window.innerWidth - 40; a.vx *= -0.5; }
  if (a.y < 40) { a.y = 40; a.vy *= -0.5; }
  if (a.y > window.innerHeight - 40) { a.y = window.innerHeight - 40; a.vy *= -0.5; }
  a.energy = energy;
  a.fitness = a.fitness * 0.98 + (1 / (1 + Math.hypot(a.vx, a.vy))) * 0.02;
  if (attractor) a.fitness += (1 / (1 + Math.hypot(a.x - attractor.x, a.y - attractor.y) / 80)) * 0.01;
  const hue = (energy * 40 + a.id * 72) % 360;
  const scale = 0.85 + Math.min(0.4, energy * 0.3);
  const rot = Math.atan2(a.vy, a.vx) * 20;
  const glow = 6 + energy * 8;
  a.el.style.left = a.x + 'px';
  a.el.style.top = a.y + 'px';
  a.el.style.setProperty('--hue', hue);
  a.el.style.setProperty('--scale', scale);
  a.el.style.setProperty('--rot', rot + 'deg');
  a.el.style.setProperty('--glow', glow);
  a.el.querySelector('.label').textContent = `R${a.id} ${a.fitness.toFixed(2)}`;
}

function checkCollisions() {
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 70 && d > 0) {
        const overlap = 70 - d;
        const nx = dx / d, ny = dy / d;
        a.x += nx * overlap * 0.5; a.y += ny * overlap * 0.5;
        b.x -= nx * overlap * 0.5; b.y -= ny * overlap * 0.5;
        const winner = a.fitness > b.fitness ? a : b;
        const loser = winner === a ? b : a;
        hashReadout(winner.res.W_out).then(h => {
          loser.res.W_out = mutateReadout(winner.res.W_out);
          status.textContent = `Sealed transfer ${h.slice(0,8)}… → R${loser.id}`;
        });
        a.vx *= 0.7; a.vy *= 0.7; b.vx *= 0.7; b.vy *= 0.7;
      }
    }
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  agents.forEach(a => updateAgent(a, dt));
  checkCollisions();
  requestAnimationFrame(loop);
}

function init() {
  for (let i = 0; i < N_AGENTS; i++) agents.push(createAgent(i));
  openDB().then(d => { db = d; status.textContent = 'Ready. Enable orientation or click.'; }).catch(() => status.textContent = 'No IndexedDB; still interactive.');
  document.getElementById('orientBtn').onclick = () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().then(p => {
        if (p === 'granted') window.addEventListener('deviceorientation', e => { orient.beta = e.beta || 0; orient.gamma = e.gamma || 0; });
      });
    } else {
      window.addEventListener('deviceorientation', e => { orient.beta = e.beta || 0; orient.gamma = e.gamma || 0; });
    }
    status.textContent = 'Orientation active (or pointer fallback).';
  };
  document.getElementById('sealBtn').onclick = seal;
  document.getElementById('restoreBtn').onclick = restore;
  document.getElementById('resetBtn').onclick = () => {
    agents.forEach(a => { a.res = makeReservoir(); a.x = Math.random() * innerWidth; a.y = Math.random() * innerHeight; a.vx = a.vy = 0; a.fitness = 0.5; });
    status.textContent = 'Reset.';
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#ui')) return;
    attractor = { x: e.clientX, y: e.clientY };
    const att = document.getElementById('attractor');
    att.style.display = 'block';
    att.style.left = e.clientX + 'px';
    att.style.top = e.clientY + 'px';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 's' || e.key === 'S') seal();
    if (e.key === 'r' || e.key === 'R') restore();
  });
  requestAnimationFrame(loop);
}
init();
