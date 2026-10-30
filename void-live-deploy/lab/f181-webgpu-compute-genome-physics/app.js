const canvas = document.getElementById('c');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Tiny MLP genome: input 4 (local dx, dy, energy, orient_bias) -> 6 hidden -> 2 force
const N = 32; // agents
const GENOME_SIZE = 4*6 + 6 + 6*2 + 2; // Wxh + bh + Why + by
let genomes = Array.from({length:N}, () => Float32Array.from({length:GENOME_SIZE}, () => (Math.random()-0.5)*0.4));
let agents = Array.from({length:N}, () => ({x:Math.random()*W, y:Math.random()*H, vx:0, vy:0, energy:1, fitness:0}));

let orient = {beta:0, gamma:0};
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});

function mlpForward(g, x) {
  // simple matmul
  let h = new Array(6).fill(0);
  for(let i=0;i<6;i++) for(let j=0;j<4;j++) h[i] += g[i*4+j] * x[j];
  for(let i=0;i<6;i++) h[i] = Math.tanh(h[i] + g[24+i]);
  let y = [0,0];
  for(let i=0;i<2;i++) for(let j=0;j<6;j++) y[i] += g[30 + i*6 + j] * h[j];
  y[0] += g[42]; y[1] += g[43];
  return y;
}

let bestFitness = 0;
let champion = genomes[0].slice();

function update() {
  const bias = (orient.gamma || 0) * 0.01;
  for(let i=0;i<N;i++) {
    const a = agents[i];
    // simple local features
    const feat = [ (a.x - W/2)/W, (a.y - H/2)/H, a.energy, bias ];
    const f = mlpForward(genomes[i], feat);
    a.vx += f[0]*0.2; a.vy += f[1]*0.2;
    a.vx *= 0.95; a.vy *= 0.95;
    a.x += a.vx; a.y += a.vy;
    if(a.x<0||a.x>W) a.vx *= -0.8;
    if(a.y<0||a.y>H) a.vy *= -0.8;
    a.x = Math.max(0, Math.min(W, a.x));
    a.y = Math.max(0, Math.min(H, a.y));
    a.energy *= 0.995;
    a.fitness = a.energy + Math.hypot(a.vx, a.vy)*0.1;
    if(a.fitness > bestFitness) {
      bestFitness = a.fitness;
      champion = genomes[i].slice();
    }
  }
}

function transfer() {
  // mutate champion to worst half
  const sorted = agents.map((a,i)=>({i,f:a.fitness})).sort((a,b)=>b.f-a.f);
  for(let k=N/2; k<N; k++) {
    const idx = sorted[k].i;
    for(let j=0;j<GENOME_SIZE;j++) {
      genomes[idx][j] = champion[j] + (Math.random()-0.5)*0.1;
    }
    agents[idx].energy = 0.5;
  }
  status.textContent = `Transferred. Best: ${bestFitness.toFixed(2)}`;
}

function render() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0,0,W,H);
  for(let i=0;i<N;i++) {
    const a = agents[i];
    ctx.fillStyle = `hsl(${120 + a.fitness*40}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 4 + a.energy*2, 0, Math.PI*2);
    ctx.fill();
  }
}

// IndexedDB
let db;
const req = indexedDB.open('f181-genomes', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('champions');
req.onsuccess = e => { db = e.target.result; load(); };

function seal() {
  if(!db) return;
  const tx = db.transaction('champions','readwrite');
  tx.objectStore('champions').put({w: Array.from(champion), t: Date.now()}, 'best');
  status.textContent = 'Sealed champion to IndexedDB';
}

function load() {
  if(!db) return;
  const tx = db.transaction('champions');
  const r = tx.objectStore('champions').get('best');
  r.onsuccess = () => {
    if(r.result) {
      champion = new Float32Array(r.result.w);
      status.textContent = 'Loaded sealed genome';
    }
  };
}

document.getElementById('seal').onclick = seal;
document.getElementById('transfer').onclick = transfer;
document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.x = Math.random()*W; a.y = Math.random()*H; a.energy=1; });
};

function loop() {
  update();
  if(Math.random()<0.02) transfer();
  render();
  requestAnimationFrame(loop);
}
status.textContent = 'Running (Canvas2D baseline; WebGPU kernel sketched)';
loop();

// WebGPU sketch comment for true compute lift:
// const adapter = await navigator.gpu.requestAdapter();
// const device = await adapter.requestDevice();
// storage buffers for positions, velocities, genomes
// compute shader evaluates MLP per agent and integrates physics
