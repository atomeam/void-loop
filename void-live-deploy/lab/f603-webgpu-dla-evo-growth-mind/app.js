const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 160; // lattice
const cell = () => ({ occupied: 0, age: 0 });
let grid = Array.from({length: N*N}, cell);
let walkers = [];
const MAX_WALKERS = 800;

function idx(x,y){ return ((y|0)+N)%N * N + ((x|0)+N)%N; }
function seedAt(sx,sy){
  const gx = Math.floor(sx / W * N), gy = Math.floor(sy / H * N);
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
    if(dx*dx+dy*dy<6) grid[idx(gx+dx,gy+dy)].occupied = 1;
  }
}

// Evolutionary genomes: [diffRate, stickProb, noise]
let pop = Array.from({length:8}, () => ({
  g: [0.4+Math.random()*0.5, 0.3+Math.random()*0.6, 0.1+Math.random()*0.4],
  fit: 0
}));
let best = pop[0];

function mutate(g){ return g.map(v => Math.max(0.05, Math.min(0.95, v + (Math.random()-0.5)*0.12))); }

function stepEvo(){
  // simple fitness: occupied count * entropy proxy
  let occ=0, bins=0;
  for(let i=0;i<grid.length;i++) if(grid[i].occupied){ occ++; bins++; }
  const ent = Math.min(1, occ / (N*N*0.15));
  document.documentElement.style.setProperty('--entropy', ent.toFixed(3));
  document.documentElement.style.setProperty('--size', (occ/(N*N)).toFixed(3));
  document.documentElement.style.setProperty('--hue', (180 + ent*140)|0);
  pop.forEach(p => p.fit = ent * (0.5 + p.g[1]));
  pop.sort((a,b)=>b.fit-a.fit);
  best = pop[0];
  // replace worst with mutant of best
  pop[7] = { g: mutate(best.g), fit: 0 };
  status.textContent = `Best stick:${best.g[1].toFixed(2)} fit:${best.fit.toFixed(2)} occ:${occ}`;
}

function spawnWalker(){
  if(walkers.length >= MAX_WALKERS) return;
  walkers.push({
    x: Math.random()*N, y: Math.random()*N,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2
  });
}

function update(){
  const [diff, stick, noise] = best.g;
  // inject a few walkers
  if(Math.random() < 0.4) spawnWalker();
  // move walkers
  for(let i=walkers.length-1;i>=0;i--){
    const w = walkers[i];
    w.x += w.vx * diff + (Math.random()-0.5)*noise;
    w.y += w.vy * diff + (Math.random()-0.5)*noise;
    w.x = (w.x + N) % N; w.y = (w.y + N) % N;
    // check neighbors for stick
    let stuck = false;
    for(let dy=-1;dy<=1 && !stuck;dy++) for(let dx=-1;dx<=1;dx++){
      if(dx===0 && dy===0) continue;
      if(grid[idx(w.x+dx, w.y+dy)].occupied && Math.random() < stick){
        grid[idx(w.x, w.y)].occupied = 1;
        grid[idx(w.x, w.y)].age = 1;
        stuck = true;
      }
    }
    if(stuck) walkers.splice(i,1);
  }
  // age decay visual
  for(let i=0;i<grid.length;i++) if(grid[i].age>0) grid[i].age *= 0.98;
  stepEvo();
}

function draw(){
  ctx.fillStyle = 'rgba(10,12,18,0.25)';
  ctx.fillRect(0,0,W,H);
  const s = W/N;
  ctx.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')},70%,60%,0.9)`;
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const c = grid[idx(x,y)];
    if(c.occupied){
      ctx.globalAlpha = 0.4 + c.age*0.6;
      ctx.fillRect(x*s, y*s, s+0.5, s+0.5);
    }
  }
  ctx.globalAlpha = 1;
  // walkers
  ctx.fillStyle = '#fff';
  walkers.forEach(w => ctx.fillRect(w.x*s, w.y*s, 2, 2));
}

// DOM seeds
const seeds = [];
function makeSeed(i){
  const el = document.createElement('div');
  el.className = 'seed';
  el.textContent = 'seed '+i;
  el.style.left = (20+i*18)+'%';
  el.style.top = (30+ (i%3)*15)+'%';
  document.body.appendChild(el);
  let drag=false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => { drag=true; ox=e.offsetX; oy=e.offsetY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if(!drag) return;
    el.style.left = (e.clientX - ox)+'px';
    el.style.top = (e.clientY - oy)+'px';
    seedAt(e.clientX, e.clientY);
  });
  el.addEventListener('pointerup', () => drag=false);
  el.addEventListener('click', () => { best.fit += 0.05; status.textContent += ' +reward'; });
  seeds.push(el);
}
for(let i=0;i<5;i++) makeSeed(i);

// pointer seed
canvas.addEventListener('pointermove', e => { if(e.buttons) seedAt(e.clientX, e.clientY); });
canvas.addEventListener('click', e => seedAt(e.clientX, e.clientY));

// Seal / IndexedDB / Broadcast
const bc = new BroadcastChannel('f603-genome');
const dbName = 'verse-f603';
function seal(){
  const data = { g: best.g, fit: best.fit, t: Date.now() };
  const hash = Array.from(new Uint8Array(new TextEncoder().encode(JSON.stringify(data.g)))).reduce((a,b)=>a+b,0).toString(16);
  data.hash = hash;
  bc.postMessage(data);
  const req = indexedDB.open(dbName,1);
  req.onupgradeneeded = () => req.result.createObjectStore('genomes');
  req.onsuccess = () => {
    const tx = req.result.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'best');
    status.textContent = 'Sealed '+hash.slice(0,6);
  };
}
function restore(){
  const req = indexedDB.open(dbName,1);
  req.onsuccess = () => {
    const tx = req.result.transaction('genomes','readonly');
    const g = tx.objectStore('genomes').get('best');
    g.onsuccess = () => { if(g.result){ best.g = g.result.g; status.textContent='Restored'; } };
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { grid=Array.from({length:N*N},cell); walkers=[]; status.textContent='Reset'; };
bc.onmessage = e => { if(e.data && e.data.fit > best.fit){ best.g = e.data.g; status.textContent='Adopted peer genome'; } };

// loop
function loop(){ update(); draw(); requestAnimationFrame(loop); }
loop();
// initial seed
seedAt(W/2, H/2);
