const N_AGENTS = 6;
const H = 8; // hidden size
const INPUT = 4; // orient history deltas + residual
const agents = [];
let orient = { beta:0, gamma:0, alpha:0 };
let lastOrient = { ...orient };
let residual = 0;
const bc = new BroadcastChannel('f866-genome');
const svg = document.getElementById('stage');

function randn() { return (Math.random()-0.5)*0.2; }
function tanh(x) { return Math.tanh(x); }
function dTanh(x) { return 1 - x*x; }

class Agent {
  constructor(id, x, y) {
    this.id = id;
    this.x = x; this.y = y;
    this.fitness = 0;
    this.hidden = new Array(H).fill(0);
    this.Wxh = Array.from({length:H}, () => Array.from({length:INPUT}, randn));
    this.Whh = Array.from({length:H}, () => Array.from({length:H}, randn));
    this.Why = Array.from({length:2}, () => Array.from({length:H}, randn)); // dx, dy morph
    this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.group.classList.add('agent');
    this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.path.setAttribute('fill', `hsl(${id*60},70%,50%)`);
    this.path.setAttribute('opacity', '0.7');
    this.group.appendChild(this.path);
    svg.appendChild(this.group);
    this.group.addEventListener('click', () => { this.fitness += 1; this.updateStatus(); });
  }
  step(input) {
    const newH = new Array(H);
    for (let i=0; i<H; i++) {
      let s = 0;
      for (let j=0; j<INPUT; j++) s += this.Wxh[i][j] * input[j];
      for (let j=0; j<H; j++) s += this.Whh[i][j] * this.hidden[j];
      newH[i] = tanh(s);
    }
    this.hidden = newH;
    let dx=0, dy=0;
    for (let i=0; i<H; i++) {
      dx += this.Why[0][i] * this.hidden[i];
      dy += this.Why[1][i] * this.hidden[i];
    }
    this.x = (this.x + dx * 2 + 1000) % 1000;
    this.y = (this.y + dy * 2 + 600) % 600;
    // residual reward
    this.fitness -= Math.abs(residual) * 0.01;
    if (this.fitness < 0) this.fitness = 0;
    this.morphPath();
  }
  morphPath() {
    const r = 30 + this.fitness * 2;
    const pts = [];
    for (let a=0; a<8; a++) {
      const ang = a * Math.PI / 4 + residual;
      const rr = r * (0.7 + 0.3 * Math.sin(a + this.hidden[0]));
      pts.push(`${this.x + Math.cos(ang)*rr},${this.y + Math.sin(ang)*rr}`);
    }
    this.path.setAttribute('d', `M${pts.join(' L')} Z`);
    this.group.setAttribute('transform', `translate(0,0)`);
  }
  getGenome() { return { id:this.id, Wxh:this.Wxh, Whh:this.Whh, Why:this.Why, fitness:this.fitness }; }
  setGenome(g) { this.Wxh=g.Wxh; this.Whh=g.Whh; this.Why=g.Why; this.fitness = g.fitness || 0; }
  updateStatus() {}
}

function init() {
  for (let i=0; i<N_AGENTS; i++) {
    agents.push(new Agent(i, 100 + (i%3)*300, 100 + Math.floor(i/3)*200));
  }
  window.addEventListener('deviceorientation', e => {
    lastOrient = { ...orient };
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
    orient.alpha = e.alpha || 0;
  });
  // pointer fallback
  let px=0, py=0;
  window.addEventListener('pointermove', e => {
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    residual = Math.hypot(dx, dy) * 0.01;
    orient.beta += dx * 0.1;
    orient.gamma += dy * 0.1;
  });
  document.getElementById('share').onclick = shareBest;
  document.getElementById('load').onclick = loadIDB;
  bc.onmessage = e => { if (e.data.type==='genome') applyGenome(e.data.genome); };
  requestAnimationFrame(loop);
  loadIDB();
}

function loop() {
  const db = orient.beta - lastOrient.beta;
  const dg = orient.gamma - lastOrient.gamma;
  const pred = residual; // simple
  residual = Math.abs(db) + Math.abs(dg) - pred;
  const input = [db*0.01, dg*0.01, residual, Math.sin(Date.now()*0.001)];
  agents.forEach(a => a.step(input));
  // evolve: mutate worst occasionally
  if (Math.random() < 0.02) {
    const worst = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
    worst.Wxh = worst.Wxh.map(r => r.map(v => v + randn()*0.05));
  }
  requestAnimationFrame(loop);
}

function shareBest() {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const g = best.getGenome();
  bc.postMessage({ type:'genome', genome:g });
  saveIDB(g);
  document.getElementById('status').textContent = `Broadcast genome fitness ${g.fitness.toFixed(1)}`;
}

function applyGenome(g) {
  const worst = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
  worst.setGenome(g);
  document.getElementById('status').textContent = `Received genome into agent ${worst.id}`;
}

async function saveIDB(g) {
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ key:'best', ...g });
  } catch (e) { console.debug("lab f866-orientation-predictive-rnn-svg-genome:", e); }
}

async function loadIDB() {
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => { if (req.result) applyGenome(req.result); };
  } catch (e) { console.debug("lab f866-orientation-predictive-rnn-svg-genome:", e); }
}

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f866', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath:'key' });
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

init();
