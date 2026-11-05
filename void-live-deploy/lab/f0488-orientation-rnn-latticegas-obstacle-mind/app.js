const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const sealBtn = document.getElementById('seal');
const logEl = document.getElementById('log');
let W=96, H=64, scale=8;
function resize() {
  cv.width = W*scale; cv.height = H*scale;
  cv.style.width = '100vw'; cv.style.height = '100vh';
}
resize(); window.onresize = resize;

// Lattice: Uint8Array, bits 0-3 for N E S W presence
let lattice = new Uint8Array(W*H);
let obs = new Uint8Array(W*H); // obstacle mask
function idx(x,y){ return ((y+H)%H)*W + ((x+W)%W); }

// Simple RNN: input 8, hidden 12, output 4
const Nin=8, Nh=12, Nout=4;
let Whh = new Float32Array(Nh*Nh); // hidden recurrent
let Wxh = new Float32Array(Nin*Nh);
let Why = new Float32Array(Nh*Nout);
let bh = new Float32Array(Nh);
let by = new Float32Array(Nout);
let h = new Float32Array(Nh);
function randn(){ return (Math.random()-0.5)*0.2; }
function initRNN(){
  for(let i=0;i<Whh.length;i++) Whh[i]=randn();
  for(let i=0;i<Wxh.length;i++) Wxh[i]=randn();
  for(let i=0;i<Why.length;i++) Why[i]=randn();
  h.fill(0);
}
initRNN();

function rnnForward(inp){
  // h = tanh(Whh h + Wxh x + bh)
  const newh = new Float32Array(Nh);
  for(let i=0;i<Nh;i++){
    let s = bh[i];
    for(let j=0;j<Nh;j++) s += Whh[i*Nh+j]*h[j];
    for(let j=0;j<Nin;j++) s += Wxh[i*Nin+j]*inp[j];
    newh[i] = Math.tanh(s);
  }
  h.set(newh);
  const out = new Float32Array(Nout);
  for(let i=0;i<Nout;i++){
    let s = by[i];
    for(let j=0;j<Nh;j++) s += Why[i*Nh+j]*h[j];
    out[i] = Math.tanh(s);
  }
  return out;
}

// Orientation / pointer
let ori = {a:0,b:0,g:0}, lastOri={a:0,b:0,g:0};
let pvx=0, pvy=0, px=0, py=0;
window.addEventListener('deviceorientation', e=>{
  lastOri = {...ori};
  ori = {a:e.alpha||0, b:e.beta||0, g:e.gamma||0};
});
cv.addEventListener('pointermove', e=>{
  const r = cv.getBoundingClientRect();
  const nx = (e.clientX-r.left)/r.width;
  const ny = (e.clientY-r.top)/r.height;
  pvx = nx-px; pvy = ny-py; px=nx; py=ny;
});

// BroadcastChannel for multi-tab genome
const bc = new BroadcastChannel('f0488-genome');
let myFitness = 0;
bc.onmessage = ev=>{
  const g = ev.data;
  if(g && g.fitness > myFitness + 0.05){
    // adopt
    Whh.set(g.Whh); Wxh.set(g.Wxh); Why.set(g.Why);
    logEl.textContent = 'Adopted foreign genome fitness '+g.fitness.toFixed(2);
    // reseed lattice lightly
    for(let i=0;i<lattice.length;i++) if(Math.random()<0.1) lattice[i] = 1<<(Math.random()*4|0);
  }
};

// Drag cards
document.querySelectorAll('.card').forEach(card=>{
  let ox,oy;
  card.onpointerdown = e=>{ ox=e.clientX-card.offsetLeft; oy=e.clientY-card.offsetTop; card.setPointerCapture(e.pointerId); };
  card.onpointermove = e=>{ if(e.buttons){ card.style.left=(e.clientX-ox)+'px'; card.style.top=(e.clientY-oy)+'px'; } };
});

