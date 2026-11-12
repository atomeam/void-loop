const COLS = 12, ROWS = 8, N_AGENTS = 4;
const cells = [];
let agents = [];
let tilt = {x:0, y:0};
let paused = false;
let step = 0;
const statusEl = document.getElementById('status');
const grid = document.getElementById('grid');

function rand(a,b){ return a + Math.random()*(b-a); }
function hueToColor(h, s=70, l=50){ return `hsl(${h%360}, ${s}%, ${l}%)`; }

class Agent {
  constructor(id, genome=null) {
    this.id = id;
    this.genome = genome || {
      hue: rand(0,360),
      spreadBiasX: rand(-0.3,0.3),
      spreadBiasY: rand(-0.3,0.3),
      overwriteProb: rand(0.4,0.8),
      vitality: 1
    };
    this.fitness = 0;
    this.cellsOwned = 0;
  }
  mutate() {
    const g = {...this.genome};
    g.hue = (g.hue + rand(-30,30) + 360) % 360;
    g.spreadBiasX += rand(-0.1,0.1);
    g.spreadBiasY += rand(-0.1,0.1);
    g.overwriteProb = Math.max(0.1, Math.min(0.95, g.overwriteProb + rand(-0.1,0.1)));
    return g;
  }
}

function initGrid() {
  grid.innerHTML = '';
  cells.length = 0;
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r;
      div.dataset.c = c;
      div.dataset.agent = '-1';
      div.dataset.vitality = '0';
      grid.appendChild(div);
      cells.push(div);
    }
  }
}

function spawnAgents() {
  agents = [];
  for (let i=0; i<N_AGENTS; i++) {
    const a = new Agent(i);
    agents.push(a);
    const idx = Math.floor(Math.random()*cells.length);
    claimCell(idx, a);
  }
}

function claimCell(idx, agent) {
  const cell = cells[idx];
  cell.dataset.agent = agent.id;
  cell.dataset.vitality = '1';
  cell.style.background = hueToColor(agent.genome.hue);
  cell.classList.add('claimed');
  cell.textContent = agent.id;
}

function getNeighbors(idx) {
  const r = Math.floor(idx / COLS), c = idx % COLS;
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  const neigh = [];
  for (const [dr,dc] of dirs) {
    const nr = r+dr, nc = c+dc;
    if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS) neigh.push(nr*COLS + nc);
  }
  return neigh;
}

function update() {
  if (paused) return;
  step++;
  agents.forEach(a => a.cellsOwned = 0);
  cells.forEach((cell, idx) => {
    const aid = parseInt(cell.dataset.agent);
    if (aid >= 0) agents[aid].cellsOwned++;
    let v = parseFloat(cell.dataset.vitality || 0);
    v = Math.max(0, v - 0.005);
    cell.dataset.vitality = v;
  });

  const toClaim = [];
  cells.forEach((cell, idx) => {
    const aid = parseInt(cell.dataset.agent);
    if (aid < 0) return;
    const agent = agents[aid];
    const g = agent.genome;
    const biasX = g.spreadBiasX + tilt.x * 0.5;
    const biasY = g.spreadBiasY + tilt.y * 0.5;
    const neigh = getNeighbors(idx);
    for (const nidx of neigh) {
      const ncell = cells[nidx];
      const naid = parseInt(ncell.dataset.agent);
      const nr = Math.floor(nidx / COLS), nc = nidx % COLS;
      const r = Math.floor(idx / COLS), c = idx % COLS;
      const dx = nc - c, dy = nr - r;
      const dirScore = dx * biasX + dy * biasY;
      const prob = g.overwriteProb * (0.5 + Math.max(0, dirScore)) * (parseFloat(cell.dataset.vitality) + 0.3);
      if (Math.random() < prob * 0.15) {
        if (naid < 0 || Math.random() < 0.4 || agents[naid].fitness < agent.fitness) {
          toClaim.push({nidx, agent});
        }
      }
    }
  });
  const claimedThis = new Set();
  for (const {nidx, agent} of toClaim) {
    if (claimedThis.has(nidx)) continue;
    claimCell(nidx, agent);
    claimedThis.add(nidx);
  }

  agents.forEach(a => a.fitness = a.cellsOwned * 0.7 + a.genome.vitality * 0.3);

  if (step % 150 === 0 && agents.length > 1) {
    agents.sort((a,b) => b.fitness - a.fitness);
    const best = agents[0];
    const worst = agents[agents.length-1];
    worst.genome = best.mutate();
    worst.fitness = best.fitness * 0.5;
    statusEl.textContent = `Step ${step} | Dominant: agent ${best.id} (${best.cellsOwned} cells) | Tilt: ${tilt.x.toFixed(2)},${tilt.y.toFixed(2)}`;
  }

  requestAnimationFrame(update);
}

grid.addEventListener('pointermove', e => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el.classList.contains('cell')) {
    const aid = parseInt(el.dataset.agent);
    if (aid >= 0) {
      let v = parseFloat(el.dataset.vitality || 0);
      el.dataset.vitality = Math.min(2, v + 0.3);
      agents[aid].fitness += 0.5;
      el.style.transform = 'scale(1.05)';
      setTimeout(() => el.style.transform = '', 200);
    }
  }
});

function onOrient(e) {
  tilt.x = (e.gamma || 0) / 45;
  tilt.y = (e.beta || 0) / 45;
  tilt.x = Math.max(-1, Math.min(1, tilt.x));
  tilt.y = Math.max(-1, Math.min(1, tilt.y));
}
document.getElementById('orientBtn').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') window.addEventListener('deviceorientation', onOrient);
    });
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
  statusEl.textContent = 'Orientation listening...';
};

document.getElementById('sealBtn').onclick = async () => {
  if (!agents.length) return;
  agents.sort((a,b)=>b.fitness-a.fitness);
  const best = agents[0].genome;
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f718', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(best, 'dominant');
    statusEl.textContent = 'Sealed dominant genome to IndexedDB';
  } catch(e) {
    localStorage.setItem('verse-f718-genome', JSON.stringify(best));
    statusEl.textContent = 'Sealed to localStorage (IDB failed)';
  }
};

document.getElementById('resetBtn').onclick = () => {
  initGrid();
  spawnAgents();
  step = 0;
  statusEl.textContent = 'Reset';
};

document.getElementById('pauseBtn').onclick = () => {
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
};

async function tryLoad() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f718', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('dominant');
    req.onsuccess = () => {
      if (req.result) {
        const a = new Agent(0, req.result);
        agents[0] = a;
        statusEl.textContent = 'Loaded sealed genome';
      }
    };
  } catch (e) { console.debug("lab f718-tilt-biased-cellular-claim-competition-mind:", e); }
}

initGrid();
spawnAgents();
tryLoad();
requestAnimationFrame(update);
statusEl.textContent = 'Ready. Enable orientation and tilt to bias claims.';
