const arena = document.getElementById('arena');
const nEl = document.getElementById('n');
const txEl = document.getElementById('tx');
const tiltEl = document.getElementById('tilt');
let agents = [];
let transfers = 0;
let orient = { beta: 0, gamma: 0 };
let permGranted = false;

// Tiny Elman-style RNN per agent (or shared). State + weights sealed.
class TinyRNN {
  constructor() {
    this.h = new Float32Array(4); // hidden
    this.Wh = [0.3, -0.2, 0.1, 0.4, -0.1, 0.2, 0.3, -0.3]; // simplified 2->4, 4->4
    this.Wo = [0.5, -0.4, 0.3, 0.2]; // 4->2 outputs (fx, fy bias)
    this.b = [0.0, 0.0];
  }
  step(x, y) { // inputs: normalized beta/gamma
    const nh = new Float32Array(4);
    // simple recurrent
    for (let i = 0; i < 4; i++) {
      nh[i] = Math.tanh(this.Wh[i]*x + this.Wh[i+4]*y + 0.4*this.h[i]);
    }
    this.h.set(nh);
    const fx = Math.tanh(this.Wo[0]*nh[0] + this.Wo[1]*nh[1] + this.b[0]);
    const fy = Math.tanh(this.Wo[2]*nh[2] + this.Wo[3]*nh[3] + this.b[1]);
    return [fx * 0.8, fy * 0.8];
  }
  seal() { return { h: Array.from(this.h), Wh: this.Wh.slice(), Wo: this.Wo.slice(), b: this.b.slice() }; }
  load(s) { this.h.set(s.h); this.Wh = s.Wh; this.Wo = s.Wo; this.b = s.b; }
  mutate() { // for competition
    this.Wo = this.Wo.map(w => w + (Math.random()-0.5)*0.1);
  }
}

function createAgent(x, y) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + agents.length;
  arena.appendChild(el);
  const rnn = new TinyRNN();
  return { el, x, y, vx:0, vy:0, rnn, id: agents.length, energy: 1 };
}

function addAgent() {
  const a = createAgent(100 + Math.random()* (window.innerWidth-200), 100 + Math.random()*(window.innerHeight-200));
  agents.push(a);
  nEl.textContent = agents.length;
}

async function requestOrient() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') permGranted = true;
    } catch(e) {}
  } else permGranted = true;
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      orient.beta = e.beta;
      orient.gamma = e.gamma;
      tiltEl.textContent = `${e.beta.toFixed(0)}° / ${e.gamma.toFixed(0)}°`;
    }
  });
}

document.getElementById('perm').onclick = requestOrient;
document.getElementById('add').onclick = addAgent;
document.getElementById('reset').onclick = () => { agents.forEach(a => a.el.remove()); agents = []; transfers=0; txEl.textContent=0; nEl.textContent=0; };

// Simple physics + collisions
function step() {
  const W = window.innerWidth, H = window.innerHeight;
  const gx = Math.max(-1, Math.min(1, (orient.gamma || 0)/40));
  const gy = Math.max(-1, Math.min(1, (orient.beta || 0)/40));
  for (const a of agents) {
    const [fx, fy] = a.rnn.step(gx, gy);
    a.vx += fx * 0.4 + gx * 0.15;
    a.vy += fy * 0.4 + gy * 0.15;
    a.vx *= 0.92; a.vy *= 0.92; // friction
    a.x += a.vx; a.y += a.vy;
    // walls
    if (a.x < 10) { a.x = 10; a.vx *= -0.6; }
    if (a.x > W-82) { a.x = W-82; a.vx *= -0.6; }
    if (a.y < 50) { a.y = 50; a.vy *= -0.6; }
    if (a.y > H-58) { a.y = H-58; a.vy *= -0.6; }
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
  }
  // collisions + genome transfer
  for (let i = 0; i < agents.length; i++) {
    for (let j = i+1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 70 && d > 0) {
        const nx = dx/d, ny = dy/d;
        const overlap = 70 - d;
        a.x -= nx * overlap * 0.5; b.x += nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5; b.y += ny * overlap * 0.5;
        // bounce
        const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
        const dot = dvx*nx + dvy*ny;
        if (dot < 0) {
          a.vx += dot * nx * 0.8; b.vx -= dot * nx * 0.8;
          a.vy += dot * ny * 0.8; b.vy -= dot * ny * 0.8;
        }
        // sealed genome transfer: winner (higher energy or random) mutates loser slightly
        if (Math.random() < 0.15) {
          const winner = a.energy > b.energy ? a : b;
          const loser = winner === a ? b : a;
          loser.rnn.load(winner.rnn.seal());
          loser.rnn.mutate();
          winner.energy = Math.min(2, winner.energy + 0.1);
          loser.energy *= 0.9;
          transfers++;
          txEl.textContent = transfers;
          winner.el.classList.add('winner');
          setTimeout(() => winner.el.classList.remove('winner'), 400);
        }
      }
    }
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Persist last state to IndexedDB
const DB = 'f279-arena';
function save() {
  const data = agents.map(a => ({ x:a.x, y:a.y, seal: a.rnn.seal() }));
  localStorage.setItem(DB, JSON.stringify({ agents: data, transfers }));
}
function load() {
  try {
    const raw = localStorage.getItem(DB);
    if (!raw) return;
    const s = JSON.parse(raw);
    transfers = s.transfers || 0; txEl.textContent = transfers;
    s.agents.forEach(ad => {
      const a = createAgent(ad.x, ad.y);
      a.rnn.load(ad.seal);
      agents.push(a);
    });
    nEl.textContent = agents.length;
  } catch(e) {}
}
setInterval(save, 4000);
load();
// start with a few
if (agents.length === 0) { for(let i=0;i<4;i++) addAgent(); }
