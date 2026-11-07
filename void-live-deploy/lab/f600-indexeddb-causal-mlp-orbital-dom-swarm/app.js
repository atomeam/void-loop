const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const STATS = document.getElementById('stats');
const N = 12;
const CENTER = {x: innerWidth/2, y: innerHeight/2};
let agents = [];
let orientation = {beta:0, gamma:0};
let db;

// Tiny MLP: 3 -> 4 -> 1
function createGenome() {
  return {
    w1: Array(12).fill(0).map(() => (Math.random()-0.5)*0.8), // 3*4
    b1: Array(4).fill(0).map(() => (Math.random()-0.5)*0.4),
    w2: Array(4).fill(0).map(() => (Math.random()-0.5)*0.8),
    b2: (Math.random()-0.5)*0.4,
    fitness: 0,
    id: Math.random().toString(36).slice(2,8)
  };
}

function mlp(g, inputs) {
  // inputs: [beta/90, gamma/90, Math.sin(Date.now()/1000)]
  const h = [];
  for (let i=0; i<4; i++) {
    let s = g.b1[i];
    for (let j=0; j<3; j++) s += inputs[j] * g.w1[i*3 + j];
    h.push(Math.tanh(s));
  }
  let o = g.b2;
  for (let i=0; i<4; i++) o += h[i] * g.w2[i];
  return Math.tanh(o); // angular velocity delta
}

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-orbital-swarm', 1);
    r.onupgradeneeded = e => {
      e.target.result.createObjectStore('population', {keyPath: 'id'});
    };
    r.onsuccess = e => res(e.target.result);
    r.onerror = rej;
  });
}

async function savePop() {
  if (!db) return;
  const tx = db.transaction('population', 'readwrite');
  const store = tx.objectStore('population');
  await store.clear();
  for (const a of agents) store.put(a.genome);
}

async function loadPop() {
  if (!db) return null;
  return new Promise(res => {
    const tx = db.transaction('population', 'readonly');
    const req = tx.objectStore('population').getAll();
    req.onsuccess = () => res(req.result);
  });
}

function spawnAgents(genomes) {
  STAGE.innerHTML = '';
  agents = [];
  const gs = genomes && genomes.length ? genomes : Array(N).fill(0).map(createGenome);
  for (let i=0; i<N; i++) {
    const el = document.createElement('div');
    el.className = 'agent';
    STAGE.appendChild(el);
    const angle = (i / N) * Math.PI * 2;
    agents.push({
      el,
      genome: gs[i] || createGenome(),
      angle,
      radius: 120 + Math.random()*80,
      omega: 0.01 + Math.random()*0.02
    });
  }
}

function update() {
  const t = Date.now() / 1000;
  const inputs = [
    Math.max(-1, Math.min(1, orientation.beta / 90)),
    Math.max(-1, Math.min(1, orientation.gamma / 90)),
    Math.sin(t * 0.7)
  ];
  let bestFit = -Infinity, bestIdx = 0;
  agents.forEach((a, i) => {
    const delta = mlp(a.genome, inputs) * 0.04;
    a.omega = a.omega * 0.92 + delta;
    a.angle += a.omega;
    // soft orbital lock: prefer radius ~ 180 + fitness influence
    const targetR = 160 + Math.sin(a.angle * 2) * 40;
    a.radius += (targetR - a.radius) * 0.02;
    const x = CENTER.x + Math.cos(a.angle) * a.radius;
    const y = CENTER.y + Math.sin(a.angle) * a.radius;
    a.el.style.transform = `translate(${x-12}px, ${y-12}px)`;
    // fitness: stability of omega near preferred + radius proximity
    const prefOmega = 0.015 + Math.sin(t + i) * 0.005;
    const fit = -Math.abs(a.omega - prefOmega) * 10 - Math.abs(a.radius - 180) * 0.01;
    a.genome.fitness = a.genome.fitness * 0.95 + fit * 0.05;
    if (a.genome.fitness > bestFit) { bestFit = a.genome.fitness; bestIdx = i; }
  });
  agents.forEach((a, i) => a.el.classList.toggle('best', i === bestIdx));
  STATS.textContent = `Best fitness: ${bestFit.toFixed(3)} | Agents: ${N}`;
  requestAnimationFrame(update);
}

// Orientation
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orientation.beta = e.beta;
  if (e.gamma != null) orientation.gamma = e.gamma;
});
// Mouse fallback
let dragging = false;
STAGE.addEventListener('pointerdown', () => dragging = true);
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  orientation.gamma = (e.clientX / innerWidth - 0.5) * 180;
  orientation.beta = (e.clientY / innerHeight - 0.5) * 180;
});

// Sealed transfer: hash genome, broadcast or local mutate best
const bc = new BroadcastChannel('verse-orbital-seal');
bc.onmessage = async e => {
  if (e.data.type === 'sealed-genome') {
    // accept if hash matches
    const g = e.data.genome;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(g.w1)+g.id));
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
    if (hex.startsWith(e.data.seal.slice(0,8))) {
      // replace worst
      let worst = 0;
      agents.forEach((a,i) => { if (a.genome.fitness < agents[worst].genome.fitness) worst = i; });
      agents[worst].genome = {...g, id: Math.random().toString(36).slice(2,8)};
      STATUS.textContent = 'Received sealed genome from peer tab';
    }
  }
};

document.getElementById('seal').onclick = async () => {
  // seal best genome
  let best = agents[0];
  agents.forEach(a => { if (a.genome.fitness > best.genome.fitness) best = a; });
  const g = best.genome;
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(g.w1)+g.id+Date.now()));
  const seal = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  bc.postMessage({type: 'sealed-genome', genome: g, seal});
  STATUS.textContent = `Sealed & broadcast: ${seal.slice(0,8)}...`;
  // local mutation of others toward best
  agents.forEach(a => {
    if (a !== best && Math.random() < 0.3) {
      a.genome.w1 = a.genome.w1.map((w,i) => w * 0.7 + g.w1[i] * 0.3 + (Math.random()-0.5)*0.05);
    }
  });
  savePop();
};

document.getElementById('reset').onclick = () => {
  spawnAgents();
  savePop();
  STATUS.textContent = 'Population reset';
};

(async () => {
  try {
    db = await openDB();
    const saved = await loadPop();
    spawnAgents(saved && saved.length >= 4 ? saved : null);
  } catch (e) {
    spawnAgents();
    STATUS.textContent = 'IndexedDB unavailable; ephemeral mode';
  }
  update();
  setInterval(savePop, 8000);
})();
