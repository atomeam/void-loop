const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const agentsDiv = document.getElementById('agents');
const status = document.getElementById('status');
let W = innerWidth, H = innerHeight;
function resize() { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; }
addEventListener('resize', resize); resize();

// Simple MLP
class MLP {
  constructor(inp=6, hid=8, out=3) {
    this.w1 = Array.from({length:hid}, () => Array.from({length:inp}, () => (Math.random()-0.5)*0.5));
    this.b1 = Array.from({length:hid}, () => 0);
    this.w2 = Array.from({length:out}, () => Array.from({length:hid}, () => (Math.random()-0.5)*0.5));
    this.b2 = Array.from({length:out}, () => 0);
  }
  forward(x) {
    const h = this.w1.map((row,i) => Math.tanh(row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    return this.w2.map((row,i) => row.reduce((s,w,j)=>s+w*h[j], this.b2[i]));
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.map(r => [...r]); m.b1 = [...this.b1];
    m.w2 = this.w2.map(r => [...r]); m.b2 = [...this.b2];
    return m;
  }
  mutate(rate=0.1) {
    const mut = a => a.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = this.w1.map(mut); this.b1 = mut(this.b1);
    this.w2 = this.w2.map(mut); this.b2 = mut(this.b2);
  }
  serialize() { return {w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2}; }
  static deserialize(o) {
    const m = new MLP();
    m.w1 = o.w1; m.b1 = o.b1; m.w2 = o.w2; m.b2 = o.b2;
    return m;
  }
}

// Agents
const agents = [];
const NUM = 10;
const colors = ['#ff6b6b','#4ecdc4','#ffe66d','#a8e6cf','#ff8b94','#6c5ce7','#00b894','#fd79a8','#fdcb6e','#74b9ff'];
function spawn(i, genome=null) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = i;
  el.style.background = colors[i % colors.length];
  agentsDiv.appendChild(el);
  const a = {
    el, id:i,
    x: Math.random()*W, y: Math.random()*H,
    vx:0, vy:0,
    mlp: genome ? MLP.deserialize(genome) : new MLP(),
    energy: 50,
    hue: Math.random()*360
  };
  agents.push(a);
  return a;
}
for(let i=0;i<NUM;i++) spawn(i);

// Orientation
let alpha=0, beta=0, gamma=0, orientGranted=false;
async function requestOrient() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') { orientGranted = true; status.textContent = 'Orientation granted. Tilt to influence.'; }
    } catch(e) { status.textContent = 'Permission denied; using pointer.'; }
  } else {
    orientGranted = true;
    status.textContent = 'Orientation available. Tilt to influence.';
  }
}
addEventListener('deviceorientation', e => {
  if (!orientGranted && e.alpha == null) return;
  alpha = e.alpha || 0; beta = e.beta || 0; gamma = e.gamma || 0;
});
document.getElementById('perm').onclick = requestOrient;

// Pointer influence
let px = W/2, py = H/2, dragging = null;
addEventListener('pointerdown', e => { px=e.clientX; py=e.clientY; });
addEventListener('pointermove', e => { px=e.clientX; py=e.clientY; });
agentsDiv.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('agent')) {
    dragging = agents.find(a => a.el === e.target);
    e.target.style.cursor = 'grabbing';
  }
});
addEventListener('pointerup', () => { if(dragging) dragging.el.style.cursor='grab'; dragging=null; });

// Density field
const GRID = 40;
const dens = Array.from({length:GRID}, () => Array(GRID).fill(0));
function densAt(x,y) {
  const i = Math.floor(x / W * GRID), j = Math.floor(y / H * GRID);
  return dens[Math.max(0,Math.min(GRID-1,j))][Math.max(0,Math.min(GRID-1,i))];
}
function deposit(x,y, amt) {
  const i = Math.floor(x / W * GRID), j = Math.floor(y / H * GRID);
  if (i>=0 && i<GRID && j>=0 && j<GRID) dens[j][i] = Math.min(1, dens[j][i] + amt);
}

// BroadcastChannel genome bus
const bc = new BroadcastChannel('f769-genome');
bc.onmessage = e => {
  if (e.data.type === 'genome' && agents.length) {
    const a = agents[Math.floor(Math.random()*agents.length)];
    a.mlp = MLP.deserialize(e.data.genome);
    a.el.classList.add('transfer');
    setTimeout(() => a.el.classList.remove('transfer'), 600);
    status.textContent = 'Received sealed genome from peer/tab.';
  }
};

