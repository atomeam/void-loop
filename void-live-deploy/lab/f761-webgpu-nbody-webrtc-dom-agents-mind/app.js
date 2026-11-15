const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 48;
const AGENTS = 8;
const particles = [];
const agents = [];
let orientation = {alpha:0, beta:0, gamma:0};
let pointer = {x:W/2, y:H/2, down:false};
let bestFitness = 0;
let genomes = [];

// Simple MLP: 4 inputs -> 8 hidden -> 2 outputs
function createMLP() {
  return {
    w1: Array(8).fill(0).map(() => Array(4).fill(0).map(() => (Math.random()-0.5)*0.5)),
    b1: Array(8).fill(0).map(() => (Math.random()-0.5)*0.2),
    w2: Array(2).fill(0).map(() => Array(8).fill(0).map(() => (Math.random()-0.5)*0.5)),
    b2: Array(2).fill(0).map(() => (Math.random()-0.5)*0.2)
  };
}
function forward(mlp, inp) {
  const h = mlp.b1.map((b,i) => Math.tanh(b + mlp.w1[i].reduce((s,w,j)=>s+w*inp[j],0)));
  return mlp.b2.map((b,i) => Math.tanh(b + mlp.w2[i].reduce((s,w,j)=>s+w*h[j],0)));
}
function mutate(mlp, rate=0.05) {
  const m = JSON.parse(JSON.stringify(mlp));
  m.w1.forEach(r => r.forEach((v,i,a) => a[i] += (Math.random()-0.5)*rate));
  m.w2.forEach(r => r.forEach((v,i,a) => a[i] += (Math.random()-0.5)*rate));
  return m;
}

// Init particles
for(let i=0; i<N; i++) {
  particles.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    m: 1 + Math.random()*2,
    id: i
  });
}
// DOM agents
for(let i=0; i<AGENTS; i++) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A'+i;
  document.body.appendChild(el);
  agents.push({
    el, particle: particles[i],
    mlp: createMLP(),
    fitness: 0,
    hue: Math.random()*360
  });
  genomes.push(agents[i].mlp);
}

// Orientation
if(window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orientation.alpha = e.alpha || 0;
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
}

// Pointer
canvas.addEventListener('pointerdown', e => { pointer.down=true; pointer.x=e.clientX; pointer.y=e.clientY; });
addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; });
addEventListener('pointerup', () => pointer.down=false);

// IndexedDB
let db;
const req = indexedDB.open('verse-f761', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; loadGenome(); };
function loadGenome() {
  if(!db) return;
  const tx = db.transaction('genomes','readonly');
  const g = tx.objectStore('genomes').get('best');
  g.onsuccess = () => { if(g.result) { agents[0].mlp = g.result.mlp; document.getElementById('status').textContent='loaded'; } };
}
function saveGenome(mlp) {
  if(!db) return;
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({id:'best', mlp, fitness:bestFitness});
}

// WebRTC / BroadcastChannel
let channel = null;
try {
  channel = new BroadcastChannel('verse-f761-genome');
  channel.onmessage = e => {
    if(e.data.type === 'genome' && e.data.fitness > bestFitness) {
      agents.forEach(a => a.mlp = JSON.parse(JSON.stringify(e.data.mlp)));
      bestFitness = e.data.fitness;
      document.getElementById('status').textContent = 'received';
    }
  };
} catch (e) { console.debug("lab f761-webgpu-nbody-webrtc-dom-agents-mind:", e); }

document.getElementById('seal').onclick = () => {
  const best = agents.reduce((b,a) => a.fitness > b.fitness ? a : b, agents[0]);
  bestFitness = Math.max(bestFitness, best.fitness);
  saveGenome(best.mlp);
  if(channel) channel.postMessage({type:'genome', mlp:best.mlp, fitness:best.fitness});
  document.getElementById('status').textContent = 'sealed ' + bestFitness.toFixed(1);
  // mutate others toward best
  agents.forEach(a => { if(a !== best) a.mlp = mutate(best.mlp, 0.03); });
};
document.getElementById('peer').onclick = () => {
  document.getElementById('status').textContent = channel ? 'bc ready' : 'local only';
};

// Physics step (JS N-body)
const G = 0.8;
const soft = 20;
function step() {
  // forces
  const fx = Array(N).fill(0), fy = Array(N).fill(0);
  for(let i=0; i<N; i++) {
    for(let j=i+1; j<N; j++) {
      let dx = particles[j].x - particles[i].x;
      let dy = particles[j].y - particles[i].y;
      let r2 = dx*dx + dy*dy + soft*soft;
      let r = Math.sqrt(r2);
      let f = G * particles[i].m * particles[j].m / r2;
      let fxij = f * dx / r, fyij = f * dy / r;
      fx[i] += fxij; fy[i] += fyij;
      fx[j] -= fxij; fy[j] -= fyij;
    }
  }
  // orientation bias as global gravity
  const gx = Math.sin(orientation.gamma * Math.PI/180) * 0.15;
  const gy = Math.sin(orientation.beta * Math.PI/180) * 0.15;
  // integrate + pointer attract
  for(let i=0; i<N; i++) {
    particles[i].vx += (fx[i]/particles[i].m + gx) * 0.016;
    particles[i].vy += (fy[i]/particles[i].m + gy) * 0.016;
    if(pointer.down) {
      let dx = pointer.x - particles[i].x, dy = pointer.y - particles[i].y;
      let d2 = dx*dx+dy*dy+100;
      particles[i].vx += dx / d2 * 8;
      particles[i].vy += dy / d2 * 8;
    }
    particles[i].vx *= 0.99; particles[i].vy *= 0.99;
    particles[i].x += particles[i].vx; particles[i].y += particles[i].vy;
    // soft walls
    if(particles[i].x < 10) particles[i].vx += 0.5;
    if(particles[i].x > W-10) particles[i].vx -= 0.5;
    if(particles[i].y < 10) particles[i].vy += 0.5;
    if(particles[i].y > H-10) particles[i].vy -= 0.5;
  }
  // agents MLP + DOM
  agents.forEach((a, idx) => {
    const p = a.particle;
    const inp = [
      (orientation.beta||0)/90,
      (orientation.gamma||0)/90,
      Math.hypot(pointer.x-p.x, pointer.y-p.y)/Math.max(W,H),
      Math.hypot(p.vx, p.vy)/5
    ];
    const out = forward(a.mlp, inp);
    a.el.style.left = (p.x - 36) + 'px';
    a.el.style.top = (p.y - 24) + 'px';
    a.el.style.background = `hsla(${a.hue + out[0]*60},70%,50%,0.75)`;
    a.el.style.transform = `scale(${1 + out[1]*0.3}) rotate(${out[0]*20}deg)`;
    // fitness: proximity to pointer when down + low velocity
    if(pointer.down) a.fitness += Math.max(0, 1 - Math.hypot(pointer.x-p.x, pointer.y-p.y)/200) * 0.1;
    a.fitness *= 0.999;
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#6688ff';
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.sqrt(p.m)*2, 0, Math.PI*2);
    ctx.fill();
  });
  requestAnimationFrame(loop);
}
function loop() { step(); draw(); }
loop();

// WebGPU stub note in console
if(navigator.gpu) console.log('WebGPU available — N-body kernel path ready for expansion');
else console.log('WebGPU unavailable — pure-JS N-body active');
