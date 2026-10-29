const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const badgesEl = document.getElementById('badges');
let W, H, particles = [], agents = [], sealed = null, running = false, frame = 0;
let orient = { beta: 0, gamma: 0 };
const N = 800, AGENT_COUNT = 6;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('f220-genomes') : null;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function makeMLP(weights) {
  const [w1, b1, w2, b2] = weights;
  return function(input) {
    const h = new Array(3).fill(0);
    for (let i = 0; i < 3; i++) {
      let s = b1[i];
      for (let j = 0; j < 4; j++) s += input[j] * w1[j * 3 + i];
      h[i] = Math.tanh(s);
    }
    const o = new Array(2).fill(0);
    for (let i = 0; i < 2; i++) {
      let s = b2[i];
      for (let j = 0; j < 3; j++) s += h[j] * w2[j * 2 + i];
      o[i] = Math.tanh(s);
    }
    return o;
  };
}
function randomGenome() {
  const w1 = Array.from({length: 12}, () => (Math.random()-0.5)*0.8);
  const b1 = Array.from({length: 3}, () => (Math.random()-0.5)*0.4);
  const w2 = Array.from({length: 6}, () => (Math.random()-0.5)*0.8);
  const b2 = Array.from({length: 2}, () => (Math.random()-0.5)*0.4);
  return [w1, b1, w2, b2];
}
function mutate(g, rate=0.15) {
  return g.map(arr => arr.map(v => v + (Math.random()-0.5)*rate));
}

class Agent {
  constructor(id, genome) {
    this.id = id;
    this.genome = genome || randomGenome();
    this.mlp = makeMLP(this.genome);
    this.fitness = 0;
    this.cx = Math.random() * W;
    this.cy = Math.random() * H;
    this.color = `hsl(${id * 60}, 70%, 55%)`;
    this.badge = document.createElement('div');
    this.badge.className = 'badge';
    this.badge.style.borderColor = this.color;
    badgesEl.appendChild(this.badge);
  }
  updateBadge() {
    this.badge.style.left = this.cx + 'px';
    this.badge.style.top = this.cy + 'px';
    this.badge.innerHTML = `A${this.id} f:${this.fitness.toFixed(1)}`; // void-review: ok (constant labels and computed numbers, no visitor text)
    this.badge.classList.toggle('leader', this === agents.reduce((a,b)=>a.fitness>b.fitness?a:b, agents[0]));
  }
}

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0, vy: 0,
      agent: Math.floor(Math.random() * AGENT_COUNT)
    });
  }
}
function initAgents() {
  agents.forEach(a => a.badge.remove());
  agents = [];
  for (let i = 0; i < AGENT_COUNT; i++) agents.push(new Agent(i));
}

function step() {
  if (!running) return;
  frame++;
  const gX = orient.gamma * 0.002;
  const gY = orient.beta * 0.002;
  const h = 40;
  for (let p of particles) {
    let dens = 0, fx = gX, fy = gY;
    for (let q of particles) {
      if (q === p) continue;
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < h*h && d2 > 1) {
        const d = Math.sqrt(d2);
        dens += (h - d) / h;
        const press = 0.015 * dens;
        fx -= (dx / d) * press;
        fy -= (dy / d) * press;
      }
    }
    const ag = agents[p.agent];
    const input = [orient.beta/90, orient.gamma/90, dens/5, ag.id/AGENT_COUNT];
    const [fScale, visc] = ag.mlp(input);
    fx *= (1 + fScale * 0.6);
    fy *= (1 + fScale * 0.6);
    const damp = 0.98 + visc * 0.015;
    p.vx = (p.vx + fx) * damp;
    p.vy = (p.vy + fy) * damp;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) { p.x = 0; p.vx *= -0.5; }
    if (p.x > W) { p.x = W; p.vx *= -0.5; }
    if (p.y < 0) { p.y = 0; p.vy *= -0.5; }
    if (p.y > H) { p.y = H; p.vy *= -0.5; }
  }
  agents.forEach(a => {
    let sx=0, sy=0, c=0, varx=0, vary=0;
    for (let p of particles) if (p.agent === a.id) { sx += p.x; sy += p.y; c++; }
    if (c > 2) {
      a.cx = sx / c; a.cy = sy / c;
      for (let p of particles) if (p.agent === a.id) {
        varx += (p.x - a.cx)**2; vary += (p.y - a.cy)**2;
      }
      a.fitness = c / (1 + Math.sqrt(varx/c + vary/c)/40);
    }
    a.updateBadge();
  });
  if (frame % 480 === 0 && agents.length > 1) {
    agents.sort((a,b) => b.fitness - a.fitness);
    const weak = agents[agents.length-1];
    weak.genome = mutate(agents[0].genome);
    weak.mlp = makeMLP(weak.genome);
    statusEl.textContent = `Evolved: A${weak.id} mutated toward leader A${agents[0].id}`;
  }
  draw();
  requestAnimationFrame(step);
}
function draw() {
  ctx.fillStyle = 'rgba(10,10,15,0.25)';
  ctx.fillRect(0,0,W,H);
  for (let p of particles) {
    const a = agents[p.agent];
    ctx.fillStyle = a ? a.color : '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  }
}

async function sealLeader() {
  if (!agents.length) return;
  const leader = agents.reduce((a,b)=>a.fitness>b.fitness?a:b);
  sealed = { genome: leader.genome, fitness: leader.fitness, id: leader.id };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f220', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(sealed, 'leader');
    await new Promise(r => tx.oncomplete = r);
    if (channel) channel.postMessage({ type: 'sealed', data: sealed });
    statusEl.textContent = `Sealed A${leader.id} (f=${leader.fitness.toFixed(1)}) to IndexedDB + Broadcast`;
  } catch (e) { statusEl.textContent = 'Seal failed: ' + e.message; }
}
async function injectSealed() {
  if (!sealed) {
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('f220', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = rej;
      });
      const tx = db.transaction('genomes', 'readonly');
      const req = tx.objectStore('genomes').get('leader');
      sealed = await new Promise(r => req.onsuccess = () => r(req.result));
    } catch (e) { console.warn('f432-webgpu-mlp-sph-genome-competition:', e); }
  }
  if (sealed && agents.length) {
    const target = agents[Math.floor(Math.random()*agents.length)];
    target.genome = sealed.genome;
    target.mlp = makeMLP(target.genome);
    statusEl.textContent = `Injected sealed genome into A${target.id}`;
  }
}
if (channel) channel.onmessage = e => { if (e.data.type === 'sealed') sealed = e.data.data; };

document.getElementById('start').onclick = () => {
  initParticles();
  initAgents();
  running = true;
  frame = 0;
  statusEl.textContent = 'Running. Tilt or drag. Competition every ~8s.';
  step();
};
document.getElementById('seal').onclick = sealLeader;
document.getElementById('inject').onclick = injectSealed;

window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});
let drag = false, lastX, lastY;
canvas.onmousedown = e => { drag = true; lastX = e.clientX; lastY = e.clientY; };
window.onmouseup = () => drag = false;
window.onmousemove = e => {
  if (!drag) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  for (let p of particles) {
    const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
    if (d < 120) { p.vx += dx * 0.02; p.vy += dy * 0.02; }
  }
  lastX = e.clientX; lastY = e.clientY;
};
statusEl.textContent = 'Ready. Click Start. Works offline.';
