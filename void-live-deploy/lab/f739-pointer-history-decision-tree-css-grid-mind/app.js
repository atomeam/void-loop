const N_AGENTS = 3;
const N_PORTALS = 16;
const HISTORY = 16;
const history = [];
let agents = [];
let portals = [];
let bestFitness = 0;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('f739-genome') : null;

function rand(a=0,b=1){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

class DecisionTree {
  constructor() {
    // Simple 2-level threshold tree on [avgSpeed, curvature, accel]
    this.tSpeed = rand(0.5, 8);
    this.tCurve = rand(0.1, 2);
    this.tAccel = rand(0.2, 4);
    this.leaves = Array.from({length:4}, () => ({
      cols: Math.floor(rand(2,6)),
      hue: Math.floor(rand(0,360)),
      scale: rand(0.7, 1.4),
      seed: Math.floor(rand(0,1000))
    }));
  }
  predict(feat) {
    let idx = 0;
    if (feat.speed > this.tSpeed) idx += 2;
    if (feat.curve > this.tCurve) idx += 1;
    // accel influences leaf slightly via mutation later
    return this.leaves[idx % 4];
  }
  mutate(rate=0.1) {
    this.tSpeed *= 1 + (Math.random()-0.5)*rate;
    this.tCurve *= 1 + (Math.random()-0.5)*rate;
    this.tAccel *= 1 + (Math.random()-0.5)*rate;
    this.leaves.forEach(l => {
      l.cols = clamp(Math.round(l.cols + (Math.random()-0.5)*2), 2, 8);
      l.hue = (l.hue + Math.floor((Math.random()-0.5)*30) + 360) % 360;
      l.scale = clamp(l.scale + (Math.random()-0.5)*0.2, 0.5, 2);
    });
  }
  clone() {
    const t = new DecisionTree();
    t.tSpeed = this.tSpeed; t.tCurve = this.tCurve; t.tAccel = this.tAccel;
    t.leaves = this.leaves.map(l => ({...l}));
    return t;
  }
  serialize() {
    return { tSpeed: this.tSpeed, tCurve: this.tCurve, tAccel: this.tAccel, leaves: this.leaves };
  }
  static deserialize(o) {
    const t = new DecisionTree();
    Object.assign(t, o);
    return t;
  }
}

function initAgents() {
  agents = Array.from({length: N_AGENTS}, (_,i) => ({
    id: i, tree: new DecisionTree(), fitness: 0, portals: []
  }));
}

function initPortals() {
  const g = document.getElementById('grid');
  g.innerHTML = '';
  portals = [];
  for (let i = 0; i < N_PORTALS; i++) {
    const p = document.createElement('div');
    p.className = 'portal';
    p.dataset.i = i;
    p.textContent = `P${i}`;
    p.onclick = () => rewardPortal(i);
    g.appendChild(p);
    portals.push(p);
  }
  assignAgents();
}

function assignAgents() {
  portals.forEach((p, i) => {
    const a = agents[i % N_AGENTS];
    a.portals.push(p);
    p.dataset.agent = a.id;
  });
}

function computeFeatures() {
  if (history.length < 4) return { speed: 0, curve: 0, accel: 0 };
  let speed = 0, curve = 0, accel = 0;
  for (let i = 1; i < history.length; i++) {
    const dx = history[i].x - history[i-1].x;
    const dy = history[i].y - history[i-1].y;
    const v = Math.hypot(dx, dy);
    speed += v;
    if (i > 1) {
      const pdx = history[i-1].x - history[i-2].x;
      const pdy = history[i-1].y - history[i-2].y;
      const cross = dx*pdy - dy*pdx;
      const dot = dx*pdx + dy*pdy;
      curve += Math.abs(Math.atan2(cross, dot));
      accel += Math.abs(v - Math.hypot(pdx, pdy));
    }
  }
  const n = history.length - 1;
  return { speed: speed/n, curve: curve/(n-1||1), accel: accel/(n-1||1) };
}

function updateLayout(feat) {
  // Average prediction or dominant agent
  const preds = agents.map(a => a.tree.predict(feat));
  const best = agents.reduce((b, a) => a.fitness > b.fitness ? a : b, agents[0]);
  const leaf = best.tree.predict(feat);
  const cols = leaf.cols;
  document.getElementById('grid').style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  portals.forEach((p, i) => {
    const a = agents[i % N_AGENTS];
    const l = a.tree.predict(feat);
    p.style.background = `hsl(${l.hue}, 60%, 25%)`;
    p.style.transform = `scale(${l.scale})`;
    p.style.fontSize = `${10 + l.scale*4}px`;
    p.textContent = `A${a.id} · ${l.seed % 100}`;
    p.style.setProperty('--cx', `${50 + Math.sin(Date.now()/500 + i)*20}%`);
    p.style.setProperty('--cy', `${50 + Math.cos(Date.now()/700 + i)*20}%`);
  });
  // Dwell fitness
  const el = document.elementFromPoint(lastX, lastY);
  if (el && el.classList.contains('portal')) {
    const aid = +el.dataset.agent;
    agents[aid].fitness += 0.05;
  }
  agents.forEach(a => a.fitness *= 0.995);
  document.getElementById('info').textContent =
    `spd:${feat.speed.toFixed(1)} crv:${feat.curve.toFixed(2)} | fit:${agents.map(a=>a.fitness.toFixed(1)).join('/')}`;
}

let lastX = 0, lastY = 0;
document.addEventListener('pointermove', e => {
  lastX = e.clientX; lastY = e.clientY;
  history.push({x: e.clientX, y: e.clientY, t: performance.now()});
  if (history.length > HISTORY) history.shift();
});

function rewardPortal(i) {
  const aid = +portals[i].dataset.agent;
  agents[aid].fitness += 2;
  agents[aid].tree.mutate(0.05); // reinforce slightly
  portals[i].style.borderColor = '#6cf';
  setTimeout(() => portals[i].style.borderColor = '', 300);
}

function evolve() {
  const sorted = [...agents].sort((a,b) => b.fitness - a.fitness);
  if (sorted[0].fitness > sorted[1].fitness + 1) {
    // transfer to weakest
    const weak = sorted[sorted.length-1];
    weak.tree = sorted[0].tree.clone();
    weak.tree.mutate(0.15);
    weak.fitness = sorted[0].fitness * 0.7;
    if (channel) channel.postMessage({ type: 'genome', data: sorted[0].tree.serialize(), fitness: sorted[0].fitness });
  }
}

if (channel) {
  channel.onmessage = e => {
    if (e.data.type === 'genome' && e.data.fitness > bestFitness) {
      agents[0].tree = DecisionTree.deserialize(e.data.data);
      agents[0].fitness = e.data.fitness * 0.8;
      bestFitness = e.data.fitness;
    }
  };
}

async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f739-verse', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    const best = agents.reduce((b,a) => a.fitness > b.fitness ? a : b);
    tx.objectStore('genomes').put({ tree: best.tree.serialize(), fitness: best.fitness, t: Date.now() }, 'best');
    alert('Sealed best genome to IndexedDB');
  } catch(e) { console.warn(e); alert('Seal failed (IndexedDB)'); }
}

async function loadSeal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f739-verse', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        agents[0].tree = DecisionTree.deserialize(req.result.tree);
        agents[0].fitness = req.result.fitness || 1;
        bestFitness = agents[0].fitness;
      }
    };
  } catch (e) { console.debug("lab f739-pointer-history-decision-tree-css-grid-mind:", e); }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initAgents(); assignAgents(); };

function loop() {
  const feat = computeFeatures();
  updateLayout(feat);
  if (Math.random() < 0.02) evolve();
  requestAnimationFrame(loop);
}

initAgents();
initPortals();
loadSeal();
loop();
