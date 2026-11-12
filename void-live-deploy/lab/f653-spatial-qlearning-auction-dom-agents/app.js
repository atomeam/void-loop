const W = 16, H = 16;
const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const tabsEl = document.getElementById('tabs');
let cellW, cellH;

function resize() {
  canvas.width = stage.clientWidth;
  canvas.height = stage.clientHeight;
  cellW = canvas.width / W;
  cellH = canvas.height / H;
}
window.addEventListener('resize', resize);
resize();

// Resource grid
let grid = Array.from({length: H}, () => Array(W).fill(0));
function inject(x, y, val=0.8) {
  const ix = Math.floor(x / cellW), iy = Math.floor(y / cellH);
  if (ix>=0 && ix<W && iy>=0 && iy<H) grid[iy][ix] = Math.min(1, grid[iy][ix] + val);
}

// Agents
const N_AGENTS = 6;
const ACTIONS = ['N','S','E','W','Claim'];
const ALPHA = 0.2, GAMMA = 0.9, EPS = 0.15;
let agents = [];
let bestFitness = -1;
let bestQs = null;

function makeQ() {
  // state: rough local sum + pos bin → ~ 20 states
  const q = {};
  for (let s=0; s<32; s++) q[s] = ACTIONS.map(() => Math.random()*0.1);
  return q;
}
function stateKey(a) {
  const ix = Math.floor(a.x / cellW), iy = Math.floor(a.y / cellH);
  let sum = 0;
  for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
    const ny = (iy+dy+H)%H, nx = (ix+dx+W)%W;
    sum += grid[ny][nx];
  }
  return Math.min(31, Math.floor(sum * 4) + (ix % 4));
}

function initAgents() {
  agents = [];
  for (let i=0; i<N_AGENTS; i++) {
    const el = document.createElement('div');
    el.className = 'agent';
    el.innerHTML = `<div>A${i}</div><div class="fit">fit:0</div>`;
    stage.appendChild(el);
    agents.push({
      id: i, el, x: Math.random()*canvas.width, y: Math.random()*canvas.height,
      q: makeQ(), fitness: 0, eps: EPS
    });
  }
}

function stepAgent(a) {
  const s = stateKey(a);
  const qs = a.q[s];
  let act;
  if (Math.random() < a.eps) act = Math.floor(Math.random()*5);
  else act = qs.indexOf(Math.max(...qs));
  const action = ACTIONS[act];
  let reward = -0.01;
  const oldX = a.x, oldY = a.y;
  const step = Math.min(cellW, cellH) * 0.8;
  if (action === 'N') a.y -= step;
  if (action === 'S') a.y += step;
  if (action === 'E') a.x += step;
  if (action === 'W') a.x -= step;
  a.x = Math.max(0, Math.min(canvas.width-1, a.x));
  a.y = Math.max(0, Math.min(canvas.height-1, a.y));
  if (action === 'Claim') {
    const ix = Math.floor(a.x / cellW), iy = Math.floor(a.y / cellH);
    if (grid[iy][ix] > 0.1) {
      reward = grid[iy][ix] * 2;
      grid[iy][ix] *= 0.3;
      a.fitness += reward;
    }
  }
  // TD
  const s2 = stateKey(a);
  const maxQ2 = Math.max(...a.q[s2]);
  qs[act] += ALPHA * (reward + GAMMA * maxQ2 - qs[act]);
  a.el.style.left = (a.x - 36) + 'px';
  a.el.style.top = (a.y - 24) + 'px';
  a.el.querySelector('.fit').textContent = 'fit:' + a.fitness.toFixed(1);
  if (a.fitness > bestFitness) {
    bestFitness = a.fitness;
    bestQs = JSON.parse(JSON.stringify(a.q));
    agents.forEach(ag => ag.el.classList.toggle('best', ag === a));
  }
}

// Pointer
stage.addEventListener('pointerdown', e => {
  inject(e.clientX, e.clientY, 1.2);
  // reward nearest
  let minD = 9999, nearest = null;
  agents.forEach(a => {
    const d = Math.hypot(a.x - e.clientX, a.y - e.clientY);
    if (d < minD) { minD = d; nearest = a; }
  });
  if (nearest && minD < 80) nearest.fitness += 0.5;
});

// Broadcast
let channel;
try {
  channel = new BroadcastChannel('f653-auction-swarm');
  channel.onmessage = ev => {
    const m = ev.data;
    if (m.type === 'state') {
      // simple influence: if peer has higher fit, slight bias
    } else if (m.type === 'seal' && m.fitness > bestFitness + 1) {
      log('Accepted superior Q from peer');
      bestFitness = m.fitness;
      bestQs = m.q;
      agents[0].q = JSON.parse(JSON.stringify(m.q));
    }
    tabsEl.textContent = 'tabs: shared';
  };
} catch(e) { console.warn('no BC'); }

function maybeSealBroadcast() {
  if (bestFitness > 5 && Math.random() < 0.02 && channel) {
    channel.postMessage({ type:'seal', fitness: bestFitness, q: bestQs });
    log('Broadcast sealed Q');
  }
}

// IndexedDB
let db;
const req = indexedDB.open('verse-f653', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('best');
req.onsuccess = e => {
  db = e.target.result;
  const tx = db.transaction('best', 'readonly');
  const g = tx.objectStore('best').get('q');
  g.onsuccess = () => {
    if (g.result) {
      bestQs = g.result.q;
      bestFitness = g.result.fitness || 0;
      agents.forEach(a => a.q = JSON.parse(JSON.stringify(bestQs)));
      statusEl.textContent = 'Restored best Q';
    }
  };
};

function saveBest() {
  if (!db || !bestQs) return;
  const tx = db.transaction('best', 'readwrite');
  tx.objectStore('best').put({ q: bestQs, fitness: bestFitness, ts: Date.now() }, 'q');
}

// Seal
document.getElementById('seal').onclick = () => {
  saveBest();
  const snap = grid.map(row => row.map(v => +v.toFixed(2)));
  const data = { qtables: bestQs || agents.map(a=>a.q), fitness: bestFitness, grid_snapshot: snap, timestamp: Date.now(), note: 'F653 spatial Q-auction' };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f653-seal.json';
  a.click();
  log('Sealed & downloaded');
};

function log(msg) { logEl.textContent = msg; }

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const v = grid[y][x];
    ctx.fillStyle = `rgba(100,180,255,${v*0.7})`;
    ctx.fillRect(x*cellW, y*cellH, cellW-1, cellH-1);
    grid[y][x] *= 0.992; // slow decay
  }
}

function loop() {
  agents.forEach(stepAgent);
  draw();
  maybeSealBroadcast();
  statusEl.textContent = `best fit ${bestFitness.toFixed(1)} | agents exploring`;
  requestAnimationFrame(loop);
}

initAgents();
statusEl.textContent = 'Running — click to inject resources';
loop();
