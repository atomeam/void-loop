const N = 12;
const GRID = 4 * 3;
const KEY_CATS = 8;
const GENOME_LEN = 6; // hueBias, scale, jitterX, jitterY, contentSeed, affinity
const POP = N;

let agents = [];
let bestFitness = -Infinity;
let bestGenome = null;
let keyBuffer = []; // {dt, cat, t}
let lastKeyT = performance.now();
let keyCount = 0;
let db, bc;

function rand() { return Math.random() * 2 - 1; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeGenome(base = null) {
  const g = base ? base.slice() : Array.from({length: GENOME_LEN}, () => Math.random());
  return g;
}

function mutate(g, rate = 0.15) {
  return g.map(v => clamp(v + (Math.random() < rate ? rand() * 0.3 : 0), 0, 1));
}

function keyCategory(e) {
  const c = e.key.toLowerCase();
  if (c === ' ') return 0;
  if (/[aeiou]/.test(c)) return 1;
  if (/[bcdfghjklmnpqrstvwxyz]/.test(c)) return 2;
  if (/[0-9]/.test(c)) return 3;
  if (['enter', 'backspace', 'tab'].includes(c)) return 4;
  if (c.length > 1) return 5;
  return 6 + (c.charCodeAt(0) % 2);
}

function initAgents() {
  agents = [];
  for (let i = 0; i < POP; i++) {
    agents.push({
      id: i,
      genome: makeGenome(),
      fitness: 0,
      captures: 0
    });
  }
}

function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  agents.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'portal';
    el.dataset.id = i;
    const g = a.genome;
    const hue = Math.floor(g[0] * 360);
    const scale = g[1];
    const jx = ((g[2] - 0.5) * 20) + 'px';
    const jy = ((g[3] - 0.5) * 20) + 'px';
    el.style.setProperty('--hue', hue);
    el.style.setProperty('--scale', scale);
    el.style.setProperty('--jx', jx);
    el.style.setProperty('--jy', jy);
    const seed = Math.floor(g[4] * 1000);
    const words = ['void', 'verse', 'mind', 'type', 'rhythm', 'evolve', 'portal', 'seal', 'agent', 'grid', 'local', 'cadence'];
    const content = words[seed % words.length] + '-' + (seed % 97);
    el.innerHTML = `<div class="label">A${i}</div><div class="content">${content}</div><div style="font-size:0.65em;opacity:0.6">f:${a.fitness.toFixed(1)}</div>`;
    el.onclick = () => rewardAgent(i, 2.5);
    grid.appendChild(el);
  });
}

function rewardAgent(i, amt) {
  agents[i].fitness += amt;
  agents[i].captures++;
  if (agents[i].fitness > bestFitness) {
    bestFitness = agents[i].fitness;
    bestGenome = agents[i].genome.slice();
  }
  document.getElementById('fit').textContent = bestFitness.toFixed(1);
  renderGrid();
}

function evaluate(recent) {
  if (recent.length < 2) return;
  const avgDt = recent.reduce((s, r) => s + r.dt, 0) / recent.length;
  const catHist = new Array(KEY_CATS).fill(0);
  recent.forEach(r => catHist[r.cat]++);
  agents.forEach(a => {
    const g = a.genome;
    // affinity match to recent rhythm
    const rhythmMatch = 1 - Math.abs(g[5] - (avgDt % 800) / 800);
    const catBias = catHist[Math.floor(g[0] * KEY_CATS) % KEY_CATS] / recent.length;
    const score = rhythmMatch * 1.5 + catBias * 2 + g[1] * 0.3;
    a.fitness += score * 0.4;
    if (score > 1.2) a.captures++;
  });
}

function evolve() {
  // sort by fitness
  agents.sort((a, b) => b.fitness - a.fitness);
  // elite + mutate
  const elites = agents.slice(0, 4);
  const next = [];
  elites.forEach(e => {
    next.push({ ...e, genome: e.genome.slice(), fitness: e.fitness * 0.7 });
    next.push({ id: next.length, genome: mutate(e.genome, 0.25), fitness: e.fitness * 0.4, captures: 0 });
  });
  while (next.length < POP) {
    const parent = elites[Math.floor(Math.random() * elites.length)];
    next.push({ id: next.length, genome: mutate(parent.genome, 0.4), fitness: 0, captures: 0 });
  }
  agents = next.slice(0, POP);
  agents.forEach((a, i) => a.id = i);
  if (agents[0].fitness > bestFitness) {
    bestFitness = agents[0].fitness;
    bestGenome = agents[0].genome.slice();
  }
  document.getElementById('fit').textContent = bestFitness.toFixed(1);
  renderGrid();
  document.getElementById('msg').textContent = `evolved @ ${keyCount} keys`;
}

function drawHist() {
  const c = document.getElementById('hist');
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 200, 40);
  if (keyBuffer.length < 2) return;
  const recent = keyBuffer.slice(-20);
  const maxDt = Math.max(...recent.map(r => r.dt), 100);
  ctx.strokeStyle = '#6cf';
  ctx.beginPath();
  recent.forEach((r, i) => {
    const x = (i / 19) * 200;
    const y = 38 - (r.dt / maxDt) * 36;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const now = performance.now();
  const dt = now - lastKeyT;
  lastKeyT = now;
  const cat = keyCategory(e);
  keyBuffer.push({ dt, cat, t: now });
  if (keyBuffer.length > 64) keyBuffer.shift();
  keyCount++;
  const recent = keyBuffer.slice(-8);
  evaluate(recent);
  // probabilistic capture
  const winner = agents.reduce((best, a, i) => a.fitness > best.f ? {i, f: a.fitness} : best, {i: 0, f: -1});
  if (Math.random() < 0.35) rewardAgent(winner.i, 1.2);
  if (keyCount % 12 === 0) evolve();
  drawHist();
  e.preventDefault();
});

// click rhythm fallback
document.getElementById('grid').addEventListener('click', () => {
  // already handled per portal
});

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f750-es', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

async function seal() {
  if (!bestGenome) return;
  try {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ genome: bestGenome, fitness: bestFitness, t: Date.now() }, 'best');
    await new Promise(r => tx.oncomplete = r);
    bc.postMessage({ type: 'genome', genome: bestGenome, fitness: bestFitness });
    document.getElementById('msg').textContent = 'sealed & broadcast';
  } catch (err) {
    document.getElementById('msg').textContent = 'seal failed (in-mem only)';
  }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initAgents(); renderGrid(); bestFitness = -Infinity; keyCount = 0; };

async function init() {
  try {
    db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        bestGenome = req.result.genome;
        bestFitness = req.result.fitness || 0;
        agents[0].genome = bestGenome.slice();
        document.getElementById('msg').textContent = 'loaded sealed';
        renderGrid();
      }
    };
  } catch (e) { console.warn(e); }
  bc = new BroadcastChannel('f750-genomes');
  bc.onmessage = (ev) => {
    const { genome, fitness } = ev.data;
    if (fitness > bestFitness) {
      bestFitness = fitness;
      bestGenome = genome.slice();
      agents[0].genome = genome.slice();
      agents[0].fitness = fitness * 0.5;
      document.getElementById('msg').textContent = 'adopted foreign genome';
      document.getElementById('fit').textContent = bestFitness.toFixed(1);
      renderGrid();
    }
  };
  initAgents();
  renderGrid();
  drawHist();
}

init();
