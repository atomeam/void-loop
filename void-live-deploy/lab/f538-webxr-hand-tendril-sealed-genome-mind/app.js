const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Genome: [growth, stiffness, hue, size, speed, mutRate, rest1, rest2]
function randomGenome() {
  return Array.from({length:8}, () => Math.random());
}
function mutate(g, rate=0.08) {
  return g.map(v => Math.max(0, Math.min(1, v + (Math.random()-0.5)*rate)));
}
function sealHash(g) {
  let h = 2166136261;
  for (let v of g.slice(0,4)) { h ^= Math.floor(v*1000); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

class Agent {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = (Math.random()-0.5)*0.5;
    this.vy = (Math.random()-0.5)*0.5;
    this.genome = randomGenome();
    this.seal = sealHash(this.genome);
    this.r = 12 + this.genome[3]*16;
    this.hue = this.genome[2]*360;
    this.transfers = 0;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.x < this.r || this.x > W-this.r) this.vx *= -1;
    if (this.y < this.r || this.y > H-this.r) this.vy *= -1;
    this.x = Math.max(this.r, Math.min(W-this.r, this.x));
    this.y = Math.max(this.r, Math.min(H-this.r, this.y));
  }
  draw() {
    ctx.beginPath();
    ctx.fillStyle = `hsl(${this.hue},80%,55%)`;
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui';
    ctx.fillText(this.transfers, this.x-4, this.y+3);
  }
  applyGenome() {
    this.r = 10 + this.genome[3]*20;
    this.hue = this.genome[2]*360;
    this.seal = sealHash(this.genome);
  }
}

class Tendril {
  constructor() {
    this.points = [];
    this.len = 18;
    this.rest = 14;
    this.stiffness = 0.8;
    for (let i=0; i<this.len; i++) {
      this.points.push({x: W/2, y: H/2 + i*this.rest, ox: W/2, oy: H/2 + i*this.rest});
    }
  }
  setRoot(x, y) {
    const p = this.points[0];
    p.ox = p.x; p.oy = p.y;
    p.x = x; p.y = y;
  }
  integrate() {
    for (let i=1; i<this.points.length; i++) {
      const p = this.points[i];
      const vx = (p.x - p.ox)*0.98;
      const vy = (p.y - p.oy)*0.98;
      p.ox = p.x; p.oy = p.y;
      p.x += vx; p.y += vy;
    }
    for (let k=0; k<4; k++) {
      for (let i=0; i<this.points.length-1; i++) {
        const a = this.points[i], b = this.points[i+1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const diff = (dist - this.rest) / dist * 0.5;
        if (i > 0) { a.x += dx*diff; a.y += dy*diff; }
        b.x -= dx*diff; b.y -= dy*diff;
      }
    }
  }
  tip() { return this.points[this.points.length-1]; }
  draw() {
    ctx.beginPath();
    ctx.strokeStyle = '#6af';
    ctx.lineWidth = 3;
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let p of this.points) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    const tip = this.tip();
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(tip.x, tip.y, 6, 0, Math.PI*2);
    ctx.fill();
  }
}

let agents = [];
let tendril = new Tendril();
let mouse = {x: W/2, y: H/2, down: false};
let db = null;
let totalTransfers = 0;

function initAgents() {
  agents = [];
  for (let i=0; i<6; i++) {
    agents.push(new Agent(100 + Math.random()*(W-200), 100 + Math.random()*(H-200)));
  }
}
initAgents();

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f538-tendril-genomes', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath: 'id'});
    r.onsuccess = e => res(e.target.result);
    r.onerror = rej;
  });
}
async function loadGenomes() {
  try {
    db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('field');
    req.onsuccess = () => {
      if (req.result && req.result.agents) {
        agents = req.result.agents.map(a => {
          const ag = new Agent(a.x, a.y);
          ag.genome = a.genome;
          ag.transfers = a.transfers || 0;
          ag.applyGenome();
          return ag;
        });
        status.textContent = 'Loaded sealed field from IndexedDB';
      }
    };
  } catch(e) { console.warn(e); }
}
loadGenomes();

async function sealField() {
  if (!db) db = await openDB();
  const data = {
    id: 'field',
    agents: agents.map(a => ({x:a.x, y:a.y, genome:a.genome, transfers:a.transfers})),
    fitness: totalTransfers,
    ts: Date.now()
  };
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(data);
  status.textContent = `Sealed field (${totalTransfers} transfers)`;
}

function checkContacts() {
  const tip = tendril.tip();
  for (let a of agents) {
    const d = Math.hypot(tip.x - a.x, tip.y - a.y);
    if (d < a.r + 10) {
      // Sealed transfer: verify hash then mutate and adopt
      if (sealHash(a.genome) === a.seal) {
        const newG = mutate(a.genome, 0.12);
        a.genome = newG;
        a.applyGenome();
        a.transfers++;
        totalTransfers++;
        // Flash
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r+8, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function loop() {
  ctx.fillStyle = 'rgba(5,5,16,0.25)';
  ctx.fillRect(0,0,W,H);
  tendril.setRoot(mouse.x, mouse.y);
  tendril.integrate();
  for (let a of agents) a.update();
  checkContacts();
  tendril.draw();
  for (let a of agents) a.draw();
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('pointerdown', e => { mouse.down = true; });
canvas.addEventListener('pointerup', e => { mouse.down = false; });

document.getElementById('seal').onclick = sealField;
document.getElementById('reset').onclick = () => { initAgents(); totalTransfers = 0; status.textContent = 'Agents reset'; };

document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { status.textContent = 'WebXR not available - using pointer'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent = 'XR session started (hand tracking optional)';
    // Minimal XR stub: in full build, bind hand joints to tendril root
    session.end();
  } catch(e) {
    status.textContent = 'XR unavailable or denied - pointer mode active';
  }
};
