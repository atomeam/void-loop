const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W=0, H=0, grid=48, cell;
let lattice = new Float32Array(grid*grid*4); // RGBA channels
let next = new Float32Array(lattice.length);
let micOn=false, analyser, freqData, timeData;
let pointer = {x:0,y:0,vx:0,vy:0};
let cards = [];
let entropy = 0;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cell = Math.min(W,H)/grid;
}
addEventListener('resize', resize); resize();

// Init lattice with noise
function initLattice() {
  for(let i=0;i<lattice.length;i++) lattice[i] = Math.random()*0.3;
}
initLattice();

// Simple NCA-like update: local growth/decay with neighbor influence
function stepNCA(mod = 0) {
  const growth = 0.08 + mod*0.04;
  const decay = 0.06 - mod*0.02;
  for(let y=0;y<grid;y++) for(let x=0;x<grid;x++) {
    const i = (y*grid+x)*4;
    let sum=0, count=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      if(dx===0&&dy===0) continue;
      const nx=(x+dx+grid)%grid, ny=(y+dy+grid)%grid;
      const ni=(ny*grid+nx)*4;
      sum += lattice[ni]; count++;
    }
    const neigh = sum/count;
    const self = lattice[i];
    let v = self + growth*neigh*(1-self) - decay*self*self;
    v = Math.max(0, Math.min(1, v));
    next[i] = v;
    next[i+1] = v*0.6;
    next[i+2] = v*0.3 + neigh*0.2;
    next[i+3] = 1;
  }
  [lattice, next] = [next, lattice];
  // entropy
  let e=0, m=0;
  for(let i=0;i<lattice.length;i+=4) { m+=lattice[i]; e -= lattice[i]*Math.log(lattice[i]+1e-6); }
  entropy = e / (grid*grid);
  document.documentElement.style.setProperty('--hue', 180 + entropy*120);
  document.documentElement.style.setProperty('--blur', (entropy*4)+'px');
}

// Decision tree agent (pure JS, depth ~3)
function decide(features) {
  // features: [centroid, flux, speed, mean, entropy]
  const [c,f,s,m,e] = features;
  if (e > 0.4) {
    if (f > 0.3) return {mod: 0.5, seed:true};
    return {mod: 0.2, seed:false};
  } else {
    if (s > 0.1) return {mod: -0.3, seed:true};
    return {mod: 0.1, seed:false};
  }
}

function injectSeed(nx, ny, strength=0.8) {
  const x = Math.floor(nx*grid), y=Math.floor(ny*grid);
  if(x<0||x>=grid||y<0||y>=grid) return;
  const i=(y*grid+x)*4;
  lattice[i] = Math.min(1, lattice[i]+strength);
}

// Cards
function spawnCard(x,y, text='weaver') {
  if(cards.length>=6) return;
  const el = document.createElement('div');
  el.className='weaver';
  el.contentEditable=true;
  el.textContent=text;
  el.style.left = (x*W-70)+'px';
  el.style.top = (y*H-30)+'px';
  el.dataset.nx = x; el.dataset.ny = y;
  let drag=false, ox=0,oy=0;
  el.addEventListener('pointerdown', e=>{ drag=true; ox=e.offsetX; oy=e.offsetY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e=>{
    if(!drag) return;
    el.style.left = (e.clientX-ox)+'px';
    el.style.top = (e.clientY-oy)+'px';
  });
  el.addEventListener('pointerup', e=>{
    drag=false;
    const nx = (parseFloat(el.style.left)+70)/W;
    const ny = (parseFloat(el.style.top)+30)/H;
    injectSeed(nx, ny, 0.6);
    el.dataset.nx=nx; el.dataset.ny=ny;
  });
  document.body.appendChild(el);
  cards.push(el);
}

// Mic
document.getElementById('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser(); analyser.fftSize=256;
    src.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
    micOn=true;
    status.textContent='Mic live · decision agent active';
  } catch(e) { status.textContent='Mic denied · pointer only'; }
};

// Pointer
canvas.addEventListener('pointermove', e=>{
  const nx=e.clientX/W, ny=e.clientY/H;
  pointer.vx = nx-pointer.x; pointer.vy=ny-pointer.y;
  pointer.x=nx; pointer.y=ny;
});
canvas.addEventListener('click', e=>{
  injectSeed(e.clientX/W, e.clientY/H, 0.9);
});

// Seal / Restore
const DB='f473-weaver', STORE='state';
function openDB() {
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>r.result.createObjectStore(STORE);
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
document.getElementById('seal').onclick = async () => {
  try {
    const db=await openDB();
    const tx=db.transaction(STORE,'readwrite');
    const cardData=cards.map(c=>({text:c.textContent, nx:c.dataset.nx, ny:c.dataset.ny}));
    tx.objectStore(STORE).put({lattice:Array.from(lattice), cards:cardData, entropy}, 'living');
    await tx.complete;
    status.textContent='Sealed to IndexedDB';
  } catch(e){ status.textContent='Seal failed: '+e.message; }
};
document.getElementById('restore').onclick = async () => {
  try {
    const db=await openDB();
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).get('living');
    req.onsuccess=()=>{
      const d=req.result;
      if(!d) return status.textContent='No seal found';
      lattice.set(d.lattice);
      cards.forEach(c=>c.remove()); cards=[];
      d.cards.forEach(c=>spawnCard(+c.nx,+c.ny,c.text));
      status.textContent='Restored living state';
    };
  } catch(e){ status.textContent='Restore failed'; }
};

// Main loop
function loop() {
  // features
  let centroid=0, flux=0;
  if(micOn && analyser) {
    analyser.getByteFrequencyData(freqData);
    let sum=0, wsum=0;
    for(let i=0;i<freqData.length;i++){ sum+=freqData[i]; wsum+=freqData[i]*i; }
    centroid = sum? wsum/sum/freqData.length : 0;
    flux = freqData.reduce((a,b)=>a+b,0)/freqData.length/255;
  }
  const mean = lattice.reduce((a,b,i)=>i%4===0?a+b:a,0)/(grid*grid);
  const speed = Math.hypot(pointer.vx, pointer.vy);
  const feats = [centroid, flux, speed, mean, entropy];
  const decision = decide(feats);
  stepNCA(decision.mod);
  if(decision.seed && Math.random()<0.1) {
    const hx=Math.random(), hy=Math.random();
    injectSeed(hx,hy,0.4);
    if(mean>0.4 && cards.length<4) spawnCard(hx,hy,'emergent');
  }
  // render
  ctx.fillStyle='#0a0a12';
  ctx.fillRect(0,0,W,H);
  for(let y=0;y<grid;y++) for(let x=0;x<grid;x++) {
    const i=(y*grid+x)*4;
    const v=lattice[i];
    if(v<0.05) continue;
    ctx.fillStyle=`hsla(${180+v*80},80%,${30+v*40}%,${0.4+v*0.6})`;
    ctx.fillRect(x*cell, y*cell, cell-1, cell-1);
  }
  // spawn from high density occasionally
  if(Math.random()<0.02) {
    let maxv=0, mx=0,my=0;
    for(let y=0;y<grid;y++) for(let x=0;x<grid;x++) {
      const v=lattice[(y*grid+x)*4];
      if(v>maxv){maxv=v; mx=x/grid; my=y/grid;}
    }
    if(maxv>0.7 && cards.length<5) spawnCard(mx,my,'hotspot');
  }
  requestAnimationFrame(loop);
}
loop();
status.textContent='Verse · Acoustic NCA Weaver online';
