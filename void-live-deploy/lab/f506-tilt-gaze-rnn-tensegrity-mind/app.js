const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const agentsEl = document.getElementById('agents');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// --- IndexedDB helpers ---
const DB_NAME = 'tensegrity-mind', STORE = 'genomes';
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = rej;
  });
}
async function saveGenome(id, genome) {
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({ id, genome, t: Date.now() });
  return new Promise(r => tx.oncomplete = r);
}
async function loadGenome(id) {
  return new Promise(res => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => res(req.result ? req.result.genome : null);
  });
}

// --- BroadcastChannel for sealed transfer ---
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tensegrity-genomes') : null;
if (bc) bc.onmessage = e => {
  if (e.data.type === 'genome') {
    statusEl.textContent = 'Received sealed genome from other tab';
    // Accept into agent 1
    agents[1].genome = e.data.genome;
    agents[1].hash = e.data.hash;
  }
};

// --- Simple causal RNN (Elman-style, tiny) ---
class CausalRNN {
  constructor(inputSize = 6, hidden = 12, output = 4) {
    this.inputSize = inputSize; this.hidden = hidden; this.output = output;
    this.Whh = randMat(hidden, hidden, 0.2);
    this.Wxh = randMat(hidden, inputSize, 0.3);
    this.Why = randMat(output, hidden, 0.3);
    this.bh = zeros(hidden); this.by = zeros(output);
    this.h = zeros(hidden);
  }
  step(x) { // x: Float32Array inputSize
    const hNew = zeros(this.hidden);
    for (let i = 0; i < this.hidden; i++) {
      let s = this.bh[i];
      for (let j = 0; j < this.hidden; j++) s += this.Whh[i][j] * this.h[j];
      for (let j = 0; j < this.inputSize; j++) s += this.Wxh[i][j] * x[j];
      hNew[i] = Math.tanh(s);
    }
    this.h = hNew;
    const y = zeros(this.output);
    for (let i = 0; i < this.output; i++) {
      let s = this.by[i];
      for (let j = 0; j < this.hidden; j++) s += this.Why[i][j] * this.h[j];
      y[i] = Math.tanh(s) * 0.5;
    }
    return y;
  }
  clone() {
    const c = new CausalRNN(this.inputSize, this.hidden, this.output);
    c.Whh = this.Whh.map(r => [...r]); c.Wxh = this.Wxh.map(r => [...r]);
    c.Why = this.Why.map(r => [...r]); c.bh = [...this.bh]; c.by = [...this.by];
    return c;
  }
  mutate(rate = 0.08) {
    const m = (arr) => arr.map(v => v + (Math.random()-0.5)*rate);
    this.Whh = this.Whh.map(r => m(r));
    this.Wxh = this.Wxh.map(r => m(r));
    this.Why = this.Why.map(r => m(r));
    this.bh = m(this.bh); this.by = m(this.by);
  }
  toJSON() { return { Whh:this.Whh, Wxh:this.Wxh, Why:this.Why, bh:this.bh, by:this.by }; }
  fromJSON(o) { Object.assign(this, o); }
}
function randMat(r,c,s){ return Array.from({length:r},()=>Array.from({length:c},()=>(Math.random()-0.5)*s)); }
function zeros(n){ return new Float32Array(n); }

// --- Tensegrity lattice ---
const N = 28;
const nodes = [];
const edges = []; // {a,b, rest, k, type:'cable'|'strut'}
function initLattice() {
  nodes.length = 0; edges.length = 0;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    nodes.push({
      x: W/2 + Math.cos(a)*180 + (Math.random()-0.5)*40,
      y: H/2 + Math.sin(a)*140 + (Math.random()-0.5)*40,
      vx:0, vy:0, mass:1
    });
  }
  // Connect nearby + some long for tensegrity
  for (let i = 0; i < N; i++) {
    for (let j = i+1; j < N; j++) {
      const dx = nodes[i].x-nodes[j].x, dy = nodes[i].y-nodes[j].y;
      const d = Math.hypot(dx,dy);
      if (d < 160 && Math.random() < 0.35) {
        edges.push({ a:i, b:j, rest: d * (0.85 + Math.random()*0.3), k: 0.04 + Math.random()*0.06, type: Math.random()<0.6?'cable':'strut' });
      }
    }
  }
  // Ensure connectivity
  for (let i = 0; i < N-1; i++) {
    if (!edges.some(e => (e.a===i&&e.b===i+1)||(e.a===i+1&&e.b===i))) {
      const d = Math.hypot(nodes[i].x-nodes[i+1].x, nodes[i].y-nodes[i+1].y);
      edges.push({ a:i, b:i+1, rest:d*0.9, k:0.05, type:'cable' });
    }
  }
}

// --- Agents ---
const agents = [
  { id:0, name:'Agent A', genome:{kScale:1, restScale:1, rnn: new CausalRNN()}, energy:0, score:0, hash:'' },
  { id:1, name:'Agent B', genome:{kScale:1, restScale:1, rnn: new CausalRNN()}, energy:0, score:0, hash:'' }
];
let active = 0;

function seal(genome) {
  // Simple hash of stringified
  const s = JSON.stringify(genome.rnn.toJSON()) + genome.kScale + genome.restScale;
  let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0;
  return h.toString(16);
}

