const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const bodies = [];
let gravity = {x:0, y:0.35};
let nextId = 1;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('f563-genome') : null;
let db;

function log(msg) { logEl.textContent = msg; console.log(msg); }

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f563-rigid-dom-genome', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('state');
    r.onsuccess = e => res(e.target.result);
    r.onerror = () => res(null);
  });
}

async function loadState() {
  db = await openDB();
  if (!db) return;
  return new Promise(res => {
    const tx = db.transaction('state', 'readonly');
    const g = tx.objectStore('state').get('genomes');
    g.onsuccess = () => res(g.result);
    g.onerror = () => res(null);
  });
}

async function saveState() {
  if (!db) return;
  const data = bodies.map(b => ({id:b.id, x:b.x, y:b.y, vx:b.vx, vy:b.vy, genome:b.genome, fitness:b.fitness}));
  const tx = db.transaction('state', 'readwrite');
  tx.objectStore('state').put(data, 'genomes');
}

function makeGenome() {
  return {
    mass: 0.8 + Math.random()*1.4,
    restitution: 0.3 + Math.random()*0.6,
    friction: 0.1 + Math.random()*0.4,
    hue: Math.floor(Math.random()*360)
  };
}

function createBody(x, y, genome) {
  const el = document.createElement('div');
  el.className = 'body';
  const w = 70 + Math.random()*40, h = 50 + Math.random()*30;
  el.style.width = w+'px'; el.style.height = h+'px';
  el.style.background = `hsl(${genome.hue},70%,45%)`;
  el.textContent = `m${genome.mass.toFixed(1)} r${genome.restitution.toFixed(1)}`;
  stage.appendChild(el);
  const b = {id:nextId++, el, x, y, vx:0, vy:0, w, h, genome, fitness:1, dragging:false};
  bodies.push(b);
  updateEl(b);
  return b;
}

function updateEl(b) {
  b.el.style.transform = `translate(${b.x}px,${b.y}px)`;
  b.el.style.background = `hsl(${b.genome.hue},70%,45%)`;
  b.el.textContent = `m${b.genome.mass.toFixed(1)} r${b.genome.restitution.toFixed(1)}`;
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolve(a, b) {
  const relVx = a.vx - b.vx, relVy = a.vy - b.vy;
  const speed = Math.hypot(relVx, relVy);
  if (speed < 0.5) return;
  const e = (a.genome.restitution + b.genome.restitution) / 2;
  const m1 = a.genome.mass, m2 = b.genome.mass;
  const inv = 1/m1 + 1/m2;
  const ox = Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y, b.y);
  if (ox < oy) { a.x += (a.x < b.x ? -ox/2 : ox/2); b.x += (a.x < b.x ? ox/2 : -ox/2); }
  else { a.y += (a.y < b.y ? -oy/2 : oy/2); b.y += (a.y < b.y ? oy/2 : -oy/2); }
  const j = -(1+e) * (relVx*0.5 + relVy*0.5) / inv;
  a.vx += j / m1 * 0.5; a.vy += j / m1 * 0.5;
  b.vx -= j / m2 * 0.5; b.vy -= j / m2 * 0.5;
  const f = (a.genome.friction + b.genome.friction)/2;
  a.vx *= (1-f*0.1); a.vy *= (1-f*0.1);
  b.vx *= (1-f*0.1); b.vy *= (1-f*0.1);
  const keA = 0.5*m1*(a.vx**2+a.vy**2), keB = 0.5*m2*(b.vx**2+b.vy**2);
  a.fitness = 1 / (1 + keA); b.fitness = 1 / (1 + keB);
  if (speed > 4) {
    if (a.fitness > b.fitness * 1.15) transfer(a, b);
    else if (b.fitness > a.fitness * 1.15) transfer(b, a);
  }
}

function transfer(winner, loser) {
  loser.genome = {...winner.genome, hue: (winner.genome.hue + 20) % 360};
  log(`Genome transfer: #${winner.id} → #${loser.id} (fit ${winner.fitness.toFixed(2)})`);
  if (channel) channel.postMessage({type:'genome', genome:winner.genome, fitness:winner.fitness});
  updateEl(loser);
}

if (channel) channel.onmessage = e => {
  if (e.data.type === 'genome' && bodies.length) {
    const target = bodies[Math.floor(Math.random()*bodies.length)];
    if (e.data.fitness > target.fitness) {
      target.genome = {...e.data.genome};
      updateEl(target);
      log('Adopted remote genome');
    }
  }
};

let drag = null, last = {x:0,y:0};
stage.addEventListener('pointerdown', e => {
  const t = e.target.closest('.body');
  if (!t) return;
  drag = bodies.find(b => b.el === t);
  if (drag) { drag.dragging = true; last = {x:e.clientX, y:e.clientY}; }
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - last.x, dy = e.clientY - last.y;
  drag.x += dx; drag.y += dy;
  drag.vx = dx * 0.3; drag.vy = dy * 0.3;
  last = {x:e.clientX, y:e.clientY};
  updateEl(drag);
});
window.addEventListener('pointerup', () => { if (drag) drag.dragging = false; drag = null; });

window.addEventListener('deviceorientation', e => {
  if (e.gamma != null) gravity.x = (e.gamma / 90) * 0.6;
  if (e.beta != null) gravity.y = ((e.beta - 30) / 90) * 0.6 + 0.2;
  statusEl.textContent = `Gravity: ${gravity.x.toFixed(2)}, ${gravity.y.toFixed(2)}`;
});

function step() {
  const W = stage.clientWidth, H = stage.clientHeight;
  for (const b of bodies) {
    if (b.dragging) continue;
    b.vx += gravity.x; b.vy += gravity.y;
    b.vx *= 0.99; b.vy *= 0.99;
    b.x += b.vx; b.y += b.vy;
    if (b.x < 0) { b.x = 0; b.vx *= -b.genome.restitution; }
    if (b.y < 0) { b.y = 0; b.vy *= -b.genome.restitution; }
    if (b.x + b.w > W) { b.x = W - b.w; b.vx *= -b.genome.restitution; }
    if (b.y + b.h > H) { b.y = H - b.h; b.vy *= -b.genome.restitution; }
    updateEl(b);
  }
  for (let i = 0; i < bodies.length; i++)
    for (let j = i+1; j < bodies.length; j++)
      if (aabb(bodies[i], bodies[j])) resolve(bodies[i], bodies[j]);
  requestAnimationFrame(step);
}

document.getElementById('seal').onclick = () => { saveState(); log('Sealed to IndexedDB'); };
document.getElementById('reset').onclick = () => { bodies.forEach(b => b.el.remove()); bodies.length = 0; spawn(); };
document.getElementById('add').onclick = () => createBody(100+Math.random()*200, 80, makeGenome());

function spawn() {
  for (let i = 0; i < 7; i++) createBody(60 + i*90, 40 + (i%3)*80, makeGenome());
}

(async () => {
  const saved = await loadState();
  if (saved && saved.length) {
    saved.forEach(s => {
      const b = createBody(s.x, s.y, s.genome);
      b.vx = s.vx; b.vy = s.vy; b.fitness = s.fitness || 1;
    });
    log('Restored sealed genomes');
  } else spawn();
  step();
})();
