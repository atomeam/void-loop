const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvas-wrap');
const statusEl = document.getElementById('status');

let W, H;
function resize() {
  W = canvas.width = wrap.clientWidth;
  H = canvas.height = wrap.clientHeight;
}
resize();
window.addEventListener('resize', resize);

// Genome: [attract, speed, aggression, noise, cohesion, resourceBias]
function randomGenome() {
  return new Float32Array(6).map(() => Math.random() * 2 - 0.5);
}
function hashGenome(g) {
  let h = 5381;
  for (let i = 0; i < g.length; i++) {
    h = ((h << 5) + h) + Math.floor(g[i] * 1000);
    h |= 0;
  }
  return (h >>> 0).toString(16).slice(0, 6);
}

class Agent {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2;
    this.energy = 1;
    this.genome = randomGenome();
    this.id = Math.random().toString(36).slice(2,6);
    this.card = null;
    this.captureHold = 0;
  }
  update(resource, agents, dt) {
    const dx = resource.x - this.x, dy = resource.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const attract = this.genome[0];
    const speed = 0.8 + this.genome[1] * 0.6;
    const noise = this.genome[3];
    const bias = this.genome[5];

    // steering toward resource modulated by genome
    this.vx += (dx / dist) * attract * 0.08 * bias;
    this.vy += (dy / dist) * attract * 0.08 * bias;

    // simple separation from nearest
    let nearest = null, nd = Infinity;
    for (const o of agents) {
      if (o === this) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < nd && d < 80) { nd = d; nearest = o; }
    }
    if (nearest) {
      const sep = this.genome[2]; // aggression as separation
      this.vx -= (nearest.x - this.x) / nd * sep * 0.05;
      this.vy -= (nearest.y - this.y) / nd * sep * 0.05;
    }

    this.vx += (Math.random()-0.5) * noise * 0.3;
    this.vy += (Math.random()-0.5) * noise * 0.3;

    const spd = Math.hypot(this.vx, this.vy) || 1;
    const maxS = speed * 2.5;
    if (spd > maxS) { this.vx = this.vx/spd*maxS; this.vy = this.vy/spd*maxS; }

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    // bounds
    if (this.x < 10) this.vx += 0.2;
    if (this.x > W-10) this.vx -= 0.2;
    if (this.y < 10) this.vy += 0.2;
    if (this.y > H-10) this.vy -= 0.2;

    // energy from proximity to resource
    if (dist < 60) this.energy = Math.min(2, this.energy + 0.005);
    else this.energy = Math.max(0.2, this.energy - 0.001);

    // competition: capture check
    if (nearest && dist < 100 && nearest && Math.hypot(nearest.x-resource.x, nearest.y-resource.y) > dist + 10) {
      this.captureHold++;
      if (this.captureHold > 40) {
        // transfer genome
        for (let i = 0; i < 6; i++) {
          this.genome[i] = this.genome[i]*0.65 + nearest.genome[i]*0.35 + (Math.random()-0.5)*0.05;
        }
        nearest.energy *= 0.7;
        this.energy = Math.min(2, this.energy + 0.3);
        this.captureHold = 0;
        captures++;
        if (this.card) this.card.querySelector('.hash').textContent = hashGenome(this.genome);
      }
    } else this.captureHold = Math.max(0, this.captureHold - 1);
  }
  draw() {
    ctx.fillStyle = `hsl(${(this.genome[0]*40+180)|0}, 70%, ${50 + this.energy*20}%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6 + this.energy*3, 0, Math.PI*2);
    ctx.fill();
  }
}

const agents = [];
const resource = { x: W/2, y: H/2, vx: 0, vy: 0 };
let pointer = { x: W/2, y: H/2 };
let captures = 0;
let running = true;

function spawnAgent(x = Math.random()*W, y = Math.random()*H) {
  const a = new Agent(x, y);
  agents.push(a);
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.innerHTML = `<div class="hash">${hashGenome(a.genome)}</div><div class="fit">e:${a.energy.toFixed(1)}</div>`;
  card.dataset.id = a.id;
  wrap.appendChild(card);
  a.card = card;

  // drag
  let dragging = false, ox=0, oy=0;
  card.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - card.offsetLeft;
    oy = e.clientY - card.offsetTop;
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', e => {
    if (!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const nx = e.clientX - rect.left - ox;
    const ny = e.clientY - rect.top - oy;
    card.style.left = nx + 'px';
    card.style.top = ny + 'px';
    // bias agent
    a.x = nx + 40;
    a.y = ny + 10;
    a.vx *= 0.5; a.vy *= 0.5;
  });
  card.addEventListener('pointerup', () => dragging = false);
  card.addEventListener('click', () => {
    // seal individual
    sealOne(a);
  });
}

function updateCards() {
  for (const a of agents) {
    if (!a.card) continue;
    a.card.style.left = (a.x - 40) + 'px';
    a.card.style.top = (a.y - 20) + 'px';
    a.card.querySelector('.fit').textContent = `e:${a.energy.toFixed(1)}`;
  }
}

function loop() {
  if (!running) return;
  ctx.fillStyle = 'rgba(5,5,8,0.25)';
  ctx.fillRect(0,0,W,H);

  // resource follows pointer
  resource.vx += (pointer.x - resource.x) * 0.02;
  resource.vy += (pointer.y - resource.y) * 0.02;
  resource.vx *= 0.9; resource.vy *= 0.9;
  resource.x += resource.vx;
  resource.y += resource.vy;

  ctx.fillStyle = '#f84';
  ctx.beginPath();
  ctx.arc(resource.x, resource.y, 12, 0, Math.PI*2);
  ctx.fill();

  const dt = 1/60;
  for (const a of agents) a.update(resource, agents, dt);
  for (const a of agents) a.draw();

  updateCards();
  statusEl.textContent = `Agents: ${agents.length} | Captures: ${captures} | Resource @ ${resource.x|0},${resource.y|0}`;
  requestAnimationFrame(loop);
}

// pointer
wrap.addEventListener('pointermove', e => {
  const r = wrap.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
});

// controls
document.getElementById('spawn').onclick = () => spawnAgent();
document.getElementById('reset').onclick = () => {
  agents.forEach(a => a.card && a.card.remove());
  agents.length = 0;
  captures = 0;
  for (let i = 0; i < 8; i++) spawnAgent();
};
document.getElementById('seal').onclick = async () => {
  const data = agents.map(a => ({ id: a.id, genome: Array.from(a.genome), energy: a.energy, hash: hashGenome(a.genome) }));
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ id: 'pop', data, ts: Date.now() });
    await tx.done;
    statusEl.textContent = 'Sealed ' + data.length + ' genomes';
  } catch (e) {
    console.warn(e);
    statusEl.textContent = 'Seal failed (IDB) — in memory only';
  }
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('pop');
    req.onsuccess = () => {
      const rec = req.result;
      if (!rec) return;
      agents.forEach(a => a.card && a.card.remove());
      agents.length = 0;
      for (const d of rec.data) {
        const a = new Agent(Math.random()*W, Math.random()*H);
        a.genome = new Float32Array(d.genome);
        a.energy = d.energy;
        // recreate card
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.innerHTML = `<div class="hash">${hashGenome(a.genome)}</div><div class="fit">e:${a.energy.toFixed(1)}</div>`;
        wrap.appendChild(card);
        a.card = card;
        agents.push(a);
      }
      statusEl.textContent = 'Loaded ' + agents.length + ' sealed genomes';
    };
  } catch (e) { console.warn(e); }
};

function sealOne(a) {
  statusEl.textContent = 'Sealed ' + hashGenome(a.genome);
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('F278-genomes', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// init
for (let i = 0; i < 6; i++) spawnAgent();
loop();