// --- Physics step ---
let tiltX = 0, tiltY = 0;
let pointer = {x:W/2, y:H/2, down:false};
function physics() {
  const ag = agents[active];
  const rnn = ag.genome.rnn;
  // Causal input: tilt + pointer delta + last energy proxy
  const inp = new Float32Array([
    tiltX*2, tiltY*2,
    (pointer.x - W/2)/W, (pointer.y - H/2)/H,
    Math.min(1, ag.energy*0.01), Math.sin(performance.now()*0.001)
  ]);
  const out = rnn.step(inp); // force biases

  // Forces
  for (const n of nodes) { n.fx = tiltX*0.3 + out[0]*0.2; n.fy = tiltY*0.3 + 0.04 + out[1]*0.2; } // gravity + tilt + rnn
  let energy = 0;
  for (const e of edges) {
    const na = nodes[e.a], nb = nodes[e.b];
    let dx = nb.x - na.x, dy = nb.y - na.y;
    let dist = Math.hypot(dx,dy) || 0.01;
    const rest = e.rest * ag.genome.restScale;
    const k = e.k * ag.genome.kScale * (e.type==='cable'?1:0.7);
    const force = (dist - rest) * k;
    if (e.type==='strut' && force < 0) continue; // struts only compress
    const fx = (dx/dist)*force, fy = (dy/dist)*force;
    na.fx += fx; na.fy += fy;
    nb.fx -= fx; nb.fy -= fy;
    energy += 0.5 * k * (dist-rest)**2;
  }
  // Pointer attraction if down
  if (pointer.down) {
    for (const n of nodes) {
      const dx = pointer.x - n.x, dy = pointer.y - n.y;
      const d2 = dx*dx+dy*dy;
      if (d2 < 12000) {
        const f = 80 / (Math.sqrt(d2)+10);
        n.fx += dx * f * 0.01; n.fy += dy * f * 0.01;
      }
    }
  }
  // Integrate
  const damp = 0.92;
  for (const n of nodes) {
    n.vx = (n.vx + n.fx / n.mass) * damp;
    n.vy = (n.vy + n.fy / n.mass) * damp;
    n.x += n.vx; n.y += n.vy;
    // Bounds
    if (n.x<20) { n.x=20; n.vx*=-0.5; }
    if (n.x>W-20) { n.x=W-20; n.vx*=-0.5; }
    if (n.y<20) { n.y=20; n.vy*=-0.5; }
    if (n.y>H-20) { n.y=H-20; n.vy*=-0.5; }
  }
  ag.energy = energy;
  ag.score = 1000 / (1 + energy) + (pointer.down ? 5 : 0);
}

// --- Render ---
function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  // Edges
  for (const e of edges) {
    const na = nodes[e.a], nb = nodes[e.b];
    ctx.beginPath();
    ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = e.type==='cable' ? 'rgba(100,180,255,0.6)' : 'rgba(255,140,80,0.5)';
    ctx.lineWidth = e.type==='cable' ? 1.2 : 2.2;
    ctx.stroke();
  }
  // Nodes
  for (const n of nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#eef';
    ctx.fill();
  }
  // Pointer
  if (pointer.down) {
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI*2);
    ctx.strokeStyle = '#8f8'; ctx.stroke();
  }
}

// --- Input ---
canvas.addEventListener('pointerdown', e => { pointer.down=true; pointer.x=e.clientX; pointer.y=e.clientY; });
addEventListener('pointermove', e => { if(pointer.down){ pointer.x=e.clientX; pointer.y=e.clientY; } });
addEventListener('pointerup', () => pointer.down=false);
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
  });
}

// --- UI ---
function updateHUD() {
  agentsEl.innerHTML = agents.map((a,i) => // void-review: ok (built from this file's own constants and numbers, no user text)
    `<div style="margin:4px 0;${i===active?'color:#8f8;font-weight:bold':''}">
      ${a.name} score:${a.score.toFixed(1)} energy:${a.energy.toFixed(0)}
      <button data-i="${i}" class="sel">select</button>
    </div>`).join('');
  agentsEl.querySelectorAll('.sel').forEach(b => b.onclick = () => { active = +b.dataset.i; });
  statusEl.textContent = `Tilt: ${tiltX.toFixed(2)},${tiltY.toFixed(2)} | Active: ${agents[active].name} | Nodes:${N} Edges:${edges.length}`;
}

document.getElementById('btnEvolve').onclick = () => {
  // Simple competition: mutate loser toward winner or random
  const scores = agents.map(a=>a.score);
  const win = scores[0] > scores[1] ? 0 : 1;
  const lose = 1-win;
  agents[lose].genome.rnn = agents[win].genome.rnn.clone();
  agents[lose].genome.rnn.mutate(0.12);
  agents[lose].genome.kScale = agents[win].genome.kScale * (0.9+Math.random()*0.2);
  agents[lose].genome.restScale = agents[win].genome.restScale * (0.9+Math.random()*0.2);
  agents[lose].hash = seal(agents[lose].genome);
  statusEl.textContent = `Evolved ${agents[lose].name} from ${agents[win].name}`;
  saveGenome(lose, agents[lose].genome.toJSON ? agents[lose].genome : agents[lose].genome);
};
document.getElementById('btnTransfer').onclick = () => {
  const g = agents[active].genome;
  const hash = seal(g);
  agents[active].hash = hash;
  if (bc) bc.postMessage({ type:'genome', genome: g, hash });
  statusEl.textContent = `Sealed & broadcast hash ${hash.slice(0,8)}…`;
  saveGenome(active, g);
};
document.getElementById('btnReset').onclick = () => { initLattice(); };

// --- Loop ---
async function start() {
  await openDB();
  // Try load
  for (let i=0;i<2;i++) {
    const g = await loadGenome(i);
    if (g && g.rnn) {
      agents[i].genome.rnn.fromJSON(g.rnn);
      agents[i].genome.kScale = g.kScale || 1;
      agents[i].genome.restScale = g.restScale || 1;
    }
  }
  initLattice();
  statusEl.textContent = 'Ready · tilt device or drag nodes · open second tab for transfer';
  function loop() {
    physics();
    render();
    updateHUD();
    requestAnimationFrame(loop);
  }
  loop();
}
start();
