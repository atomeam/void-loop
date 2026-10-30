const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const tilesEl = document.getElementById('tiles');
let W, H, agents = [], sealed = [], pointer = {x:0, y:0, active:false};
let frame = 0;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize); resize();

function hashGenome(w, fit) {
  let s = w.map(v => v.toFixed(4)).join(',') + '|' + fit.toFixed(2);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).slice(0, 8);
}

function createAgent(x, y, fromGenome) {
  const weights = fromGenome ? fromGenome.weights.map(v => v + (Math.random()-0.5)*0.1) : Array.from({length:6}, () => (Math.random()-0.5)*2);
  return {
    x, y, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    energy: 50 + Math.random()*50, weights, fitness: 0, id: Math.random()
  };
}

function initSwarm(biasGenomes) {
  agents = [];
  for (let i = 0; i < 24; i++) {
    const g = biasGenomes && biasGenomes.length ? biasGenomes[i % biasGenomes.length] : null;
    agents.push(createAgent(Math.random()*W, Math.random()*H, g));
  }
}

function updateAgent(a) {
  const dx = pointer.x - a.x, dy = pointer.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx/dist, ny = dy/dist;
  // tiny decision: weighted features
  const feat = [nx, ny, Math.min(dist/200,1), a.energy/100, Math.sin(frame*0.01), 1];
  let fx = 0, fy = 0;
  for (let i = 0; i < 3; i++) fx += a.weights[i] * feat[i];
  for (let i = 0; i < 3; i++) fy += a.weights[i+3] * feat[i];
  a.vx = a.vx * 0.92 + fx * 0.4;
  a.vy = a.vy * 0.92 + fy * 0.4;
  a.x += a.vx; a.y += a.vy;
  if (a.x < 0 || a.x > W) a.vx *= -0.8;
  if (a.y < 0 || a.y > H) a.vy *= -0.8;
  a.x = Math.max(0, Math.min(W, a.x));
  a.y = Math.max(0, Math.min(H, a.y));
  a.energy *= 0.995;
  if (pointer.active && dist < 80) a.energy += 0.8;
  a.fitness = a.energy;
}

function checkCollisions() {
  for (let i = 0; i < agents.length; i++) {
    for (let j = i+1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < 18 && Math.abs(a.energy - b.energy) > 5) {
        const winner = a.energy > b.energy ? a : b;
        const loser = winner === a ? b : a;
        // seal and transfer
        const sealedHash = hashGenome(winner.weights, winner.fitness);
        sealed.push({hash: sealedHash, weights: [...winner.weights], fitness: winner.fitness, time: Date.now()});
        if (sealed.length > 20) sealed.shift();
        // transfer with mutation
        for (let k = 0; k < loser.weights.length; k++) {
          loser.weights[k] = loser.weights[k]*0.3 + winner.weights[k]*0.7 + (Math.random()-0.5)*0.2;
        }
        loser.energy *= 0.7;
        winner.energy = Math.min(winner.energy + 10, 150);
        // visual flash
        a.flash = b.flash = 8;
      }
    }
  }
}

function draw() {
  ctx.fillStyle = '#111122';
  ctx.fillRect(0,0,W,H);
  agents.forEach(a => {
    const hue = (a.fitness * 2) % 360;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6 + (a.flash||0)*0.5, 0, Math.PI*2);
    ctx.fillStyle = `hsl(${hue}, 70%, ${50 + (a.flash||0)*5}%)`;
    ctx.fill();
    if (a.flash) a.flash--;
  });
  if (pointer.active) {
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI*2);
    ctx.strokeStyle = '#88f'; ctx.stroke();
  }
}

function updateStats() {
  const avg = agents.reduce((s,a)=>s+a.fitness,0)/agents.length || 0;
  statsEl.textContent = `Agents: ${agents.length} | Avg fitness: ${avg.toFixed(1)} | Sealed: ${sealed.length}`;
  tilesEl.innerHTML = sealed.slice(-3).map(s => `<span class="tile" title="${s.hash}">${s.hash.slice(0,4)}… ${s.fitness.toFixed(0)}</span>`).join('');
}

function loop() {
  frame++;
  agents.forEach(updateAgent);
  checkCollisions();
  draw();
  if (frame % 10 === 0) updateStats();
  requestAnimationFrame(loop);
}

// IDB persistence
let db;
const req = indexedDB.open('void-sealed-genomes', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('seals', {keyPath: 'hash'});
req.onsuccess = e => {
  db = e.target.result;
  const tx = db.transaction('seals', 'readonly');
  const store = tx.objectStore('seals');
  const getAll = store.getAll();
  getAll.onsuccess = () => {
    const saved = getAll.result.sort((a,b)=>b.fitness-a.fitness).slice(0,5);
    initSwarm(saved);
    loop();
  };
};
req.onerror = () => { initSwarm(); loop(); };

function saveSeals() {
  if (!db) return;
  const tx = db.transaction('seals', 'readwrite');
  const store = tx.objectStore('seals');
  sealed.slice(-5).forEach(s => store.put(s));
}
setInterval(saveSeals, 5000);

canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true;
});
canvas.addEventListener('pointerleave', () => pointer.active = false);
canvas.addEventListener('click', () => {
  agents.forEach(a => { if (Math.hypot(a.x-pointer.x, a.y-pointer.y)<100) a.energy += 20; });
});

document.getElementById('inject').onclick = () => agents.forEach(a => a.energy = Math.min(a.energy+15, 150));
document.getElementById('reset').onclick = () => initSwarm(sealed.slice(-3));
document.getElementById('clear').onclick = () => {
  sealed = [];
  if (db) db.transaction('seals','readwrite').objectStore('seals').clear();
  updateStats();
};

// optional orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.gamma != null) {
      pointer.x = W/2 + (e.gamma||0)*3;
      pointer.y = H/2 + (e.beta||0)*3;
      pointer.active = true;
    }
  });
}
