const cards = [];
const NUM = 8;
let handPos = {x: window.innerWidth/2, y: window.innerHeight/2};
let usingXR = false;
let xrSession = null;
const channel = new BroadcastChannel('f726-genomes');
let db;

function initDB() {
  const req = indexedDB.open('verse-f726', 1);
  req.onupgradeneeded = e => {
    e.target.result.createObjectStore('genomes', {keyPath: 'id'});
  };
  req.onsuccess = e => { db = e.target.result; loadGenomes(); };
}
initDB();

function createCard(i) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = `Note ${i+1}\nSpring genome`;
  el.style.left = (100 + i*80) + 'px';
  el.style.top = (100 + (i%3)*100) + 'px';
  document.body.appendChild(el);
  const c = {
    el, x: parseFloat(el.style.left), y: parseFloat(el.style.top),
    vx: 0, vy: 0,
    genome: { stiffness: 0.05 + Math.random()*0.1, damping: 0.8 + Math.random()*0.15, attract: 80 + Math.random()*40 },
    fitness: 0, holdTime: 0, id: i
  };
  makeDraggable(c);
  cards.push(c);
  return c;
}

function makeDraggable(c) {
  let dragging = false, ox, oy;
  c.el.addEventListener('pointerdown', e => {
    dragging = true; ox = e.clientX - c.x; oy = e.clientY - c.y;
    c.el.style.cursor = 'grabbing';
    c.fitness += 5;
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    c.x = e.clientX - ox; c.y = e.clientY - oy;
    c.vx = c.vy = 0;
  });
  window.addEventListener('pointerup', () => { dragging = false; c.el.style.cursor = 'grab'; });
  c.el.addEventListener('click', () => { c.fitness += 10; c.el.classList.add('rewarded'); setTimeout(() => c.el.classList.remove('rewarded'), 600); });
}

for (let i=0; i<NUM; i++) createCard(i);

function updatePhysics(dt) {
  cards.forEach(c => {
    const dx = handPos.x - c.x, dy = handPos.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    const force = Math.min(dist, c.genome.attract) / c.genome.attract;
    const ax = (dx / dist) * force * c.genome.stiffness * 200;
    const ay = (dy / dist) * force * c.genome.stiffness * 200 + 0.2;
    c.vx = (c.vx + ax * dt) * c.genome.damping;
    c.vy = (c.vy + ay * dt) * c.genome.damping;
    c.x += c.vx * dt * 60;
    c.y += c.vy * dt * 60;
    c.x = Math.max(20, Math.min(window.innerWidth-160, c.x));
    c.y = Math.max(20, Math.min(window.innerHeight-110, c.y));
    c.el.style.left = c.x + 'px';
    c.el.style.top = c.y + 'px';
    c.el.textContent = `Note ${c.id+1}\nS:${c.genome.stiffness.toFixed(3)}\nD:${c.genome.damping.toFixed(2)}\nF:${c.fitness.toFixed(0)}`;
    if (dist < 60) c.holdTime += dt; else c.holdTime = 0;
    if (c.holdTime > 0.5) c.fitness += dt * 2;
  });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  updatePhysics(dt);
  if (Math.random() < 0.005) evolve();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function evolve() {
  cards.sort((a,b) => b.fitness - a.fitness);
  const best = cards[0];
  cards.slice(4).forEach(c => {
    c.genome.stiffness = best.genome.stiffness * (0.85 + Math.random()*0.3);
    c.genome.damping = Math.min(0.98, best.genome.damping * (0.9 + Math.random()*0.2));
    c.genome.attract = best.genome.attract * (0.8 + Math.random()*0.4);
    c.fitness *= 0.7;
  });
}

function seal() {
  if (!db) return;
  const best = cards.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({id: 'best', genome: best.genome, fitness: best.fitness, ts: Date.now()});
  channel.postMessage({type: 'genome', genome: best.genome, fitness: best.fitness});
  document.getElementById('status').textContent = 'Sealed best genome (F=' + best.fitness.toFixed(0) + ')';
}

function loadGenomes() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const req = tx.objectStore('genomes').get('best');
  req.onsuccess = () => {
    if (req.result) {
      cards.forEach(c => Object.assign(c.genome, req.result.genome));
    }
  };
}

channel.onmessage = e => {
  if (e.data.type === 'genome' && e.data.fitness > (cards[0]?.fitness || 0)) {
    cards.forEach(c => Object.assign(c.genome, e.data.genome));
    document.getElementById('status').textContent = 'Adopted shared genome F=' + e.data.fitness.toFixed(0);
  }
};

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => location.reload();

window.addEventListener('pointermove', e => {
  if (!usingXR) handPos = {x: e.clientX, y: e.clientY};
});

document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {requiredFeatures: ['hand-tracking']});
    usingXR = true;
    document.getElementById('status').textContent = 'XR Hand mode active';
    xrSession.addEventListener('end', () => { usingXR = false; document.getElementById('status').textContent = 'XR ended - pointer mode'; });
  } catch (err) {
    console.warn(err);
    document.getElementById('status').textContent = 'XR failed, using pointer';
  }
};