// IndexedDB
let db;
const req = indexedDB.open('f769-genomes', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; loadTop(); };
function sealTop() {
  if (!db) return;
  const sorted = [...agents].sort((a,b)=>b.energy - a.energy).slice(0,3);
  const tx = db.transaction('genomes','readwrite');
  sorted.forEach((a,i) => tx.objectStore('genomes').put({id:i, genome:a.mlp.serialize(), energy:a.energy}));
  status.textContent = 'Sealed top 3 genomes to IndexedDB.';
}
function loadTop() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  const g = tx.objectStore('genomes').getAll();
  g.onsuccess = () => {
    if (g.result.length) {
      g.result.forEach((item,i) => { if (agents[i]) agents[i].mlp = MLP.deserialize(item.genome); });
      status.textContent = 'Loaded sealed genomes.';
    }
  };
}
document.getElementById('seal').onclick = sealTop;
document.getElementById('reset').onclick = () => { agents.forEach(a => a.mlp = new MLP()); status.textContent = 'Agents reset.'; };

// Animation
function step() {
  // Decay density
  for(let j=0;j<GRID;j++) for(let i=0;i<GRID;i++) dens[j][i] *= 0.98;
  // Update agents
  const inputBase = [
    Math.sin(alpha*Math.PI/180), Math.cos(beta*Math.PI/180), Math.sin(gamma*Math.PI/180),
    (px/W-0.5)*2, (py/H-0.5)*2, Math.sin(Date.now()/1000)
  ];
  agents.forEach(a => {
    const out = a.mlp.forward(inputBase);
    const speed = 1.2;
    a.vx += out[0]*0.15; a.vy += out[1]*0.15;
    a.vx *= 0.92; a.vy *= 0.92;
    // Pointer attract if close
    const dx = px - a.x, dy = py - a.y, d = Math.hypot(dx,dy);
    if (d < 120) { a.vx += dx/d*0.3; a.vy += dy/d*0.3; }
    a.x += a.vx * speed; a.y += a.vy * speed;
    if (a.x < 0) a.x = 0, a.vx *= -0.5;
    if (a.x > W) a.x = W, a.vx *= -0.5;
    if (a.y < 0) a.y = 0, a.vy *= -0.5;
    if (a.y > H) a.y = H, a.vy *= -0.5;
    a.el.style.left = (a.x-14)+'px';
    a.el.style.top = (a.y-14)+'px';
    // Energy from density
    const densVal = densAt(a.x, a.y);
    a.energy += densVal * 0.5 - 0.02;
    a.energy = Math.max(0, Math.min(100, a.energy));
    deposit(a.x, a.y, 0.05 * (a.energy/50));
    a.el.style.opacity = 0.6 + a.energy/200;
    a.el.textContent = Math.round(a.energy);
  });
  // Collisions / genome transfer
  for(let i=0;i<agents.length;i++) for(let j=i+1;j<agents.length;j++) {
    const a=agents[i], b=agents[j];
    const d = Math.hypot(a.x-b.x, a.y-b.y);
    if (d < 36 && Math.random() < 0.05) {
      // Sealed transfer: better fitness donates mutated clone
      if (a.energy > b.energy) {
        b.mlp = a.mlp.clone(); b.mlp.mutate(0.08);
        bc.postMessage({type:'genome', genome:b.mlp.serialize()});
        b.el.classList.add('transfer'); setTimeout(()=>b.el.classList.remove('transfer'),400);
      } else {
        a.mlp = b.mlp.clone(); a.mlp.mutate(0.08);
        bc.postMessage({type:'genome', genome:a.mlp.serialize()});
        a.el.classList.add('transfer'); setTimeout(()=>a.el.classList.remove('transfer'),400);
      }
    }
  }
  // Draw density
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cellW = W/GRID, cellH = H/GRID;
  for(let j=0;j<GRID;j++) for(let i=0;i<GRID;i++) {
    const v = dens[j][i];
    if (v > 0.01) {
      ctx.fillStyle = `hsla(${200 + v*60}, 70%, ${20 + v*40}%, ${v*0.6})`;
      ctx.fillRect(i*cellW, j*cellH, cellW, cellH);
    }
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Initial status
status.textContent = 'F769: Tilt or drag. Click Seal to persist. Offline-capable.';
