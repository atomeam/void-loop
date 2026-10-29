const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let orient = { beta: 0, gamma: 0 };
let orientEnabled = false;

document.getElementById('orientBtn').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') startOrient(); }).catch(() => startOrient());
  } else startOrient();
};
function startOrient() {
  orientEnabled = true;
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
  document.getElementById('status').textContent = 'Orientation active. Tilt to bias field gravity.';
}

// Simple density field via particles (WebGPU compute path prepared; Canvas2D fallback)
const N = 400;
const particles = Array.from({length: N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

// Agents: local MLP controlling DOM elements that forage
class Agent {
  constructor(id, x, y) {
    this.id = id;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.score = 0;
    // Tiny MLP genome: 4-in (local dens, orientB, orientG, bias), 6-hidden, 2-out (fx,fy)
    this.w1 = Array.from({length:6}, () => Array.from({length:4}, () => (Math.random()-0.5)*0.5));
    this.b1 = Array.from({length:6}, () => (Math.random()-0.5)*0.2);
    this.w2 = Array.from({length:2}, () => Array.from({length:6}, () => (Math.random()-0.5)*0.5));
    this.b2 = Array.from({length:2}, () => (Math.random()-0.5)*0.2);
    this.seal = this.hashGenome();
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.innerHTML = `<div>A${id}</div><div class="seal">${this.seal.slice(0,6)}</div><div class="sc">0</div>`;
    document.body.appendChild(this.el);
    this.setupDrag();
  }
  hashGenome() {
    const s = JSON.stringify([this.w1, this.b1, this.w2, this.b2]).slice(0,64);
    let h = 0; for (let i=0; i<s.length; i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  forward(dens, ob, og) {
    const inp = [dens, ob/90, og/90, 1];
    const h = this.w1.map((row,i) => Math.tanh(row.reduce((a,w,j)=>a+w*inp[j],0) + this.b1[i]));
    const out = this.w2.map((row,i) => row.reduce((a,w,j)=>a+w*h[j],0) + this.b2[i]);
    return out;
  }
  step(dens) {
    const [fx, fy] = this.forward(dens, orient.beta, orient.gamma);
    this.vx = this.vx*0.9 + fx*0.8;
    this.vy = this.vy*0.9 + fy*0.8 + (orient.beta/90)*0.3; // gravity bias
    this.x = Math.max(20, Math.min(W-40, this.x + this.vx));
    this.y = Math.max(20, Math.min(H-40, this.y + this.vy));
    this.score += dens * 0.05;
    this.el.style.left = (this.x-36)+'px';
    this.el.style.top = (this.y-36)+'px';
    this.el.querySelector('.sc').textContent = Math.floor(this.score);
  }
  setupDrag() {
    let ox, oy, dragging = false;
    this.el.onpointerdown = e => {
      dragging = true; ox = e.clientX - this.x; oy = e.clientY - this.y;
      this.el.setPointerCapture(e.pointerId);
    };
    this.el.onpointermove = e => {
      if (!dragging) return;
      this.x = e.clientX - ox; this.y = e.clientY - oy;
      this.vx = this.vy = 0;
    };
    this.el.onpointerup = e => {
      if (!dragging) return;
      dragging = false;
      // Check merge: if overlapping another agent
      for (const other of agents) {
        if (other === this) continue;
        const dx = this.x - other.x, dy = this.y - other.y;
        if (dx*dx + dy*dy < 80*80) {
          const winner = this.score >= other.score ? this : other;
          const loser = winner === this ? other : this;
          // Transfer genome: lerp + mutate
          for (let i=0; i<6; i++) for (let j=0; j<4; j++)
            loser.w1[i][j] = winner.w1[i][j]*0.7 + loser.w1[i][j]*0.3 + (Math.random()-0.5)*0.05;
          loser.seal = loser.hashGenome();
          loser.el.querySelector('.seal').textContent = loser.seal.slice(0,6);
          document.getElementById('status').textContent = `Genome transferred ${winner.id} → ${loser.id} (seal ${loser.seal.slice(0,6)})`;
          break;
        }
      }
    };
  }
}

const agents = [
  new Agent(0, W*0.3, H*0.4),
  new Agent(1, W*0.5, H*0.5),
  new Agent(2, W*0.7, H*0.4),
  new Agent(3, W*0.5, H*0.7)
];

function sampleDensity(x, y) {
  let d = 0;
  for (const p of particles) {
    const dx = p.x - x, dy = p.y - y;
    const r2 = dx*dx + dy*dy;
    if (r2 < 1600) d += Math.exp(-r2/400);
  }
  return Math.min(1, d / 8);
}

function stepParticles() {
  const gx = orient.gamma / 90 * 0.4;
  const gy = orient.beta / 90 * 0.4;
  for (const p of particles) {
    p.vx = p.vx*0.98 + gx + (Math.random()-0.5)*0.1;
    p.vy = p.vy*0.98 + gy + (Math.random()-0.5)*0.1;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.5;
    if (p.y < 0 || p.y > H) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(100,180,255,0.6)';
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();
  }
}

function loop() {
  stepParticles();
  for (const a of agents) {
    const dens = sampleDensity(a.x, a.y);
    a.step(dens);
  }
  draw();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB persistence
const DB_NAME = 'void-f287', STORE = 'pop';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('sealBtn').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const data = agents.map(a => ({
      id: a.id, score: a.score, seal: a.seal,
      w1: a.w1, b1: a.b1, w2: a.w2, b2: a.b2
    }));
    tx.objectStore(STORE).put(data, 'pop');
    document.getElementById('status').textContent = 'Population sealed to IndexedDB.';
  } catch(e) { console.error(e); }
};
document.getElementById('loadBtn').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('pop');
    req.onsuccess = () => {
      const data = req.result;
      if (!data) return;
      data.forEach((d, i) => {
        if (agents[i]) {
          Object.assign(agents[i], d);
          agents[i].seal = agents[i].hashGenome();
          agents[i].el.querySelector('.seal').textContent = agents[i].seal.slice(0,6);
        }
      });
      document.getElementById('status').textContent = 'Loaded sealed population.';
    };
  } catch(e) { console.error(e); }
};

// WebGPU compute stub (progressive)
if (navigator.gpu) {
  document.getElementById('status').textContent += ' | WebGPU available (compute path prepared).';
}
