const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const seedsDiv = document.getElementById('seeds');
let W = innerWidth, H = innerHeight;
cv.width = W; cv.height = H;
onresize = () => { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; };

const GRID = 4; // pixel scale
const GW = Math.floor(W / GRID), GH = Math.floor(H / GRID);
let sticky = new Uint8Array(GW * GH);
let walkers = [];
const N_WALKERS = 180;
const N_AGENTS = 3;
let agents = [];
let bestFitness = 0;
let bestWeights = null;
let orient = {x:0, y:0};
let ptr = {x: W/2, y: H/2, vx:0, vy:0};

// Simple MLP
function createMLP() {
  const w1 = Array.from({length:4*8}, () => (Math.random()-0.5)*0.5);
  const b1 = Array.from({length:8}, () => 0);
  const w2 = Array.from({length:8*3}, () => (Math.random()-0.5)*0.5);
  const b2 = Array.from({length:3}, () => 0);
  return {w1, b1, w2, b2, fitness: 0};
}
function forward(m, inp) {
  const h = new Array(8).fill(0);
  for (let i=0; i<8; i++) {
    let s = m.b1[i];
    for (let j=0; j<4; j++) s += inp[j] * m.w1[j*8 + i];
    h[i] = Math.tanh(s);
  }
  const o = new Array(3).fill(0);
  for (let i=0; i<3; i++) {
    let s = m.b2[i];
    for (let j=0; j<8; j++) s += h[j] * m.w2[j*3 + i];
    o[i] = Math.tanh(s);
  }
  return o; // biasX, biasY, stickP
}
function reward(m, strength=0.01) {
  // simple Hebbian nudge toward recent
  for (let i=0; i<m.w1.length; i++) m.w1[i] += (Math.random()-0.5)*strength;
  for (let i=0; i<m.w2.length; i++) m.w2[i] += (Math.random()-0.5)*strength;
  m.fitness += 1;
  if (m.fitness > bestFitness) { bestFitness = m.fitness; bestWeights = JSON.parse(JSON.stringify(m)); }
}

function init() {
  sticky.fill(0);
  // center seed
  const cx = GW>>1, cy = GH>>1;
  sticky[cy*GW + cx] = 1;
  walkers = Array.from({length: N_WALKERS}, () => ({
    x: Math.random()*GW, y: Math.random()*GH, stuck: false
  }));
  agents = Array.from({length: N_AGENTS}, createMLP);
  // seeds DOM
  seedsDiv.innerHTML = '';
  for (let i=0; i<4; i++) {
    const d = document.createElement('div');
    d.className = 'seed';
    d.textContent = 'S' + i;
    d.style.left = (20 + i*60) + 'px';
    d.style.top = (60 + (i%2)*50) + 'px';
    d.dataset.agent = i % N_AGENTS;
    makeDraggable(d);
    d.onclick = (e) => { e.stopPropagation(); reward(agents[d.dataset.agent]); status.textContent = 'rewarded agent ' + d.dataset.agent; };
    seedsDiv.appendChild(d);
  }
}
function makeDraggable(el) {
  let ox, oy;
  el.onpointerdown = e => {
    ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (e.buttons) {
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
      // inject seed
      const gx = Math.floor(el.offsetLeft / GRID), gy = Math.floor(el.offsetTop / GRID);
      if (gx>=0 && gx<GW && gy>=0 && gy<GH) sticky[gy*GW + gx] = 1;
    }
  };
}

window.addEventListener('deviceorientation', e => {
  orient.x = (e.gamma || 0)/90;
  orient.y = (e.beta || 0)/90;
});
window.addEventListener('pointermove', e => {
  ptr.vx = e.clientX - ptr.x; ptr.vy = e.clientY - ptr.y;
  ptr.x = e.clientX; ptr.y = e.clientY;
});

function step() {
  const inp = [orient.x, orient.y, ptr.vx*0.01, ptr.vy*0.01];
  // average or pick agent for global bias (or per)
  const out = forward(agents[0], inp); // primary
  const biasX = out[0]*0.8, biasY = out[1]*0.8, stickP = (out[2]+1)*0.3;

  for (let w of walkers) {
    if (w.stuck) continue;
    w.x += (Math.random()-0.5 + biasX)*1.5;
    w.y += (Math.random()-0.5 + biasY)*1.5;
    w.x = (w.x + GW) % GW; w.y = (w.y + GH) % GH;
    const ix = Math.floor(w.x), iy = Math.floor(w.y);
    // check neighbors
    let contact = false;
    for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
      const nx = (ix+dx+GW)%GW, ny = (iy+dy+GH)%GH;
      if (sticky[ny*GW + nx]) contact = true;
    }
    if (contact && Math.random() < stickP) {
      sticky[iy*GW + ix] = 1;
      w.stuck = true;
      // respawn
      w.x = Math.random()*GW; w.y = Math.random()*GH; w.stuck = false;
    }
  }
  // occasional inject from pointer
  if (Math.random() < 0.05) {
    const ix = Math.floor(ptr.x / GRID), iy = Math.floor(ptr.y / GRID);
    if (ix>=0 && ix<GW && iy>=0 && iy<GH && Math.random()<0.1) sticky[iy*GW + ix] = 1;
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#6cf';
  for (let y=0; y<GH; y++) for (let x=0; x<GW; x++) {
    if (sticky[y*GW + x]) ctx.fillRect(x*GRID, y*GRID, GRID-1, GRID-1);
  }
  // walkers faint
  ctx.fillStyle = 'rgba(200,100,255,.4)';
  for (let w of walkers) ctx.fillRect(w.x*GRID, w.y*GRID, 2, 2);
}

// Persistence
const dbName = 'verse-f792';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = () => req.result.createObjectStore('genomes', {keyPath: 'ts'});
req.onsuccess = () => { db = req.result; loadBest(); };
function loadBest() {
  const tx = db.transaction('genomes', 'readonly');
  const store = tx.objectStore('genomes');
  const r = store.getAll();
  r.onsuccess = () => {
    const all = r.result;
    if (all.length) {
      const best = all.reduce((a,b) => a.fitness > b.fitness ? a : b);
      agents[0] = best.weights; // simplify
      bestFitness = best.fitness;
      status.textContent = 'loaded sealed fitness ' + bestFitness.toFixed(1);
    }
  };
}
function seal() {
  const genome = { weights: agents[0], fitness: bestFitness, ts: Date.now() };
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(genome);
  bc.postMessage(genome);
  status.textContent = 'sealed & broadcast fitness ' + bestFitness.toFixed(1);
}
const bc = new BroadcastChannel('f792-genome');
bc.onmessage = e => {
  const g = e.data;
  if (g.fitness > bestFitness) {
    agents[0] = g.weights;
    bestFitness = g.fitness;
    status.textContent = 'adopted peer genome fitness ' + bestFitness.toFixed(1);
  }
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = init;

init();
function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}
loop();
status.textContent = 'running — tilt or move pointer, drag seeds';
