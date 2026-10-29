const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 180;
const particles = [];
const channel = new BroadcastChannel('verse-granular-genome-f456');
let tabCount = 1;
const probesEl = document.getElementById('probes');
let sealed = [];

class Particle {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2;
    this.r = 4 + Math.random()*3;
    // genes: restitution, friction, hue
    this.genes = [0.6 + Math.random()*0.3, 0.05 + Math.random()*0.1, Math.random()*360];
    this.energy = 0;
    this.fitness = 0;
  }
  step(gX, gY) {
    this.vy += 0.08 * gY; // gravity bias
    this.vx += 0.08 * gX;
    this.vx *= (1 - this.genes[1]);
    this.vy *= (1 - this.genes[1]);
    this.x += this.vx; this.y += this.vy;
    // bounds
    if (this.x < this.r) { this.x = this.r; this.vx *= -this.genes[0]; }
    if (this.x > W - this.r) { this.x = W - this.r; this.vx *= -this.genes[0]; }
    if (this.y < this.r) { this.y = this.r; this.vy *= -this.genes[0]; }
    if (this.y > H - this.r) { this.y = H - this.r; this.vy *= -this.genes[0]; }
    this.energy = this.vx*this.vx + this.vy*this.vy;
    this.fitness = 1 / (1 + this.energy); // prefer low energy / settled
  }
  draw() {
    ctx.beginPath();
    ctx.fillStyle = `hsl(${this.genes[2]}, 70%, 55%)`;
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fill();
  }
}

function init() {
  for (let i = 0; i < N; i++) {
    particles.push(new Particle(Math.random()*W, Math.random()*H*0.5));
  }
}

let gx = 0, gy = 1;
window.addEventListener('deviceorientation', e => {
  if (e.gamma != null) gx = Math.max(-1, Math.min(1, e.gamma / 45));
  if (e.beta != null) gy = Math.max(-1, Math.min(1, (e.beta - 30) / 45));
});

let mouse = {x:0, y:0, down:false};
canvas.addEventListener('pointerdown', e => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointerup', () => mouse.down = false);
canvas.addEventListener('pointerleave', () => mouse.down = false);

function collide() {
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i+1; j < particles.length; j++) {
      const b = particles[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx*dx + dy*dy;
      const min = a.r + b.r;
      if (d2 < min*min && d2 > 0) {
        const d = Math.sqrt(d2);
        const nx = dx/d, ny = dy/d;
        const overlap = min - d;
        a.x -= nx * overlap * 0.5; b.x += nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5; b.y += ny * overlap * 0.5;
        // relative velocity along normal
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const velN = rvx*nx + rvy*ny;
        if (velN < 0) {
          const e = Math.min(a.genes[0], b.genes[0]);
          const j = -(1+e) * velN / 2;
          a.vx -= j * nx; a.vy -= j * ny;
          b.vx += j * nx; b.vy += j * ny;
        }
        // genome transfer: weaker (lower fitness) adopts stronger with small mut
        if (a.fitness < b.fitness) transfer(a, b);
        else if (b.fitness < a.fitness) transfer(b, a);
      }
    }
  }
}

function transfer(weak, strong) {
  for (let k = 0; k < 3; k++) {
    weak.genes[k] = strong.genes[k] + (Math.random()-0.5)*0.05;
    weak.genes[k] = Math.max(0, Math.min(k===2?360:1, weak.genes[k]));
  }
  // broadcast occasional
  if (Math.random() < 0.02) {
    channel.postMessage({ type: 'genome', genes: strong.genes.slice(), fitness: strong.fitness });
  }
}

channel.onmessage = e => {
  if (e.data.type === 'genome') {
    // inject into a random low-fitness particle
    const low = particles.reduce((p, c) => c.fitness < p.fitness ? c : p, particles[0]);
    if (low && e.data.fitness > low.fitness) {
      low.genes = e.data.genes.slice();
    }
  } else if (e.data.type === 'hello') {
    tabCount++;
    document.getElementById('tabs').textContent = tabCount;
  }
};
channel.postMessage({ type: 'hello' });

function spawnProbes() {
  probesEl.innerHTML = '';
  // sample 4 regions
  const regions = [[W*0.25,H*0.5],[W*0.75,H*0.5],[W*0.5,H*0.25],[W*0.5,H*0.75]];
  regions.forEach((p, i) => {
    const nearby = particles.filter(pt => Math.hypot(pt.x-p[0], pt.y-p[1]) < 80);
    if (nearby.length < 3) return;
    const avgFit = nearby.reduce((s,pt)=>s+pt.fitness,0)/nearby.length;
    const genes = nearby[0].genes;
    const div = document.createElement('div');
    div.className = 'probe';
    div.innerHTML = `Probe ${i+1}<br>fit:${avgFit.toFixed(2)} rest:${genes[0].toFixed(2)}<br>Click to seal`; // void-review: ok (constant labels and computed numbers, no visitor text)
    div.onclick = () => sealGenome(genes, avgFit);
    probesEl.appendChild(div);
  });
}

async function sealGenome(genes, fit) {
  const id = 'seal-' + Date.now();
  sealed.push({id, genes, fit, t: Date.now()});
  try {
    const db = await openDB();
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({id, genes, fit, t: Date.now()});
    document.getElementById('status').textContent = `Sealed genome (fit ${fit.toFixed(2)}) to IndexedDB`;
  } catch(e) { console.warn(e); }
}

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('verse-f456', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals', {keyPath:'id'});
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function loop() {
  ctx.fillStyle = 'rgba(5,5,16,0.25)';
  ctx.fillRect(0,0,W,H);
  const gX = mouse.down ? (mouse.x/W - 0.5)*2 : gx;
  const gY = mouse.down ? (mouse.y/H - 0.5)*2 : gy;
  particles.forEach(p => p.step(gX, gY));
  collide();
  particles.forEach(p => p.draw());
  document.getElementById('n').textContent = particles.length;
  if (Math.random() < 0.05) spawnProbes();
  requestAnimationFrame(loop);
}

init();
loop();
