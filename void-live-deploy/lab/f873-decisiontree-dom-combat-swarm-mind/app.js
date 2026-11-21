const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let orient = { beta: 0, gamma: 0 };
window.addEventListener('deviceorientation', e => { orient.beta = e.beta || 0; orient.gamma = e.gamma || 0; });

class DecisionTree {
  constructor() {
    this.thresh = [Math.random()*0.6-0.3, Math.random()*0.6-0.3];
    this.leaves = Array.from({length:4}, () => ({ vx: (Math.random()-0.5)*1.2, vy: (Math.random()-0.5)*1.2, agg: Math.random() }));
  }
  decide(dx, dy, ob, og) {
    const b0 = dx > this.thresh[0] ? 1 : 0;
    const b1 = dy > this.thresh[1] ? 1 : 0;
    const leaf = this.leaves[b0*2 + b1];
    const tiltx = (og || 0) * 0.01;
    const tilty = (ob || 0) * 0.01;
    return { vx: leaf.vx + tiltx * leaf.agg, vy: leaf.vy + tilty * leaf.agg, agg: leaf.agg };
  }
  clone() { const t = new DecisionTree(); t.thresh = [...this.thresh]; t.leaves = this.leaves.map(l => ({...l})); return t; }
  mutate() { if (Math.random()<0.3) this.thresh[Math.floor(Math.random()*2)] += (Math.random()-0.5)*0.2; else { const l = this.leaves[Math.floor(Math.random()*4)]; l.vx += (Math.random()-0.5)*0.3; l.vy += (Math.random()-0.5)*0.3; } }
}

const agents = [];
const N = 7;
function spawn(x, y, tree) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + agents.length;
  stage.appendChild(el);
  const a = { el, x: x || Math.random()*W, y: y || Math.random()*H, vx:0, vy:0, tree: tree || new DecisionTree(), fitness: 1, age: 0, trail: [] };
  agents.push(a);
  return a;
}
for (let i=0; i<N; i++) spawn();

let pointer = { x: W/2, y: H/2 };
stage.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

function nearestRival(a) {
  let best = null, bd = 1e9;
  for (const b of agents) if (b !== a) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function update() {
  for (const a of agents) {
    const rival = nearestRival(a);
    const dx = rival ? (rival.x - a.x)/W : 0;
    const dy = rival ? (rival.y - a.y)/H : 0;
    const act = a.tree.decide(dx, dy, orient.beta, orient.gamma);
    a.vx = act.vx * 2;
    a.vy = act.vy * 2;
    a.x += a.vx; a.y += a.vy;
    a.x = Math.max(35, Math.min(W-35, a.x));
    a.y = Math.max(35, Math.min(H-35, a.y));
    a.age++;
    a.fitness = a.age * 0.01 + (a.conquests || 0);
    a.el.style.left = (a.x - 35) + 'px';
    a.el.style.top = (a.y - 35) + 'px';
    const hue = (a.fitness * 20) % 360;
    a.el.style.background = `hsl(${hue},70%,40%)`;
    a.el.style.transform = `scale(${0.8 + Math.min(1.5, a.fitness*0.1)})`;
    a.trail.push({x:a.x, y:a.y});
    if (a.trail.length > 20) a.trail.shift();
  }
  // combat
  for (let i=0; i<agents.length; i++) for (let j=i+1; j<agents.length; j++) {
    const a = agents[i], b = agents[j];
    if (Math.hypot(a.x-b.x, a.y-b.y) < 50) {
      const winner = a.fitness > b.fitness ? a : b;
      const loser = winner === a ? b : a;
      winner.conquests = (winner.conquests || 0) + 1;
      winner.tree = loser.tree.clone();
      winner.tree.mutate();
      winner.fitness += 2;
      loser.fitness *= 0.5;
      loser.x += (Math.random()-0.5)*80;
      loser.y += (Math.random()-0.5)*80;
      winner.el.classList.add('conquest');
      setTimeout(() => winner.el.classList.remove('conquest'), 400);
      statusEl.textContent = 'conquest!';
    }
  }
  // trails
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(100,180,255,0.3)';
  for (const a of agents) {
    if (a.trail.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(a.trail[0].x, a.trail[0].y);
    for (const p of a.trail) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  requestAnimationFrame(update);
}
update();

// persistence
const DB = 'verse-f873-dt-combat';
const bc = new BroadcastChannel('f873-genome');
async function seal() {
  const best = agents.reduce((m,a) => a.fitness > m.fitness ? a : m, agents[0]);
  const data = { tree: best.tree, fitness: best.fitness, ts: Date.now() };
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(data, 'best');
    };
  } catch (e) { console.debug("lab f873-decisiontree-dom-combat-swarm-mind:", e); }
  bc.postMessage(data);
  statusEl.textContent = 'sealed ' + best.fitness.toFixed(1);
}
document.getElementById('seal').onclick = seal;
bc.onmessage = e => {
  if (e.data.fitness > (agents[0]?.fitness || 0)) {
    agents.forEach(a => { a.tree = e.data.tree; a.fitness = e.data.fitness * 0.8; });
    statusEl.textContent = 'adopted';
  }
};
document.getElementById('reset').onclick = () => location.reload();

// drag
let drag = null, off = {};
stage.addEventListener('pointerdown', e => {
  const el = e.target.closest('.agent');
  if (!el) return;
  drag = agents.find(a => a.el === el);
  off.x = e.clientX - drag.x; off.y = e.clientY - drag.y;
});
window.addEventListener('pointermove', e => { if (drag) { drag.x = e.clientX - off.x; drag.y = e.clientY - off.y; } });
window.addEventListener('pointerup', () => drag = null);

statusEl.textContent = 'running';
