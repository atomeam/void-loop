const arena = document.getElementById('arena');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let agents = [];
const NUM_AGENTS = 3;
const CARDS_PER = 4;
const RES_SIZE = 16;
const dbName = 'verse-f814-reservoir';
let sharedGenomes = [];
const bc = new BroadcastChannel('f814-genome');

function resize() {
  canvas.width = arena.clientWidth;
  canvas.height = arena.clientHeight;
}
resize();
window.addEventListener('resize', resize);

class Reservoir {
  constructor() {
    this.W = new Float32Array(RES_SIZE * RES_SIZE);
    this.Win = new Float32Array(RES_SIZE * 4);
    this.state = new Float32Array(RES_SIZE);
    for (let i = 0; i < this.W.length; i++) this.W[i] = (Math.random() - 0.5) * 0.4;
    for (let i = 0; i < this.Win.length; i++) this.Win[i] = (Math.random() - 0.5) * 0.8;
  }
  step(input) {
    const next = new Float32Array(RES_SIZE);
    for (let i = 0; i < RES_SIZE; i++) {
      let s = 0;
      for (let j = 0; j < RES_SIZE; j++) s += this.W[i * RES_SIZE + j] * this.state[j];
      for (let k = 0; k < 4; k++) s += this.Win[i * 4 + k] * (input[k] || 0);
      next[i] = Math.tanh(s);
    }
    this.state.set(next);
    return this.state[0];
  }
  serialize() { return { W: Array.from(this.W), Win: Array.from(this.Win) }; }
  load(data) {
    this.W.set(data.W);
    this.Win.set(data.Win);
  }
}

class Agent {
  constructor(id, x, y) {
    this.id = id;
    this.res = new Reservoir();
    this.cards = [];
    this.cx = x; this.cy = y;
    this.vx = 0; this.vy = 0;
    for (let i = 0; i < CARDS_PER; i++) {
      const c = document.createElement('div');
      c.className = `card agent${id}`;
      c.textContent = `A${id}-${i}`;
      c.style.left = (x + (i % 2) * 40 - 20) + 'px';
      c.style.top = (y + Math.floor(i / 2) * 30 - 15) + 'px';
      arena.appendChild(c);
      this.cards.push({ el: c, lx: (i % 2) * 40 - 20, ly: Math.floor(i / 2) * 30 - 15, vx: 0, vy: 0 });
    }
  }
  update(dt, hand) {
    const input = [this.cx / canvas.width - 0.5, this.cy / canvas.height - 0.5, hand.fx, hand.fy];
    const force = this.res.step(input) * 2;
    for (let i = 0; i < this.cards.length; i++) {
      for (let j = i + 1; j < this.cards.length; j++) {
        const a = this.cards[i], b = this.cards[j];
        const dx = (parseFloat(b.el.style.left) - parseFloat(a.el.style.left));
        const dy = (parseFloat(b.el.style.top) - parseFloat(a.el.style.top));
        const dist = Math.hypot(dx, dy) || 1;
        const rest = 50;
        const spring = (dist - rest) * 0.02;
        a.vx += spring * dx / dist;
        a.vy += spring * dy / dist;
        b.vx -= spring * dx / dist;
        b.vy -= spring * dy / dist;
      }
    }
    this.vx += (hand.x - this.cx) * 0.001 * force + hand.fx * 0.5;
    this.vy += (hand.y - this.cy) * 0.001 * force + hand.fy * 0.5;
    this.vx *= 0.95; this.vy *= 0.95;
    this.cx += this.vx * dt;
    this.cy += this.vy * dt;
    this.cards.forEach(c => {
      c.vx *= 0.9; c.vy *= 0.9;
      let lx = parseFloat(c.el.style.left) + c.vx * dt;
      let ly = parseFloat(c.el.style.top) + c.vy * dt;
      const dx = lx - this.cx, dy = ly - this.cy;
      const d = Math.hypot(dx, dy);
      if (d > 80) { lx = this.cx + dx / d * 80; ly = this.cy + dy / d * 80; }
      c.el.style.left = lx + 'px';
      c.el.style.top = ly + 'px';
    });
  }
  collide(other) {
    const dx = this.cx - other.cx, dy = this.cy - other.cy;
    const d = Math.hypot(dx, dy);
    if (d < 100 && Math.random() < 0.05) {
      const transfer = this.res.serialize();
      other.res.load(transfer);
      bc.postMessage({ type: 'transfer', from: this.id, to: other.id, genome: transfer });
      status.textContent = `Genome transfer A${this.id} → A${other.id}`;
    }
  }
}

function initAgents() {
  agents.forEach(a => a.cards.forEach(c => c.el.remove()));
  agents = [];
  for (let i = 0; i < NUM_AGENTS; i++) {
    agents.push(new Agent(i, 200 + i * 250, 300));
  }
}
initAgents();

let hand = { x: 400, y: 300, fx: 0, fy: 0 };
let pointerDown = false;
arena.addEventListener('pointermove', e => {
  hand.x = e.clientX; hand.y = e.clientY;
  if (pointerDown) { hand.fx = e.movementX * 0.1; hand.fy = e.movementY * 0.1; }
});
arena.addEventListener('pointerdown', () => pointerDown = true);
arena.addEventListener('pointerup', () => { pointerDown = false; hand.fx = hand.fy = 0; });

window.addEventListener('deviceorientation', e => {
  if (e.gamma) hand.fx += e.gamma * 0.001;
  if (e.beta) hand.fy += e.beta * 0.001;
});

let xrSession = null;
async function tryXR() {
  if (!navigator.xr) return;
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    status.textContent = 'WebXR active';
  } catch (e) { console.debug("lab f814-webxr-hand-reservoir-softbody-dom-mind:", e); }
}
document.getElementById('ui').addEventListener('click', tryXR, { once: true });

function loop(t) {
  const dt = 16;
  agents.forEach(a => a.update(dt, hand));
  for (let i = 0; i < agents.length; i++)
    for (let j = i + 1; j < agents.length; j++) agents[i].collide(agents[j]);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(100,150,255,0.3)';
  agents.forEach(a => {
    a.cards.forEach((c, i) => {
      if (i === 0) return;
      const x1 = parseFloat(c.el.style.left) + 40;
      const y1 = parseFloat(c.el.style.top) + 30;
      const x2 = parseFloat(a.cards[0].el.style.left) + 40;
      const y2 = parseFloat(a.cards[0].el.style.top) + 30;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
  });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('genomes', 'readwrite');
  agents.forEach((a, i) => tx.objectStore('genomes').put(a.res.serialize(), i));
  status.textContent = 'Genome sealed to IndexedDB';
  bc.postMessage({ type: 'seal', genomes: agents.map(a => a.res.serialize()) });
};
document.getElementById('reset').onclick = initAgents;

bc.onmessage = e => {
  if (e.data.type === 'transfer' && e.data.to < agents.length) {
    agents[e.data.to].res.load(e.data.genome);
  }
};

(async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').getAll();
    req.onsuccess = () => {
      if (req.result.length) {
        req.result.forEach((g, i) => { if (agents[i]) agents[i].res.load(g); });
        status.textContent = 'Restored sealed genomes';
      }
    };
  } catch (e) { console.debug("lab f814-webxr-hand-reservoir-softbody-dom-mind:", e); }
})();
