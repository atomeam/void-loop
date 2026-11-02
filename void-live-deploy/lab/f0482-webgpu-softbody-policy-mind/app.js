const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const modeBtn = document.getElementById('mode');
let mode = 'chase'; // chase | orbit
let pointer = { x: 400, y: 300 };
let energy = 0.3, fitness = 0.5, gen = 0;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Softbody: grid of points
const COLS = 9, ROWS = 7, SPACING = 42;
const points = [];
const springs = [];
let restPositions = [];

function initSoftbody() {
  points.length = 0;
  springs.length = 0;
  const ox = (canvas.width - (COLS-1)*SPACING) / 2;
  const oy = (canvas.height - (ROWS-1)*SPACING) / 2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      points.push({
        x: ox + c * SPACING,
        y: oy + r * SPACING,
        px: ox + c * SPACING,
        py: oy + r * SPACING,
        pinned: (r === 0 && (c === 0 || c === COLS-1)),
        id: r * COLS + c
      });
    }
  }
  restPositions = points.map(p => ({ x: p.x, y: p.y }));
  // springs
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c < COLS - 1) springs.push({ a: i, b: i + 1, rest: SPACING });
      if (r < ROWS - 1) springs.push({ a: i, b: i + COLS, rest: SPACING });
      if (c < COLS - 1 && r < ROWS - 1) {
        springs.push({ a: i, b: i + COLS + 1, rest: SPACING * Math.SQRT2 });
        springs.push({ a: i + 1, b: i + COLS, rest: SPACING * Math.SQRT2 });
      }
    }
  }
}

function verlet() {
  const damp = 0.98;
  const gravity = 0.15;
  for (const p of points) {
    if (p.pinned) continue;
    const vx = (p.x - p.px) * damp;
    const vy = (p.y - p.py) * damp;
    p.px = p.x; p.py = p.y;
    p.x += vx;
    p.y += vy + gravity;
    p.x = Math.max(20, Math.min(canvas.width - 20, p.x));
    p.y = Math.max(20, Math.min(canvas.height - 20, p.y));
  }
  energy = 0;
  for (let k = 0; k < 3; k++) {
    for (const s of springs) {
      const a = points[s.a], b = points[s.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const diff = (dist - s.rest) / dist * 0.5;
      energy += Math.abs(dist - s.rest);
      if (!a.pinned) { a.x += dx * diff; a.y += dy * diff; }
      if (!b.pinned) { b.x -= dx * diff; b.y -= dy * diff; }
    }
  }
  energy /= springs.length;
}

function createMLP() {
  return {
    w1: Array(8).fill(0).map(() => Array(4).fill(0).map(() => (Math.random()-0.5)*0.8)),
    b1: Array(8).fill(0).map(() => (Math.random()-0.5)*0.2),
    w2: Array(4).fill(0).map(() => Array(8).fill(0).map(() => (Math.random()-0.5)*0.8)),
    b2: Array(4).fill(0).map(() => (Math.random()-0.5)*0.2)
  };
}
function forward(m, inp) {
  const h = m.b1.map((b, i) => Math.tanh(b + m.w1[i].reduce((s, w, j) => s + w * inp[j], 0)));
  return m.b2.map((b, i) => Math.tanh(b + m.w2[i].reduce((s, w, j) => s + w * h[j], 0)));
}
function mutate(m, rate = 0.15) {
  const nm = JSON.parse(JSON.stringify(m));
  for (const arr of [nm.w1, nm.w2]) for (const row of arr) for (let i = 0; i < row.length; i++) if (Math.random() < rate) row[i] += (Math.random()-0.5)*0.4;
  for (const arr of [nm.b1, nm.b2]) for (let i = 0; i < arr.length; i++) if (Math.random() < rate) arr[i] += (Math.random()-0.5)*0.2;
  return nm;
}

let policies = Array(6).fill(0).map(createMLP);
let active = 0;
let fitnesses = Array(6).fill(0.5);
let evoTimer = 0;

function applyPolicy() {
  const com = points.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  com.x /= points.length; com.y /= points.length;
  const dx = (pointer.x - com.x) / canvas.width;
  const dy = (pointer.y - com.y) / canvas.height;
  const inp = [dx, dy, energy / 50, mode === 'orbit' ? 1 : 0];
  const out = forward(policies[active], inp);
  const controls = [COLS + 1, COLS * 2 - 2, (ROWS-2)*COLS + 1, (ROWS-1)*COLS - 2];
  controls.forEach((idx, i) => {
    if (idx < points.length && !points[idx].pinned) {
      points[idx].x += out[i] * 4;
      points[idx].y += out[(i+1)%4] * 4;
    }
  });
  const dist = Math.hypot(pointer.x - com.x, pointer.y - com.y);
  const target = mode === 'orbit' ? 120 : 0;
  const f = Math.max(0, 1 - Math.abs(dist - target) / 300);
  fitnesses[active] = fitnesses[active] * 0.92 + f * 0.08;
  fitness = fitnesses[active];
}

function evolve() {
  evoTimer++;
  if (evoTimer < 120) return;
  evoTimer = 0;
  gen++;
  const best = fitnesses.indexOf(Math.max(...fitnesses));
  policies = policies.map((p, i) => i === best ? p : mutate(policies[best]));
  fitnesses = fitnesses.map((f, i) => i === best ? f : f * 0.7);
  active = (active + 1) % policies.length;
}

const facetEls = [];
const facetIndices = [COLS*2 + 2, COLS*2 + COLS-3, COLS*(ROWS-3) + 2, COLS*(ROWS-3) + COLS-3, Math.floor(COLS*ROWS/2)];
function initFacets() {
  const container = document.getElementById('facets');
  container.innerHTML = '';
  facetEls.length = 0;
  const labels = ['Policy', 'Energy', 'COM', 'Skin', 'Mind'];
  facetIndices.forEach((idx, i) => {
    const el = document.createElement('div');
    el.className = 'facet';
    el.textContent = labels[i];
    container.appendChild(el);
    facetEls.push(el);
  });
}
function updateFacets() {
  facetIndices.forEach((idx, i) => {
    const p = points[idx];
    const rest = restPositions[idx];
    if (!p || !facetEls[i]) return;
    const dx = p.x - rest.x, dy = p.y - rest.y;
    const scale = 1 + Math.hypot(dx, dy) * 0.008;
    facetEls[i].style.transform = `translate(${p.x - 45}px, ${p.y - 32}px) rotate(${dx*0.4}deg) scale(${scale})`;
    facetEls[i].style.background = `hsla(${200 + fitness*80}, 40%, 20%, 0.8)`;
  });
}

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  pointer.y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
}
canvas.addEventListener('pointermove', setPointer);
canvas.addEventListener('touchmove', setPointer, { passive: true });

