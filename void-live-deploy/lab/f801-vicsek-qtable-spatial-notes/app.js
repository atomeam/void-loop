const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
addEventListener('resize', () => { W = cv.width = innerWidth; H = cv.height = innerHeight; });

const N = 180;
const particles = Array.from({length: N}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  th: Math.random() * Math.PI * 2,
  vx: 0, vy: 0
}));
const speed = 1.8;
let radius = 40;
let noiseAmp = 0.25;

// Q-table: 5 bins × 4 actions
const NBINS = 5, NACTIONS = 4;
let Q = Array.from({length: NBINS}, () => Array(NACTIONS).fill(0));
let epsilon = 0.3;
let fitness = 0;
let lastS = 0, lastA = 0;
const alpha = 0.2, gamma = 0.9;

const notes = Array.from({length: 5}, (_, i) => {
  const el = document.createElement('div');
  el.className = 'note';
  el.textContent = `Note ${i+1}`;
  el.onclick = () => reward();
  document.body.appendChild(el);
  return el;
});

function reward() {
  const r = 1.0;
  const s = lastS, a = lastA;
  const maxNext = Math.max(...Q[s]);
  Q[s][a] += alpha * (r + gamma * maxNext - Q[s][a]);
  fitness += 1;
  updateHUD();
}

function getAlignment() {
  let sx = 0, sy = 0;
  for (const p of particles) { sx += Math.cos(p.th); sy += Math.sin(p.th); }
  return Math.hypot(sx, sy) / N;
}

function chooseAction(s) {
  if (Math.random() < epsilon) return Math.floor(Math.random() * NACTIONS);
  let best = 0, bv = -Infinity;
  for (let a = 0; a < NACTIONS; a++) if (Q[s][a] > bv) { bv = Q[s][a]; best = a; }
  return best;
}

function applyAction(a) {
  if (a === 0) noiseAmp = Math.min(0.8, noiseAmp + 0.04);
  else if (a === 1) noiseAmp = Math.max(0.05, noiseAmp - 0.04);
  else if (a === 2) radius = Math.min(80, radius + 4);
  else radius = Math.max(15, radius - 4);
}

function updateVicsek() {
  const nextTh = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    let sx = 0, sy = 0, cnt = 0;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const q = particles[j];
      const dx = ((q.x - p.x + W/2) % W) - W/2;
      const dy = ((q.y - p.y + H/2) % H) - H/2;
      if (dx*dx + dy*dy < radius*radius) { sx += Math.cos(q.th); sy += Math.sin(q.th); cnt++; }
    }
    let th = cnt ? Math.atan2(sy, sx) : p.th;
    th += (Math.random() - 0.5) * noiseAmp * 2;
    nextTh[i] = th;
  }
  for (let i = 0; i < N; i++) {
    particles[i].th = nextTh[i];
    particles[i].x = (particles[i].x + Math.cos(particles[i].th) * speed + W) % W;
    particles[i].y = (particles[i].y + Math.sin(particles[i].th) * speed + H) % H;
  }
}

function updateNotes() {
  // Simple density bins
  const bins = 12;
  const grid = Array.from({length: bins}, () => Array(bins).fill(0));
  const bx = W / bins, by = H / bins;
  for (const p of particles) {
    const ix = Math.min(bins-1, Math.floor(p.x / bx));
    const iy = Math.min(bins-1, Math.floor(p.y / by));
    grid[iy][ix]++;
  }
  const peaks = [];
  for (let y = 0; y < bins; y++) for (let x = 0; x < bins; x++) {
    peaks.push({x: x*bx + bx/2, y: y*by + by/2, d: grid[y][x]});
  }
  peaks.sort((a,b) => b.d - a.d);
  for (let i = 0; i < notes.length; i++) {
    const pk = peaks[i] || {x: W/2, y: H/2, d: 0};
    notes[i].style.left = (pk.x - 40) + 'px';
    notes[i].style.top = (pk.y - 20) + 'px';
    notes[i].textContent = `Density ${pk.d} | A:${getAlignment().toFixed(2)}`;
  }
}

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8cf';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
    // heading tick
    ctx.strokeStyle = '#adf';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.th)*8, p.y + Math.sin(p.th)*8);
    ctx.stroke();
  }
}

function updateHUD() {
  document.getElementById('stats').textContent =
    `Alignment: ${getAlignment().toFixed(2)} | noise: ${noiseAmp.toFixed(2)} | r: ${radius.toFixed(0)} | ε: ${epsilon.toFixed(2)} | Fitness: ${fitness}`;
}

// Persistence
const dbName = 'f801-qtable';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('store');
req.onsuccess = e => { db = e.target.result; load(); };
function save() {
  if (!db) return;
  const tx = db.transaction('store', 'readwrite');
  tx.objectStore('store').put({Q, fitness, noiseAmp, radius}, 'genome');
}
function load() {
  if (!db) return;
  const tx = db.transaction('store', 'readonly');
  const g = tx.objectStore('store').get('genome');
  g.onsuccess = () => {
    if (g.result) {
      Q = g.result.Q; fitness = g.result.fitness || 0;
      noiseAmp = g.result.noiseAmp || 0.25; radius = g.result.radius || 40;
    }
  };
}

const bc = new BroadcastChannel('f801-genome');
bc.onmessage = e => {
  if (e.data.fitness > fitness) {
    Q = e.data.Q; fitness = e.data.fitness;
    noiseAmp = e.data.noiseAmp; radius = e.data.radius;
    updateHUD();
  }
};

document.getElementById('seal').onclick = () => {
  save();
  bc.postMessage({Q, fitness, noiseAmp, radius});
  alert('Genome sealed & broadcast');
};
document.getElementById('reset').onclick = () => {
  Q = Array.from({length: NBINS}, () => Array(NACTIONS).fill(0));
  fitness = 0; noiseAmp = 0.25; radius = 40;
  updateHUD();
};

function loop() {
  const align = getAlignment();
  const s = Math.min(NBINS-1, Math.floor(align * NBINS));
  const a = chooseAction(s);
  applyAction(a);
  lastS = s; lastA = a;
  updateVicsek();
  updateNotes();
  render();
  updateHUD();
  requestAnimationFrame(loop);
}
loop();
