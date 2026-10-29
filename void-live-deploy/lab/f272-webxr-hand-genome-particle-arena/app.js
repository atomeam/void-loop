const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const cardsEl = document.getElementById('cards');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const N = 180;
const particles = [];
const resources = [];
const agents = [];
const AGENT_COUNT = 6;
let gravity = {x: 0, y: 0.02};
let pointer = {x: W/2, y: H/2, down: false};
let bestFitness = 0;
let xrSession = null;
let handPos = null;

function createMLP() {
  return {
    w1: Array.from({length: 8}, () => Math.random()*2-1),
    b1: Array.from({length: 2}, () => Math.random()*0.2-0.1),
    w2: Array.from({length: 4}, () => Math.random()*2-1),
    b2: Array.from({length: 2}, () => Math.random()*0.2-0.1),
    fitness: 0,
    captures: 0
  };
}
function mlpForward(mlp, input) {
  const h = [0,0];
  for (let i=0;i<2;i++) {
    h[i] = mlp.b1[i];
    for (let j=0;j<4;j++) h[i] += input[j] * mlp.w1[i*4 + j];
    h[i] = Math.tanh(h[i]);
  }
  const out = [0,0];
  for (let i=0;i<2;i++) {
    out[i] = mlp.b2[i];
    for (let j=0;j<2;j++) out[i] += h[j] * mlp.w2[i*2 + j];
    out[i] = Math.tanh(out[i]) * 0.15;
  }
  return out;
}
function mutate(mlp, rate=0.15) {
  const m = {...mlp, w1:[...mlp.w1], b1:[...mlp.b1], w2:[...mlp.w2], b2:[...mlp.b2]};
  for (let k of ['w1','w2','b1','b2']) for (let i=0;i<m[k].length;i++) if (Math.random()<rate) m[k][i] += (Math.random()-0.5)*0.4;
  m.fitness = 0; m.captures = 0;
  return m;
}

for (let i=0;i<N;i++) {
  particles.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    agent: i % AGENT_COUNT,
    isRes: false
  });
}
for (let i=0;i<24;i++) {
  resources.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0, life: 200 + Math.random()*100
  });
}
for (let i=0;i<AGENT_COUNT;i++) agents.push(createMLP());

const agentCards = [];
for (let i=0;i<AGENT_COUNT;i++) {
  const d = document.createElement('div');
  d.className = 'agent-card';
  d.innerHTML = `A${i}<br>fit:0`;
  cardsEl.appendChild(d);
  agentCards.push(d);
}

function step() {
  for (let p of particles) {
    p.vx += gravity.x; p.vy += gravity.y;
    const a = agents[p.agent];
    let bestD = 1e9, rdx=0, rdy=0;
    for (let r of resources) {
      const dx = r.x - p.x, dy = r.y - p.y;
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; rdx = dx; rdy = dy; }
    }
    const dens = particles.filter(q => (q.x-p.x)**2 + (q.y-p.y)**2 < 2500).length / 20;
    const input = [rdx/W, rdy/H, dens, Math.sqrt(bestD)/Math.max(W,H)];
    const f = mlpForward(a, input);
    p.vx += f[0]; p.vy += f[1];
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
    if (bestD < 400) {
      a.captures++;
      a.fitness += 1;
      const idx = resources.findIndex(r => (r.x-p.x)**2+(r.y-p.y)**2 < 400);
      if (idx >= 0) resources.splice(idx, 1);
      if (Math.random() < 0.7) resources.push({x: Math.random()*W, y: Math.random()*H, life: 300});
    }
  }
  if (Math.random() < 0.008) {
    agents.sort((a,b) => b.fitness - a.fitness);
    if (agents[0].fitness > bestFitness) bestFitness = agents[0].fitness;
    for (let i=3;i<AGENT_COUNT;i++) agents[i] = mutate(agents[Math.floor(Math.random()*3)]);
    agents.forEach(a => a.fitness *= 0.95);
  }
  agents.forEach((a,i) => {
    agentCards[i].innerHTML = `A${i}<br>fit:${a.fitness.toFixed(0)}`;
    agentCards[i].style.left = (80 + i*140) + 'px';
    agentCards[i].style.top = (H - 80) + 'px';
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#ffaa33';
  for (let r of resources) {
    ctx.beginPath(); ctx.arc(r.x, r.y, 6, 0, Math.PI*2); ctx.fill();
  }
  const cols = ['#4af','#f4a','#4fa','#fa4','#a4f','#ff4'];
  for (let p of particles) {
    ctx.fillStyle = cols[p.agent];
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
  }
  if (handPos) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(handPos.x, handPos.y, 20, 0, Math.PI*2); ctx.stroke();
  } else if (pointer.down) {
    ctx.strokeStyle = '#aaa';
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 15, 0, Math.PI*2); ctx.stroke();
  }
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointerdown', e => { pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('pointermove', e => {
  if (pointer.down) {
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    pointer.x = e.clientX; pointer.y = e.clientY;
    for (let p of particles) {
      const d2 = (p.x - pointer.x)**2 + (p.y - pointer.y)**2;
      if (d2 < 6400) {
        p.vx += dx * 0.05; p.vy += dy * 0.05;
      }
    }
  }
});
canvas.addEventListener('pointerup', () => pointer.down = false);

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.gamma != null) {
      gravity.x = (e.gamma || 0) * 0.001;
      gravity.y = (e.beta || 0) * 0.001;
    }
  });
}

document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { statusEl.textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['hand-tracking'] });
    statusEl.textContent = 'XR active. Use hand to steer.';
    xrSession.addEventListener('end', () => { xrSession = null; statusEl.textContent = 'XR ended'; });
  } catch (err) {
    statusEl.textContent = 'XR failed: ' + err.message + ' (pointer fallback)';
  }
};

const DB_NAME = 'f272-genomes';
let db;
const openDB = () => new Promise(res => {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath: 'id'});
  r.onsuccess = e => res(e.target.result);
  r.onerror = () => res(null);
});
document.getElementById('sealBtn').onclick = async () => {
  db = db || await openDB();
  if (!db) { statusEl.textContent = 'IDB blocked'; return; }
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({id: 'best', weights: best, ts: Date.now(), fitness: best.fitness});
  statusEl.textContent = `Sealed genome fit=${best.fitness.toFixed(0)}`;
};
document.getElementById('loadBtn').onclick = async () => {
  db = db || await openDB();
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const req = tx.objectStore('genomes').get('best');
  req.onsuccess = () => {
    if (req.result) {
      const g = req.result.weights;
      agents[0] = {...g, w1:[...g.w1], b1:[...g.b1], w2:[...g.w2], b2:[...g.b2]};
      statusEl.textContent = 'Loaded sealed genome into agent 0';
    }
  };
};

document.addEventListener('keydown', async e => {
  if (e.key === 'c' && e.ctrlKey) {
    const best = agents[0];
    await navigator.clipboard.writeText(JSON.stringify({type:'f272-genome', weights: best}));
    statusEl.textContent = 'Genome copied to clipboard';
  }
});