function rasterObstacles(){
  obs.fill(0);
  const r = cv.getBoundingClientRect();
  document.querySelectorAll('.card').forEach(card=>{
    const cr = card.getBoundingClientRect();
    const x0 = Math.floor(((cr.left-r.left)/r.width)*W);
    const y0 = Math.floor(((cr.top-r.top)/r.height)*H);
    const x1 = Math.ceil(((cr.right-r.left)/r.width)*W);
    const y1 = Math.ceil(((cr.bottom-r.top)/r.height)*H);
    for(let y=Math.max(0,y0); y<Math.min(H,y1); y++)
      for(let x=Math.max(0,x0); x<Math.min(W,x1); x++)
        obs[idx(x,y)] = 1;
  });
}

function stepLattice(bias){
  const next = new Uint8Array(W*H);
  // stream
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i = idx(x,y);
    const c = lattice[i];
    if(c&1) next[idx(x,y-1)] |= 1; // N
    if(c&2) next[idx(x+1,y)] |= 2; // E
    if(c&4) next[idx(x,y+1)] |= 4; // S
    if(c&8) next[idx(x-1,y)] |= 8; // W
  }
  // collisions + obstacles + bias injection
  const collBias = (bias[0]+1)*0.3;
  for(let i=0;i<next.length;i++){
    if(obs[i]){ next[i]=0; continue; }
    let c = next[i];
    // simple 2-particle collision scatter
    if((c&3)===3 && Math.random()<0.5+collBias*0.5){ c = (c&~3)|12; } // NE -> SW etc rough
    if(Math.random()<bias[1]*0.02) c |= 1<<(Math.random()*4|0); // inject
    next[i] = c & 15;
  }
  lattice = next;
}

function render(){
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,cv.width,cv.height);
  ctx.fillStyle = '#66aaff';
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(lattice[idx(x,y)]) ctx.fillRect(x*scale, y*scale, scale-1, scale-1);
    if(obs[idx(x,y)]){ ctx.fillStyle='#334466'; ctx.fillRect(x*scale,y*scale,scale,scale); ctx.fillStyle='#66aaff'; }
  }
}

let frame=0, residual=1;
function loop(){
  rasterObstacles();
  const da = (ori.a-lastOri.a)/180, db=(ori.b-lastOri.b)/90, dg=(ori.g-lastOri.g)/90;
  // reduced stats: density, mean vel rough
  let dens=0, vx=0, vy=0;
  for(let i=0;i<lattice.length;i++){
    const c=lattice[i];
    dens += c?1:0;
    if(c&1) vy--; if(c&4) vy++; if(c&2) vx++; if(c&8) vx--;
  }
  dens /= (W*H);
  const inp = new Float32Array([da, db, dg, pvx*10, pvy*10, dens, vx/W, vy/H]);
  const out = rnnForward(inp);
  stepLattice(out);
  // fitness ~ low variance (coherence)
  residual = Math.abs(out[0]) + Math.abs(vx)/100;
  myFitness = 1/(1+residual);
  status.textContent = `dens ${(dens*100).toFixed(1)}% residual ${residual.toFixed(2)} fit ${myFitness.toFixed(2)}`;
  sealBtn.disabled = residual > 0.4;
  render();
  frame++;
  requestAnimationFrame(loop);
}
loop();

sealBtn.onclick = ()=>{
  const genome = {
    Whh: Array.from(Whh), Wxh: Array.from(Wxh), Why: Array.from(Why),
    fitness: myFitness, hash: Math.random().toString(36).slice(2)
  };
  bc.postMessage(genome);
  // IndexedDB
  const req = indexedDB.open('f0488',1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(genome, 'own');
    logEl.textContent = 'Sealed & broadcast fitness '+myFitness.toFixed(2);
  };
};

// load previous
indexedDB.open('f0488',1).onsuccess = e => {
  const db = e.target.result;
  if(!db.objectStoreNames.contains('genomes')) return;
  const tx = db.transaction('genomes','readonly');
  tx.objectStore('genomes').get('own').onsuccess = ev => {
    if(ev.target.result){
      const g = ev.target.result;
      Whh.set(g.Whh); Wxh.set(g.Wxh); Why.set(g.Why);
      logEl.textContent = 'Restored sealed genome';
    }
  };
};
