const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W=0, H=0, grid=64;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

// Simple density + velocity field (fallback LBM-like advection)
let dens = new Float32Array(grid*grid);
let vx = new Float32Array(grid*grid);
let vy = new Float32Array(grid*grid);
function idx(x,y){ return ((y%grid+grid)%grid)*grid + ((x%grid+grid)%grid); }

// Agents
const N = 12;
let agents = [];
function randW(){ return (Math.random()-0.5)*0.8; }
function makeAgent() {
  return {
    x: Math.random()*W, y: Math.random()*H,
    vx:0, vy:0, energy: 50,
    w: [randW(),randW(),randW(),randW(), randW(),randW(),randW(),randW(), randW(),randW()] // 4->4->2 approx
  };
}
for(let i=0;i<N;i++) agents.push(makeAgent());

// Tiny MLP forward: 4 in -> 4 hidden -> 2 out
function mlp(a, ins) {
  const h = [0,0,0,0];
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) h[i] += ins[j] * a.w[j*4 + i];
  for(let i=0;i<4;i++) h[i] = Math.tanh(h[i]);
  const out = [0,0];
  for(let i=0;i<2;i++) for(let j=0;j<4;j++) out[i] += h[j] * a.w[16 + j*2 + i];
  return out;
}

function sample(x,y, field) {
  const gx = Math.floor(x / W * grid);
  const gy = Math.floor(y / H * grid);
  return field[idx(gx,gy)] || 0;
}

function stepAgents() {
  for(const a of agents) {
    const ins = [
      sample(a.x, a.y, vx)*2,
      sample(a.x, a.y, vy)*2,
      sample(a.x, a.y, dens)*0.5,
      a.energy * 0.01
    ];
    const thr = mlp(a, ins);
    a.vx += thr[0] * 0.15;
    a.vy += thr[1] * 0.15;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = (a.x + a.vx + W) % W;
    a.y = (a.y + a.vy + H) % H;
    // consume density
    const d = sample(a.x, a.y, dens);
    if (d > 0.1) {
      a.energy += d * 0.8;
      // reduce local dens (simple)
      const gx = Math.floor(a.x / W * grid);
      const gy = Math.floor(a.y / H * grid);
      dens[idx(gx,gy)] *= 0.7;
    }
    a.energy *= 0.995;
    if (a.energy < 5) { a.energy = 20; a.x = Math.random()*W; a.y=Math.random()*H; } // respawn weak
  }
  // simple evolve: mutate worst occasionally
  if (Math.random() < 0.02) {
    agents.sort((p,q)=>q.energy-p.energy);
    const best = agents[0].w.slice();
    const worst = agents[agents.length-1];
    worst.w = best.map(v => v + (Math.random()-0.5)*0.3);
    worst.energy = 30;
  }
}

function stepField() {
  // simple diffusion + advection-ish
  const nd = dens.slice(), nvx=vx.slice(), nvy=vy.slice();
  for(let y=0;y<grid;y++) for(let x=0;x<grid;x++) {
    const i = idx(x,y);
    let d=0, sx=0, sy=0, c=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const j = idx(x+dx,y+dy);
      d += dens[j]; sx += vx[j]; sy += vy[j]; c++;
    }
    nd[i] = d/c * 0.98;
    nvx[i] = sx/c * 0.95;
    nvy[i] = sy/c * 0.95;
  }
  dens = nd; vx = nvx; vy = nvy;
  // decay
  for(let i=0;i<dens.length;i++) { dens[i]*=0.99; vx[i]*=0.98; vy[i]*=0.98; }
}

let mouseDown=false, mx=0, my=0;
canvas.addEventListener('pointerdown', e=>{ mouseDown=true; mx=e.clientX; my=e.clientY; });
addEventListener('pointerup', ()=> mouseDown=false);
addEventListener('pointermove', e=>{
  if (!mouseDown) return;
  const dx = e.clientX - mx, dy = e.clientY - my;
  mx = e.clientX; my = e.clientY;
  const gx = Math.floor(e.clientX / W * grid);
  const gy = Math.floor(e.clientY / H * grid);
  for(let r=0;r<3;r++) for(let a=0;a<8;a++) {
    const ix = (gx + Math.round(Math.cos(a)*r) + grid)%grid;
    const iy = (gy + Math.round(Math.sin(a)*r) + grid)%grid;
    const i = idx(ix,iy);
    dens[i] += 0.4;
    vx[i] += dx * 0.02;
    vy[i] += dy * 0.02;
  }
});

async function sealGenome() {
  agents.sort((p,q)=>q.energy-p.energy);
  const best = agents[0].w;
  const data = JSON.stringify(best);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db = await openDB();
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({hash, weights:best, energy:agents[0].energy, t:Date.now()});
  status.textContent = `Sealed ${hash.slice(0,8)}… energy ${agents[0].energy.toFixed(0)}`;
}
function openDB() {
  return new Promise((res,rej)=>{
    const r = indexedDB.open('verse-f200',1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('genomes',{keyPath:'hash'});
    r.onsuccess = ()=> res(r.result);
    r.onerror = rej;
  });
}
async function loadGenome() {
  const db = await openDB();
  const tx = db.transaction('genomes');
  const store = tx.objectStore('genomes');
  const req = store.getAll();
  req.onsuccess = ()=> {
    const list = req.result;
    if (!list.length) { status.textContent='No sealed genomes'; return; }
    const g = list[list.length-1];
    agents[0].w = g.weights;
    status.textContent = `Loaded ${g.hash.slice(0,8)}…`;
  };
}
document.getElementById('seal').onclick = sealGenome;
document.getElementById('load').onclick = loadGenome;
document.getElementById('reset').onclick = ()=>{ dens.fill(0); vx.fill(0); vy.fill(0); agents.forEach(a=>{a.x=Math.random()*W;a.y=Math.random()*H;a.energy=40;}); status.textContent='Reset'; };

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  // field as faint dots
  ctx.fillStyle = 'rgba(80,120,255,0.35)';
  for(let y=0;y<grid;y++) for(let x=0;x<grid;x++) {
    const d = dens[idx(x,y)];
    if (d > 0.05) {
      const px = x / grid * W, py = y / grid * H;
      ctx.fillRect(px, py, W/grid, H/grid);
    }
  }
  // agents
  for(const a of agents) {
    const s = 4 + Math.min(12, a.energy*0.15);
    ctx.fillStyle = a.energy > 60 ? '#7f7' : a.energy > 30 ? '#ff7' : '#f77';
    ctx.beginPath();
    ctx.arc(a.x, a.y, s, 0, Math.PI*2);
    ctx.fill();
    // velocity line
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + a.vx*8, a.y + a.vy*8);
    ctx.stroke();
  }
  const bestE = Math.max(...agents.map(a=>a.energy));
  status.textContent = `Agents: ${N} | Best energy: ${bestE.toFixed(0)} | Drag to stir fluid`;
}

function loop() {
  stepField();
  stepAgents();
  draw();
  requestAnimationFrame(loop);
}
status.textContent = 'Ready — drag to inject, seal best swimmer genome';
loop();
