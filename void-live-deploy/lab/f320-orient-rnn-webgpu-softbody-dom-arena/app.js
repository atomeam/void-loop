const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const musclesDiv = document.getElementById('muscles');
const status = document.getElementById('status');
const agentSpan = document.getElementById('agent');

let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Softbody: simple mass-spring grid 5x5 nodes
const N = 5;
const nodes = [];
const springs = [];
for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
  nodes.push({ x: W/2 + (x-2)*40, y: H/2 + (y-2)*40, vx:0, vy:0, ox:0, oy:0 });
}
nodes.forEach((n,i) => { n.ox = n.x; n.oy = n.y; });
// Springs: horizontal, vertical, diagonal
function addSpring(a,b,rest) { springs.push({ a, b, rest, k:0.1, d:0.02 }); }
for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
  const i = y*N + x;
  if (x < N-1) addSpring(i, i+1, 40);
  if (y < N-1) addSpring(i, i+N, 40);
  if (x < N-1 && y < N-1) addSpring(i, i+N+1, 56);
}

// Tiny RNN: input [orientX, orientY, speed, tension], hidden 8, output [k_mod, d_mod, forceX, forceY]
class TinyRNN {
  constructor() {
    this.h = new Array(8).fill(0);
    this.Whh = Array.from({length:8}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.5));
    this.Wxh = Array.from({length:8}, () => Array.from({length:4}, () => (Math.random()-0.5)*0.5));
    this.Why = Array.from({length:4}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.5));
    this.bh = new Array(8).fill(0);
    this.by = new Array(4).fill(0);
  }
  step(x) { // x: [4]
    const hNew = new Array(8).fill(0);
    for (let i=0; i<8; i++) {
      let s = this.bh[i];
      for (let j=0; j<8; j++) s += this.Whh[i][j] * this.h[j];
      for (let j=0; j<4; j++) s += this.Wxh[i][j] * x[j];
      hNew[i] = Math.tanh(s);
    }
    this.h = hNew;
    const y = new Array(4).fill(0);
    for (let i=0; i<4; i++) {
      let s = this.by[i];
      for (let j=0; j<8; j++) s += this.Why[i][j] * this.h[j];
      y[i] = Math.tanh(s);
    }
    return y;
  }
  serialize() { return { Whh:this.Whh, Wxh:this.Wxh, Why:this.Why, bh:this.bh, by:this.by }; }
  load(s) { Object.assign(this, s); }
}

const agents = Array.from({length:4}, () => ({ rnn: new TinyRNN(), score:0 }));
let current = 0;
let orient = { beta:0, gamma:0 }; // pitch, roll
let pointer = { x:0, y:0, down:false };

// DOM muscles (one per some nodes)
const muscleNodes = [0,4,12,20,24]; // corners + center
const muscles = muscleNodes.map(i => {
  const el = document.createElement('div');
  el.className = 'muscle';
  musclesDiv.appendChild(el);
  return { el, node: nodes[i] };
});

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
  // Request permission on iOS
  document.body.addEventListener('click', () => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') status.textContent = 'Orientation granted'; });
    }
  }, {once:true});
}

// Pointer
canvas.addEventListener('pointerdown', e => { pointer.down=true; pointer.x=e.clientX; pointer.y=e.clientY; });
window.addEventListener('pointermove', e => { if (pointer.down) { pointer.x=e.clientX; pointer.y=e.clientY; } });
window.addEventListener('pointerup', () => pointer.down=false);