const DB = 'softbody-mind', STORE = 'state';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      points: points.map(p => ({ x: p.x, y: p.y, px: p.px, py: p.py })),
      policies, fitnesses, gen, mode, rest: restPositions
    }, 'latest');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent += ' | sealed';
  } catch (e) { console.warn(e); }
}
async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('latest');
    const data = await new Promise(r => req.onsuccess = () => r(req.result));
    if (!data) return;
    data.points.forEach((dp, i) => { if (points[i]) Object.assign(points[i], dp); });
    policies = data.policies || policies;
    fitnesses = data.fitnesses || fitnesses;
    gen = data.gen || 0;
    mode = data.mode || 'chase';
    modeBtn.textContent = mode === 'chase' ? 'Chase' : 'Orbit';
    if (data.rest) restPositions = data.rest;
    statusEl.textContent += ' | restored';
  } catch (e) { console.warn(e); }
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { initSoftbody(); initFacets(); };
modeBtn.onclick = () => {
  mode = mode === 'chase' ? 'orbit' : 'chase';
  modeBtn.textContent = mode === 'chase' ? 'Chase' : 'Orbit';
};
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = `hsla(${180 + fitness*60}, 60%, 50%, 0.6)`;
  ctx.lineWidth = 1.5;
  for (const s of springs) {
    const a = points[s.a], b = points[s.b];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (const p of points) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.pinned ? 5 : 3, 0, Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle = '#f80';
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, mode === 'orbit' ? 120 : 18, 0, Math.PI*2); ctx.stroke();
}

function loop() {
  verlet();
  applyPolicy();
  evolve();
  updateFacets();
  draw();
  document.documentElement.style.setProperty('--energy', Math.min(1, energy / 20).toFixed(3));
  document.documentElement.style.setProperty('--fitness', fitness.toFixed(3));
  statusEl.textContent = `Energy: ${energy.toFixed(1)}  Fitness: ${fitness.toFixed(2)}  Gen: ${gen}  Active: ${active}`;
  requestAnimationFrame(loop);
}

initSoftbody();
initFacets();
loop();
