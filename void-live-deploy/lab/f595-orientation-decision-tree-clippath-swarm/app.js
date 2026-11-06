const N = 9;
const portals = [];
let orientation = { alpha:0, beta:0, gamma:0 };
let pointer = { x:0, y:0 };
let db;
const channel = new BroadcastChannel('f595-genome');
let bestFitness = -Infinity;
let bestTree = null;

function randomTree() {
  const rules = [];
  for (let i = 0; i < 6; i++) {
    rules.push({
      binA: Math.random() * 360,
      binB: Math.random() * 180 - 90,
      binG: Math.random() * 180 - 90,
      dA: (Math.random()-0.5)*40,
      dB: (Math.random()-0.5)*40,
      dG: (Math.random()-0.5)*40,
      hue: Math.random()*360,
      scale: 0.8 + Math.random()*0.6
    });
  }
  return rules;
}

function evalTree(tree, ori) {
  let best = tree[0];
  let bestDist = Infinity;
  for (const r of tree) {
    const da = Math.abs(((ori.alpha - r.binA + 180) % 360) - 180);
    const db = Math.abs(ori.beta - r.binB);
    const dg = Math.abs(ori.gamma - r.binG);
    const dist = da + db + dg;
    if (dist < bestDist) { bestDist = dist; best = r; }
  }
  return best;
}

function createPortal(i) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `A${i}`;
  el.dataset.i = i;
  document.body.appendChild(el);
  const p = {
    el,
    x: 100 + Math.random()*(window.innerWidth-200),
    y: 100 + Math.random()*(window.innerHeight-200),
    vx: 0, vy: 0,
    tree: randomTree(),
    fitness: 0,
    hue: 180
  };
  el.addEventListener('click', () => {
    p.fitness += 1;
    el.style.transform = 'scale(1.15)';
    setTimeout(() => el.style.transform = '', 200);
    updateStatus();
  });
  portals.push(p);
  return p;
}

for (let i = 0; i < N; i++) createPortal(i);

function updateStatus() {
  const maxF = Math.max(...portals.map(p => p.fitness));
  document.getElementById('status').textContent =
    `portals:${N} maxFit:${maxF.toFixed(1)} ori:${orientation.beta.toFixed(0)},${orientation.gamma.toFixed(0)}`;
}

function step() {
  const ori = pointerMode ? { alpha: pointer.x/10, beta: (pointer.y/window.innerHeight-0.5)*180, gamma: (pointer.x/window.innerWidth-0.5)*180 } : orientation;
  for (const p of portals) {
    const r = evalTree(p.tree, ori);
    p.hue = r.hue;
    // soft repulsion
    for (const q of portals) {
      if (p === q) continue;
      const dx = p.x - q.x, dy = p.y - q.y;
      const d2 = dx*dx + dy*dy + 100;
      const f = 800 / d2;
      p.vx += dx * f * 0.01;
      p.vy += dy * f * 0.01;
    }
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(60, Math.min(window.innerWidth-60, p.x));
    p.y = Math.max(60, Math.min(window.innerHeight-60, p.y));
    // clip-path from tree deltas
    const a = 50 + r.dA, b = 50 + r.dB, c = 50 + r.dG;
    const clip = `polygon(${a}% 10%, ${100-b}% 20%, 90% ${c}%, 80% 90%, 20% 80%, 10% ${100-a}%)`;
    p.el.style.left = (p.x-60)+'px';
    p.el.style.top = (p.y-60)+'px';
    p.el.style.background = `hsl(${p.hue},70%,40%)`;
    p.el.style.clipPath = clip;
    p.el.style.transform = `scale(${r.scale})`;
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

let pointerMode = true;
window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointerMode = true; });
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) {
    orientation = { alpha: e.alpha||0, beta: e.beta||0, gamma: e.gamma||0 };
    pointerMode = false;
  }
});

async function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('verse-f595', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

document.getElementById('seal').onclick = async () => {
  const best = portals.reduce((a,b) => a.fitness > b.fitness ? a : b);
  if (best.fitness <= bestFitness) return;
  bestFitness = best.fitness;
  bestTree = JSON.parse(JSON.stringify(best.tree));
  try {
    db = db || await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ tree: bestTree, fitness: bestFitness }, 'best');
    channel.postMessage({ tree: bestTree, fitness: bestFitness });
    document.getElementById('status').textContent = 'Sealed fitness ' + bestFitness;
  } catch(e) { console.warn(e); }
};

document.getElementById('restore').onclick = async () => {
  try {
    db = db || await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        bestTree = req.result.tree;
        bestFitness = req.result.fitness;
        portals.forEach(p => { p.tree = JSON.parse(JSON.stringify(bestTree)); p.fitness = 0; });
        document.getElementById('status').textContent = 'Restored fitness ' + bestFitness;
      }
    };
  } catch (e) { console.debug("lab f595-orientation-decision-tree-clippath-swarm:", e); }
};

channel.onmessage = e => {
  if (e.data.fitness > bestFitness) {
    bestFitness = e.data.fitness;
    bestTree = e.data.tree;
    portals.forEach(p => { p.tree = JSON.parse(JSON.stringify(bestTree)); });
    document.getElementById('status').textContent = 'Adopted peer genome fit ' + bestFitness;
  }
};

updateStatus();
