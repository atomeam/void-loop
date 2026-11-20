const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const NUM_SPECIES = 4;
const PARTICLES_PER = 80;
const species = [];
const particles = [];
let orientation = { alpha:0, beta:0, gamma:0 };
let mouse = { x: W/2, y: H/2, vx:0, vy:0 };
let lastMouse = { x: W/2, y: H/2 };

class Genome {
  constructor(data) {
    this.params = data || new Float32Array(10).map(() => (Math.random()-0.5)*2);
    this.fitness = 0;
    this.hue = (Math.random()*360)|0;
  }
  mutate(rate=0.1) {
    for (let i=0; i<this.params.length; i++) {
      if (Math.random() < rate) this.params[i] += (Math.random()-0.5)*0.3;
      this.params[i] = Math.max(-2, Math.min(2, this.params[i]));
    }
  }
  clone() {
    const g = new Genome(new Float32Array(this.params));
    g.fitness = this.fitness;
    g.hue = this.hue;
    return g;
  }
}

class Particle {
  constructor(speciesIdx) {
    this.s = speciesIdx;
    this.x = Math.random()*W;
    this.y = Math.random()*H;
    this.vx = (Math.random()-0.5)*2;
    this.vy = (Math.random()-0.5)*2;
  }
}

function init() {
  species.length = 0;
  particles.length = 0;
  for (let s=0; s<NUM_SPECIES; s++) {
    species.push(new Genome());
    for (let p=0; p<PARTICLES_PER; p++) particles.push(new Particle(s));
  }
  loadGenomes();
}

function loadGenomes() {
  if (!window.indexedDB) return;
  const req = indexedDB.open('verse-f838', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes', 'readonly');
    const store = tx.objectStore('genomes');
    store.get('best').onsuccess = ev => {
      if (ev.target.result) {
        const data = ev.target.result;
        data.forEach((d, i) => {
          if (species[i]) {
            species[i].params = new Float32Array(d.params);
            species[i].fitness = d.fitness || 0;
            species[i].hue = d.hue || species[i].hue;
          }
        });
      }
    };
  };
}

function saveGenomes() {
  if (!window.indexedDB) return;
  const req = indexedDB.open('verse-f838', 1);
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(species.map(s => ({params: Array.from(s.params), fitness: s.fitness, hue: s.hue})), 'best');
  };
}

const channel = new BroadcastChannel('f838-genome');
channel.onmessage = e => {
  if (e.data.type === 'genome' && e.data.fitness > Math.max(...species.map(s=>s.fitness))) {
    const bestIdx = e.data.speciesIdx || 0;
    if (species[bestIdx]) {
      species[bestIdx].params = new Float32Array(e.data.params);
      species[bestIdx].fitness = e.data.fitness;
      species[bestIdx].hue = e.data.hue;
      particles.filter(p => p.s === bestIdx).forEach(p => { p.x = Math.random()*W; p.y = Math.random()*H; });
    }
  }
};

function seal() {
  const best = species.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const idx = species.indexOf(best);
  saveGenomes();
  channel.postMessage({ type:'genome', params: Array.from(best.params), fitness: best.fitness, hue: best.hue, speciesIdx: idx });
  document.getElementById('stats').innerHTML += '<br>Sealed & broadcast best genome.';
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { init(); };

window.addEventListener('deviceorientation', e => {
  orientation.alpha = e.alpha || 0;
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
}, true);

canvas.addEventListener('mousemove', e => {
  mouse.vx = e.clientX - lastMouse.x;
  mouse.vy = e.clientY - lastMouse.y;
  mouse.x = e.clientX; mouse.y = e.clientY;
  lastMouse.x = e.clientX; lastMouse.y = e.clientY;
});

canvas.addEventListener('click', e => {
  let minDist = Infinity, closestS = 0;
  for (const p of particles) {
    const dx = p.x - e.clientX, dy = p.y - e.clientY;
    const d = dx*dx + dy*dy;
    if (d < minDist) { minDist = d; closestS = p.s; }
  }
  species[closestS].fitness += 1;
  species[closestS].mutate(0.15);
});

function step() {
  const windX = (orientation.gamma || 0) * 0.01 + mouse.vx * 0.05;
  const windY = (orientation.beta || 0) * 0.01 + mouse.vy * 0.05;
  mouse.vx *= 0.9; mouse.vy *= 0.9;

  for (const p of particles) {
    const g = species[p.s];
    let fx = windX * g.params[0], fy = windY * g.params[1];
    let count = 0, cx=0, cy=0, sepX=0, sepY=0;
    for (let i=0; i<20; i++) {
      const o = particles[(Math.random()*particles.length)|0];
      if (o.s !== p.s) continue;
      const dx = o.x - p.x, dy = o.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 400 && d2 > 0) {
        const d = Math.sqrt(d2);
        if (d < 20) { sepX -= dx/d; sepY -= dy/d; }
        cx += o.x; cy += o.y; count++;
      }
    }
    if (count) {
      cx /= count; cy /= count;
      fx += (cx - p.x) * g.params[2] * 0.01;
      fy += (cy - p.y) * g.params[2] * 0.01;
      fx += sepX * g.params[3];
      fy += sepY * g.params[3];
    }
    p.vx = (p.vx + fx) * 0.98;
    p.vy = (p.vy + fy) * 0.98;
    const sp = Math.hypot(p.vx, p.vy);
    const maxSp = 1.5 + g.params[4];
    if (sp > maxSp) { p.vx *= maxSp/sp; p.vy *= maxSp/sp; }
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  for (const p of particles) {
    const g = species[p.s];
    ctx.fillStyle = `hsl(${g.hue},70%,60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + Math.abs(g.params[5])*1.5, 0, Math.PI*2);
    ctx.fill();
  }
  const stats = species.map((s,i) => `<span class="species" style="background:hsl(${s.hue},70%,60%)"></span>S${i}: ${s.fitness.toFixed(0)}`).join('<br>');
  document.getElementById('stats').innerHTML = stats;
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}

init();
loop();
