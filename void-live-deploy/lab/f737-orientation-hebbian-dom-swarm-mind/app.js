const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const N = 8;
const agents = [];
let orientation = {alpha:0, beta:0, gamma:0};
let pointer = {x:0, y:0, vx:0, vy:0};
let lastPointer = {x:0, y:0};
const channel = new BroadcastChannel('f737-genome');

function randomGenome() {
  return Array.from({length:6}, () => (Math.random()-0.5)*0.5);
}

function createAgent(g) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'Agent';
  document.body.appendChild(el);
  return {
    el, genome: g || randomGenome(),
    x: Math.random()*(innerWidth-120), y: Math.random()*(innerHeight-80),
    vx:0, vy:0, fitness: 1, hue: Math.random()*360, id: Math.random().toString(36).slice(2)
  };
}

for (let i=0; i<N; i++) agents.push(createAgent());

addEventListener('deviceorientation', e => {
  orientation.alpha = e.alpha || 0;
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
});

addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.vx = e.clientX - lastPointer.x;
  pointer.vy = e.clientY - lastPointer.y;
  lastPointer = {x:e.clientX, y:e.clientY};
});

function features() {
  const hasOri = Math.abs(orientation.beta) > 1 || Math.abs(orientation.gamma) > 1;
  return hasOri ? [
    orientation.beta/90, orientation.gamma/90, orientation.alpha/180,
    pointer.vx/20, pointer.vy/20, 1
  ] : [pointer.vx/20, pointer.vy/20, pointer.x/innerWidth, pointer.y/innerHeight, 0, 1];
}

function hebbianUpdate(a, feat, reward) {
  for (let i=0; i<a.genome.length; i++) {
    a.genome[i] += 0.01 * reward * feat[i] * (a.genome[i] > 0 ? 1 : -1);
    a.genome[i] = Math.max(-2, Math.min(2, a.genome[i]));
  }
}

function step() {
  const feat = features();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  agents.forEach(a => {
    const out = a.genome.reduce((s,w,i) => s + w * feat[i], 0);
    a.vx += out * 0.5;
    a.vy += Math.sin(out) * 0.4;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = Math.max(0, Math.min(innerWidth-120, a.x + a.vx));
    a.y = Math.max(0, Math.min(innerHeight-80, a.y + a.vy));
    a.hue = (a.hue + out * 2 + 360) % 360;
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    a.el.style.background = `hsla(${a.hue},70%,40%,0.85)`;
    a.el.textContent = `F:${a.fitness.toFixed(1)}`;
    a.fitness *= 0.995;
    const g = ctx.createRadialGradient(a.x+60, a.y+40, 10, a.x+60, a.y+40, 80);
    g.addColorStop(0, `hsla(${a.hue},80%,50%,0.4)`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(a.x+60, a.y+40, 80, 0, Math.PI*2); ctx.fill();
  });
  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const a=agents[i], b=agents[j];
      if (Math.abs(a.x-b.x)<100 && Math.abs(a.y-b.y)<70) {
        if (a.fitness > b.fitness + 0.5) transfer(a, b);
        else if (b.fitness > a.fitness + 0.5) transfer(b, a);
      }
    }
  }
  requestAnimationFrame(step);
}
step();

function transfer(winner, loser) {
  loser.genome = winner.genome.map(w => w + (Math.random()-0.5)*0.1);
  loser.fitness = winner.fitness * 0.8;
  channel.postMessage({genome: winner.genome, fitness: winner.fitness, from: winner.id});
  document.getElementById('status').textContent = 'Genome transfer';
}

channel.onmessage = e => {
  const best = agents.reduce((m,a) => a.fitness > m.fitness ? a : m, agents[0]);
  if (e.data.fitness > best.fitness) {
    best.genome = e.data.genome.map(w => w + (Math.random()-0.5)*0.05);
    best.fitness = e.data.fitness;
  }
};

agents.forEach(a => {
  a.el.addEventListener('pointerdown', () => {
    a.fitness += 2;
    hebbianUpdate(a, features(), 1);
  });
});

document.getElementById('seal').onclick = () => {
  const best = agents.reduce((m,a) => a.fitness > m.fitness ? a : m, agents[0]);
  const req = indexedDB.open('verse-f737', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => {
    const tx = e.target.result.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({genome: best.genome, fitness: best.fitness}, 'best');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  };
};

document.getElementById('reset').onclick = () => {
  agents.forEach(a => a.el.remove());
  agents.length = 0;
  for (let i=0; i<N; i++) agents.push(createAgent());
  agents.forEach(a => a.el.addEventListener('pointerdown', () => {
    a.fitness += 2; hebbianUpdate(a, features(), 1);
  }));
  document.getElementById('status').textContent = 'Reset';
};

const req = indexedDB.open('verse-f737', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
req.onsuccess = e => {
  const tx = e.target.result.transaction('genomes');
  const get = tx.objectStore('genomes').get('best');
  get.onsuccess = () => {
    if (get.result && agents[0]) {
      agents[0].genome = get.result.genome;
      agents[0].fitness = get.result.fitness || 1;
    }
  };
};