// Physics step
function stepPhysics() {
  const rnn = agents[current].rnn;
  const speed = Math.hypot(pointer.x - W/2, pointer.y - H/2) / 200;
  const input = [
    Math.sin(orient.gamma * Math.PI/180),
    Math.sin(orient.beta * Math.PI/180),
    Math.min(1, speed),
    0.5 // tension placeholder
  ];
  const out = rnn.step(input);
  const kMod = 0.08 + out[0]*0.06;
  const dMod = 0.015 + out[1]*0.02;
  const fx = out[2] * 2 + (orient.gamma||0)*0.05 + (pointer.down ? (pointer.x - W/2)*0.01 : 0);
  const fy = out[3] * 2 + (orient.beta||0)*0.05 + (pointer.down ? (pointer.y - H/2)*0.01 : 0);

  // Forces
  nodes.forEach(n => { n.ax = fx*0.5; n.ay = fy*0.5 + 0.05; }); // gravity-ish
  springs.forEach(s => {
    const a = nodes[s.a], b = nodes[s.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx,dy) || 1;
    const force = (dist - s.rest) * kMod;
    const nx = dx/dist, ny = dy/dist;
    a.ax += nx * force; a.ay += ny * force;
    b.ax -= nx * force; b.ay -= ny * force;
    // damping
    const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
    a.ax += dvx * dMod; a.ay += dvy * dMod;
    b.ax -= dvx * dMod; b.ay -= dvy * dMod;
  });

  nodes.forEach(n => {
    n.vx = (n.vx + n.ax) * 0.98;
    n.vy = (n.vy + n.ay) * 0.98;
    n.x += n.vx;
    n.y += n.vy;
    // bounds soft
    if (n.x < 20) n.vx += 1; if (n.x > W-20) n.vx -= 1;
    if (n.y < 20) n.vy += 1; if (n.y > H-20) n.vy -= 1;
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#4af';
  ctx.lineWidth = 1;
  springs.forEach(s => {
    const a = nodes[s.a], b = nodes[s.b];
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  });
  ctx.fillStyle = '#adf';
  nodes.forEach(n => { ctx.beginPath(); ctx.arc(n.x,n.y,4,0,Math.PI*2); ctx.fill(); });

  // Update DOM muscles
  muscles.forEach(m => {
    const n = m.node;
    m.el.style.left = (n.x - 20) + 'px';
    m.el.style.top = (n.y - 20) + 'px';
    const stretch = Math.hypot(n.x - n.ox, n.y - n.oy) / 50;
    m.el.style.transform = `scale(${1 + stretch*0.5})`;
    m.el.style.opacity = 0.5 + Math.min(0.5, stretch);
  });
}

function loop() {
  stepPhysics();
  draw();
  requestAnimationFrame(loop);
}
loop();

// UI
document.getElementById('next').onclick = () => { current = (current+1)%4; agentSpan.textContent = current; status.textContent = `Agent ${current} score ${agents[current].score}`; };
document.getElementById('score').onclick = () => { agents[current].score++; status.textContent = `Agent ${current} scored! ${agents[current].score}`; };

function seal() {
  const data = { agent: current, genome: agents[current].rnn.serialize(), score: agents[current].score, ts: Date.now() };
  const key = 'F320-genome-' + current;
  const req = indexedDB.open('F320Arena', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, key);
    status.textContent = 'Sealed to IndexedDB';
  };
  req.onerror = () => status.textContent = 'IDB failed (in-memory only)';
}
document.getElementById('seal').onclick = seal;

document.getElementById('load').onclick = () => {
  const key = 'F320-genome-' + current;
  const req = indexedDB.open('F320Arena', 1);
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readonly');
    const g = tx.objectStore('genomes').get(key);
    g.onsuccess = () => {
      if (g.result) {
        agents[current].rnn.load(g.result.genome);
        agents[current].score = g.result.score || 0;
        status.textContent = 'Loaded genome';
      } else status.textContent = 'No sealed genome';
    };
  };
};

document.getElementById('export').onclick = () => {
  const data = JSON.stringify({ agent:current, genome: agents[current].rnn.serialize(), score:agents[current].score });
  navigator.clipboard.writeText(data).then(() => status.textContent = 'Exported to clipboard').catch(() => status.textContent = 'Copy failed');
};
document.getElementById('import').onclick = () => {
  const s = prompt('Paste genome JSON:');
  if (!s) return;
  try {
    const data = JSON.parse(s);
    if (data.genome) {
      agents[current].rnn.load(data.genome);
      status.textContent = 'Imported genome';
    }
  } catch(e) { status.textContent = 'Invalid JSON'; }
};

// WebGPU note: in a full version the particle update would be a compute shader; this uses JS for reliability and offline demo.
status.textContent = 'Ready. Tilt or drag to deform. ' + (window.DeviceOrientationEvent ? 'Orientation available.' : 'Pointer only.');
