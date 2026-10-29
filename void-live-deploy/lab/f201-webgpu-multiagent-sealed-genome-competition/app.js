const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const logEl = document.getElementById('log');
function log(msg) { logEl.innerHTML = `<div>${new Date().toISOString().slice(11,19)} ${msg}</div>` + logEl.innerHTML; }

let W, H, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Tiny genome: 6 floats controlling speed, attraction, repulsion, noise, color bias, size
function randomGenome() {
  return Array.from({length: 6}, () => (Math.random() - 0.5) * 2);
}
function hashGenome(g) {
  // Simple FNV-like hash for sealing (demo; not crypto)
  let h = 2166136261;
  for (const v of g) {
    const n = Math.floor((v + 2) * 1000);
    h ^= n;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

class Agent {
  constructor(x, y, genome, color) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.genome = genome || randomGenome();
    this.color = color || `hsl(${Math.random()*360},70%,60%)`;
    this.score = 0;
    this.id = Math.random().toString(36).slice(2, 6);
    this.sealed = null;
  }
  step(resources, tiltX, tiltY) {
    const [spd, attr, rep, noise, cBias, size] = this.genome;
    let fx = tiltX * 0.3, fy = tiltY * 0.3;
    // Attract to nearest resource
    let best = null, bestD = Infinity;
    for (const r of resources) {
      const dx = r.x - this.x, dy = r.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best && bestD < 180) {
      fx += (best.x - this.x) / bestD * attr * 0.4;
      fy += (best.y - this.y) / bestD * attr * 0.4;
    }
    // Repel from other agents (simple)
    fx += (Math.random() - 0.5) * noise * 2;
    fy += (Math.random() - 0.5) * noise * 2;
    this.vx = this.vx * 0.92 + fx * Math.abs(spd);
    this.vy = this.vy * 0.92 + fy * Math.abs(spd);
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 3.5) { this.vx *= 3.5 / speed; this.vy *= 3.5 / speed; }
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W) this.vx *= -0.8;
    if (this.y < 0 || this.y > H) this.vy *= -0.8;
    this.x = Math.max(0, Math.min(W, this.x));
    this.y = Math.max(0, Math.min(H, this.y));
  }
  draw() {
    const size = 4 + Math.abs(this.genome[5]) * 3;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.fill();
    if (this.sealed) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

class Resource {
  constructor(x, y) { this.x = x; this.y = y; this.life = 1; }
  draw() {
    ctx.fillStyle = `rgba(255,200,80,${this.life})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

let agents = [];
let resources = [];
let running = false;
let gen = 0;
let tiltX = 0, tiltY = 0;
let tiltEnabled = false;
let lastWinner = null;
let sealedStore = []; // local cache of sealed genomes

const DB_NAME = 'f201-genomes';
const STORE = 'sealed';
let db = null;

async function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'hash' });
    };
    req.onsuccess = () => { db = req.result; document.getElementById('dbstatus').textContent = 'IDB: ready'; resolve(db); };
    req.onerror = () => { document.getElementById('dbstatus').textContent = 'IDB: fail'; resolve(null); };
  });
}
openDB();

async function saveSealed(hash, genome, score) {
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({ hash, genome, score, t: Date.now() });
  sealedStore.push({ hash, genome, score });
  log(`Sealed genome ${hash} (score ${score})`);
}
async function loadSealed() {
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => { sealedStore = req.result || []; resolve(sealedStore); };
  });
}

function spawnAgents(n = 12) {
  agents = [];
  for (let i = 0; i < n; i++) {
    agents.push(new Agent(Math.random()*W, Math.random()*H));
  }
}
function spawnResources(n = 8) {
  resources = [];
  for (let i = 0; i < n; i++) {
    resources.push(new Resource(Math.random()*W, Math.random()*H));
  }
}

canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  resources.push(new Resource(x, y));
  log(`Resource placed at ${x.toFixed(0)},${y.toFixed(0)}`);
});

document.getElementById('start').onclick = () => {
  spawnAgents(16);
  spawnResources(12);
  gen++;
  running = true;
  lastWinner = null;
  log(`Generation ${gen} started · ${agents.length} agents`);
  document.getElementById('gen').textContent = gen;
};
document.getElementById('pause').onclick = () => { running = !running; };
document.getElementById('tilt').onchange = (e) => {
  tiltEnabled = e.target.checked;
  if (tiltEnabled && window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', onOrient);
    log('Tilt enabled (grant permission if prompted)');
  } else {
    window.removeEventListener('deviceorientation', onOrient);
    tiltX = tiltY = 0;
  }
};
function onOrient(ev) {
  if (!tiltEnabled) return;
  tiltX = (ev.gamma || 0) / 45; // -1..1 approx
  tiltY = (ev.beta || 0) / 45;
}

document.getElementById('seal').onclick = async () => {
  if (!agents.length) return;
  const winner = agents.reduce((a, b) => a.score > b.score ? a : b);
  const h = hashGenome(winner.genome);
  winner.sealed = h;
  lastWinner = winner;
  await saveSealed(h, winner.genome.slice(), winner.score);
  document.getElementById('winner').textContent = `${winner.id} (${winner.score}) · ${h}`;
  log(`Sealed winner ${winner.id} → ${h}`);
};
document.getElementById('inject').onclick = async () => {
  await loadSealed();
  if (!sealedStore.length) { log('No sealed genomes in IDB'); return; }
  const pick = sealedStore[Math.floor(Math.random() * sealedStore.length)];
  // Inject into a random living agent (or spawn new)
  if (agents.length) {
    const target = agents[Math.floor(Math.random() * agents.length)];
    target.genome = pick.genome.slice();
    target.color = '#fff';
    target.sealed = pick.hash;
    log(`Injected sealed ${pick.hash} into ${target.id}`);
  } else {
    agents.push(new Agent(W/2, H/2, pick.genome, '#fff'));
    agents[agents.length-1].sealed = pick.hash;
    log(`Spawned agent from sealed ${pick.hash}`);
  }
};

function collideAndScore() {
  for (let i = resources.length - 1; i >= 0; i--) {
    const r = resources[i];
    for (const a of agents) {
      if (Math.hypot(a.x - r.x, a.y - r.y) < 12) {
        a.score++;
        resources.splice(i, 1);
        // occasional new resource
        if (Math.random() < 0.6) resources.push(new Resource(Math.random()*W, Math.random()*H));
        break;
      }
    }
  }
  // Mild competition: high scorers get slight speed boost via genome mutation chance
  if (Math.random() < 0.002 && agents.length > 1) {
    const sorted = [...agents].sort((a,b) => b.score - a.score);
    const best = sorted[0];
    const worst = sorted[sorted.length-1];
    if (best.score > worst.score + 3) {
      // Transfer a gene fragment (sealed transfer simulation)
      const gi = Math.floor(Math.random()*6);
      worst.genome[gi] = best.genome[gi];
      worst.color = best.color;
    }
  }
}

function frame() {
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, 0, W, H);
  if (running) {
    for (const a of agents) a.step(resources, tiltX, tiltY);
    collideAndScore();
  }
  for (const r of resources) r.draw();
  for (const a of agents) a.draw();
  document.getElementById('nAgents').textContent = agents.length;
  document.getElementById('nRes').textContent = resources.length;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Initial
spawnAgents(10);
spawnResources(6);
log('F201 ready · click canvas to place resources · Seal/Inject uses IndexedDB');
document.getElementById('nAgents').textContent = agents.length;
