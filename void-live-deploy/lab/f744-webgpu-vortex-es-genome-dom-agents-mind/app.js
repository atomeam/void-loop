const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hudStatus = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 12;
const agents = [];
const DOM_AGENTS = 6;
let pointer = {x: W/2, y: H/2, down: false};
let bestFitness = -Infinity;
let sealedGenome = null;

class Agent {
  constructor(i) {
    this.id = i;
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.strength = (Math.random() - 0.5) * 80; // circulation
    this.core = 12 + Math.random() * 20;
    this.vx = 0; this.vy = 0;
    this.fitness = 0;
    this.genome = { strMul: 0.8 + Math.random()*0.4, coreMul: 0.8 + Math.random()*0.4, hue: Math.random()*360 };
    this.el = null;
    if (i < DOM_AGENTS) this.makeDOM();
  }
  makeDOM() {
    const el = document.createElement('div');
    el.className = 'agent';
    el.innerHTML = `<strong>V${this.id}</strong><br>fit:0<br>Γ:0`;
    document.getElementById('stage').appendChild(el);
    this.el = el;
  }
  applyGenome() {
    this.strength *= this.genome.strMul;
    this.core *= this.genome.coreMul;
    this.core = Math.max(8, Math.min(40, this.core));
  }
  mutate() {
    this.genome.strMul += (Math.random()-0.5)*0.15;
    this.genome.coreMul += (Math.random()-0.5)*0.15;
    this.genome.hue = (this.genome.hue + (Math.random()-0.5)*40) % 360;
    this.genome.strMul = Math.max(0.3, Math.min(1.8, this.genome.strMul));
    this.genome.coreMul = Math.max(0.4, Math.min(1.6, this.genome.coreMul));
  }
  transferFrom(other) {
    if (other.fitness > this.fitness + 5) {
      this.genome = JSON.parse(JSON.stringify(other.genome));
      this.mutate();
      this.fitness = other.fitness * 0.7;
    }
  }
  updateDOM() {
    if (!this.el) return;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.background = `hsla(${this.genome.hue},70%,40%,0.8)`;
    this.el.innerHTML = `<strong>V${this.id}</strong><br>fit:${this.fitness.toFixed(0)}<br>Γ:${this.strength.toFixed(1)}`;
  }
}

function biotSavart() {
  // pure JS discrete vortex method
  for (let i = 0; i < N; i++) {
    let ax = 0, ay = 0;
    const a = agents[i];
    for (let j = 0; j < N; j++) if (i !== j) {
      const b = agents[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const r2 = dx*dx + dy*dy + b.core*b.core;
      const factor = b.strength / (2 * Math.PI * r2);
      ax += -dy * factor;
      ay += dx * factor;
    }
    // pointer attractor / injector
    if (pointer.down) {
      const dx = pointer.x - a.x, dy = pointer.y - a.y;
      const d = Math.hypot(dx, dy) + 1;
      ax += dx / d * 40;
      ay += dy / d * 40;
      if (d < 40) a.fitness += 0.5;
    }
    a.vx = a.vx * 0.92 + ax * 0.08;
    a.vy = a.vy * 0.92 + ay * 0.08;
    a.x += a.vx;
    a.y += a.vy;
    // soft walls
    if (a.x < 20 || a.x > W-20) a.vx *= -0.6;
    if (a.y < 20 || a.y > H-20) a.vy *= -0.6;
    a.x = Math.max(10, Math.min(W-10, a.x));
    a.y = Math.max(10, Math.min(H-10, a.y));
  }
}

function evolve() {
  // simple ES: copy best to weak, mutate
  let maxF = -Infinity, best = agents[0];
  agents.forEach(a => { if (a.fitness > maxF) { maxF = a.fitness; best = a; } });
  if (maxF > bestFitness) bestFitness = maxF;
  agents.forEach(a => {
    if (a !== best && Math.random() < 0.05) a.transferFrom(best);
    if (Math.random() < 0.02) a.mutate();
    a.applyGenome();
    a.fitness *= 0.995;
  });
}

function drawField() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(100,150,255,0.15)';
  ctx.lineWidth = 1;
  // sample a coarse velocity field for visualization
  const step = 28;
  for (let x = step; x < W; x += step) {
    for (let y = step; y < H; y += step) {
      let vx = 0, vy = 0;
      agents.forEach(a => {
        const dx = x - a.x, dy = y - a.y;
        const r2 = dx*dx + dy*dy + a.core*a.core;
        const f = a.strength / (2 * Math.PI * r2);
        vx += -dy * f;
        vy += dx * f;
      });
      const mag = Math.hypot(vx, vy);
      if (mag > 0.5) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx*0.8, y + vy*0.8);
        ctx.stroke();
      }
    }
  }
  // particles
  agents.forEach(a => {
    ctx.fillStyle = `hsla(${a.genome.hue},80%,60%,0.9)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, Math.min(8, Math.abs(a.strength)/10 + 3), 0, Math.PI*2);
    ctx.fill();
  });
}

function loop() {
  biotSavart();
  evolve();
  drawField();
  agents.forEach(a => a.updateDOM());
  hudStatus.textContent = `best fit ${bestFitness.toFixed(0)} | agents ${N}`;
  requestAnimationFrame(loop);
}

// persistence
const DB_NAME = 'verse-f744-vortex';
const CHANNEL = 'f744-genomes';
let db;
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
if (bc) bc.onmessage = e => { if (e.data && e.data.fitness > bestFitness) { sealedGenome = e.data; applySealed(); } };

function openDB() {
  return new Promise(res => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => res();
  });
}
async function sealBest() {
  const best = agents.reduce((b,a) => a.fitness > b.fitness ? a : b, agents[0]);
  const payload = { fitness: best.fitness, genome: best.genome, ts: Date.now() };
  sealedGenome = payload;
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(payload, 'best');
  }
  if (bc) bc.postMessage(payload);
  hudStatus.textContent = 'sealed & broadcast';
}
function applySealed() {
  if (!sealedGenome) return;
  agents.forEach(a => {
    if (sealedGenome.fitness > a.fitness) {
      a.genome = JSON.parse(JSON.stringify(sealedGenome.genome));
      a.mutate();
      a.fitness = sealedGenome.fitness * 0.6;
    }
  });
}

document.getElementById('seal').onclick = sealBest;
document.getElementById('reset').onclick = () => { agents.forEach(a => { a.fitness=0; a.strength=(Math.random()-0.5)*60; }); bestFitness=-Infinity; };
document.getElementById('reward').onclick = () => {
  let nearest = agents[0], md = 1e9;
  agents.forEach(a => { const d = Math.hypot(a.x-pointer.x, a.y-pointer.y); if (d < md) { md=d; nearest=a; } });
  nearest.fitness += 20;
};

addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('pointerdown', () => pointer.down = true);
addEventListener('pointerup', () => pointer.down = false);

// init
for (let i=0; i<N; i++) agents.push(new Agent(i));
openDB().then(() => {
  if (db) {
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => { if (req.result) { sealedGenome = req.result; applySealed(); } };
  }
  loop();
});
