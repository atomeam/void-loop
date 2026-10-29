const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
const bodiesEl = document.getElementById('bodies');
const status = document.getElementById('status');
let w, h, agents = [], genomes = [], generation = 0, running = false;
let tiltX = 0, tiltY = 0, mouseX = 0, mouseY = 0;
const DB_NAME = 'genomeArenaF230';
const STORE = 'genomes';

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// DeviceOrientation as causal input
window.addEventListener('deviceorientation', e => {
  tiltX = (e.gamma || 0) / 45;
  tiltY = (e.beta || 0) / 45;
  status.textContent = `Tilt: ${tiltX.toFixed(2)}, ${tiltY.toFixed(2)} | Gen ${generation}`;
});
// Mouse fallback for desktop
canvas.addEventListener('mousemove', e => {
  mouseX = (e.clientX / w - 0.5) * 2;
  mouseY = (e.clientY / h - 0.5) * 2;
  if (!tiltX && !tiltY) { tiltX = mouseX; tiltY = mouseY; }
});

// Tiny MLP genome: 4 inputs (pos, vel), 4 hidden, 2 outputs (ax, ay)
function randomGenome() {
  return {
    w1: Array.from({length: 4*4}, () => Math.random()*2-1),
    w2: Array.from({length: 4*2}, () => Math.random()*2-1),
    b1: Array.from({length: 4}, () => Math.random()*0.2-0.1),
    b2: Array.from({length: 2}, () => Math.random()*0.2-0.1),
    fitness: 0,
    id: Math.random().toString(36).slice(2,8)
  };
}

function mlpForward(g, inputs) {
  const h = [];
  for (let i = 0; i < 4; i++) {
    let s = g.b1[i];
    for (let j = 0; j < 4; j++) s += inputs[j] * g.w1[i*4 + j];
    h.push(Math.tanh(s));
  }
  const outs = [];
  for (let i = 0; i < 2; i++) {
    let s = g.b2[i];
    for (let j = 0; j < 4; j++) s += h[j] * g.w2[i*4 + j];
    outs.push(Math.tanh(s) * 0.15);
  }
  return outs;
}

function initAgents(n = 12) {
  agents = [];
  genomes = [];
  for (let i = 0; i < n; i++) {
    const g = randomGenome();
    genomes.push(g);
    agents.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0, vy: 0,
      genome: g,
      color: `hsl(${Math.random()*360},70%,60%)`
    });
  }
}

function step() {
  if (!running) return;
  const forceX = tiltX * 0.08;
  const forceY = tiltY * 0.08;
  agents.forEach(a => {
    const inputs = [
      (a.x / w - 0.5) * 2,
      (a.y / h - 0.5) * 2,
      a.vx, a.vy
    ];
    const [ax, ay] = mlpForward(a.genome, inputs);
    a.vx += ax + forceX;
    a.vy += ay + forceY;
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += a.vx; a.y += a.vy;
    if (a.x < 10 || a.x > w-10) a.vx *= -0.8;
    if (a.y < 10 || a.y > h-10) a.vy *= -0.8;
    a.x = Math.max(10, Math.min(w-10, a.x));
    a.y = Math.max(10, Math.min(h-10, a.y));
    a.genome.fitness += 1 + Math.hypot(a.vx, a.vy) * 0.1;
  });
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, w, h);
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6, 0, Math.PI*2);
    ctx.fillStyle = a.color;
    ctx.fill();
  });
  requestAnimationFrame(step);
}

function updateBodies() {
  bodiesEl.innerHTML = '';
  const sorted = [...agents].sort((a,b) => b.genome.fitness - a.genome.fitness).slice(0, 3);
  sorted.forEach((a, i) => {
    const div = document.createElement('div');
    div.className = 'body';
    const size = 30 + Math.min(40, a.genome.fitness / 50);
    div.style.width = div.style.height = size + 'px';
    div.style.left = (a.x - size/2) + 'px';
    div.style.top = (a.y - size/2) + 'px';
    div.style.background = a.color;
    div.style.color = a.color;
    div.dataset.id = a.genome.id;
    let drag = false, ox, oy;
    div.addEventListener('mousedown', e => { drag = true; ox = e.clientX - a.x; oy = e.clientY - a.y; e.preventDefault(); });
    window.addEventListener('mousemove', e => {
      if (drag) {
        a.x = e.clientX - ox; a.y = e.clientY - oy;
        a.genome.fitness += 2;
      }
    });
    window.addEventListener('mouseup', () => drag = false);
    bodiesEl.appendChild(div);
  });
}

async function sealWinner() {
  if (!agents.length) return;
  const winner = agents.reduce((best, a) => a.genome.fitness > best.genome.fitness ? a : best);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(winner.genome)));
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, {keyPath: 'hash'});
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ hash: hex.slice(0,16), genome: winner.genome, gen: generation, time: Date.now() });
    status.textContent = `Sealed ${hex.slice(0,8)}... Gen ${generation}. Transfer ready.`;
  };
  genomes.forEach(g => {
    if (g !== winner.genome) {
      for (let i = 0; i < g.w1.length; i++) if (Math.random() < 0.1) g.w1[i] = (g.w1[i] + winner.genome.w1[i]) / 2;
    }
    g.w1 = g.w1.map(v => v + (Math.random()-0.5)*0.1);
    g.fitness = 0;
  });
  generation++;
  updateBodies();
}

document.getElementById('start').onclick = () => {
  if (!agents.length) initAgents();
  running = true;
  step();
  setInterval(updateBodies, 200);
  status.textContent = 'Competing... tilt or drag bodies.';
};
document.getElementById('seal').onclick = sealWinner;
document.getElementById('reset').onclick = () => { running = false; agents = []; genomes = []; generation = 0; bodiesEl.innerHTML = ''; ctx.clearRect(0,0,w,h); status.textContent = 'Reset.'; };

indexedDB.open(DB_NAME, 1).onsuccess = e => {
  const db = e.target.result;
  if (db.objectStoreNames.contains(STORE)) {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    store.getAll().onsuccess = ev => {
      if (ev.target.result.length) status.textContent += ' | Loaded prior seals.';
    };
  }
};
